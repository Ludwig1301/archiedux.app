"use client";

import { useEffect, useRef } from "react";

/** Live oscilloscope of the microphone while recording. */
export function MicMeter({ analyser, active, color = "#EF4444" }) {
  const canvas = useRef(null);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !analyser) return;
    const g = c.getContext("2d");
    if (!g) return;
    const data = new Float32Array(analyser.fftSize);
    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== Math.floor(w * dpr)) {
        c.width = Math.floor(w * dpr);
        c.height = Math.floor(h * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      analyser.getFloatTimeDomainData(data);
      let peak = 0;
      g.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * w;
        const y = h / 2 + data[i] * (h / 2) * 0.9;
        peak = Math.max(peak, Math.abs(data[i]));
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokeStyle = active ? (peak > 0.95 ? "#FBBF24" : color) : "rgba(139,148,174,0.5)";
      g.lineWidth = 2;
      g.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser, active, color]);

  return <canvas ref={canvas} className="h-14 w-full" aria-label="Mikrofon dalga formu" />;
}
