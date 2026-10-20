import { jsonError, noStore } from "../../../../../lib/packs/server/http.js";
import { isValidPackId, readStatus } from "../../../../../lib/packs/server/packs.js";
import { isJobAlive } from "../../../../../lib/packs/server/pipeline.js";

export async function GET(_req, ctx) {
  const { packId } = await ctx.params;
  if (!isValidPackId(packId)) return jsonError(400, "Geçersiz paket.");
  const status = await readStatus(packId);
  if (!status) return jsonError(404, "Durum bulunamadı.");
  const alive = isJobAlive(packId);
  // A job that is neither finished nor known to this process was interrupted by a restart.
  if (!alive && status.stage !== "done" && status.stage !== "failed") {
    return noStore({
      ...status,
      stage: "failed",
      error: "İşlem yarıda kaldı (sunucu yeniden başlatılmış olabilir). Paketi yeniden oluştur.",
    });
  }
  return noStore(status);
}
