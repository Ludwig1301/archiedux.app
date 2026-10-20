"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";

import { clamp, round2 } from "../../lib/packs/client/format.js";

const SNAP = 0.05;
const MIN_LEN = 0.2;
const snap = (v) => Math.round(v / SNAP) * SNAP;

export function Timeline({
  duration,
  lines,
  characters,
  selectedId,
  currentTime,
  peaks,
  onSeek,
  onSelect,
  onChangeTiming,
}) {
  const scroller = useRef(null);
  const canvas = useRef(null);
  const [viewW, setViewW] = useState(800);
  const [zoom, setZoom] = useState(1); // 1 = fit to width
  const pps = Math.max(8, (viewW / Math.max(1, duration)) * zoom);
  const width = Math.max(viewW, duration * pps);
  const colors = new Map(characters.map((c) => [c.id, c.color]));

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    setViewW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Waveform
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const h = 56;
    const w = Math.min(32000, Math.floor(width));
    c.width = Math.floor(w * dpr);
    c.height = Math.floor(h * dpr);
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const g = c.getContext("2d");
    if (!g) return;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, w, h);
    if (!peaks) return;
    const buckets = peaks.length / 2;
    const contentW = duration * pps;
    g.fillStyle = "rgba(103, 232, 249, 0.45)";
    for (let x = 0; x < Math.min(w, contentW); x++) {
      const b = Math.floor((x / contentW) * buckets);
      const min = peaks[b * 2] ?? 0;
      const max = peaks[b * 2 + 1] ?? 0;
      const y1 = h / 2 - max * (h / 2) * 0.95;
      const y2 = h / 2 - min * (h / 2) * 0.95;
      g.fillRect(x, y1, 1, Math.max(1, y2 - y1));
    }
  }, [peaks, width, pps, duration]);

  // Keep the playhead visible while playing.
  useEffect(() => {
    const el = scroller.current;
    if (!el || zoom <= 1) return;
    const x = currentTime * pps;
    if (x < el.scrollLeft + 40 || x > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = x - el.clientWidth / 3;
  }, [currentTime, pps, zoom]);

  const timeAt = useCallback(
    (clientX) => {
      const el = scroller.current;
      const rect = el.getBoundingClientRect();
      return clamp((clientX - rect.left + el.scrollLeft) / pps, 0, duration);
    },
    [pps, duration],
  );

  const startDrag = (line, mode) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const x0 = e.clientX;
    const s0 = line.startTime;
    const e0 = line.endTime;
    let moved = false;
    const move = (ev) => {
      const dt = (ev.clientX - x0) / pps;
      if (Math.abs(ev.clientX - x0) > 3) moved = true;
      if (!moved) return;
      if (mode === "move") {
        const d = clamp(snap(dt), -s0, duration - e0);
        onChangeTiming(line.lineId, round2(s0 + d), round2(e0 + d));
      } else if (mode === "l") {
        onChangeTiming(line.lineId, round2(clamp(snap(s0 + dt), 0, e0 - MIN_LEN)), e0);
      } else {
        onChangeTiming(line.lineId, s0, round2(clamp(snap(e0 + dt), s0 + MIN_LEN, duration)));
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!moved) {
        onSelect(line.lineId);
        onSeek(line.startTime);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const tickEvery = pps > 120 ? 0.5 : pps > 50 ? 1 : pps > 20 ? 5 : 10;
  const ticks = [];
  for (let t = 0; t <= duration + 0.001; t += tickEvery) ticks.push(t);

  return (
    <div className="surface">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-sm text-muted">
        <span>Zaman çizelgesi</span>
        <span className="hidden text-dim sm:inline">
          Blokları sürükle, kenarlardan uzat. I / O tuşları seçili repliğin başını ve sonunu oynatıcıya taşır.
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            className="grid size-7 place-items-center rounded-sm hover:bg-panel-2 hover:text-parchment"
            aria-label="Uzaklaştır"
            onClick={() => setZoom((z) => Math.max(1, z / 1.5))}
          >
            <ZoomOut size={15} />
          </button>
          <span className="tabular w-10 text-center text-xs">{zoom.toFixed(1)}×</span>
          <button
            className="grid size-7 place-items-center rounded-sm hover:bg-panel-2 hover:text-parchment"
            aria-label="Yakınlaştır"
            onClick={() => setZoom((z) => Math.min(20, z * 1.5))}
          >
            <ZoomIn size={15} />
          </button>
        </div>
      </div>
      <div
        ref={scroller}
        className="relative overflow-x-auto overflow-y-hidden"
        onPointerDown={(e) => onSeek(timeAt(e.clientX))}
      >
        <div className="relative" style={{ width }}>
          {/* ruler */}
          <div className="relative h-6 border-b border-line/60">
            {ticks.map((t) => (
              <div key={t} className="absolute top-0 h-full border-l border-line/80" style={{ left: t * pps }}>
                {(t % (tickEvery >= 5 ? tickEvery : 5) === 0 || pps > 50) && (
                  <span className="tabular absolute left-1 top-0.5 text-[10px] text-dim">
                    {Number.isInteger(t) ? `${t}s` : t.toFixed(1)}
                  </span>
                )}
              </div>
            ))}
          </div>
          <canvas ref={canvas} className="block" aria-hidden />
          {/* line blocks */}
          <div className="relative h-14 border-t border-line/60">
            {lines.map((l) => {
              const sel = l.lineId === selectedId;
              const color = colors.get(l.characterId) ?? "#8B5CF6";
              return (
                <div
                  key={l.lineId}
                  onPointerDown={startDrag(l, "move")}
                  className={`group absolute top-2 h-10 cursor-grab overflow-hidden rounded-sm text-xs font-semibold text-white active:cursor-grabbing ${sel ? "ring-2 ring-white z-10" : "ring-1 ring-black/30"}`}
                  style={{
                    left: l.startTime * pps,
                    width: Math.max(4, (l.endTime - l.startTime) * pps),
                    background: `${color}${sel ? "" : "CC"}`,
                  }}
                  title={l.text}
                >
                  <span className="pointer-events-none block truncate px-2 pt-1 leading-tight drop-shadow">
                    {l.text || "…"}
                  </span>
                  <span className="tabular pointer-events-none block truncate px-2 text-[10px] font-medium opacity-75">
                    #{l.lineId}
                  </span>
                  <div
                    onPointerDown={startDrag(l, "l")}
                    className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-white/0 hover:bg-white/40"
                  />
                  <div
                    onPointerDown={startDrag(l, "r")}
                    className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-white/0 hover:bg-white/40"
                  />
                </div>
              );
            })}
          </div>
          {/* playhead */}
          <div className="pointer-events-none absolute inset-y-0 w-px bg-red-500" style={{ left: currentTime * pps }}>
            <div className="absolute -left-[5px] top-0 size-[11px] rotate-45 bg-red-500" />
          </div>
        </div>
      </div>
    </div>
  );
}
