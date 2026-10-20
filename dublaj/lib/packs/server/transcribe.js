import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { run } from "./exec.js";
import { detectSpeechRegions } from "./media.js";

const mapSegments = (segs) =>
  (segs ?? []).map((s) => ({
    start: Number(s.start),
    end: Number(s.end),
    text: String(s.text ?? ""),
    noSpeechProb: s.no_speech_prob,
    avgLogprob: s.avg_logprob,
  }));

/* OpenAI Whisper API (or any OpenAI-compatible endpoint, e.g. Groq via OPENAI_BASE_URL). */
export const openaiTranscriber = {
  name: "openai",
  async available() {
    return Boolean(config.openaiKey);
  },
  async transcribe(audio, _workDir, _duration, log) {
    log(`Whisper API (${config.openaiWhisperModel}, language=tr) çalışıyor…`);
    const buf = await fs.readFile(audio);
    const form = new FormData();
    form.append("file", new Blob([buf], { type: "audio/mpeg" }), path.basename(audio));
    form.append("model", config.openaiWhisperModel);
    form.append("language", "tr");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
    form.append("temperature", "0");
    form.append("prompt", "Bir Türk dizisinden diyalog. Noktalama işaretlerini kullan.");
    const res = await fetch(`${config.openaiBaseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.openaiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Whisper API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const j = await res.json();
    if (!j.segments?.length && j.text?.trim()) {
      return [{ start: 0, end: Number(j.duration) || _duration, text: j.text }];
    }
    return mapSegments(j.segments);
  },
};

/* Local openai-whisper CLI (pip install openai-whisper). */
export const localWhisperTranscriber = {
  name: "local",
  async available() {
    try {
      await run(config.whisperCli, ["--help"], { timeoutMs: 60_000 });
      return true;
    } catch {
      return false;
    }
  },
  async transcribe(audio, workDir, _duration, log) {
    const outDir = path.join(workDir, "whisper");
    await fs.mkdir(outDir, { recursive: true });
    log(`Yerel Whisper (${config.localWhisperModel}, language=tr) çalışıyor…`);
    await run(
      config.whisperCli,
      [
        audio,
        "--language",
        "tr",
        "--task",
        "transcribe",
        "--model",
        config.localWhisperModel,
        "--output_format",
        "json",
        "--output_dir",
        outDir,
        "--temperature",
        "0",
        "--condition_on_previous_text",
        "False",
        "--fp16",
        "False",
        "--verbose",
        "False",
      ],
      { timeoutMs: 30 * 60_000 },
    );
    const jsonFile = (await fs.readdir(outDir)).find((f) => f.endsWith(".json"));
    if (!jsonFile) throw new Error("Whisper JSON çıktısı bulunamadı");
    const j = JSON.parse(await fs.readFile(path.join(outDir, jsonFile), "utf8"));
    await fs.rm(outDir, { recursive: true, force: true });
    return mapSegments(j.segments);
  },
};

/* Last resort: FFmpeg silence detection → timestamps only, text left empty for the editor. */
export const silenceTranscriber = {
  name: "silence",
  async available() {
    return true;
  },
  async transcribe(audio, _workDir, duration, log) {
    log("Uyarı: Whisper yok — konuşma bölgeleri sessizlik analiziyle bulunuyor (metni editörde yazın).");
    const regions = await detectSpeechRegions(audio, duration);
    return regions.map((r) => ({ start: r.start, end: r.end, text: "" }));
  },
};

const TRANSCRIBERS = {
  openai: openaiTranscriber,
  local: localWhisperTranscriber,
  silence: silenceTranscriber,
};

/* ---------------- post-processing ---------------- */

// Whisper often hallucinates these on silence/music in Turkish audio.
const HALLUCINATIONS = [
  "altyazı m.k.",
  "altyazı m.k",
  "altyazı",
  "altyazılar",
  "abone olmayı unutmayın",
  "izlediğiniz için teşekkür ederim",
  "izlediğiniz için teşekkürler",
  "bir sonraki videoda görüşmek üzere",
  "videoyu beğenmeyi unutmayın",
  "[müzik]",
  "(müzik)",
];

const norm = (s) =>
  s
    .toLocaleLowerCase("tr-TR")
    .replace(/[“”"«»]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?…]+$/, "")
    .trim();

const round = (n) => Math.round(n * 100) / 100;

export function cleanSegments(segments, duration) {
  let segs = segments
    .map((s) => ({ ...s, text: s.text.replace(/\s+/g, " ").trim() }))
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
    .filter((s) => !(s.noSpeechProb !== undefined && s.noSpeechProb > 0.75 && (s.avgLogprob ?? 0) < -0.8))
    .filter((s) => {
      if (!s.text) return true; // silence-detector segments
      const n = norm(s.text);
      return !HALLUCINATIONS.some((h) => n === norm(h)) && !/^(www\.|https?:)/.test(n);
    })
    .map((s) => ({
      ...s,
      start: Math.max(0, Math.min(s.start, duration)),
      end: Math.max(0, Math.min(s.end, duration)),
    }))
    .filter((s) => s.end - s.start >= 0.2)
    .sort((a, b) => a.start - b.start);

  // Merge consecutive duplicates (Whisper loops) and very short fragments.
  const merged = [];
  for (const s of segs) {
    const prev = merged[merged.length - 1];
    if (prev && s.text && norm(prev.text) === norm(s.text) && s.start - prev.end < 0.5) {
      prev.end = Math.max(prev.end, s.end);
      continue;
    }
    if (prev && s.end - s.start < 0.45 && s.start - prev.end < 0.2) {
      prev.end = Math.max(prev.end, s.end);
      prev.text = [prev.text, s.text].filter(Boolean).join(" ");
      continue;
    }
    merged.push({ ...s });
  }
  // Remove overlaps.
  for (let i = 1; i < merged.length; i++) {
    if (merged[i].start < merged[i - 1].end) merged[i - 1].end = merged[i].start;
  }
  segs = merged.filter((s) => s.end - s.start >= 0.2);
  return segs.map((s) => ({ start: round(s.start), end: round(s.end), text: s.text }));
}

export async function transcribe(audio, workDir, duration, log) {
  const errors = [];
  for (const name of config.transcriberOrder) {
    const t = TRANSCRIBERS[name];
    if (!t) continue;
    if (!(await t.available())) {
      log(`${name}: kullanılamıyor, atlanıyor.`);
      continue;
    }
    try {
      const raw = await t.transcribe(audio, workDir, duration, log);
      return { method: name, segments: cleanSegments(raw, duration) };
    } catch (err) {
      const msg = err.message;
      errors.push(`${name}: ${msg}`);
      log(`${name} başarısız: ${msg.split("\n")[0]} — sıradaki yöntem deneniyor.`);
    }
  }
  throw new Error(`Metne çevirme başarısız.\n${errors.join("\n")}`);
}
