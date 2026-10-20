"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Waveform from "./waveform.jsx";
import { CheckIcon, MicIcon, StopIcon } from "./icons.jsx";

export default function MicTester({ compact = false }) {
  const [stream, setStream] = useState(null);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const contextRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const frameRef = useRef(0);

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    stream?.getTracks().forEach((track) => track.stop());
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    contextRef.current?.close?.().catch(() => {});
    contextRef.current = null;
    sourceRef.current = null;
    analyserRef.current = null;
    setStream(null);
    setLevel(0);
    setTesting(false);
  }, [stream]);

  useEffect(() => () => {
    cancelAnimationFrame(frameRef.current);
    stream?.getTracks().forEach((track) => track.stop());
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    contextRef.current?.close?.().catch(() => {});
  }, [stream]);

  async function start() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Bu tarayıcı mikrofon erişimini desteklemiyor.");
      return;
    }

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContextClass();
      const source = context.createMediaStreamSource(nextStream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      await context.resume().catch(() => {});

      contextRef.current = context;
      sourceRef.current = source;
      analyserRef.current = analyser;
      setStream(nextStream);
      setTesting(true);

      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let index = 0; index < data.length; index += 1) {
          const value = (data[index] - 128) / 128;
          sum += value * value;
        }
        const rms = Math.sqrt(sum / data.length);
        setLevel(Math.min(1, rms * 4.2));
        frameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (permissionError) {
      setError(
        permissionError?.name === "NotAllowedError"
          ? "Mikrofon izni verilmedi. Adres çubuğundaki kilit simgesinden izin ver."
          : permissionError?.message || "Mikrofon başlatılamadı.",
      );
    }
  }

  const levelPercent = Math.round(level * 100);
  const status = level > 0.28 ? "Ses algılanıyor" : level > 0.06 ? "Düşük seviye" : "Sessiz";

  return (
    <div className={`rounded-sm border border-line bg-black/25 p-4 ${compact ? "" : "sm:p-5"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-sm border border-brass/25 bg-brass/[0.07] text-brass">
            <MicIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-parchment">Mikrofon testi</p>
            <p className="text-[11px] text-dim">İzin sadece bu düğmeye bastığında istenir.</p>
          </div>
        </div>
        {testing ? (
          <button type="button" onClick={stop} className="button-secondary min-h-8 px-2.5 text-[11px]">
            <StopIcon className="h-3.5 w-3.5" />
            Durdur
          </button>
        ) : (
          <button type="button" onClick={start} className="button-primary min-h-8 px-2.5 text-[11px]">
            <MicIcon className="h-3.5 w-3.5" />
            Test et
          </button>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-dim">
          <span className={testing ? "text-brass" : ""}>{testing ? status : "Mikrofon kapalı"}</span>
          <span className="font-mono">{testing ? `${levelPercent}%` : "—"}</span>
        </div>
        <div className="meter-track mt-1.5 h-2">
          <div className="meter-fill" style={{ width: `${testing ? levelPercent : 0}%` }} />
        </div>
        <div className="mt-2 rounded-sm border border-line/70 bg-ink/40 px-2">
          <Waveform stream={stream} active={testing} bars={48} className="h-10" />
        </div>
      </div>

      {testing && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-sage">
          <CheckIcon className="h-3.5 w-3.5" />
          Mikrofon bağlı. Konuşurken çubuk hareket etmiyorsa tarayıcı ayarlarını kontrol et.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[11px] leading-5 text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
