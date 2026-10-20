"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Circle,
  Download,
  Ear,
  Film,
  Headphones,
  Pencil,
  Play,
  RotateCcw,
  Settings2,
  Square,
  Trash2,
} from "lucide-react";
import { takeWindow } from "../../lib/packs/types.js";
import { api } from "../../lib/packs/client/api.js";
import { AudioEngine } from "../../lib/packs/client/audio-engine.js";
import { clamp, fmtTime } from "../../lib/packs/client/format.js";
import { extFor, openMic, pickMimeType } from "../../lib/packs/client/mic.js";
import { deleteTake, loadTakes, saveTake } from "../../lib/packs/client/takes.js";
import { MicMeter } from "./mic-meter.jsx";
import { AppHeader, Button, Notice, Spinner, btn } from "./ui.jsx";
import { withBase } from "../../lib/base-path.js";

const PREROLL = 1.2; // seconds of scene heard before the line starts
const TAIL = 0.6;

const DEFAULT_SETTINGS = { bgVolume: 1, fillOriginal: true, enhanceVoice: true, latencyOffsetMs: 0, autoAdvance: true };
const SETTINGS_KEY = "dub:settings";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function DubStage({ packId }) {
  const [env, setEnv] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [buffers, setBuffers] = useState(null);
  const [takes, setTakes] = useState(new Map());
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState({ kind: "loading" });
  const [time, setTime] = useState(0);
  const [mic, setMic] = useState(null);
  const [error, setError] = useState(null);
  const [onlyChar, setOnlyChar] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [headphoneHint, setHeadphoneHint] = useState(true);

  const video = useRef(null);
  const engineRef = useRef(null);
  const cancelCountdown = useRef(false);
  const micRef = useRef(null);

  const pack = env?.pack ?? null;
  const lines = useMemo(() => (pack ? [...pack.lines].sort((a, b) => a.startTime - b.startTime) : []), [pack]);
  const visibleLines = useMemo(
    () => (onlyChar ? lines.filter((l) => l.characterId === onlyChar) : lines),
    [lines, onlyChar],
  );
  const charById = useMemo(() => new Map((pack?.characters ?? []).map((c) => [c.id, c])), [pack]);
  const selected = lines.find((l) => l.lineId === selectedId) ?? null;
  const busy = mode.kind !== "idle";

  /* ---------------- load ---------------- */
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...s });
      setHeadphoneHint(localStorage.getItem("dub:headphoneHint") !== "0");
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const e = await api.get(packId);
        if (cancelled) return;
        if (!e.pack || (e.meta.status !== "draft" && e.meta.status !== "published"))
          throw new Error("Bu paket henüz hazır değil.");
        setEnv(e);
        setSelectedId([...e.pack.lines].sort((a, b) => a.startTime - b.startTime)[0]?.lineId ?? null);
        const engine = AudioEngine.get();
        engineRef.current = engine;
        const [bg, vocals, stored] = await Promise.all([
          engine.loadUrl(e.pack.backgroundAudioUrl),
          engine.loadUrl(e.pack.referenceVocalUrl),
          loadTakes(packId),
        ]);
        if (cancelled) return;
        const byId = new Map(e.pack.lines.map((l) => [l.lineId, l]));
        const restored = new Map();
        for (const s of stored) {
          const l = byId.get(s.lineId);
          if (!l || Math.abs(l.startTime - s.lineStart) > 0.01 || Math.abs(l.endTime - s.lineEnd) > 0.01) {
            void deleteTake(packId, s.lineId); // pack was edited since — timing no longer matches
            continue;
          }
          try {
            restored.set(s.lineId, { ...s, buffer: await engine.decodeBlob(s.blob) });
          } catch {
            /* undecodable blob */
          }
        }
        setBuffers({ bg, vocals });
        setTakes(restored);
        setMode({ kind: "idle" });
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      }
    })();
    return () => {
      cancelled = true;
      engineRef.current?.stop();
      micRef.current?.close();
    };
  }, [packId]);

  // When idle, park the subtitle/video on the selected line.
  useEffect(() => {
    if (mode.kind !== "idle" || !selected) return;
    setTime(selected.startTime);
    const v = video.current;
    if (v && Math.abs(v.currentTime - selected.startTime) > 0.05) v.currentTime = selected.startTime + 0.01;
  }, [selected, mode.kind]);

  /* ---------------- layers ---------------- */
  const takeLayer = useCallback(
    (t) => {
      const line = lines.find((l) => l.lineId === t.lineId);
      if (!line) return null;
      const w = takeWindow(line, t.startAt, t.buffer.duration);
      if (w.length <= 0.02) return null;
      return { buffer: t.buffer, at: w.placeAt, offset: w.trimStart, duration: w.length, gain: t.gain };
    },
    [lines],
  );

  const sceneLayers = useCallback(
    (exclude) => {
      if (!buffers) return [];
      const out = [{ buffer: buffers.bg, at: 0, gain: settings.bgVolume }];
      for (const t of takes.values()) {
        if (t.lineId === exclude) continue;
        const l = takeLayer(t);
        if (l) out.push(l);
      }
      if (settings.fillOriginal) {
        for (const l of lines) {
          if (l.lineId === exclude || takes.has(l.lineId)) continue;
          const at = Math.max(0, l.startTime - 0.1);
          out.push({ buffer: buffers.vocals, at, offset: at, duration: l.endTime + 0.25 - at });
        }
      }
      return out;
    },
    [buffers, takes, lines, settings.bgVolume, settings.fillOriginal, takeLayer],
  );

  /* ---------------- actions ---------------- */
  const stopAll = useCallback(() => {
    cancelCountdown.current = true;
    engineRef.current?.stop();
  }, []);

  const playRange = useCallback(
    async (m, from, to, layers) => {
      const engine = engineRef.current;
      if (!engine || !pack) return;
      setError(null);
      setMode(m);
      const pb = await engine.play({
        from: clamp(from, 0, pack.duration),
        to: clamp(to, 0, pack.duration),
        layers,
        video: video.current,
        onTick: setTime,
      });
      await pb.done;
      setMode({ kind: "idle" });
    },
    [pack],
  );

  const listenReference = useCallback(
    (l) => {
      if (!buffers) return;
      setSelectedId(l.lineId);
      void playRange({ kind: "reference", lineId: l.lineId }, l.startTime - 0.4, l.endTime + 0.4, [
        { buffer: buffers.bg, at: 0, gain: settings.bgVolume * 0.8 },
        { buffer: buffers.vocals, at: 0 },
      ]);
    },
    [buffers, playRange, settings.bgVolume],
  );

  const replayTake = useCallback(
    (l) => {
      const t = takes.get(l.lineId);
      if (!t || !buffers) return;
      const layer = takeLayer(t);
      setSelectedId(l.lineId);
      void playRange({ kind: "replay", lineId: l.lineId }, l.startTime - 0.6, l.endTime + TAIL, [
        { buffer: buffers.bg, at: 0, gain: settings.bgVolume },
        ...(layer ? [layer] : []),
      ]);
    },
    [takes, buffers, takeLayer, playRange, settings.bgVolume],
  );

  const previewScene = useCallback(() => {
    if (!pack) return;
    void playRange({ kind: "preview" }, 0, pack.duration, sceneLayers());
  }, [pack, playRange, sceneLayers]);

  const ensureMic = useCallback(async () => {
    if (micRef.current) return micRef.current;
    const m = await openMic(engineRef.current);
    micRef.current = m;
    setMic(m);
    return m;
  }, []);

  const record = useCallback(
    async (line) => {
      const engine = engineRef.current;
      if (!engine || !pack || !buffers) return;
      setError(null);
      setSelectedId(line.lineId);
      let m;
      try {
        await engine.resume();
        m = await ensureMic();
      } catch (e) {
        setError(e.message);
        return;
      }
      const mime = pickMimeType();
      let rec;
      try {
        rec = new MediaRecorder(m.stream, mime ? { mimeType: mime, audioBitsPerSecond: 128_000 } : undefined);
      } catch {
        setError("Bu tarayıcı ses kaydı (MediaRecorder) desteklemiyor.");
        return;
      }
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      let recStart = 0;
      const started = new Promise((r) => (rec.onstart = () => ((recStart = engine.ctx.currentTime), r())));
      const stopped = new Promise((r) => (rec.onstop = () => r()));

      cancelCountdown.current = false;
      rec.start(250); // warm up during the countdown so the first syllable is never clipped
      await started;
      for (const n of [3, 2, 1]) {
        setMode({ kind: "countdown", n, lineId: line.lineId });
        await sleep(750);
        if (cancelCountdown.current) {
          rec.stop();
          await stopped;
          setMode({ kind: "idle" });
          return;
        }
      }

      const from = Math.max(0, line.startTime - PREROLL);
      const to = Math.min(pack.duration, line.endTime + TAIL);
      setMode({ kind: "recording", lineId: line.lineId });
      const pb = await engine.play({
        from,
        to,
        layers: sceneLayers(line.lineId),
        video: video.current,
        onTick: setTime,
      });
      await pb.done;
      await sleep(120);
      rec.stop();
      await stopped;

      const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
      const latency = engine.outputLatency + m.inputLatency + settings.latencyOffsetMs / 1000;
      // Timeline second that corresponds to sample 0 of the recording.
      const startAt = pb.from - (pb.t0 - recStart) - latency;
      try {
        const buffer = await engine.decodeBlob(blob);
        const prev = takes.get(line.lineId);
        const take = {
          lineId: line.lineId,
          blob,
          mimeType: blob.type,
          startAt,
          gain: prev?.gain ?? 1,
          buffer,
          lineStart: line.startTime,
          lineEnd: line.endTime,
        };
        setTakes((t) => new Map(t).set(line.lineId, take));
        void saveTake({
          packId,
          lineId: line.lineId,
          blob,
          mimeType: blob.type,
          startAt,
          gain: take.gain,
          lineStart: line.startTime,
          lineEnd: line.endTime,
          createdAt: Date.now(),
        });
        if (settings.autoAdvance) {
          const list = onlyChar ? lines.filter((l) => l.characterId === onlyChar) : lines;
          const next = list[list.findIndex((l) => l.lineId === line.lineId) + 1];
          if (next) setSelectedId(next.lineId);
        }
      } catch {
        setError("Kayıt çözümlenemedi, tekrar dene.");
      }
      setMode({ kind: "idle" });
    },
    [
      pack,
      buffers,
      ensureMic,
      sceneLayers,
      settings.latencyOffsetMs,
      settings.autoAdvance,
      takes,
      packId,
      onlyChar,
      lines,
    ],
  );

  const removeTake = useCallback(
    (lineId) => {
      setTakes((t) => {
        const n = new Map(t);
        n.delete(lineId);
        return n;
      });
      void deleteTake(packId, lineId);
    },
    [packId],
  );

  const setTakeGain = useCallback(
    (lineId, gain) => {
      setTakes((t) => {
        const cur = t.get(lineId);
        if (!cur) return t;
        const n = new Map(t).set(lineId, { ...cur, gain });
        void saveTake({
          packId,
          lineId,
          blob: cur.blob,
          mimeType: cur.mimeType,
          startAt: cur.startAt,
          gain,
          lineStart: cur.lineStart,
          lineEnd: cur.lineEnd,
          createdAt: Date.now(),
        });
        return n;
      });
    },
    [packId],
  );

  const exportMp4 = useCallback(async () => {
    if (!pack) return;
    setError(null);
    setMode({ kind: "exporting" });
    try {
      const form = new FormData();
      const list = [...takes.values()];
      form.set(
        "meta",
        JSON.stringify({
          takes: list.map((t) => ({ lineId: t.lineId, startAt: t.startAt, gain: t.gain })),
          options: {
            backgroundVolume: settings.bgVolume,
            enhanceVoice: settings.enhanceVoice,
            fillOriginal: settings.fillOriginal,
          },
        }),
      );
      for (const t of list) form.set(`line_${t.lineId}`, t.blob, `line_${t.lineId}.${extFor(t.mimeType)}`);
      const res = await fetch(withBase(`/api/packs/${pack.packId}/render`), { method: "POST", body: form });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Video oluşturulamadı (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pack.packId}-dub.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      setError(e.message);
    } finally {
      setMode({ kind: "idle" });
    }
  }, [pack, takes, settings]);

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape" || (e.code === "Space" && busy)) {
        e.preventDefault();
        stopAll();
        return;
      }
      if (busy || !selected) return;
      const k = e.key.toLowerCase();
      if (k === "r") record(selected);
      else if (k === "l") listenReference(selected);
      else if (k === "p") replayTake(selected);
      else if (e.code === "Space") {
        e.preventDefault();
        previewScene();
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const i = visibleLines.findIndex((l) => l.lineId === selectedId);
        const next = visibleLines[clamp(i + (e.key === "ArrowDown" ? 1 : -1), 0, visibleLines.length - 1)];
        if (next) setSelectedId(next.lineId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, selected, selectedId, visibleLines, record, listenReference, replayTake, previewScene, stopAll]);

  /* ---------------- render ---------------- */
  if (loadError)
    return (
      <>
        <AppHeader />
        <main className="packs-ui mx-auto max-w-xl flex-1 px-6 py-20 text-center">
          <h1 className="display text-3xl font-bold">Sahne açılamadı</h1>
          <p className="mt-2 text-muted">{loadError}</p>
          <Link href="/tr/paketler" className={btn("outline", "md", "mt-6")}>
            Paketlere dön
          </Link>
        </main>
      </>
    );

  if (!pack)
    return (
      <>
        <AppHeader />
        <div className="grid flex-1 place-items-center text-muted">
          <Spinner size={22} />
        </div>
      </>
    );

  const playingLineId = "lineId" in mode ? mode.lineId : null;
  const subtitleLine =
    mode.kind === "preview"
      ? (lines.find((l) => time >= l.startTime - 0.05 && time < l.endTime + 0.15) ?? null)
      : playingLineId !== null
        ? (lines.find((l) => l.lineId === playingLineId) ?? null)
        : selected;
  const subChar = subtitleLine ? charById.get(subtitleLine.characterId) : null;
  const playingNow =
    mode.kind === "recording" || mode.kind === "reference" || mode.kind === "replay" || mode.kind === "preview";
  const progress =
    subtitleLine && playingNow
      ? clamp((time - subtitleLine.startTime) / Math.max(0.1, subtitleLine.endTime - subtitleLine.startTime), 0, 1)
      : 1;
  const beforeLine = subtitleLine && playingNow && time < subtitleLine.startTime;
  const recordedCount = lines.filter((l) => takes.has(l.lineId)).length;
  const selChar = selected ? charById.get(selected.characterId) : null;

  const statusOf = (l) =>
    mode.kind === "recording" && mode.lineId === l.lineId
      ? { label: "Kayıtta", cls: "bg-rust/15 text-red-300 ring-rust/40" }
      : takes.has(l.lineId)
        ? { label: "Tamamlandı", cls: "bg-sage/10 text-sage-bright ring-sage/30" }
        : { label: "Bekliyor", cls: "text-dim ring-line" };

  return (
    <>
      <AppHeader>
        <span className="hidden sm:block">
          <Link href="/tr/paketler" className={btn("ghost", "md")}>
            <ArrowLeft size={16} /> Dub Pack’ler
          </Link>
        </span>
        {env?.canEdit && (
          <Link href={`/tr/paket/${pack.packId}/duzenle`} className={btn("outline", "md")}>
            <Pencil size={15} /> Düzenle
          </Link>
        )}
      </AppHeader>

      <main className="packs-ui mx-auto grid w-full max-w-7xl flex-1 gap-6 px-5 pb-16 pt-6 lg:px-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          <div>
            <p className="text-sm text-muted">{pack.category}</p>
            <h1 className="display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{pack.title}</h1>
          </div>

          {/* Stage */}
          <div className="relative overflow-hidden rounded-sm border border-brass/20 bg-black shadow-[0_30px_100px_rgba(0,0,0,0.42)]">
            <video ref={video} src={pack.videoUrl} muted playsInline preload="auto" className="aspect-video w-full" />

            {mode.kind === "recording" && (
              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-sm font-semibold">
                <span className="rec-pulse size-2.5 rounded-full bg-red-500" /> Kayıtta
              </div>
            )}
            {mode.kind === "countdown" && (
              <div className="absolute inset-0 grid place-items-center bg-black/55">
                <div className="text-center">
                  <span
                    key={mode.n}
                    className="count-pop block display text-[clamp(5rem,14vw,9rem)] font-extrabold leading-none"
                  >
                    {mode.n}
                  </span>
                  <span className="mt-2 block text-lg font-semibold" style={{ color: selChar?.color }}>
                    {selChar?.name} hazır ol
                  </span>
                </div>
              </div>
            )}
            {mode.kind === "loading" && (
              <div className="absolute inset-0 grid place-items-center bg-black/60 text-muted">
                <span className="flex items-center gap-3">
                  <Spinner /> Ses katmanları yükleniyor…
                </span>
              </div>
            )}

            {subtitleLine && mode.kind !== "countdown" && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-4 pb-4 pt-14 text-center sm:px-10 sm:pb-6">
                {subChar && (
                  <span
                    className="mb-1.5 inline-block rounded px-2 py-0.5 text-xs font-bold text-white sm:text-sm"
                    style={{ background: subChar.color }}
                  >
                    {subChar.name}
                  </span>
                )}
                <p
                  className={`subtitle-fill mx-auto max-w-[34ch] display text-[clamp(1.15rem,2.6vw,2rem)] font-bold leading-tight transition-opacity ${beforeLine ? "opacity-60" : ""}`}
                  style={{ "--p": beforeLine ? 0 : progress }}
                >
                  {subtitleLine.text || "…"}
                </p>
              </div>
            )}
          </div>

          {/* Line controller */}
          <section className="surface p-4">
            {selected ? (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-bold" style={{ color: selChar?.color }}>
                    {selChar?.name}
                  </span>
                  <span className="tabular text-sm text-muted">
                    {fmtTime(selected.startTime)} – {fmtTime(selected.endTime)} (
                    {(selected.endTime - selected.startTime).toFixed(1)} sn)
                  </span>
                  <span className="tabular ml-auto text-sm text-muted">
                    Replik {lines.findIndex((l) => l.lineId === selected.lineId) + 1} / {lines.length}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="listen" onClick={() => listenReference(selected)} disabled={busy} title="Kısayol: L">
                    <Ear size={16} /> Orijinal sesi dinle
                  </Button>
                  {mode.kind === "recording" || mode.kind === "countdown" ? (
                    <Button variant="rec" onClick={stopAll}>
                      <Square size={14} fill="currentColor" /> {mode.kind === "countdown" ? "Vazgeç" : "Kaydı bitir"}
                    </Button>
                  ) : (
                    <Button variant="rec" onClick={() => record(selected)} disabled={busy} title="Kısayol: R">
                      <Circle size={14} fill="currentColor" />{" "}
                      {takes.has(selected.lineId) ? "Yeniden kaydet" : "Kaydet"}
                    </Button>
                  )}
                  <Button
                    variant="listen"
                    onClick={() => replayTake(selected)}
                    disabled={busy || !takes.has(selected.lineId)}
                    title="Kısayol: P"
                  >
                    <Play size={16} /> Kaydımı dinle
                  </Button>
                  {(mode.kind === "reference" || mode.kind === "replay" || mode.kind === "preview") && (
                    <Button variant="ghost" onClick={stopAll}>
                      <Square size={14} /> Durdur
                    </Button>
                  )}
                </div>
                <div className="mt-3 rounded-sm bg-ink/60 px-2 border border-line">
                  {mic ? (
                    <MicMeter analyser={mic.analyser} active={mode.kind === "recording" || mode.kind === "countdown"} />
                  ) : (
                    <p className="flex h-14 items-center gap-2 px-2 text-sm text-muted">
                      <Headphones size={16} /> İlk kayıtta mikrofon izni istenir. Arka plan sesi mikrofona karışmasın
                      diye kulaklık tak.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-muted">Bu pakette replik yok.</p>
            )}
            {error && (
              <div className="mt-3">
                <Notice tone="error">{error}</Notice>
              </div>
            )}
          </section>

          {/* Scene controls */}
          <section className="flex flex-wrap items-center gap-3 surface p-4">
            <div className="mr-auto">
              <p className="font-semibold">
                <span className="tabular">{recordedCount}</span> / <span className="tabular">{lines.length}</span>{" "}
                replik kaydedildi
              </p>
              <div className="mt-1.5 h-1.5 w-48 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full bg-sage transition-[width]"
                  style={{ width: `${lines.length ? (recordedCount / lines.length) * 100 : 0}%` }}
                />
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowSettings((s) => !s)} aria-expanded={showSettings}>
              <Settings2 size={16} /> Ses ayarları
            </Button>
            {mode.kind === "preview" ? (
              <Button variant="listen" onClick={stopAll}>
                <Square size={14} /> Önizlemeyi durdur
              </Button>
            ) : (
              <Button variant="listen" onClick={previewScene} disabled={busy} title="Kısayol: Boşluk">
                <Film size={16} /> Tüm sahneyi önizle
              </Button>
            )}
            <Button variant="primary" onClick={exportMp4} disabled={busy || recordedCount === 0}>
              {mode.kind === "exporting" ? <Spinner /> : <Download size={16} />}{" "}
              {mode.kind === "exporting" ? "Video hazırlanıyor…" : "MP4 olarak indir"}
            </Button>

            {showSettings && (
              <div className="grid w-full gap-4 border-t border-line pt-4 text-sm sm:grid-cols-2">
                <label className="block">
                  <span className="flex justify-between font-semibold">
                    Arka plan sesi <span className="tabular text-muted">%{Math.round(settings.bgVolume * 100)}</span>
                  </span>
                  <input
                    type="range"
                    className="range w-full"
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={settings.bgVolume}
                    onChange={(e) => setSettings((s) => ({ ...s, bgVolume: Number(e.target.value) }))}
                  />
                </label>
                <label className="block">
                  <span className="flex justify-between font-semibold">
                    Senkron düzeltme{" "}
                    <span className="tabular text-muted">
                      {settings.latencyOffsetMs > 0 ? "+" : ""}
                      {settings.latencyOffsetMs} ms
                    </span>
                  </span>
                  <input
                    type="range"
                    className="range w-full"
                    min={-300}
                    max={300}
                    step={5}
                    value={settings.latencyOffsetMs}
                    onChange={(e) => setSettings((s) => ({ ...s, latencyOffsetMs: Number(e.target.value) }))}
                  />
                  <span className="text-xs text-muted">
                    Sesin videodan geç geliyorsa artır. Yeni kayıtlara uygulanır.
                  </span>
                </label>
                <label className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-brass"
                    checked={settings.fillOriginal}
                    onChange={(e) => setSettings((s) => ({ ...s, fillOriginal: e.target.checked }))}
                  />
                  <span>
                    <span className="font-semibold">Kaydedilmeyen replikler orijinal kalsın</span>
                    <span className="block text-xs text-muted">
                      Tek bir karakteri seslendirip diğerlerini orijinal sesle bırakabilirsin.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-brass"
                    checked={settings.enhanceVoice}
                    onChange={(e) => setSettings((s) => ({ ...s, enhanceVoice: e.target.checked }))}
                  />
                  <span>
                    <span className="font-semibold">Sesimi güçlendir</span>
                    <span className="block text-xs text-muted">
                      İndirilen videoda uğultuyu keser, sesini sıkıştırıp öne çıkarır.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-brass"
                    checked={settings.autoAdvance}
                    onChange={(e) => setSettings((s) => ({ ...s, autoAdvance: e.target.checked }))}
                  />
                  <span className="font-semibold">Kayıttan sonra sonraki repliğe geç</span>
                </label>
              </div>
            )}
          </section>
        </div>

        {/* Lines */}
        <aside className="flex min-h-0 flex-col lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7.5rem)]">
          {headphoneHint && (
            <div className="mb-3 flex items-start gap-3 rounded-sm border border-sage/30 bg-sage/[0.07] p-3 text-sm text-sage-bright">
              <Headphones size={18} className="mt-0.5 shrink-0" />
              <p className="flex-1">
                Kulaklıkla kaydet: müzik ve efektler kulağında çalarken sadece senin sesin kaydedilir.
              </p>
              <button
                className="text-xs font-semibold hover:underline"
                onClick={() => {
                  setHeadphoneHint(false);
                  try {
                    localStorage.setItem("dub:headphoneHint", "0");
                  } catch {
                    /* ignore */
                  }
                }}
              >
                Tamam
              </button>
            </div>
          )}
          {pack.characters.length > 1 && (
            <div className="mb-3">
              <p className="mb-2 text-sm font-semibold text-parchment">Kimi seslendiriyorsun?</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-pressed={onlyChar === null}
                  onClick={() => setOnlyChar(null)}
                  className={`chip focus-ring ${onlyChar === null ? "chip-active" : ""}`}
                >
                  Hepsi
                </button>
                {pack.characters.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={onlyChar === c.id}
                    onClick={() => {
                      setOnlyChar(c.id);
                      const first = lines.find((l) => l.characterId === c.id);
                      if (first) setSelectedId(first.lineId);
                    }}
                    className={`chip focus-ring ${onlyChar === c.id ? "chip-active" : ""}`}
                  >
                    <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <ol className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {visibleLines.map((l) => {
              const c = charById.get(l.characterId);
              const sel = l.lineId === selectedId;
              const st = statusOf(l);
              const take = takes.get(l.lineId);
              const nowPlaying = playingNow && time >= l.startTime && time < l.endTime;
              return (
                <li key={l.lineId}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-current={sel}
                    onClick={() => !busy && setSelectedId(l.lineId)}
                    onKeyDown={(e) =>
                      (e.key === "Enter" || e.key === " ") && !busy && (e.preventDefault(), setSelectedId(l.lineId))
                    }
                    className={`block w-full cursor-pointer rounded-sm px-3 py-2.5 text-left ring-1 transition-colors ${sel ? "bg-panel-2 ring-brass/60" : nowPlaying ? "bg-panel ring-sage/40" : "bg-panel ring-line hover:ring-muted"}`}
                    style={{ boxShadow: `inset 3px 0 0 ${c?.color ?? "#8B5CF6"}` }}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold" style={{ color: c?.color }}>
                        {c?.name}
                      </span>
                      <span className="tabular text-dim">{fmtTime(l.startTime)}</span>
                      <span className={`ml-auto rounded-full px-2 py-0.5 font-semibold ring-1 ${st.cls}`}>
                        {st.label}
                      </span>
                    </div>
                    <p className={`mt-1 text-[15px] leading-snug ${l.text ? "" : "italic text-dim"}`}>
                      {l.text || "Metin yok — repliği dinleyip kendi cümleni kur"}
                    </p>
                  </div>
                  {sel && take && (
                    <div className="mt-1 flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs text-muted">
                      <span>Kayıt sesi</span>
                      <input
                        type="range"
                        className="range flex-1"
                        min={0.2}
                        max={2.5}
                        step={0.05}
                        value={take.gain}
                        aria-label="Kayıt ses seviyesi"
                        onChange={(e) => setTakeGain(l.lineId, Number(e.target.value))}
                      />
                      <span className="tabular w-9 text-right">%{Math.round(take.gain * 100)}</span>
                      <button
                        className="grid size-7 place-items-center rounded-sm hover:bg-panel-2 hover:text-parchment"
                        onClick={() => record(l)}
                        disabled={busy}
                        aria-label="Yeniden kaydet"
                        title="Yeniden kaydet"
                      >
                        <RotateCcw size={13} />
                      </button>
                      <button
                        className="grid size-7 place-items-center rounded-sm hover:bg-rust/10 hover:text-red-400"
                        onClick={() => removeTake(l.lineId)}
                        disabled={busy}
                        aria-label="Kaydı sil"
                        title="Kaydı sil"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-dim">
            Kısayollar: R kaydet, L orijinali dinle, P kaydımı dinle, Boşluk sahneyi önizle, Esc durdur.
          </p>
        </aside>
      </main>
    </>
  );
}
