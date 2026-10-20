import fs from "node:fs/promises";
import path from "node:path";

import { config } from "../../../../../lib/packs/server/config.js";
import { jsonError } from "../../../../../lib/packs/server/http.js";
import { isValidPackId, readPack } from "../../../../../lib/packs/server/packs.js";
import { makeRenderDir, renderDub } from "../../../../../lib/packs/server/render.js";

const g = globalThis;
const renders = (g.__dubRenders ??= { running: 0 });
const MAX_PARALLEL_RENDERS = 2;

/**
 * POST /api/packs/:packId/render  (multipart)
 *   meta: JSON { takes: [{ lineId, startAt, gain }], options: { backgroundVolume, enhanceVoice, fillOriginal } }
 *   line_<lineId>: recorded audio blob (webm / ogg / mp4)
 * → final_dub.mp4 (attachment)
 */
export async function POST(req, ctx) {
  const { packId } = await ctx.params;
  if (!isValidPackId(packId)) return jsonError(400, "Geçersiz paket.");
  const pack = await readPack(packId);
  if (!pack) return jsonError(404, "Paket bulunamadı.");
  if (Number(req.headers.get("content-length") || 0) > config.maxRenderUploadBytes)
    return jsonError(413, "Kayıtlar çok büyük.");
  if (renders.running >= MAX_PARALLEL_RENDERS) return jsonError(429, "Sunucu meşgul, birkaç saniye sonra tekrar dene.");

  let form;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "Form verisi okunamadı.");
  }

  let meta;

  try {
    meta = JSON.parse(String(form.get("meta") || "{}"));
  } catch {
    return jsonError(400, "meta JSON geçersiz.");
  }

  renders.running++;
  const dir = await makeRenderDir();
  try {
    const takes = [];
    for (const t of (meta.takes ?? []).slice(0, 400)) {
      const lineId = Number(t.lineId);
      const startAt = Number(t.startAt);
      if (!Number.isInteger(lineId) || !Number.isFinite(startAt)) continue;
      const blob = form.get(`line_${lineId}`);
      if (!(blob instanceof File) || blob.size === 0) continue;
      const file = path.join(dir, `in_${lineId}.bin`);
      await fs.writeFile(file, Buffer.from(await blob.arrayBuffer()));
      takes.push({ lineId, startAt, gain: Number(t.gain) || 1, file });
    }
    const out = await renderDub(
      pack,
      takes,
      {
        backgroundVolume: Number.isFinite(Number(meta.options?.backgroundVolume))
          ? Number(meta.options?.backgroundVolume)
          : 1,
        enhanceVoice: meta.options?.enhanceVoice !== false,
        fillOriginal: meta.options?.fillOriginal === true,
      },
      dir,
    );
    const data = await fs.readFile(out);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(data.length),
        "Content-Disposition": `attachment; filename="${packId}-dub.mp4"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error(`[render:${packId}]`, err);
    return jsonError(500, "Video oluşturulamadı: " + (err.message || "").split("\n")[0]);
  } finally {
    renders.running--;
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
