"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Film, Link2, Upload, X, Clapperboard } from "lucide-react";
import { CATEGORIES, MAX_SEGMENT_SECONDS } from "../../lib/packs/types.js";
import { api, createPack, saveEditKey } from "../../lib/packs/client/api.js";
import { clamp, fmtTime, parseTime, youTubeId, youTubeStartParam } from "../../lib/packs/client/format.js";
import { RangeSlider } from "./range-slider.jsx";
import { Button, Field, inputClass, Notice, Spinner } from "./ui.jsx";

function TimeInput({ label, value, onCommit }) {
  const [text, setText] = useState(fmtTime(value));
  useEffect(() => setText(fmtTime(value)), [value]);
  return (
    <Field label={label}>
      <input
        className={`${inputClass} tabular`}
        value={text}
        inputMode="decimal"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const v = parseTime(text);
          if (v === null) setText(fmtTime(value));
          else onCommit(v);
        }}
        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
      />
    </Field>
  );
}

export function CreatePackModal({ open, onClose, initialUrl = "", initialSource = "youtube", initialFile = null }) {
  const router = useRouter();
  const dialog = useRef(null);
  const [source, setSource] = useState(initialSource);
  const [url, setUrl] = useState(initialUrl);
  const [ytInfo, setYtInfo] = useState(null);
  const [ytLoading, setYtLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [fileDuration, setFileDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(30);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Türkçe Dizi");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const previewRef = useRef(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (open) {
      setSource(initialFile ? "upload" : initialSource);
      if (initialUrl) setUrl(initialUrl);
      if (initialFile) pickFile(initialFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialUrl, initialSource, initialFile]);

  useEffect(() => () => void (fileUrl && URL.revokeObjectURL(fileUrl)), [fileUrl]);

  const videoId = useMemo(() => youTubeId(url), [url]);

  // Fetch YouTube metadata once a valid link is entered.
  useEffect(() => {
    if (source !== "youtube" || !videoId) {
      setYtInfo(null);
      return;
    }
    let cancelled = false;
    setYtLoading(true);
    const t0 = youTubeStartParam(url);
    api
      .youtubeInfo(url)
      .then((info) => {
        if (cancelled) return;
        setYtInfo({ title: info.title, duration: info.duration });
        setTitle((t) => t || info.title.slice(0, 120));
        const s = clamp(t0 ?? 0, 0, Math.max(0, info.duration - 1));
        setStart(s);
        setEnd(Math.min(info.duration || s + 30, s + 30));
      })
      .catch(() => {
        if (cancelled) return;
        setYtInfo(null);
        if (t0 !== null) {
          setStart(t0);
          setEnd(t0 + 30);
        }
      })
      .finally(() => !cancelled && setYtLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, source]);

  const pickFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith("video/") && !/\.(mp4|mov|mkv|webm|m4v)$/i.test(f.name)) {
      setError("Bu bir video dosyası değil.");
      return;
    }
    setError(null);
    setFile(f);
    setFileUrl(URL.createObjectURL(f));
    setTitle((t) => t || f.name.replace(/\.[^.]+$/, "").slice(0, 120));
  };

  const maxDuration =
    source === "youtube" ? ytInfo?.duration || Math.max(600, end + 60) : fileDuration || Math.max(60, end);

  const setRange = useCallback(
    (s, e) => {
      const s2 = clamp(s, 0, maxDuration - 0.5);
      let e2 = clamp(e, s2 + 0.5, maxDuration);
      if (e2 - s2 > MAX_SEGMENT_SECONDS) e2 = s2 + MAX_SEGMENT_SECONDS;
      setStart(Math.round(s2 * 10) / 10);
      setEnd(Math.round(e2 * 10) / 10);
    },
    [maxDuration],
  );

  const canSubmit =
    !submitting && title.trim() && (source === "youtube" ? Boolean(videoId) : Boolean(file)) && end > start;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setProgress(0);
    const form = new FormData();
    form.set("sourceType", source);
    form.set("title", title.trim());
    form.set("category", category);
    form.set("start", start.toFixed(2));
    form.set("end", end.toFixed(2));
    if (source === "youtube") form.set("youtubeUrl", url.trim());
    else if (file) form.set("file", file);
    try {
      const { packId, editKey } = await createPack(form, setProgress);
      saveEditKey(packId, editKey);
      onClose();
      router.push(`/tr/paket/${packId}/duzenle`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  const embed = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?start=${Math.floor(start)}&end=${Math.ceil(end)}&rel=0&modestbranding=1`
    : null;

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && !submitting && onClose()}
      className="packs-ui m-auto w-[min(760px,calc(100vw-24px))] max-h-[calc(100dvh-24px)] rounded-sm border border-brass/30 bg-panel p-0 text-parchment shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={submit} className="flex max-h-[calc(100dvh-24px)] flex-col">
        <div className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 className="display text-2xl font-bold tracking-tight">Yeni dub paketi</h2>
            <p className="mt-0.5 text-sm text-muted">
              En fazla {MAX_SEGMENT_SECONDS} saniyelik bir sahne seç. Ses ayrıştırma ve Türkçe altyazı otomatik çıkar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="ml-auto grid size-9 place-items-center rounded-sm text-muted hover:bg-panel-2 hover:text-parchment"
            aria-label="Kapat"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <div role="tablist" className="inline-flex rounded-sm bg-panel-2 p-1 border border-line">
            {[
              ["youtube", "YouTube linki", Link2],
              ["upload", "MP4 yükle", Upload],
            ].map(([k, label, Icon]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={source === k}
                onClick={() => setSource(k)}
                className={`inline-flex h-9 items-center gap-2 rounded-sm px-4 text-sm font-semibold transition-colors ${source === k ? "bg-brass text-white" : "text-muted hover:text-parchment"}`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>

          {source === "youtube" ? (
            <div className="space-y-4">
              <Field
                label="YouTube bağlantısı"
                hint="youtube.com/watch?v=…, youtu.be/… ya da Shorts linki. Linkteki ?t= zamanı başlangıç olarak alınır."
              >
                <div className="relative">
                  <input
                    className={inputClass}
                    placeholder="https://www.youtube.com/watch?v=…"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    autoFocus
                  />
                  {ytLoading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                      <Spinner size={14} />
                    </span>
                  )}
                </div>
              </Field>
              {url && !videoId && <p className="text-sm text-red-300">Bu bir YouTube video linkine benzemiyor.</p>}
              {videoId && (
                <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
                  <div className="aspect-video overflow-hidden rounded-sm bg-black border border-line">
                    {embed && (
                      <iframe
                        key={`${videoId}-${Math.floor(start)}`}
                        src={embed}
                        className="size-full"
                        allow="encrypted-media; picture-in-picture"
                        title="YouTube önizleme"
                      />
                    )}
                  </div>
                  <div className="text-sm text-muted">
                    {ytInfo ? (
                      <>
                        <p className="font-semibold text-parchment line-clamp-2">{ytInfo.title}</p>
                        <p className="tabular mt-1">Video süresi {fmtTime(ytInfo.duration, false)}</p>
                      </>
                    ) : !ytLoading ? (
                      <p>Video bilgisi alınamadı; başlangıç ve bitişi elle yazabilirsin.</p>
                    ) : null}
                    <p className="mt-3">Önizleme seçtiğin aralığı oynatır.</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {!file ? (
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    pickFile(e.dataTransfer.files[0]);
                  }}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed px-6 py-10 text-center transition-colors ${dragOver ? "border-brass bg-brass/10" : "border-line hover:border-muted"}`}
                >
                  <Film size={28} className="text-brass-bright" />
                  <span className="font-semibold">MP4 dosyasını buraya sürükle</span>
                  <span className="text-sm text-muted">ya da seçmek için tıkla — MP4, MOV, MKV, WebM</span>
                  <input
                    type="file"
                    accept="video/*,.mkv"
                    className="sr-only"
                    onChange={(e) => pickFile(e.target.files?.[0])}
                  />
                </label>
              ) : (
                <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
                  <video
                    ref={previewRef}
                    src={fileUrl ?? undefined}
                    controls
                    playsInline
                    className="aspect-video w-full rounded-sm bg-black border border-line"
                    onLoadedMetadata={(e) => {
                      const d = e.currentTarget.duration;
                      if (Number.isFinite(d)) {
                        setFileDuration(d);
                        setStart(0);
                        setEnd(Math.min(d, MAX_SEGMENT_SECONDS));
                      }
                    }}
                  />
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold break-all">{file.name}</p>
                    <p className="tabular text-muted">
                      {(file.size / 1048576).toFixed(1)} MB{fileDuration ? `, ${fmtTime(fileDuration, false)}` : ""}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() =>
                          previewRef.current &&
                          setRange(previewRef.current.currentTime, Math.max(end, previewRef.current.currentTime + 1))
                        }
                      >
                        Başlangıç = oynatıcı
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => previewRef.current && setRange(start, previewRef.current.currentTime)}
                      >
                        Bitiş = oynatıcı
                      </Button>
                    </div>
                    <button
                      type="button"
                      className="text-muted underline-offset-2 hover:text-parchment hover:underline"
                      onClick={() => {
                        setFile(null);
                        setFileUrl(null);
                        setFileDuration(0);
                      }}
                    >
                      Başka dosya seç
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {(source === "upload" ? Boolean(file) : Boolean(videoId)) && (
            <div className="rounded-sm border border-line bg-black/20 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">Sahne aralığı</span>
                <span
                  className={`tabular text-sm ${end - start > MAX_SEGMENT_SECONDS - 0.05 ? "text-amber-300" : "text-muted"}`}
                >
                  {(end - start).toFixed(1)} / {MAX_SEGMENT_SECONDS} sn
                </span>
              </div>
              <RangeSlider
                max={maxDuration}
                start={start}
                end={end}
                maxSpan={MAX_SEGMENT_SECONDS}
                onChange={setRange}
              />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <TimeInput label="Başlangıç" value={start} onCommit={(v) => setRange(v, Math.max(end, v + 1))} />
                <TimeInput label="Bitiş" value={end} onCommit={(v) => setRange(start, v)} />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
            <Field label="Paket başlığı">
              <input
                className={inputClass}
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Kurtlar Vadisi — Çakır ve Polat sahnesi"
              />
            </Field>
            <Field label="Kategori">
              <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>

          {error && <Notice tone="error">{error}</Notice>}
        </div>

        <div className="flex items-center gap-3 border-t border-line px-5 py-4 sm:px-6">
          {submitting && source === "upload" && progress < 1 && (
            <div className="flex flex-1 items-center gap-3 text-sm text-muted">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                <div className="h-full bg-brass transition-[width]" style={{ width: `${progress * 100}%` }} />
              </div>
              <span className="tabular">%{Math.round(progress * 100)}</span>
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              Vazgeç
            </Button>
            <Button type="submit" variant="primary" disabled={!canSubmit}>
              {submitting ? <Spinner /> : <Clapperboard size={16} />}
              Paketi oluştur
            </Button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
