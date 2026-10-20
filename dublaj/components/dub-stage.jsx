"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Waveform from "./waveform.jsx";
import {
  CheckIcon,
  DownloadIcon,
  HeadphonesIcon,
  MicIcon,
  PlayIcon,
  ResetIcon,
  SpeakerIcon,
  StopIcon,
} from "./icons.jsx";

const COUNTDOWN_SECONDS = 3;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timer = setTimeout(() => {
      reject(new Error("Video oynatıcısı yüklenemedi. Bağlantını kontrol et."));
    }, 15_000);

    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      previous?.();
      resolve(window.YT);
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Video oynatıcısı yüklenemedi. Bağlantını kontrol et."));
      };
      document.head.appendChild(script);
    }
  });
}

function writeAscii(view, offset, text) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

function encodeWav(audioBuffer) {
  const samples = audioBuffer.getChannelData(0);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return new Blob([view], { type: "audio/wav" });
}

function slugify(value) {
  return String(value || "sahne")
    .toLocaleLowerCase("tr")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export default function DubStage({ scene, video, className = "" }) {
  const isYouTube = !video || video.kind === "youtube";
  const youtubeId = isYouTube ? video?.videoId || scene.videoId : null;
  const fileSrc = !isYouTube ? video?.src : null;
  const lines = scene.lines;

  const [activeId, setActiveId] = useState(lines[0]?.id || "");
  const [mode, setMode] = useState("idle");
  const [countdown, setCountdown] = useState(0);
  const [progress, setProgress] = useState(0);
  const [recordings, setRecordings] = useState({});
  const [micStream, setMicStream] = useState(null);
  const [videoReady, setVideoReady] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const hostRef = useRef(null);
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const sourcesRef = useRef([]);
  const urlsRef = useRef([]);
  const monitorRef = useRef(null);
  const countdownRef = useRef(null);
  const startTimerRef = useRef(null);
  const audioRef = useRef(null);
  const modeRef = useRef(mode);
  const activeIdRef = useRef(activeId);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const activeLine = useMemo(
    () => lines.find((line) => line.id === activeId) || lines[0],
    [activeId, lines],
  );

  const activeCharacter = scene.characters.find(
    (character) => character.id === activeLine?.characterId,
  );

  const recordedCount = lines.filter((line) => recordings[line.id]).length;
  const allRecorded = lines.length > 0 && recordedCount === lines.length;
  const hasRecordings = recordedCount > 0;
  const isBusy = mode === "countdown" || mode === "recording";
  const isPlaying = mode === "reference" || mode === "preview" || mode === "take";

  const clearTimers = useCallback(() => {
    if (monitorRef.current) {
      clearInterval(monitorRef.current);
      monitorRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
  }, []);

  const stopSources = useCallback(() => {
    for (const source of sourcesRef.current) {
      try {
        source.stop();
      } catch {
        /* kaynak zaten bitmiş olabilir */
      }
    }
    sourcesRef.current = [];
  }, []);

  const unlockAudio = useCallback(async () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, []);

  const pauseVideo = useCallback(() => {
    try {
      if (isYouTube) playerRef.current?.pauseVideo?.();
      else videoRef.current?.pause();
    } catch {
      /* yok say */
    }
  }, [isYouTube]);

  const playVideo = useCallback(() => {
    try {
      if (isYouTube) playerRef.current?.playVideo?.();
      else videoRef.current?.play?.().catch(() => {});
    } catch {
      /* yok say */
    }
  }, [isYouTube]);

  const muteVideo = useCallback(
    (muted) => {
      try {
        if (isYouTube) {
          if (muted) playerRef.current?.mute?.();
          else playerRef.current?.unMute?.();
        } else if (videoRef.current) {
          videoRef.current.muted = muted;
        }
      } catch {
        /* yok say */
      }
    },
    [isYouTube],
  );

  const seekVideo = useCallback(
    (time) => {
      try {
        if (isYouTube) playerRef.current?.seekTo?.(time, true);
        else if (videoRef.current) videoRef.current.currentTime = time;
      } catch {
        /* yok say */
      }
    },
    [isYouTube],
  );

  const getVideoTime = useCallback(() => {
    try {
      if (isYouTube) return playerRef.current?.getCurrentTime?.() || 0;
      return videoRef.current?.currentTime || 0;
    } catch {
      return 0;
    }
  }, [isYouTube]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {
        /* yok say */
      }
      audioRef.current = null;
    }
  }, []);

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const stopMic = useCallback(() => {
    releaseMic();
    setMicStream(null);
  }, [releaseMic]);

  const resetPlayback = useCallback(() => {
    clearTimers();
    stopSources();
    stopAudio();
    pauseVideo();
    muteVideo(true);
    setProgress(0);
    setMode("idle");
  }, [clearTimers, muteVideo, pauseVideo, stopAudio, stopSources]);

  const finishLinePlayback = useCallback(() => {
    resetPlayback();
  }, [resetPlayback]);

  useEffect(() => {
    setActiveId(lines[0]?.id || "");
    setMode("idle");
    setProgress(0);
    setCountdown(0);
    setRecordings({});
    setMessage("");
    setError("");
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current = [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  useEffect(() => {
    if (!youtubeId || !isYouTube) return undefined;
    let cancelled = false;
    setVideoReady(false);

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        playerRef.current = new YT.Player(hostRef.current, {
          videoId: youtubeId,
          playerVars: {
            start: Math.floor(scene.sourceStart),
            end: Math.ceil(scene.sourceEnd),
            rel: 0,
            playsinline: 1,
            enablejsapi: 1,
            controls: 0,
            modestbranding: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              try {
                event.target.mute();
                event.target.seekTo(scene.sourceStart, true);
              } catch {
                /* yok say */
              }
              setVideoReady(true);
            },
            onError: () => {
              if (!cancelled) setError("Sahne videosu açılamadı. Kaynak sayfasından izlemeyi dene.");
            },
          },
        });
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message || "Video oynatıcısı yüklenemedi.");
      });

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* yok say */
      }
      playerRef.current = null;
      setVideoReady(false);
    };
  }, [isYouTube, youtubeId, scene.sourceStart, scene.sourceEnd]);

  useEffect(() => {
    if (isYouTube) return;
    setVideoReady(false);
  }, [fileSrc, isYouTube]);

  useEffect(
    () => () => {
      clearTimers();
      stopSources();
      stopAudio();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        try {
          recorder.stop();
        } catch {
          /* yok say */
        }
      }
      releaseMic();
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      urlsRef.current = [];
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* yok say */
      }
      audioContextRef.current?.close?.().catch(() => {});
    },
    [clearTimers, releaseMic, stopAudio, stopSources],
  );

  function selectLine(lineId) {
    if (mode === "countdown" || mode === "recording" || mode === "preview") return;
    resetPlayback();
    setActiveId(lineId);
  }

  async function toggleReference() {
    if (mode === "reference") {
      finishLinePlayback();
      return;
    }
    if (mode === "countdown" || mode === "recording" || mode === "preview") return;
    if (!videoReady) {
      setError("Video henüz hazır değil; birkaç saniye sonra tekrar dene.");
      return;
    }
    resetPlayback();
    setError("");
    setMessage("");
    await unlockAudio();
    const line = activeIdRef.current
      ? lines.find((item) => item.id === activeIdRef.current)
      : lines[0];
    if (!line) return;
    seekVideo(Math.max(scene.sourceStart, line.start));
    muteVideo(false);
    playVideo();
    setMode("reference");
    const span = Math.max(0.2, line.end - line.start);

    monitorRef.current = setInterval(() => {
      const time = getVideoTime();
      setProgress(Math.max(0, Math.min(1, (time - line.start) / span)));
      if (time >= line.end - 0.08) finishLinePlayback();
    }, 100);
  }

  function endTake() {
    clearTimers();
    pauseVideo();
    muteVideo(true);
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        stopMic();
        setMode("idle");
        setProgress(0);
      }
    } else {
      stopMic();
      setMode("idle");
      setProgress(0);
    }
  }

  async function startTake() {
    if (isBusy || mode === "preview") return;
    setError("");
    setMessage("");

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Bu tarayıcı mikrofon kaydını desteklemiyor. Güncel Chrome, Edge veya Firefox kullan.");
      return;
    }

    const line = activeIdRef.current
      ? lines.find((item) => item.id === activeIdRef.current)
      : lines[0];
    if (!line) return;

    resetPlayback();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicStream(stream);
      await unlockAudio();

      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const lineId = line.id;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        stopMic();
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          urlsRef.current.push(url);
          setRecordings((current) => ({ ...current, [lineId]: { blob, url } }));
          setMessage("Kayıt hazır. Dinleyebilir veya yeniden çekebilirsin.");
        } else {
          setError("Kayıt boş görünüyor. Mikrofonunun seçili olduğundan emin ol.");
        }
        setMode("idle");
        setProgress(0);
      };

      recorderRef.current = recorder;

      seekVideo(line.start);
      pauseVideo();
      muteVideo(true);
      setMode("countdown");
      setCountdown(COUNTDOWN_SECONDS);

      let remaining = COUNTDOWN_SECONDS;
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          setCountdown(remaining);
          return;
        }

        clearInterval(countdownRef.current);
        countdownRef.current = null;
        setCountdown(0);

        try {
          recorder.start(150);
        } catch {
          setError("Kayıt başlatılamadı. Mikrofonu kontrol edip tekrar dene.");
          stopMic();
          setMode("idle");
          return;
        }

        muteVideo(true);
        seekVideo(line.start);
        playVideo();
        setMode("recording");

        const duration = Math.max(0.6, line.end - line.start);
        const startedAt = performance.now();
        monitorRef.current = setInterval(() => {
          const elapsed = (performance.now() - startedAt) / 1000;
          setProgress(Math.min(1, elapsed / duration));
          if (elapsed >= duration) endTake();
        }, 80);
      }, 1000);
    } catch (recordError) {
      setError(recordError.message || "Mikrofon izni alınamadı.");
      stopMic();
      resetPlayback();
    }
  }

  async function playTake() {
    const local = recordings[activeIdRef.current];
    if (!local) return;
    resetPlayback();
    setError("");
    await unlockAudio();
    const audio = new Audio(local.url);
    audioRef.current = audio;
    setMode("take");
    setProgress(0);
    audio.ontimeupdate = () => {
      if (audio.duration) setProgress(Math.min(1, audio.currentTime / audio.duration));
    };
    audio.onended = () => {
      audioRef.current = null;
      setMode("idle");
      setProgress(0);
    };
    audio.play().catch(() => {
      setError("Kayıt oynatılamadı.");
      setMode("idle");
      setProgress(0);
    });
  }

  async function previewScene() {
    if (mode === "preview") {
      resetPlayback();
      return;
    }
    if (!allRecorded) {
      setError("Önizleme için önce tüm replikleri kaydet.");
      return;
    }
    if (!videoReady) {
      setError("Video hazır değil; birkaç saniye sonra tekrar dene.");
      return;
    }

    resetPlayback();
    setError("");
    setMessage("");
    const context = await unlockAudio();
    if (!context) {
      setError("Ses motoru bu tarayıcıda başlatılamadı.");
      return;
    }

    const decoded = [];
    for (const line of lines) {
      const recording = recordings[line.id];
      if (!recording) continue;
      try {
        const buffer = await context.decodeAudioData(await recording.blob.arrayBuffer());
        decoded.push({ line, buffer });
      } catch {
        setError("Bir kayıt çözülemedi. O repliği yeniden kaydetmeyi dene.");
      }
    }

    if (!decoded.length) {
      setError("Oynatılacak kayıt bulunamadı.");
      return;
    }

    const startDelay = 0.7;
    const startAt = context.currentTime + startDelay;
    seekVideo(scene.sourceStart);
    muteVideo(true);

    for (const { line, buffer } of decoded) {
      const offset = Math.max(0, line.start - scene.sourceStart);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start(startAt + offset);
      sourcesRef.current.push(source);
    }

    setMode("preview");
    setProgress(0);
    startTimerRef.current = setTimeout(() => {
      if (modeRef.current === "preview") playVideo();
    }, startDelay * 1000);

    const span = Math.max(0.2, scene.sourceEnd - scene.sourceStart);
    monitorRef.current = setInterval(() => {
      const time = getVideoTime();
      setProgress(Math.max(0, Math.min(1, (time - scene.sourceStart) / span)));
      const line = lines.find((item) => time >= item.start && time < item.end);
      if (line && line.id !== activeIdRef.current) setActiveId(line.id);
      if (time >= scene.sourceEnd - 0.08) resetPlayback();
    }, 120);
  }

  async function downloadDub() {
    if (!hasRecordings || exporting) return;
    setExporting(true);
    setError("");
    setMessage("");
    try {
      const context = await unlockAudio();
      if (!context) throw new Error("Ses motoru başlatılamadı.");
      const span = Math.max(0.5, scene.sourceEnd - scene.sourceStart);
      const sampleRate = context.sampleRate;
      const totalSamples = Math.ceil((span + 1) * sampleRate);
      const mixed = context.createBuffer(1, totalSamples, sampleRate);
      const channel = mixed.getChannelData(0);

      for (const line of lines) {
        const recording = recordings[line.id];
        if (!recording) continue;
        try {
          const buffer = await context.decodeAudioData(await recording.blob.arrayBuffer());
          const data = buffer.getChannelData(0);
          const offset = Math.floor(Math.max(0, line.start - scene.sourceStart) * sampleRate);
          for (let index = 0; index < data.length && offset + index < totalSamples; index += 1) {
            channel[offset + index] += data[index];
          }
        } catch {
          /* tek bir replik çözülemezse diğerlerini indirmeye devam et */
        }
      }

      const wav = encodeWav(mixed);
      const url = URL.createObjectURL(wav);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slugify(scene.title)}-dublaj.wav`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMessage("Dublaj sesi WAV olarak indirildi.");
    } catch (downloadError) {
      setError(downloadError.message || "Dublaj indirilemedi.");
    } finally {
      setExporting(false);
    }
  }

  const statusText =
    mode === "countdown"
      ? `Hazır ol · ${countdown}`
      : mode === "recording"
        ? "Kaydediliyor"
        : mode === "reference"
          ? "Orijinal ses"
          : mode === "preview"
            ? "Dublaj oynatılıyor"
            : mode === "take"
              ? "Kaydın oynatılıyor"
              : videoReady
                ? "Kayıt için hazır"
                : "Video hazırlanıyor";

  const displayedProgress =
    mode === "countdown" ? Math.max(0, 1 - countdown / COUNTDOWN_SECONDS) : progress;

  return (
    <section className={`stage-shell ${className}`} aria-label="İnteraktif dublaj sahnesi">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div>
          <p className="eyebrow">Native Dub Stage</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-parchment sm:text-xl">{scene.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-brass/25 bg-brass/[0.07] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-brass">
            <span className="record-dot" /> Canlı demo
          </span>
          <span className="rounded-sm border border-line px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-dim">
            {recordedCount}/{lines.length} kayıt
          </span>
        </div>
      </div>

      <div className="relative aspect-video overflow-hidden border-b border-line bg-black">
        {isYouTube ? (
          <div ref={hostRef} className="h-full w-full" />
        ) : (
          <video
            ref={videoRef}
            src={fileSrc}
            muted
            playsInline
            className="h-full w-full object-contain"
            onLoadedMetadata={() => setVideoReady(true)}
            onError={() => setError("Yüklediğin video oynatılamadı.")}
          />
        )}

        {!videoReady && (
          <div className="absolute inset-0 grid place-items-center bg-ink/70 text-sm text-muted">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brass" />
              Video hazırlanıyor…
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/65 to-transparent p-3.5">
          <span className="inline-flex items-center gap-2 rounded-sm border border-line bg-black/45 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-parchment backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-brass" />
            {scene.film}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-black/45 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted backdrop-blur">
            <SpeakerIcon className="h-3 w-3" />
            {mode === "recording" || mode === "countdown" ? "Sessiz" : "Orijinal"}
          </span>
        </div>

        {mode === "countdown" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-ink/40">
            <span className="grid h-24 w-24 place-items-center rounded-full border border-brass/55 bg-ink/80 text-5xl font-bold text-brass shadow-glow">
              {countdown}
            </span>
          </div>
        )}

        {mode === "recording" && (
          <span className="absolute left-3.5 top-12 inline-flex items-center gap-2 rounded-sm bg-rust px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Kayıt
          </span>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/92 via-black/60 to-transparent px-4 pb-4 pt-10 sm:px-5">
          {activeLine && (
            <>
              <p
                className="text-[11px] font-bold uppercase tracking-[0.17em]"
                style={{ color: activeCharacter?.color || "#c9a227" }}
              >
                {activeCharacter?.name || "Karakter"}
                <span className="ml-2 font-mono text-[10px] font-normal tracking-normal text-muted">
                  {activeLine.start.toFixed(1)}s – {activeLine.end.toFixed(1)}s
                </span>
              </p>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-parchment sm:text-base">
                “{activeLine.text}”
              </p>
            </>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
          <div
            className="h-full bg-brass transition-[width] duration-100"
            style={{ width: `${Math.max(0, Math.min(1, displayedProgress)) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid gap-2 border-b border-line p-3.5 sm:grid-cols-2 sm:p-4">
        {lines.map((line, index) => {
          const character = scene.characters.find((item) => item.id === line.characterId);
          const recorded = Boolean(recordings[line.id]);
          const selected = line.id === activeLine?.id;
          return (
            <button
              key={line.id}
              type="button"
              onClick={() => selectLine(line.id)}
              disabled={mode === "countdown" || mode === "recording" || mode === "preview"}
              data-active={selected}
              className="timeline-row focus-ring flex items-start gap-2.5 rounded-sm border border-line/80 bg-white/[0.015] p-2.5 text-left transition hover:border-brass/35 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-sm border border-line font-mono text-[10px] text-dim">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: character?.color }}>
                    {character?.name}
                  </span>
                  {recorded ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sage">
                      <CheckIcon className="h-3 w-3" /> hazır
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-dim">
                      {line.start.toFixed(0)}–{line.end.toFixed(0)}s
                    </span>
                  )}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted">{line.text}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleReference}
            disabled={!videoReady || mode === "countdown" || mode === "recording" || mode === "preview"}
            className="button-secondary min-h-10 px-3.5 text-xs sm:text-sm"
          >
            <HeadphonesIcon className="h-4 w-4" />
            {mode === "reference" ? "Durdur" : "Orijinali dinle"}
          </button>

          {isBusy ? (
            <button type="button" onClick={endTake} className="button-danger min-h-10 px-3.5 text-xs sm:text-sm">
              <StopIcon className="h-4 w-4" />
              {mode === "countdown" ? "İptal" : "Kaydı bitir"}
            </button>
          ) : (
            <button
              type="button"
              onClick={startTake}
              disabled={mode === "preview" || !videoReady}
              className="button-primary min-h-10 px-3.5 text-xs sm:text-sm"
            >
              <MicIcon className="h-4 w-4" />
              {recordings[activeLine?.id] ? "Yeniden kaydet" : "Kaydet"}
            </button>
          )}

          {recordings[activeLine?.id] && !isBusy && (
            <>
              <button
                type="button"
                onClick={playTake}
                disabled={mode === "preview"}
                className="button-secondary min-h-10 px-3.5 text-xs sm:text-sm"
              >
                <PlayIcon className="h-4 w-4" />
                {mode === "take" ? "Oynatılıyor" : "Kaydımı dinle"}
              </button>
              <button
                type="button"
                onClick={resetPlayback}
                className="button-ghost min-h-10 text-xs"
                title="Oynatmayı durdur"
              >
                <ResetIcon className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        <div className="mt-3 rounded-sm border border-line/80 bg-black/25 px-3 py-2">
          <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-wider">
            <span className={mode === "recording" ? "text-brass" : "text-dim"}>
              {mode === "recording" ? "Canlı mikrofon" : "Mikrofon kapalı"}
            </span>
            <span className={isBusy ? "text-brass" : "text-dim"}>{statusText}</span>
          </div>
          <Waveform stream={micStream} active={mode === "recording"} bars={64} className="mt-1.5" />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={previewScene}
            disabled={!allRecorded || mode === "countdown" || mode === "recording"}
            className="button-primary min-h-10 px-4 text-xs sm:text-sm"
            title={allRecorded ? "Tüm replikleri videoyla birlikte oynat" : "Önce tüm replikleri kaydet"}
          >
            <PlayIcon className="h-4 w-4" />
            {mode === "preview" ? "Önizlemeyi durdur" : "Tüm sahneyi önizle"}
          </button>
          <button
            type="button"
            onClick={downloadDub}
            disabled={!hasRecordings || exporting || isBusy}
            className="button-secondary min-h-10 px-4 text-xs sm:text-sm"
            title="Kayıtlarını tek bir ses dosyası olarak indir"
          >
            <DownloadIcon className="h-4 w-4" />
            {exporting ? "Hazırlanıyor…" : "Dublajı indir (.wav)"}
          </button>
          <span className="text-[11px] leading-5 text-dim">MP4 video render Pro planda yakında.</span>
        </div>

        {(message || error) && (
          <div className="mt-3">
            {message && <p role="status" className="text-xs text-sage">{message}</p>}
            {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
