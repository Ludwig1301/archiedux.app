"use client";

import { useEffect, useRef, useState } from "react";
import Waveform from "./waveform.jsx";
import { MicIcon, ResetIcon, StopIcon } from "./icons.jsx";

const COUNTDOWN_SECONDS = 3;

export default function VoiceRecorder({ maxSeconds = 8, onRecorded, hint }) {
  const [phase, setPhase] = useState("idle");
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [remaining, setRemaining] = useState(maxSeconds);
  const [stream, setStream] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const countdownRef = useRef(null);
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);
  const previewUrlRef = useRef("");

  function clearTimers() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function releaseStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }

  function revokePreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }
    setPreviewUrl("");
  }

  function stopRecording() {
    clearTimers();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        releaseStream();
        setPhase("idle");
      }
    } else {
      releaseStream();
      setPhase("idle");
    }
  }

  function retry() {
    clearTimers();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        /* yok say */
      }
    }
    releaseStream();
    revokePreview();
    setPhase("idle");
    setRemaining(maxSeconds);
    setCountdown(COUNTDOWN_SECONDS);
    setError("");
    onRecorded?.(null);
  }

  async function start() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Bu tarayıcı mikrofon kaydını desteklemiyor. Güncel Chrome, Edge veya Firefox kullan.");
      return;
    }

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = nextStream;
      setStream(nextStream);

      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(nextStream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        releaseStream();
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          previewUrlRef.current = url;
          setPreviewUrl(url);
          setPhase("done");
          onRecorded?.({ blob, duration: maxSeconds });
        } else {
          setError("Kayıt boş görünüyor. Mikrofonunun seçili olduğundan emin ol.");
          setPhase("idle");
        }
      };

      recorderRef.current = recorder;
      setPhase("countdown");
      setCountdown(COUNTDOWN_SECONDS);

      let count = COUNTDOWN_SECONDS;
      countdownRef.current = setInterval(() => {
        count -= 1;
        if (count > 0) {
          setCountdown(count);
          return;
        }

        clearInterval(countdownRef.current);
        countdownRef.current = null;

        try {
          recorder.start(150);
        } catch {
          setError("Kayıt başlatılamadı. Mikrofonu kontrol edip tekrar dene.");
          releaseStream();
          setPhase("idle");
          return;
        }

        setPhase("recording");
        setRemaining(maxSeconds);
        startedAtRef.current = performance.now();
        timerRef.current = setInterval(() => {
          const elapsed = (performance.now() - startedAtRef.current) / 1000;
          const left = Math.max(0, maxSeconds - elapsed);
          setRemaining(left);
          if (left <= 0) stopRecording();
        }, 80);
      }, 1000);
    } catch (recordError) {
      setError(recordError.message || "Mikrofon izni alınamadı.");
      releaseStream();
      setPhase("idle");
    }
  }

  useEffect(
    () => () => {
      clearTimers();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        try {
          recorder.stop();
        } catch {
          /* yok say */
        }
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    [],
  );

  return (
    <div className="rounded-sm border border-line bg-black/20 p-3.5">
      {phase === "idle" && (
        <div className="flex flex-col items-center gap-2.5 py-3 text-center">
          <button type="button" onClick={start} className="button-primary min-h-11 px-5">
            <MicIcon className="h-4 w-4" />
            Kaydı başlat
          </button>
          <p className="text-[11px] text-dim">{hint || `Geri sayımdan sonra en fazla ${maxSeconds} saniye kayıt.`}</p>
        </div>
      )}

      {phase === "countdown" && (
        <div className="flex flex-col items-center gap-2 py-3">
          <span className="grid h-20 w-20 place-items-center rounded-full border border-brass/50 bg-ink text-4xl font-bold text-brass">
            {countdown}
          </span>
          <p className="text-xs text-muted">Hazır ol, kayıt birazdan başlıyor…</p>
        </div>
      )}

      {phase === "recording" && (
        <div>
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="inline-flex items-center gap-2 text-brass">
              <span className="record-dot" /> Kaydediliyor
            </span>
            <span className="font-mono text-muted">{remaining.toFixed(1)}s</span>
          </div>
          <div className="meter-track mt-2 h-1.5">
            <div
              className="meter-fill"
              style={{ width: `${Math.max(0, Math.min(1, 1 - remaining / maxSeconds)) * 100}%` }}
            />
          </div>
          <div className="mt-2 rounded-sm border border-line/70 bg-ink/40 px-2">
            <Waveform stream={stream} active={phase === "recording"} bars={48} className="h-12" />
          </div>
          <button type="button" onClick={stopRecording} className="button-danger mt-3 min-h-9 w-full text-xs">
            <StopIcon className="h-4 w-4" />
            Kaydı bitir
          </button>
        </div>
      )}

      {phase === "done" && (
        <div>
          <p className="text-xs font-semibold text-sage">Kayıt hazır. Dinle veya tekrar çek.</p>
          {previewUrl && <audio src={previewUrl} controls className="mt-2 h-9 w-full" />}
          <button type="button" onClick={retry} className="button-secondary mt-2 min-h-9 w-full text-xs">
            <ResetIcon className="h-4 w-4" />
            Tekrar çek
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[11px] leading-5 text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
