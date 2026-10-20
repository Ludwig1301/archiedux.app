import path from "node:path";

function list(value, fallback) {
  if (!value) return fallback;
  return value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const root = process.cwd();

export const config = {
  /** Where packs live on disk. Served at /packs/<packId>/<file> by a route handler. */
  packsDir: path.resolve(/*turbopackIgnore: true*/ root, process.env.PACKS_DIR || "storage/packs"),
  /** Scratch space for renders. */
  rendersDir: path.resolve(/*turbopackIgnore: true*/ root, process.env.RENDERS_DIR || "storage/renders"),

  ffmpeg: process.env.FFMPEG_PATH || "ffmpeg",
  ffprobe: process.env.FFPROBE_PATH || "ffprobe",
  ytdlp: process.env.YTDLP_PATH || "yt-dlp",
  /** Optional Netscape cookies.txt — servers often need it for YouTube's "confirm you're not a bot" check. */
  ytdlpCookies: process.env.YTDLP_COOKIES || "",
  /** Extra raw args (space-separated), e.g. "--extractor-args youtube:player_client=web". */
  ytdlpExtraArgs: (process.env.YTDLP_EXTRA_ARGS || "").split(" ").filter(Boolean),
  python: process.env.PYTHON_PATH || "python3",
  whisperCli: process.env.WHISPER_CLI || "whisper",

  /** Order in which stem separators are tried: demucs (local), replicate, ffmpeg (karaoke fallback). */
  separatorOrder: list(process.env.STEM_SEPARATOR_ORDER, ["demucs", "replicate", "ffmpeg"]),
  demucsModel: process.env.DEMUCS_MODEL || "htdemucs",
  demucsDevice: process.env.DEMUCS_DEVICE || "", // "cpu" | "cuda" | "" (auto)

  replicateToken: process.env.REPLICATE_API_TOKEN || "",
  replicateModel: process.env.REPLICATE_DEMUCS_MODEL || "ryan5453/demucs",
  replicateVersion: process.env.REPLICATE_DEMUCS_VERSION || "",
  replicateExtraInput: process.env.REPLICATE_DEMUCS_INPUT || "", // JSON merged into input

  /** Order in which transcribers are tried: openai, local (whisper CLI), silence (timestamps only). */
  transcriberOrder: list(process.env.TRANSCRIBER_ORDER, ["openai", "local", "silence"]),
  openaiKey: process.env.OPENAI_API_KEY || "",
  openaiBaseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
  openaiWhisperModel: process.env.OPENAI_WHISPER_MODEL || "whisper-1",
  localWhisperModel: process.env.WHISPER_MODEL || "small",

  maxConcurrentJobs: num(process.env.MAX_CONCURRENT_JOBS, 1),
  maxUploadBytes: num(process.env.MAX_UPLOAD_MB, 140) * 1024 * 1024,
  maxRenderUploadBytes: num(process.env.MAX_RENDER_UPLOAD_MB, 80) * 1024 * 1024,
  maxVideoHeight: num(process.env.MAX_VIDEO_HEIGHT, 720),

  /** Admin token (header `x-admin-token`): may edit / publish / delete any pack. Creators use their own edit key. */
  adminToken: process.env.DUBPACK_ADMIN_TOKEN || "",
  /** If "true", only admins (token) can create packs. */
  adminOnlyCreate: process.env.DUBPACK_ADMIN_ONLY_CREATE === "true",
  /** If "true", only admins can publish packs to the public library (creators can still dub their drafts). */
  publishRequiresAdmin: process.env.DUBPACK_PUBLISH_REQUIRES_ADMIN === "true",
};
