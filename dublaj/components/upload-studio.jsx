"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DubStage from "./dub-stage.jsx";
import {
  CheckIcon,
  FilmIcon,
  SparklesIcon,
  UploadIcon,
  VideoIcon,
  WandIcon,
} from "./icons.jsx";

const MAX_SIZE = 95 * 1024 * 1024;
const MAX_DURATION = 60;

const pipeline = [
  ["Ses çıkarılıyor", "Videodaki konuşma kanalı ayrıştırılıyor."],
  ["Zaman damgaları bulunuyor", "Konuşma aralıkları repliklere bölünüyor."],
  ["Replik taslağı hazırlanıyor", "Her aralık için düzenlenebilir bir replik oluşturuluyor."],
];

const defaultLines = [
  "Sahne başlıyor. İlk repliğini buraya yaz.",
  "Şimdi sıra ikinci replikte. Tonunu değiştir.",
  "Üçüncü replik: biraz daha dram.",
  "Kapanış repliği: son söz senin.",
];

function formatDuration(seconds) {
  const safe = Math.max(0, Math.round(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(duration) ? duration : 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Video okunamadı. MP4 dosyasının bozuk olmadığından emin ol."));
    };
    video.src = url;
  });
}

export default function UploadStudio() {
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [phase, setPhase] = useState("idle");
  const [step, setStep] = useState(0);
  const [lineTexts, setLineTexts] = useState([]);
  const [showStage, setShowStage] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const urlRef = useRef("");
  const timersRef = useRef([]);

  const credits = Math.max(1, Math.ceil((duration || 1) / 15));

  const localScene = useMemo(() => {
    if (!file || !duration || !lineTexts.length) return null;
    const segment = duration / lineTexts.length;
    const lines = lineTexts.map((text, index) => ({
      id: `line-${index + 1}`,
      characterId: "you",
      start: Number((index * segment).toFixed(2)),
      end: Number(Math.min(duration, (index + 1) * segment - 0.08).toFixed(2)),
      text: text || `Replik ${index + 1}`,
    }));

    return {
      id: `upload-${file.name}-${file.size}`,
      title: file.name.replace(/\.mp4$/i, ""),
      film: "AI Creator · Yüklenen video",
      year: new Date().getFullYear(),
      duration: formatDuration(duration),
      age: "Yerel",
      players: 1,
      category: "AI Creator",
      sourceStart: 0,
      sourceEnd: duration,
      credit: "Kullanıcı tarafından yüklenen video. Dosya bu tarayıcıdan ayrılmaz.",
      characters: [{ id: "you", name: "Sen", color: "#c9a227" }],
      lines,
    };
  }, [duration, file, lineTexts]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      timersRef.current.forEach((timer) => clearTimeout(timer));
    },
    [],
  );

  function clearTimers() {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }

  async function acceptFile(nextFile) {
    if (!nextFile) return;
    setError("");
    const isMp4 = nextFile.type === "video/mp4" || /\.mp4$/i.test(nextFile.name);
    if (!isMp4) {
      setError("Sadece MP4 dosyaları yükleyebilirsin.");
      return;
    }
    if (nextFile.size > MAX_SIZE) {
      setError("Dosya 95 MB sınırını aşıyor.");
      return;
    }

    try {
      const seconds = await readDuration(nextFile);
      if (!seconds) throw new Error("Videonun süresi okunamadı.");
      if (seconds > MAX_DURATION + 0.5) {
        setError(`Video en fazla ${MAX_DURATION} saniye olabilir. Bu video ${Math.round(seconds)} saniye.`);
        return;
      }

      clearTimers();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(nextFile);
      urlRef.current = url;

      setFile(nextFile);
      setFileUrl(url);
      setDuration(seconds);
      setPhase("ready");
      setStep(0);
      setLineTexts([]);
      setShowStage(false);
    } catch (readError) {
      setError(readError.message || "Dosya okunamadı.");
    }
  }

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files?.[0]);
  }

  function analyze() {
    if (!file || phase === "analyzing") return;
    clearTimers();
    setPhase("analyzing");
    setStep(0);
    setError("");

    timersRef.current.push(setTimeout(() => setStep(1), 850));
    timersRef.current.push(setTimeout(() => setStep(2), 1900));
    timersRef.current.push(setTimeout(() => setStep(3), 2950));
    timersRef.current.push(
      setTimeout(() => {
        const count = duration < 12 ? 2 : duration < 30 ? 3 : 4;
        setLineTexts(defaultLines.slice(0, count));
        setPhase("done");
        setStep(3);
      }, 3650),
    );
  }

  function resetFile() {
    clearTimers();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = "";
    setFile(null);
    setFileUrl("");
    setDuration(0);
    setPhase("idle");
    setStep(0);
    setLineTexts([]);
    setShowStage(false);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-sm border border-brass/25 bg-brass/[0.07] text-brass">
            <SparklesIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-parchment">AI Creator</p>
            <p className="text-[11px] text-dim">MP4 yükle · replikleri stüdyoya al</p>
          </div>
        </div>
        <span className="rounded-sm border border-line px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-dim">
          {duration ? `${credits} kredi · demo ücretsiz` : "60 sn / 95 MB"}
        </span>
      </div>

      {!file && (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-4 flex flex-col items-center justify-center gap-3 rounded-sm border border-dashed px-5 py-10 text-center transition ${
            dragging ? "border-brass bg-brass/[0.08]" : "border-line bg-black/20 hover:border-brass/35"
          }`}
        >
          <span className="grid h-12 w-12 place-items-center rounded-sm border border-brass/25 bg-brass/[0.06] text-brass">
            <UploadIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-parchment">MP4 dosyanı buraya bırak</p>
            <p className="mt-1 text-xs text-dim">veya seçmek için tıkla · en fazla 60 saniye</p>
          </div>
          <button type="button" className="button-secondary min-h-9 px-3 text-xs" onClick={() => inputRef.current?.click()}>
            <VideoIcon className="h-4 w-4" />
            Dosya seç
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,.mp4"
            className="hidden"
            onChange={(event) => acceptFile(event.target.files?.[0])}
          />
        </div>
      )}

      {file && (
        <div className="mt-4">
          <div className="overflow-hidden rounded-sm border border-line bg-black">
            <video src={fileUrl} controls muted playsInline className="aspect-video w-full object-contain" />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-sm border border-line bg-black/20 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-parchment">{file.name}</p>
              <p className="text-[10px] text-dim">
                {formatSize(file.size)} · {formatDuration(duration)} · MP4
              </p>
            </div>
            <button type="button" onClick={resetFile} className="button-ghost min-h-8 text-[11px]">
              Değiştir
            </button>
          </div>

          {phase === "ready" && (
            <div className="mt-3 rounded-sm border border-brass/20 bg-brass/[0.05] p-3">
              <p className="flex items-center gap-2 text-xs font-semibold text-brass">
                <WandIcon className="h-4 w-4" />
                Tahmini maliyet: {credits} kredi
              </p>
              <p className="mt-1 text-[11px] leading-5 text-muted">
                Demo sürümde analiz ve kayıt ücretsiz. Video cihazından ayrılmaz; tüm işlem tarayıcında yapılır.
              </p>
              <button type="button" onClick={analyze} className="button-primary mt-3 min-h-9 w-full px-3 text-xs">
                <SparklesIcon className="h-4 w-4" />
                Analiz et ve replikleri hazırla
              </button>
            </div>
          )}

          {phase === "analyzing" && (
            <div className="mt-3 rounded-sm border border-line bg-black/20 p-3">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                <span className="text-brass">AI hattı çalışıyor</span>
                <span className="font-mono text-dim">{Math.min(3, step)}/3</span>
              </div>
              <div className="mt-2 space-y-2">
                {pipeline.map(([title, description], index) => {
                  const done = step > index;
                  const active = step === index;
                  return (
                    <div key={title} className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-sm border text-[10px] ${
                          done
                            ? "border-sage/40 bg-sage/10 text-sage"
                            : active
                              ? "border-brass/50 bg-brass/10 text-brass"
                              : "border-line text-dim"
                        }`}
                      >
                        {done ? <CheckIcon className="h-3 w-3" /> : active ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brass" /> : index + 1}
                      </span>
                      <span>
                        <span className={`block text-xs font-semibold ${done || active ? "text-parchment" : "text-dim"}`}>
                          {title}
                        </span>
                        <span className="block text-[10px] leading-5 text-dim">{description}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {phase === "done" && localScene && (
            <div className="mt-3">
              <div className="rounded-sm border border-sage/25 bg-sage/[0.05] p-3">
                <p className="flex items-center gap-2 text-xs font-semibold text-sage">
                  <CheckIcon className="h-4 w-4" />
                  {localScene.lines.length} replik hazır. Metinleri düzenleyebilirsin.
                </p>
              </div>

              <div className="mt-3 space-y-2">
                {localScene.lines.map((line, index) => (
                  <label key={line.id} className="block rounded-sm border border-line bg-black/20 p-2.5">
                    <span className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-dim">
                      <span className="text-brass">Replik {index + 1}</span>
                      <span className="font-mono">
                        {line.start.toFixed(1)}s – {line.end.toFixed(1)}s
                      </span>
                    </span>
                    <input
                      value={lineTexts[index]}
                      onChange={(event) => {
                        const next = [...lineTexts];
                        next[index] = event.target.value;
                        setLineTexts(next);
                      }}
                      maxLength={180}
                      className="field mt-1.5 min-h-9 px-2.5 text-xs"
                      placeholder={`Replik ${index + 1} metni`}
                    />
                  </label>
                ))}
              </div>

              {!showStage ? (
                <button
                  type="button"
                  onClick={() => setShowStage(true)}
                  className="button-primary mt-3 min-h-10 w-full px-3 text-xs"
                >
                  <FilmIcon className="h-4 w-4" />
                  Stüdyoda aç ve kaydet
                </button>
              ) : (
                <div className="mt-4 space-y-2">
                  <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brass">
                    <span className="record-dot" /> Yerel stüdyo
                  </p>
                  <DubStage scene={localScene} video={{ kind: "file", src: fileUrl }} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-sm border border-rust/35 bg-rust/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <p className="mt-3 text-[10px] leading-4 text-dim">
        Yükleme yalnızca bu tarayıcıda işlenir. Dosya sunucuya gönderilmez; max 60 sn ve 95 MB.
      </p>
    </div>
  );
}
