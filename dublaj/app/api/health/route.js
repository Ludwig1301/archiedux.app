import { connection } from "next/server";
import { config } from "../../../lib/packs/server/config.js";
import { hasBinary, run } from "../../../lib/packs/server/exec.js";
import { noStore } from "../../../lib/packs/server/http.js";

/** GET /api/health → which pipeline backends are available on this server. */
export async function GET() {
  await connection(); // always run at request time
  const demucs = run(config.python, ["-c", "import demucs"], { timeoutMs: 30_000 }).then(
    () => true,
    () => false,
  );
  const [ffmpeg, ffprobe, ytdlp, whisper, demucsOk] = await Promise.all([
    hasBinary(config.ffmpeg, ["-version"]),
    hasBinary(config.ffprobe, ["-version"]),
    hasBinary(config.ytdlp),
    hasBinary(config.whisperCli, ["--help"]),
    demucs,
  ]);
  return noStore({
    ffmpeg,
    ffprobe,
    ytdlp,
    separators: { order: config.separatorOrder, demucs: demucsOk, replicate: Boolean(config.replicateToken), ffmpeg },
    transcribers: {
      order: config.transcriberOrder,
      openai: Boolean(config.openaiKey),
      local: whisper,
      silence: ffmpeg,
    },
  });
}
