"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, CircleAlert } from "lucide-react";

import { api } from "../../lib/packs/client/api.js";
import { Notice, Spinner, btn } from "./ui.jsx";

const STEPS = [
  { stage: "ingest", label: "Video alınıyor", detail: "yt-dlp ile bölüm indirilir, FFmpeg ile H.264/AAC’ye çevrilir" },
  { stage: "separate", label: "Ses katmanlara ayrılıyor", detail: "Demucs vokalleri müzik ve efektlerden ayırır" },
  {
    stage: "transcribe",
    label: "Türkçe replikler çıkarılıyor",
    detail: "Whisper (language=tr) zaman damgalı metin üretir",
  },
  { stage: "finalize", label: "Paket hazırlanıyor", detail: "pack.json yazılır" },
];
const ORDER = ["queued", "ingest", "separate", "transcribe", "finalize", "done"];

export function ProcessingView({ packId, onDone }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stop = false;
    let timer;
    const poll = async () => {
      try {
        const s = await api.status(packId);
        if (stop) return;
        setStatus(s);
        if (s.stage === "done") {
          onDone();
          return;
        }
        if (s.stage === "failed") return;
      } catch (e) {
        if (!stop) setError(e.message);
      }
      if (!stop) timer = setTimeout(poll, 1500);
    };
    poll();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [packId, onDone]);

  const idx = status ? ORDER.indexOf(status.stage) : 0;
  const failed = status?.stage === "failed";
  const failedAt = failed ? (status?.log.filter((l) => l.stage !== "failed").at(-1)?.stage ?? "ingest") : null;

  return (
    <main className="packs-ui mx-auto w-full max-w-2xl flex-1 px-5 py-14 lg:px-8">
      <h1 className="display text-3xl font-bold tracking-tight">
        {failed ? "Paket oluşturulamadı" : "Paketin hazırlanıyor"}
      </h1>
      <p className="mt-2 text-muted">
        {failed
          ? "Aşağıdaki hatayı düzelttikten sonra yeniden deneyebilirsin."
          : "Bu sayfayı açık bırakabilir ya da daha sonra dönebilirsin; 60 saniyelik bir sahne genelde 1–4 dakika sürer."}
      </p>

      {status?.stage === "queued" && (
        <div className="mt-6">
          <Notice>Sırada {status.queuePosition ?? 1}. sıradasın — sunucu aynı anda sınırlı sayıda paket işler.</Notice>
        </div>
      )}

      <div className="mt-8 h-2 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full transition-[width] duration-700 ${failed ? "bg-rust" : "bg-brass"}`}
          style={{ width: `${Math.round((status?.progress ?? 0) * 100)}%` }}
        />
      </div>

      <ol className="mt-8 space-y-5">
        {STEPS.map((s) => {
          const i = ORDER.indexOf(s.stage);
          const isFailed = failed && failedAt === s.stage;
          const doneStep = !isFailed && (status?.stage === "done" || i < (failed ? ORDER.indexOf(failedAt) : idx));
          const active = !failed && i === idx;
          return (
            <li key={s.stage} className="flex gap-4">
              <span
                className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ring-1 ${
                  isFailed
                    ? "bg-rust/15 text-red-400 ring-rust/40"
                    : doneStep
                      ? "bg-brass text-white ring-brass"
                      : active
                        ? "text-sage-bright ring-sage/50"
                        : "text-dim ring-line"
                }`}
              >
                {isFailed ? (
                  <CircleAlert size={15} />
                ) : doneStep ? (
                  <Check size={15} strokeWidth={3} />
                ) : active ? (
                  <Spinner size={13} />
                ) : null}
              </span>
              <div>
                <p className={`font-semibold ${doneStep || active || isFailed ? "text-parchment" : "text-dim"}`}>
                  {s.label}
                </p>
                <p className="text-sm text-muted">{active && status?.message ? status.message : s.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {failed && status?.error && (
        <div className="mt-8">
          <Notice tone="error">
            <pre className="whitespace-pre-wrap font-sans">{status.error}</pre>
          </Notice>
          <Link href="/tr/paketler" className={btn("outline", "md", "mt-4")}>
            Paketlere dön
          </Link>
        </div>
      )}
      {error && (
        <div className="mt-6">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {status && status.log.length > 0 && (
        <details className="mt-10 text-sm text-muted">
          <summary className="cursor-pointer select-none hover:text-parchment">İşlem günlüğü</summary>
          <ul className="mt-3 space-y-1 border-l border-line pl-4">
            {status.log.slice(-14).map((l, i) => (
              <li key={i}>
                <span className="tabular text-dim">{new Date(l.at).toLocaleTimeString("tr-TR")}</span> {l.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
