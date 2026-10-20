import fs from "node:fs/promises";
import path from "node:path";
import { CHARACTER_COLORS } from "../types.js";
import { config } from "./config.js";
import { downloadYouTubeSegment, ingestUpload } from "./ingest.js";
import { extractWav, probe, thumbnail } from "./media.js";
import { packDir, packFile, publicUrls, readStatus, updateMeta, writePack, writeStatus } from "./packs.js";
import { separateStems } from "./separate.js";
import { transcribe } from "./transcribe.js";

/* ---------------- in-process job queue (survives HMR via globalThis) ---------------- */

const g = globalThis;
const queue = (g.__dubQueue ??= { running: 0, waiting: [], active: new Set(), statusLocks: new Map() });

/** True while a pack is queued or being processed by this server process. */
export function isJobAlive(packId) {
  return queue.active.has(packId) || queue.waiting.some((j) => j.packId === packId);
}

const STAGE_WEIGHT = {
  queued: [0, 0],
  ingest: [0.02, 0.3],
  separate: [0.3, 0.7],
  transcribe: [0.7, 0.95],
  finalize: [0.95, 1],
  done: [1, 1],
  failed: [1, 1],
};

/** Serialized per pack so concurrent log lines never clobber each other. */
function setStatus(packId, stage, message, extra = {}) {
  const prev = queue.statusLocks.get(packId) ?? Promise.resolve();
  const next = prev.then(() => writeStatusNow(packId, stage, message, extra)).catch(() => undefined);
  queue.statusLocks.set(packId, next);
  return next;
}

async function writeStatusNow(packId, stage, message, extra) {
  const prev = (await readStatus(packId)) ?? { packId, stage, progress: 0, message, updatedAt: "", log: [] };
  const at = new Date().toISOString();
  const status = {
    ...prev,
    ...extra,
    stage,
    message,
    progress: extra.progress ?? STAGE_WEIGHT[stage][0],
    updatedAt: at,
    log: [...prev.log, { at, stage, message }].slice(-80),
  };
  await writeStatus(status);
}

export async function enqueue(job) {
  queue.waiting.push(job);
  await setStatus(job.packId, "queued", "Sırada bekliyor…", { queuePosition: queue.waiting.length });
  pump();
}

function pump() {
  while (queue.running < config.maxConcurrentJobs && queue.waiting.length) {
    const job = queue.waiting.shift();
    queue.running++;
    queue.active.add(job.packId);
    queue.waiting.forEach((j, i) => void setStatus(j.packId, "queued", "Sırada bekliyor…", { queuePosition: i + 1 }));
    runPipeline(job)
      .catch(() => undefined)
      .finally(() => {
        queue.running--;
        queue.active.delete(job.packId);
        queue.statusLocks.delete(job.packId);
        pump();
      });
  }
}

/* ---------------- the pipeline ---------------- */

export async function runPipeline(job) {
  const { packId } = job;
  const dir = packDir(packId);
  const work = path.join(dir, "_work");
  await fs.mkdir(work, { recursive: true });

  let stage = "ingest";
  const log = (m) => void setStatus(packId, stage, m);

  try {
    /* 1) Ingest: yt-dlp / upload → video.mp4, audio.wav */
    await setStatus(
      packId,
      "ingest",
      job.source.type === "youtube" ? "YouTube videosu indiriliyor…" : "Yüklenen video işleniyor…",
    );
    const videoPath = packFile(packId, "video.mp4");
    if (job.source.type === "youtube") {
      await downloadYouTubeSegment(job.source.url, job.source.start, job.source.end, work, videoPath, log);
    } else {
      if (!job.uploadPath) throw new Error("Yüklenen dosya bulunamadı");
      await ingestUpload(job.uploadPath, job.source.start, job.source.end, videoPath);
      await fs.rm(job.uploadPath, { force: true });
    }
    const info = await probe(videoPath);
    if (!info.hasVideo || info.duration <= 0) throw new Error("Geçerli bir video akışı bulunamadı");
    const duration = Math.round(info.duration * 100) / 100;
    const wav = path.join(work, "audio.wav");
    await extractWav(videoPath, wav, duration, info.hasAudio);
    await thumbnail(videoPath, packFile(packId, "thumb.jpg"), Math.min(duration / 3, 3)).catch(() => undefined);
    await setStatus(packId, "ingest", `Video hazır (${duration.toFixed(1)} sn).`, { progress: 0.3 });

    /* 2) Stem separation → vocals.mp3 + background.mp3 */
    stage = "separate";
    await setStatus(packId, "separate", "Vokal ve arka plan ayrıştırılıyor…");
    const sep = await separateStems(
      wav,
      work,
      { vocals: packFile(packId, "vocals.mp3"), background: packFile(packId, "background.mp3") },
      log,
    );
    await setStatus(packId, "separate", `Ayrıştırma tamam (${sep.method}).`, { progress: 0.7 });

    /* 3) Whisper (tr) → segments */
    stage = "transcribe";
    await setStatus(packId, "transcribe", "Türkçe konuşma metne çevriliyor…");
    const tr = await transcribe(packFile(packId, "vocals.mp3"), work, duration, log);
    await setStatus(packId, "transcribe", `${tr.segments.length} replik bulundu (${tr.method}).`, { progress: 0.95 });

    /* 4) pack.json */
    stage = "finalize";
    const pack = {
      packId,
      title: job.title,
      category: job.category,
      language: "TR",
      duration,
      ...publicUrls(packId),
      characters: [
        { id: "char_1", name: "Karakter 1", color: CHARACTER_COLORS[0] },
        { id: "char_2", name: "Karakter 2", color: CHARACTER_COLORS[1] },
      ],
      lines: tr.segments.map((s, i) => ({
        lineId: i + 1,
        characterId: "char_1",
        startTime: s.start,
        endTime: s.end,
        text: s.text,
      })),
    };
    await writePack(pack);
    await updateMeta(packId, { status: "draft", separator: sep.method, transcriber: tr.method, hasThumbnail: true });
    await fs.rm(work, { recursive: true, force: true });
    await setStatus(packId, "done", "Paket hazır! Replikleri düzenleyip yayınlayabilirsin.", {
      progress: 1,
      queuePosition: undefined,
    });
  } catch (err) {
    const message = err.message || String(err);
    console.error(`[pipeline:${packId}]`, message);
    await updateMeta(packId, { status: "failed" }).catch(() => undefined);
    await setStatus(packId, "failed", "İşlem başarısız oldu.", { error: message.slice(0, 4000), progress: 1 });
    await fs.rm(work, { recursive: true, force: true }).catch(() => undefined);
    throw err;
  }
}
