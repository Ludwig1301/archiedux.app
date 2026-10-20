"use client";

import { useCallback, useRef } from "react";
import { clamp, fmtTime } from "../../lib/packs/client/format.js";

/** Two-thumb range selector. Dragging the middle moves the whole window. */
export function RangeSlider({ min = 0, max, start, end, maxSpan, step = 0.1, onChange }) {
  const track = useRef(null);
  const span = Math.max(0.001, max - min);
  const pct = (v) => ((v - min) / span) * 100;
  const snap = (v) => Math.round(v / step) * step;

  const drag = useCallback(
    (kind) => (e) => {
      e.preventDefault();
      const el = track.current;
      if (!el) return;
      e.target.setPointerCapture(e.pointerId);
      const rect = el.getBoundingClientRect();
      const origin = min + ((e.clientX - rect.left) / rect.width) * span;
      const s0 = start;
      const e0 = end;
      const move = (ev) => {
        const v = min + ((ev.clientX - rect.left) / rect.width) * span;
        if (kind === "start") {
          const s = clamp(snap(v), min, e0 - 0.5);
          onChange(s, e0 - s > maxSpan ? s + maxSpan : e0);
        } else if (kind === "end") {
          const en = clamp(snap(v), s0 + 0.5, max);
          onChange(en - s0 > maxSpan ? en - maxSpan : s0, en);
        } else {
          const d = clamp(snap(v - origin), min - s0, max - e0);
          onChange(s0 + d, e0 + d);
        }
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [start, end, min, max, span, maxSpan, onChange],
  );

  const key = (kind) => (e) => {
    const d = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!d) return;
    e.preventDefault();
    const amt = d * (e.shiftKey ? 5 : 1);
    if (kind === "start") onChange(clamp(start + amt, min, end - 0.5), end);
    else onChange(start, clamp(end + amt, start + 0.5, Math.min(max, start + maxSpan)));
  };

  return (
    <div className="select-none pt-7 pb-1">
      <div ref={track} className="relative h-2 rounded-full bg-line">
        <div
          className="absolute inset-y-0 cursor-grab rounded-full bg-brass active:cursor-grabbing"
          style={{ left: `${pct(start)}%`, width: `${pct(end) - pct(start)}%` }}
          onPointerDown={drag("both")}
        />
        {["start", "end"].map((k) => {
          const v = k === "start" ? start : end;
          return (
            <div
              key={k}
              role="slider"
              tabIndex={0}
              aria-label={k === "start" ? "Başlangıç" : "Bitiş"}
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={Math.round(v * 10) / 10}
              aria-valuetext={fmtTime(v)}
              onKeyDown={key(k)}
              onPointerDown={drag(k)}
              className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-2 border-brass bg-parchment"
              style={{ left: `${pct(v)}%` }}
            >
              <span
                className={`tabular absolute bottom-full mb-1.5 whitespace-nowrap rounded bg-panel-2 px-1.5 py-0.5 text-[11px] font-semibold text-parchment border border-line ${
                  (k === "start" ? pct(v) > 12 : pct(v) > 88) ? "right-1/2 -mr-2" : "left-1/2 -ml-2"
                }`}
              >
                {fmtTime(v)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
