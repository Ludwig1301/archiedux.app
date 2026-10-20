import { config } from "../../../../lib/packs/server/config.js";
import { jsonError, noStore } from "../../../../lib/packs/server/http.js";
import {
  canEdit,
  deletePack,
  isAdmin,
  isValidPackId,
  publicMeta,
  readMeta,
  readPack,
  readStatus,
  sanitizePack,
  updateMeta,
  ValidationError,
  writePack,
} from "../../../../lib/packs/server/packs.js";
import { isJobAlive } from "../../../../lib/packs/server/pipeline.js";

export async function GET(req, ctx) {
  const { packId } = await ctx.params;
  if (!isValidPackId(packId)) return jsonError(400, "Geçersiz paket.");
  const [pack, meta, status] = await Promise.all([readPack(packId), readMeta(packId), readStatus(packId)]);
  if (!meta) return jsonError(404, "Paket bulunamadı.");
  return noStore({
    pack,
    meta: publicMeta(meta),
    status,
    jobAlive: isJobAlive(packId),
    canEdit: canEdit(req, meta),
    canPublish: canEdit(req, meta) && (!config.publishRequiresAdmin || isAdmin(req)),
  });
}

/** PUT { pack, status?: "draft" | "published" } — saves editor changes. */
export async function PUT(req, ctx) {
  const { packId } = await ctx.params;
  if (!isValidPackId(packId)) return jsonError(400, "Geçersiz paket.");
  const [existing, meta] = await Promise.all([readPack(packId), readMeta(packId)]);
  if (!existing || !meta) return jsonError(404, "Paket bulunamadı.");
  if (!canEdit(req, meta)) return jsonError(403, "Bu paketi düzenleme yetkin yok.");

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Geçersiz JSON.");
  }

  try {
    const pack = body.pack ? sanitizePack(body.pack, existing) : existing;
    let status = meta.status;
    if (body.status === "published" || body.status === "draft") {
      if (body.status === "published" && config.publishRequiresAdmin && !isAdmin(req)) {
        return jsonError(403, "Yayınlamak için yönetici yetkisi gerekli.");
      }
      if (body.status === "published" && !pack.lines.length)
        return jsonError(400, "Yayınlamak için en az bir replik gerekli.");
      status = body.status;
    }
    await writePack(pack);
    const nextMeta = await updateMeta(packId, { status });
    return noStore({ pack, meta: publicMeta(nextMeta) });
  } catch (err) {
    if (err instanceof ValidationError) return jsonError(400, err.message);
    throw err;
  }
}

export async function DELETE(req, ctx) {
  const { packId } = await ctx.params;
  if (!isValidPackId(packId)) return jsonError(400, "Geçersiz paket.");
  const meta = await readMeta(packId);
  if (!meta) return jsonError(404, "Paket bulunamadı.");
  if (!canEdit(req, meta)) return jsonError(403, "Bu paketi silme yetkin yok.");
  if (isJobAlive(packId)) return jsonError(409, "Paket hâlâ işleniyor, bitince silebilirsin.");
  await deletePack(packId);
  return noStore({ ok: true });
}
