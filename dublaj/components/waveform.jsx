"use client";

import { useEffect, useRef } from "react";

function sizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.floor((rect.width || 300) * dpr));
  const height = Math.max(1, Math.floor((rect.height || 52) * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { dpr, width, height };
}

function paintIdle(canvas, bars) {
  const { width, height } = sizeCanvas(canvas);
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, width, height);
  const gap = width / bars;
  for (let index = 0; index < bars; index += 1) {
    const wave = (Math.sin(index * 1.37) + 1) / 2;
    const barHeight = Math.max(height * 0.08, wave * height * 0.42);
    const x = index * gap + gap * 0.24;
    const y = (height - barHeight) / 2;
    context.fillStyle = "rgba(201, 162, 39, 0.22)";
    context.fillRect(x, y, gap * 0.52, barHeight);
  }
}

export default function Waveform({ stream, active = false, bars = 52, className = "" }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);

  useEffect(() => {
    if (!stream) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return undefined;

    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.78;
    source.connect(analyser);
    audioContext.resume().catch(() => {});

    const data = new Uint8Array(analyser.frequencyBinCount);

    function draw() {
      const current = canvasRef.current;
      if (!current) return;
      const { width, height } = sizeCanvas(current);
      const context = current.getContext("2d");
      if (!context) return;
      analyser.getByteFrequencyData(data);
      context.clearRect(0, 0, width, height);

      const gap = width / bars;
      const gradient = context.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "rgba(224, 189, 74, 0.95)");
      gradient.addColorStop(0.55, "rgba(201, 162, 39, 0.8)");
      gradient.addColorStop(1, "rgba(139, 115, 34, 0.55)");

      for (let index = 0; index < bars; index += 1) {
        const sampleIndex = Math.floor((index / bars) * data.length);
        const value = data[sampleIndex] / 255;
        const barHeight = Math.max(height * 0.07, value * height * 0.95);
        const x = index * gap + gap * 0.24;
        const y = (height - barHeight) / 2;
        context.fillStyle = gradient;
        context.fillRect(x, y, gap * 0.52, barHeight);
      }

      frameRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(frameRef.current);
      source.disconnect();
      analyser.disconnect();
      audioContext.close().catch(() => {});
    };
  }, [stream, bars]);

  useEffect(() => {
    if (stream) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const draw = () => paintIdle(canvas, bars);
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [stream, bars, active]);

  return (
    <canvas
      ref={canvasRef}
      className={`waveform ${active ? "" : "opacity-45"} ${className}`}
      aria-hidden="true"
    />
  );
}
