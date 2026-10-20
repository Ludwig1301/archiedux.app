import { jsonError, noStore } from "../../../../lib/packs/server/http.js";
import { parseYouTubeUrl, youtubeInfo } from "../../../../lib/packs/server/ingest.js";

/** GET /api/youtube/info?url=… → { id, title, duration, thumbnail } (used to size the range slider). */
export async function GET(req) {
  const url = parseYouTubeUrl(req.nextUrl.searchParams.get("url") || "");
  if (!url) return jsonError(400, "Geçerli bir YouTube bağlantısı değil.");
  try {
    return noStore(await youtubeInfo(url));
  } catch (err) {
    const msg = err.message || "";
    const hint = /not a bot|Sign in/i.test(msg) ? " (Sunucuda YTDLP_COOKIES ayarı gerekebilir.)" : "";
    return jsonError(502, "Video bilgisi alınamadı." + hint);
  }
}
