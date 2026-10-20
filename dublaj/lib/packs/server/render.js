import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { takeWindow } from "../types.js";
import { config } from "./config.js";
import { run } from "./exec.js";
import { probe } from "./media.js";
import { packFile } from "./packs.js";

const f3 = (n) => n.toFixed(3);

export async function makeRenderDir() {
  const id = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const dir = path.join(config.rendersDir, id);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Builds the final dub:
 *   background.mp3  ─┐
 *   take_n (adelay) ─┼─ amix ─ alimiter ─┐
 *   vocals (gated)  ─┘                    ├─ final_dub.mp4
 *   video.mp4 (stream copy) ──────────────┘
 */
export async function renderDub(pack, takes, opts, dir) {
  const linesById = new Map(pack.lines.map((l) => [l.lineId, l]));

  // Normalize every take to 48k mono WAV first: MediaRecorder WebM often lacks a duration header.
  const prepared = [];
  for (const take of takes) {
    if (!linesById.has(take.lineId)) continue;
    const wav = path.join(dir, `take_${take.lineId}.wav`);
    await run(
      config.ffmpeg,
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        take.file,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "48000",
        "-c:a",
        "pcm_s16le",
        wav,
      ],
      {
        timeoutMs: 120_000,
      },
    );
    const { duration } = await probe(wav);
    if (duration > 0) prepared.push({ take, wav, duration });
  }

  const args = [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    packFile(pack.packId, "video.mp4"),
    "-i",
    packFile(pack.packId, "background.mp3"),
  ];
  const filters = [];
  const mixLabels = [];

  const bgVol = Math.max(0, Math.min(1.5, opts.backgroundVolume));
  filters.push(`[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${bgVol.toFixed(3)}[bg]`);
  mixLabels.push("[bg]");

  let inputIndex = 2;
  const recorded = new Set();
  for (const { take, wav, duration } of prepared) {
    const line = linesById.get(take.lineId);
    const w = takeWindow(line, take.startAt, duration);
    if (w.length < 0.05) continue;
    recorded.add(take.lineId);
    args.push("-i", wav);
    const delayMs = Math.max(0, Math.round(w.placeAt * 1000));
    const gain = Math.max(0, Math.min(4, take.gain || 1));
    const fadeOut = Math.max(0, w.length - 0.06);
    const chain = [
      `atrim=start=${f3(w.trimStart)}:end=${f3(w.trimEnd)}`,
      "asetpts=PTS-STARTPTS",
      opts.enhanceVoice ? "highpass=f=80,acompressor=threshold=-20dB:ratio=3:attack=5:release=120:makeup=2" : null,
      `volume=${gain.toFixed(3)}`,
      "afade=t=in:st=0:d=0.02",
      `afade=t=out:st=${f3(fadeOut)}:d=0.06`,
      "aformat=sample_rates=48000:channel_layouts=stereo",
      `adelay=delays=${delayMs}:all=1`,
    ]
      .filter(Boolean)
      .join(",");
    const label = `[t${inputIndex}]`;
    filters.push(`[${inputIndex}:a]${chain}${label}`);
    mixLabels.push(label);
    inputIndex++;
  }

  if (opts.fillOriginal) {
    const missing = pack.lines.filter((l) => !recorded.has(l.lineId));
    if (missing.length) {
      args.push("-i", packFile(pack.packId, "vocals.mp3"));
      const expr = missing
        .map((l) => `between(t,${f3(Math.max(0, l.startTime - 0.1))},${f3(l.endTime + 0.25)})`)
        .join("+");
      const label = `[ov]`;
      filters.push(
        `[${inputIndex}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume='if(${expr},1,0)':eval=frame${label}`,
      );
      mixLabels.push(label);
      inputIndex++;
    }
  }

  filters.push(
    `${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.97:level=0[aout]`,
  );

  const out = path.join(dir, "final_dub.mp4");
  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    "0:v:0",
    "-map",
    "[aout]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-t",
    f3(pack.duration),
    "-movflags",
    "+faststart",
    out,
  );
  await run(config.ffmpeg, args, { timeoutMs: 10 * 60_000 });
  return out;
}
