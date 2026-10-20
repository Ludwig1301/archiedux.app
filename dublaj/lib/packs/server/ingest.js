import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { run } from "./exec.js";
import { normalizeVideo } from "./media.js";

const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
]);

/** Accepts only YouTube URLs (yt-dlp supports 1000+ sites; we deliberately restrict it). */
export function parseYouTubeUrl(raw) {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!YT_HOSTS.has(u.hostname.toLowerCase())) return null;
    let id = null;
    if (u.hostname === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{6,})/);
      if (m) id = m[2];
    }
    if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
    return `https://www.youtube.com/watch?v=${id}`;
  } catch {
    return null;
  }
}

function baseArgs() {
  const args = ["--no-playlist", "--no-warnings", "--no-progress", "--newline"];
  if (config.ytdlpCookies) args.push("--cookies", config.ytdlpCookies);
  if (config.ffmpeg !== "ffmpeg") args.push("--ffmpeg-location", config.ffmpeg);
  return [...args, ...config.ytdlpExtraArgs];
}

export async function youtubeInfo(url) {
  const { stdout } = await run(config.ytdlp, [...baseArgs(), "--skip-download", "--dump-single-json", url], {
    timeoutMs: 60_000,
  });
  const j = JSON.parse(stdout);
  return { id: j.id, title: j.title, duration: Number(j.duration) || 0, thumbnail: j.thumbnail, uploader: j.uploader };
}

const FORMAT = "bv*[height<=720][ext=mp4]+ba[ext=m4a]/bv*[height<=720]+ba/b[height<=720]/bv*+ba/b";

async function findDownloaded(dir, prefix) {
  const files = await fs.readdir(dir);
  const hit = files.find((f) => f.startsWith(prefix + ".") && !f.endsWith(".part") && !f.endsWith(".ytdl"));
  return hit ? path.join(dir, hit) : null;
}

/**
 * Downloads [start, end] of a YouTube video and writes a normalized `video.mp4` into `workDir`.
 * Strategy 1: yt-dlp --download-sections (only fetches the needed range).
 * Strategy 2 (fallback): full download, then FFmpeg trim.
 */
export async function downloadYouTubeSegment(url, start, end, workDir, outVideo, onLog) {
  const section = `*${start.toFixed(2)}-${end.toFixed(2)}`;
  try {
    onLog("YouTube bölümü indiriliyor (yt-dlp --download-sections)…");
    await run(
      config.ytdlp,
      [
        ...baseArgs(),
        "-f",
        FORMAT,
        "--download-sections",
        section,
        "--force-keyframes-at-cuts",
        "--merge-output-format",
        "mp4",
        "-o",
        path.join(workDir, "section.%(ext)s"),
        url,
      ],
      { timeoutMs: 10 * 60_000 },
    );
    const file = await findDownloaded(workDir, "section");
    if (!file) throw new Error("yt-dlp çıktı dosyası bulunamadı");
    onLog("Video normalize ediliyor (H.264/AAC)…");
    await normalizeVideo(file, outVideo, 0, end - start);
    await fs.rm(file, { force: true });
    return;
  } catch (err) {
    onLog(`Bölüm indirme başarısız, tam indirme deneniyor: ${err.message.split("\n")[0]}`);
  }

  await run(
    config.ytdlp,
    [
      ...baseArgs(),
      "-f",
      FORMAT,
      "--max-filesize",
      "1500M",
      "--merge-output-format",
      "mp4",
      "-o",
      path.join(workDir, "full.%(ext)s"),
      url,
    ],
    { timeoutMs: 30 * 60_000 },
  );
  const full = await findDownloaded(workDir, "full");
  if (!full) throw new Error("YouTube videosu indirilemedi");
  onLog("Bölüm kesiliyor ve normalize ediliyor…");
  await normalizeVideo(full, outVideo, start, end);
  await fs.rm(full, { force: true });
}

export async function ingestUpload(input, start, end, outVideo) {
  await normalizeVideo(input, outVideo, start, end);
}
