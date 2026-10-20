import { config } from "./config.js";
import { run } from "./exec.js";

export async function probe(file) {
  const { stdout } = await run(
    config.ffprobe,
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file],
    { timeoutMs: 60_000 },
  );
  const data = JSON.parse(stdout);

  const streams = data.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video");
  const durations = [data.format?.duration, ...streams.map((s) => s.duration)]
    .map((d) => Number(d))
    .filter((d) => Number.isFinite(d) && d > 0);
  return {
    duration: durations.length ? Math.max(...durations) : 0,
    hasAudio: streams.some((s) => s.codec_type === "audio"),
    hasVideo: Boolean(video),
    width: video?.width,
    height: video?.height,
  };
}

/**
 * Trims [start, end] and re-encodes to a browser-safe H.264/AAC MP4 with faststart.
 * Accurate seeking: -ss after -i would be slow on long inputs, so we use input seek
 * (accurate since FFmpeg 2.1 when re-encoding).
 */
export async function normalizeVideo(input, output, start, end) {
  const args = ["-y", "-hide_banner", "-loglevel", "error"];
  if (start > 0) args.push("-ss", start.toFixed(3));
  args.push("-i", input);
  if (end !== null) args.push("-t", Math.max(0.1, end - start).toFixed(3));
  const h = config.maxVideoHeight;
  args.push(
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-vf",
    `scale=-2:'min(${h},ih)':flags=bicubic,format=yuv420p`,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ac",
    "2",
    "-ar",
    "48000",
    "-movflags",
    "+faststart",
    output,
  );
  await run(config.ffmpeg, args, { timeoutMs: 15 * 60_000 });
}

/** Extracts the master audio as 44.1 kHz stereo WAV. Generates silence if the video has no audio. */
export async function extractWav(video, output, duration, hasAudio) {
  if (hasAudio) {
    await run(
      config.ffmpeg,
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        video,
        "-vn",
        "-ac",
        "2",
        "-ar",
        "44100",
        "-c:a",
        "pcm_s16le",
        output,
      ],
      {
        timeoutMs: 5 * 60_000,
      },
    );
  } else {
    await silence(output, duration);
  }
}

export async function silence(output, duration) {
  await run(config.ffmpeg, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=44100:cl=stereo",
    "-t",
    Math.max(0.1, duration).toFixed(3),
    output,
  ]);
}

export async function toMp3(input, output) {
  await run(
    config.ffmpeg,
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      input,
      "-vn",
      "-ac",
      "2",
      "-ar",
      "44100",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "192k",
      output,
    ],
    {
      timeoutMs: 5 * 60_000,
    },
  );
}

/** Sums several audio files into one mp3 (used to rebuild "background" from 4-stem outputs). */
export async function mixToMp3(inputs, output) {
  if (inputs.length === 1) return toMp3(inputs[0], output);
  const args = ["-y", "-hide_banner", "-loglevel", "error"];
  for (const i of inputs) args.push("-i", i);
  const labels = inputs.map((_, i) => `[${i}:a]`).join("");
  args.push(
    "-filter_complex",
    `${labels}amix=inputs=${inputs.length}:duration=longest:dropout_transition=0:normalize=0,alimiter=limit=0.95:level=0[a]`,
    "-map",
    "[a]",
    "-ac",
    "2",
    "-ar",
    "44100",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "192k",
    output,
  );
  await run(config.ffmpeg, args, { timeoutMs: 5 * 60_000 });
}

export async function thumbnail(video, output, at) {
  await run(config.ffmpeg, [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    Math.max(0, at).toFixed(2),
    "-i",
    video,
    "-frames:v",
    "1",
    "-vf",
    "scale=640:-2",
    "-q:v",
    "4",
    output,
  ]);
}

/**
 * Speech regions from short-term loudness — used as a last-resort "transcriber"
 * that produces timestamps without text when no Whisper backend is available.
 * The threshold adapts to each clip: it sits between the quiet floor (music bed /
 * room tone) and the loud parts, so a constant soundtrack does not read as speech.
 */
export async function detectSpeechRegions(audio, duration) {
  const WINDOW = 0.05; // 800 samples @ 16 kHz
  const { stdout } = await run(
    config.ffmpeg,
    [
      "-hide_banner",
      "-nostats",
      "-loglevel",
      "error",
      "-i",
      audio,
      "-af",
      "pan=mono|c0=0.5*c0+0.5*c1,highpass=f=120,lowpass=f=5000,aresample=16000,asetnsamples=n=800:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-",
      "-f",
      "null",
      "-",
    ],
    { timeoutMs: 5 * 60_000 },
  );
  const levels = [];
  for (const m of stdout.matchAll(/RMS_level=(-?[\d.]+|-inf)/g)) levels.push(m[1] === "-inf" ? -120 : Number(m[1]));
  if (!levels.length) return [];
  const sorted = [...levels].sort((a, b) => a - b);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const floor = pct(0.2);
  const peak = pct(0.97);
  if (peak - floor < 6) return peak > -45 ? [{ start: 0, end: duration }] : [];
  const threshold = floor + (peak - floor) * 0.45;

  const raw = [];
  let open = null;
  levels.forEach((lv, i) => {
    const t = i * WINDOW;
    if (lv > threshold && open === null) open = t;
    if (lv <= threshold && open !== null) {
      raw.push({ start: open, end: t });
      open = null;
    }
  });
  if (open !== null) raw.push({ start: open, end: levels.length * WINDOW });

  const merged = [];
  for (const r of raw) {
    const prev = merged[merged.length - 1];
    if (prev && r.start - prev.end < 0.35) prev.end = r.end;
    else merged.push({ ...r });
  }
  return merged
    .filter((r) => r.end - r.start >= 0.3)
    .map((r) => ({ start: Math.max(0, r.start - 0.1), end: Math.min(duration, r.end + 0.1) }));
}
