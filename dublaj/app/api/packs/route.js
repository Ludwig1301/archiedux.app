import fs from "node:fs/promises";
import path from "node:path";

import { CATEGORIES, MAX_SEGMENT_SECONDS } from "../../../lib/packs/types.js";
import { config } from "../../../lib/packs/server/config.js";
import { jsonError, noStore, parseTime } from "../../../lib/packs/server/http.js";
import { parseYouTubeUrl } from "../../../lib/packs/server/ingest.js";
import { probe } from "../../../lib/packs/server/media.js";
import {
  isAdmin,
  isValidPackId,
  listPacks,
  newEditKey,
  newPackId,
  packDir,
  publicMeta,
  readMeta,
  readPack,
  writeMeta,
} from "../../../lib/packs/server/packs.js";
import { enqueue } from "../../../lib/packs/server/pipeline.js";

/** GET /api/packs            → published library
 *  GET /api/packs?ids=a,b    → specific packs (any status; used for "Paketlerim")
 *  GET /api/packs?all=1      → everything (admin only) */
export async function GET(req) {
  const ids = req.nextUrl.searchParams.get("ids");
  if (ids) {
    const list = ids.split(",").filter(isValidPackId).slice(0, 100);
    const items = await Promise.all(
      list.map(async (id) => {
        const [pack, meta] = await Promise.all([readPack(id), readMeta(id)]);
        return meta ? { pack, meta: publicMeta(meta) } : null;
      }),
    );
    return noStore({ packs: items.filter(Boolean) });
  }
  const all = req.nextUrl.searchParams.get("all") === "1" && isAdmin(req);
  const packs = await listPacks(all ? {} : { status: ["published"] });
  return noStore({ packs: packs.map((p) => ({ pack: p.pack, meta: publicMeta(p.meta) })) });
}

/** POST /api/packs (multipart) → starts the Dub Pack pipeline. */
export async function POST(req) {
  if (config.adminOnlyCreate && !isAdmin(req)) return jsonError(403, "Paket oluşturmak için yönetici yetkisi gerekli.");

  const len = Number(req.headers.get("content-length") || 0);
  if (len > config.maxUploadBytes + 1024 * 1024)
    return jsonError(413, `Dosya çok büyük (en fazla ${Math.round(config.maxUploadBytes / 1048576)} MB).`);

  let form;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "Form verisi okunamadı.");
  }

  const sourceType = String(form.get("sourceType") || "youtube");
  const title = String(form.get("title") || "")
    .trim()
    .slice(0, 120);
  const categoryRaw = String(form.get("category") || "Topluluk");
  const category = CATEGORIES.includes(categoryRaw) ? categoryRaw : "Topluluk";
  const start = parseTime(form.get("start")) ?? 0;
  let end = parseTime(form.get("end"));

  if (!title) return jsonError(400, "Paket başlığı gerekli.");
  if (start < 0) return jsonError(400, "Başlangıç zamanı geçersiz.");
  if (end === null) end = start + MAX_SEGMENT_SECONDS;
  if (end <= start + 0.5) return jsonError(400, "Bitiş, başlangıçtan en az 0.5 sn sonra olmalı.");
  if (end - start > MAX_SEGMENT_SECONDS + 0.01)
    return jsonError(400, `Bölüm en fazla ${MAX_SEGMENT_SECONDS} saniye olabilir.`);

  const packId = await newPackId(title);
  const dir = packDir(packId);
  const work = path.join(dir, "_work");
  await fs.mkdir(work, { recursive: true });

  const now = new Date().toISOString();
  const { key: editKey, hash: editKeyHash } = newEditKey();

  try {
    if (sourceType === "youtube") {
      const url = parseYouTubeUrl(String(form.get("youtubeUrl") || ""));
      if (!url) throw new UserError("Geçerli bir YouTube bağlantısı gir (youtube.com veya youtu.be).");
      const meta = {
        packId,
        status: "processing",
        createdAt: now,
        updatedAt: now,
        source: { type: "youtube", url, start, end },
        editKeyHash,
      };
      await writeMeta(meta);
      await enqueue({ packId, title, category, source: meta.source });
    } else if (sourceType === "upload") {
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) throw new UserError("Bir MP4 / video dosyası seç.");
      if (file.size > config.maxUploadBytes) throw new UserError("Dosya çok büyük.");
      const ext =
        path
          .extname(file.name)
          .toLowerCase()
          .match(/^\.[a-z0-9]{1,5}$/)?.[0] || ".mp4";
      const uploadPath = path.join(work, `upload${ext}`);
      await fs.writeFile(uploadPath, Buffer.from(await file.arrayBuffer()));
      let info;
      try {
        info = await probe(uploadPath);
      } catch {
        throw new UserError("Dosya okunamadı — geçerli bir video yükle.");
      }
      if (!info.hasVideo) throw new UserError("Dosyada video akışı yok.");
      if (info.duration && start >= info.duration) throw new UserError("Başlangıç zamanı video süresinden büyük.");
      const clampedEnd = info.duration ? Math.min(end, info.duration) : end;
      const meta = {
        packId,
        status: "processing",
        createdAt: now,
        updatedAt: now,
        source: { type: "upload", fileName: file.name.slice(0, 200), start, end: clampedEnd },
        editKeyHash,
      };
      await writeMeta(meta);
      await enqueue({ packId, title, category, source: meta.source, uploadPath });
    } else {
      throw new UserError("Bilinmeyen kaynak türü.");
    }
  } catch (err) {
    await fs.rm(dir, { recursive: true, force: true });
    if (err instanceof UserError) return jsonError(400, err.message);
    console.error(err);
    return jsonError(500, "Paket oluşturulamadı.");
  }

  return noStore({ packId, editKey }, { status: 202 });
}

class UserError extends Error {}
