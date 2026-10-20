import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";
import { run } from "./exec.js";
import { mixToMp3, toMp3 } from "./media.js";

async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 1) Local Demucs (python -m demucs)                                  */
/* ------------------------------------------------------------------ */
export const demucsSeparator = {
  name: "demucs",
  async available() {
    try {
      await run(config.python, ["-c", "import demucs"], { timeoutMs: 30_000 });
      return true;
    } catch {
      return false;
    }
  },
  async separate(wav, workDir, out, log) {
    const outDir = path.join(workDir, "demucs");
    await fs.mkdir(outDir, { recursive: true });
    const args = [
      "-m",
      "demucs",
      "--two-stems=vocals",
      "-n",
      config.demucsModel,
      "-o",
      outDir,
      "--filename",
      "{stem}.{ext}",
    ];
    if (config.demucsDevice) args.push("-d", config.demucsDevice);
    args.push(wav);
    log(`Demucs (${config.demucsModel}) çalışıyor — CPU'da 60 sn ses için 1-3 dk sürebilir…`);
    await run(config.python, args, { timeoutMs: 30 * 60_000 });
    const files = await walk(outDir);
    const vocals = files.find((f) => /(^|[\\/])vocals\.(wav|mp3|flac)$/.test(f));
    const noVocals = files.find((f) => /(^|[\\/])no_vocals\.(wav|mp3|flac)$/.test(f));
    if (!vocals || !noVocals) throw new Error("Demucs çıktıları bulunamadı (vocals / no_vocals)");
    await toMp3(vocals, out.vocals);
    await toMp3(noVocals, out.background);
    await fs.rm(outDir, { recursive: true, force: true });
  },
};

/* ------------------------------------------------------------------ */
/* 2) Replicate API (Demucs model)                                    */
/* ------------------------------------------------------------------ */
const REPLICATE = "https://api.replicate.com/v1";

async function replicateFetch(url, init = {}) {
  const headers = new Headers(init.headers);
  if (new URL(url).hostname === "api.replicate.com") headers.set("Authorization", `Bearer ${config.replicateToken}`);
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Replicate ${res.status}: ${body.slice(0, 300)}`);
  }
  return res;
}

async function resolveReplicateVersion() {
  if (config.replicateVersion) return config.replicateVersion;
  const res = await replicateFetch(`${REPLICATE}/models/${config.replicateModel}`);
  const j = await res.json();
  if (!j.latest_version?.id) throw new Error(`Replicate modeli için sürüm bulunamadı: ${config.replicateModel}`);
  return j.latest_version.id;
}

async function replicateUpload(file) {
  const buf = await fs.readFile(file);
  const form = new FormData();
  form.append("content", new Blob([buf], { type: "audio/mpeg" }), path.basename(file));
  const res = await replicateFetch(`${REPLICATE}/files`, { method: "POST", body: form });
  const j = await res.json();
  if (!j.urls?.get) throw new Error("Replicate dosya yükleme yanıtı beklenmedik");
  return j.urls.get;
}

function collectOutputs(output) {
  const result = {};
  const add = (key, val) => {
    if (typeof val === "string" && /^https?:\/\//.test(val)) result[key.toLowerCase()] = val;
  };
  const nameOf = (u) => path.basename(new URL(u).pathname).split(".")[0];
  if (typeof output === "string") {
    add(nameOf(output), output);
  } else if (Array.isArray(output)) {
    for (const v of output) {
      if (typeof v === "string") add(nameOf(v), v);
    }
  } else if (output && typeof output === "object") {
    for (const [k, v] of Object.entries(output)) add(k, v);
  }
  return result;
}

export const replicateSeparator = {
  name: "replicate",
  async available() {
    return Boolean(config.replicateToken);
  },
  async separate(wav, workDir, out, log) {
    const mp3 = path.join(workDir, "replicate-input.mp3");
    await toMp3(wav, mp3);
    log(`Replicate (${config.replicateModel}) — ses yükleniyor…`);
    const [version, audioUrl] = await Promise.all([resolveReplicateVersion(), replicateUpload(mp3)]);
    let extra = {};
    if (config.replicateExtraInput) {
      try {
        extra = JSON.parse(config.replicateExtraInput);
      } catch {
        throw new Error("REPLICATE_DEMUCS_INPUT geçerli bir JSON değil");
      }
    }
    const res = await replicateFetch(`${REPLICATE}/predictions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "wait=60" },
      body: JSON.stringify({ version, input: { audio: audioUrl, ...extra } }),
    });
    let pred = await res.json();
    const deadline = Date.now() + 20 * 60_000;
    while (!["succeeded", "failed", "canceled"].includes(pred.status)) {
      if (Date.now() > deadline) throw new Error("Replicate tahmini zaman aşımına uğradı");
      log(`Replicate durumu: ${pred.status}…`);
      await new Promise((r) => setTimeout(r, 3000));
      pred = await (await replicateFetch(pred.urls.get)).json();
    }
    if (pred.status !== "succeeded") throw new Error(`Replicate başarısız: ${pred.error ?? pred.status}`);

    const outputs = collectOutputs(pred.output);
    const keys = Object.keys(outputs);
    const vocalKey = keys.find((k) => k.includes("vocal") && !k.includes("no_") && !k.includes("no-"));
    if (!vocalKey) throw new Error(`Replicate çıktısında vokal kanalı yok: ${keys.join(", ")}`);
    const bgKey = keys.find((k) => /no_vocals|no-vocals|accompaniment|instrumental|music/.test(k));
    const stemKeys = bgKey ? [bgKey] : keys.filter((k) => k !== vocalKey);
    if (!stemKeys.length) throw new Error("Replicate çıktısında arka plan kanalı yok");

    const download = async (key) => {
      const u = outputs[key];
      const ext = path.extname(new URL(u).pathname) || ".wav";
      const dest = path.join(workDir, `rep-${key.replace(/[^\w-]/g, "_")}${ext}`);
      const r = await replicateFetch(u);
      await fs.writeFile(dest, Buffer.from(await r.arrayBuffer()));
      return dest;
    };
    log("Replicate stem'leri indiriliyor…");
    const vocalFile = await download(vocalKey);
    const bgFiles = await Promise.all(stemKeys.map(download));
    await toMp3(vocalFile, out.vocals);
    await mixToMp3(bgFiles, out.background);
    await Promise.all([vocalFile, ...bgFiles, mp3].map((f) => fs.rm(f, { force: true })));
  },
};

/* ------------------------------------------------------------------ */
/* 3) FFmpeg "karaoke" fallback (center-channel cancellation)          */
/*    Low quality, but always available — dialogue in TV is usually    */
/*    mixed to the center, so L-R removes most of it.                  */
/* ------------------------------------------------------------------ */
export const ffmpegSeparator = {
  name: "ffmpeg",
  async available() {
    return true;
  },
  async separate(wav, _workDir, out, log) {
    log("Uyarı: Demucs/Replicate yok — FFmpeg merkez kanal iptali kullanılıyor (düşük kalite).");
    const bgFilter =
      "[0:a]asplit=2[x][y];" +
      "[x]pan=stereo|c0=c0-c1|c1=c1-c0[side];" +
      "[y]pan=mono|c0=0.5*c0+0.5*c1,lowpass=f=140,pan=stereo|c0=c0|c1=c0[low];" +
      "[side][low]amix=inputs=2:normalize=0,alimiter=limit=0.95:level=0[a]";
    await run(config.ffmpeg, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      wav,
      "-filter_complex",
      bgFilter,
      "-map",
      "[a]",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "192k",
      out.background,
    ]);
    const vocFilter = "pan=mono|c0=0.5*c0+0.5*c1,highpass=f=150,lowpass=f=7000,pan=stereo|c0=c0|c1=c0";
    await run(config.ffmpeg, [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      wav,
      "-af",
      vocFilter,
      "-c:a",
      "libmp3lame",
      "-b:a",
      "192k",
      out.vocals,
    ]);
  },
};

const SEPARATORS = {
  demucs: demucsSeparator,
  replicate: replicateSeparator,
  ffmpeg: ffmpegSeparator,
};

/** Tries each configured separator in order and falls back on failure. */
export async function separateStems(wav, workDir, out, log) {
  const errors = [];
  for (const name of config.separatorOrder) {
    const sep = SEPARATORS[name];
    if (!sep) continue;
    if (!(await sep.available())) {
      log(`${name}: kullanılamıyor, atlanıyor.`);
      continue;
    }
    try {
      await sep.separate(wav, workDir, out, log);
      return { method: name, ...out };
    } catch (err) {
      const msg = err.message;
      errors.push(`${name}: ${msg}`);
      log(`${name} başarısız: ${msg.split("\n")[0]} — sıradaki yöntem deneniyor.`);
    }
  }
  throw new Error(`Ses ayrıştırma başarısız.\n${errors.join("\n")}`);
}
