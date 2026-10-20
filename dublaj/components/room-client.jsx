"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearActiveRoom,
  getActiveRoom,
  getActiveRoomCode,
  getRoomSocket,
  setActiveRoom,
  updateActiveRoom,
} from "../lib/client-socket.js";
import { AVATAR_CHOICES, getClientId } from "../lib/avatars.js";
import { Seal } from "./brand.jsx";

const RECORD_LEAD_SECONDS = 2.5;

function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(8_000).emit(event, payload, (timeoutError, response) => {
      if (timeoutError) return reject(new Error("Sunucudan yanıt alınamadı."));
      if (!response?.ok) return reject(new Error(response?.error || "İşlem tamamlanamadı."));
      resolve(response);
    });
  });
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const failed = () => {
      clearTimeout(timer);
      reject(new Error("YouTube oynatıcısı yüklenemedi. Bağlantını kontrol edip sayfayı yenile."));
    };
    const timer = setTimeout(failed, 15_000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      previous?.();
      resolve(window.YT);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = failed;
      document.head.appendChild(script);
    }
  });
}

export default function RoomClient({ code }) {
  const [room, setRoom] = useState(null);
  const [scene, setScene] = useState(null);
  const [playerId, setPlayerId] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [avatar, setAvatar] = useState(AVATAR_CHOICES[0]);
  const [status, setStatus] = useState("Odaya bağlanıyor…");
  const [error, setError] = useState("");
  const [take, setTake] = useState({ lineId: "", phase: "", count: 0, progress: 0 });
  const [playback, setPlayback] = useState({ active: false, pending: false, progress: 0, lineId: "" });
  const [localRecordings, setLocalRecordings] = useState({});
  const [videoReady, setVideoReady] = useState(false);

  const videoMountRef = useRef(null);
  const playerRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const localUrlsRef = useRef([]);
  const audioCtxRef = useRef(null);
  const takeMonitorRef = useRef(null);
  const playMonitorRef = useRef(null);
  const playbackTimerRef = useRef(null);
  const sourcesRef = useRef([]);
  const sceneRef = useRef(null);
  const roomRef = useRef(null);
  const nameRef = useRef("");
  const clientIdRef = useRef("");
  const safeCode = useMemo(() => String(code || "").toUpperCase(), [code]);

  const unlockAudio = useCallback(async () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      if (audioCtxRef.current.state === "suspended") await audioCtxRef.current.resume();
      return audioCtxRef.current;
    } catch {
      return audioCtxRef.current || null;
    }
  }, []);

  const stopPlayback = useCallback(() => {
    if (playMonitorRef.current) {
      clearInterval(playMonitorRef.current);
      playMonitorRef.current = null;
    }
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    for (const source of sourcesRef.current) {
      try {
        source.stop();
      } catch {
        /* kaynak zaten bitmiş olabilir */
      }
    }
    sourcesRef.current = [];
    try {
      playerRef.current?.pauseVideo();
    } catch {
      /* oynatıcı hazır değilse yok say */
    }
    setPlayback({ active: false, pending: false, progress: 0, lineId: "" });
  }, []);

  const playTogether = useCallback(
    (message) => {
      const currentScene = sceneRef.current;
      if (!currentScene) return;
      stopPlayback();
      const player = playerRef.current;
      try {
        player?.mute();
      } catch {
        /* yok say */
      }

      (async () => {
        const context = await unlockAudio();
        const decoded = [];
        if (context) {
          for (const line of currentScene.lines) {
            const recording = message.recordings?.[line.id];
            if (!recording?.audio) continue;
            try {
              const buffer = await context.decodeAudioData(base64ToArrayBuffer(recording.audio));
              decoded.push({ line, buffer });
            } catch (decodeError) {
              setError(`Bir ses kaydı çözülemedi: ${decodeError.message || "bilinmeyen hata"}`);
            }
          }
        }

        const now = Date.now();
        const remaining = Math.max(0, (message.playbackAt - now) / 1000);
        const elapsed = Math.max(0, (now - message.playbackAt) / 1000);
        // Sonradan katılan oyuncu videoyu ve sesleri geçen süreye göre hizala.
        try {
          player?.seekTo(currentScene.sourceStart + elapsed, true);
        } catch {
          /* yok say */
        }

        if (context) {
          const startWhen = context.currentTime + remaining;
          for (const { line, buffer } of decoded) {
            const relative = line.start - currentScene.sourceStart - elapsed;
            const when = startWhen + Math.max(0, relative);
            const trim = Math.max(0, -relative);
            if (trim >= buffer.duration) continue; // bu replik çoktan bitmiş
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            try {
              source.start(when, trim);
            } catch (startError) {
              setError(`Bir kayıt zamanlanamadı: ${startError.message}`);
            }
            sourcesRef.current.push(source);
          }
        }

        const bekliyor = remaining > 0.05;
        setPlayback({ active: true, pending: bekliyor, progress: 0, lineId: "" });
        playbackTimerRef.current = setTimeout(() => {
          try {
            playerRef.current?.playVideo();
          } catch {
            /* yok say */
          }
          setPlayback((prev) => (prev.active ? { ...prev, pending: false } : prev));
        }, remaining * 1000);

        const span = Math.max(0.1, currentScene.sourceEnd - currentScene.sourceStart);
        playMonitorRef.current = setInterval(() => {
          let time = null;
          try {
            time = playerRef.current?.getCurrentTime?.();
          } catch {
            /* yok say */
          }
          if (typeof time !== "number") return;
          const progress = Math.max(0, Math.min(1, (time - currentScene.sourceStart) / span));
          const active = currentScene.lines.find((line) => time >= line.start && time < line.end);
          setPlayback({
            active: true,
            pending: Date.now() < message.playbackAt,
            progress,
            lineId: active?.id || "",
          });
          if (time >= currentScene.sourceEnd - 0.1) stopPlayback();
        }, 120);
      })();
    },
    [stopPlayback, unlockAudio],
  );

  const applyRoom = useCallback((nextRoom) => {
    roomRef.current = nextRoom;
    updateActiveRoom(nextRoom);
    setRoom(nextRoom);
  }, []);

  const join = useCallback(
    async (displayName, avatarChoice) => {
      setError("");
      setStatus("Odaya bağlanıyor…");
      try {
        const socket = getRoomSocket();
        if (!socket.connected) {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              socket.off("connect", connected);
              socket.off("connect_error", failed);
              reject(new Error("Sunucuya bağlanılamadı."));
            }, 10_000);
            const connected = () => {
              clearTimeout(timer);
              socket.off("connect_error", failed);
              resolve();
            };
            const failed = () => {
              clearTimeout(timer);
              socket.off("connect", connected);
              reject(new Error("Sunucuya bağlanılamadı."));
            };
            socket.once("connect", connected);
            socket.once("connect_error", failed);
            socket.connect();
          });
        }
        const response = await emitAck(socket, "room:join", {
          code: safeCode,
          name: displayName,
          clientId: clientIdRef.current,
          avatar: avatarChoice,
        });
        nameRef.current = displayName;
        roomRef.current = response.room;
        sceneRef.current = response.scene;
        setPlayerId(response.playerId);
        setRoom(response.room);
        setScene(response.scene);
        setActiveRoom(response);
        sessionStorage.setItem("replikName", displayName);
        if (avatarChoice) sessionStorage.setItem("replikAvatar", avatarChoice);
        setStatus("");
      } catch (joinError) {
        setError(joinError.message || "Odaya katılınamadı.");
        setStatus("");
      }
    },
    [safeCode],
  );

  // Soket olaylarını bağla + kopan bağlantıda sessizce yeniden katıl.
  useEffect(() => {
    const socket = getRoomSocket();
    const playHandler = (message) => playTogether(message);
    const handleConnect = () => {
      const current = roomRef.current;
      if (!current || !nameRef.current || !clientIdRef.current) return;
      emitAck(socket, "room:rejoin", { code: safeCode, clientId: clientIdRef.current })
        .then((response) => {
          setPlayerId(response.playerId);
          roomRef.current = response.room;
          sceneRef.current = response.scene;
          setRoom(response.room);
          setScene(response.scene);
          setActiveRoom(response);
          setError("");
        })
        .catch(() => {
          // Grace süresi dolmuşsa aynı adla yeniden katılmayı dene.
          join(nameRef.current, sessionStorage.getItem("replikAvatar") || "");
        });
    };
    socket.on("room:update", applyRoom);
    socket.on("playback:start", playHandler);
    socket.on("playback:stop", stopPlayback);
    socket.on("connect", handleConnect);
    return () => {
      socket.off("room:update", applyRoom);
      socket.off("playback:start", playHandler);
      socket.off("playback:stop", stopPlayback);
      socket.off("connect", handleConnect);
    };
  }, [applyRoom, playTogether, stopPlayback, join, safeCode]);

  // Ses bağlamını ilk kullanıcı etkileşiminde aç (tarayıcı otoplay kısıtı için).
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [unlockAudio]);

  useEffect(() => {
    clientIdRef.current = getClientId();
    const rememberedName = sessionStorage.getItem("replikName") || "";
    const rememberedAvatar = sessionStorage.getItem("replikAvatar") || "";
    setNameInput(rememberedName);
    if (rememberedAvatar) setAvatar(rememberedAvatar);

    const activeRoom = getActiveRoom();
    if (getActiveRoomCode() === safeCode && activeRoom) {
      roomRef.current = activeRoom.room;
      sceneRef.current = activeRoom.scene;
      nameRef.current =
        activeRoom.room.players.find((player) => player.id === activeRoom.playerId)?.name || rememberedName;
      setRoom(activeRoom.room);
      setScene(activeRoom.scene);
      setPlayerId(activeRoom.playerId);
      if (rememberedAvatar) setAvatar(rememberedAvatar);
      setStatus("");
    } else if (rememberedName) {
      join(rememberedName, rememberedAvatar);
    }
  }, [join, safeCode]);

  useEffect(() => {
    let active = true;
    if (!scene?.videoId || !videoMountRef.current) return undefined;
    loadYouTubeApi()
      .then((YT) => {
        if (!active || !videoMountRef.current) return;
        playerRef.current = new YT.Player(videoMountRef.current, {
          videoId: scene.videoId,
          playerVars: {
            start: Math.floor(scene.sourceStart),
            end: Math.ceil(scene.sourceEnd),
            rel: 0,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (active) setVideoReady(true);
            },
            onError: () =>
              setError("Sahne videosu bu oynatıcıda açılamadı. Kaynak sayfasından izlemeyi deneyin."),
          },
        });
      })
      .catch((playerError) => {
        if (active) setError(playerError.message || "Video oynatıcısı yüklenemedi.");
      });
    return () => {
      active = false;
      try {
        playerRef.current?.destroy();
      } catch {
        /* yok say */
      }
      playerRef.current = null;
      setVideoReady(false);
    };
  }, [scene?.videoId, scene?.sourceStart, scene?.sourceEnd]);

  useEffect(
    () => () => {
      if (takeMonitorRef.current) clearInterval(takeMonitorRef.current);
      if (playMonitorRef.current) clearInterval(playMonitorRef.current);
      if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
      if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      localUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      audioCtxRef.current?.close();
      clearActiveRoom(safeCode);
    },
    [safeCode],
  );

  const currentPlayer =
    (clientIdRef.current &&
      room?.players.find((player) => player.clientId && player.clientId === clientIdRef.current)) ||
    room?.players.find((player) => player.id === playerId);
  const currentCharacter = scene?.characters.find(
    (character) => character.id === currentPlayer?.characterId,
  );
  const allRecorded = Boolean(
    scene?.lines.length && scene.lines.every((line) => room?.recordings?.[line.id]),
  );
  const connectedPlayers = room?.players.filter((player) => player.connected) || [];
  const allReady = Boolean(
    connectedPlayers.length && connectedPlayers.every((player) => player.ready),
  );

  function stopTakeMonitor() {
    if (takeMonitorRef.current) {
      clearInterval(takeMonitorRef.current);
      takeMonitorRef.current = null;
    }
  }

  function cleanupTake() {
    stopTakeMonitor();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setTake({ lineId: "", phase: "", count: 0, progress: 0 });
  }

  function endTake() {
    stopTakeMonitor();
    try {
      playerRef.current?.pauseVideo();
    } catch {
      /* yok say */
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      // Kayıt henüz başlamadan (geri sayımda) iptal edildiyse durumu hemen sıfırla.
      cleanupTake();
    }
  }

  async function startRecording(line) {
    setError("");
    if (take.phase) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Bu tarayıcı mikrofon kaydını desteklemiyor. Güncel Chrome, Edge veya Firefox kullan.");
      return;
    }
    const currentScene = sceneRef.current;
    if (!currentScene) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      await unlockAudio();

      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        const url = URL.createObjectURL(blob);
        localUrlsRef.current.push(url);
        setLocalRecordings((current) => ({ ...current, [line.id]: { blob, url } }));
        cleanupTake();
      };
      recorderRef.current = recorder;

      const video = playerRef.current;
      const lead = Math.max(1, Math.min(RECORD_LEAD_SECONDS, line.start - currentScene.sourceStart));
      const seekTarget = Math.max(currentScene.sourceStart, line.start - lead);
      try {
        video?.mute();
        video?.seekTo(seekTarget, true);
        video?.playVideo();
      } catch {
        /* yok say */
      }

      setTake({ lineId: line.id, phase: "countdown", count: Math.max(1, Math.ceil(lead)), progress: 0 });
      const startedAt = performance.now();
      let recording = false;
      stopTakeMonitor();
      takeMonitorRef.current = setInterval(() => {
        let time = null;
        try {
          time = playerRef.current?.getCurrentTime?.();
        } catch {
          /* yok say */
        }
        if (typeof time !== "number" || time < seekTarget + 0.15) {
          time = seekTarget + (performance.now() - startedAt) / 1000;
        }

        if (!recording) {
          const remaining = line.start - time;
          if (remaining > 0.05) {
            setTake((previous) =>
              previous.lineId === line.id
                ? { ...previous, count: Math.max(1, Math.ceil(remaining)) }
                : previous,
            );
          } else {
            recording = true;
            if (recorder.state === "inactive") recorder.start(200);
            setTake((previous) =>
              previous.lineId === line.id ? { ...previous, phase: "recording", count: 0 } : previous,
            );
          }
        } else {
          const span = Math.max(0.1, line.end - line.start);
          const progress = Math.max(0, Math.min(1, (time - line.start) / span));
          setTake((previous) => (previous.lineId === line.id ? { ...previous, progress } : previous));
          if (time >= line.end) endTake();
        }
      }, 90);
    } catch (recordError) {
      setError(recordError.message || "Mikrofon izni alınamadı.");
      cleanupTake();
    }
  }

  function stopRecording() {
    endTake();
  }

  async function submitRecording(line) {
    const local = localRecordings[line.id];
    if (!local) return;
    try {
      const socket = getRoomSocket();
      await emitAck(socket, "room:recording", {
        code: safeCode,
        lineId: line.id,
        mimeType: local.blob.type,
        audio: new Uint8Array(await local.blob.arrayBuffer()),
      });
      setStatus("Kayıt odaya eklendi.");
      setTimeout(() => setStatus(""), 2500);
    } catch (uploadError) {
      setError(uploadError.message || "Kayıt odaya gönderilemedi.");
    }
  }

  async function setCharacter(targetPlayerId, characterId) {
    try {
      await emitAck(getRoomSocket(), "room:assign", {
        code: safeCode,
        playerId: targetPlayerId,
        characterId,
      });
    } catch (assignmentError) {
      setError(assignmentError.message || "Karakter atanamadı.");
    }
  }

  async function toggleReady() {
    try {
      await emitAck(getRoomSocket(), "room:ready", { code: safeCode, ready: !currentPlayer?.ready });
    } catch (readyError) {
      setError(readyError.message || "Durum güncellenemedi.");
    }
  }

  async function startPlayback() {
    try {
      await unlockAudio();
      await emitAck(getRoomSocket(), "room:play", { code: safeCode });
    } catch (playError) {
      setError(playError.message || "Oynatma başlatılamadı.");
    }
  }

  async function requestStop() {
    try {
      await emitAck(getRoomSocket(), "room:stop", { code: safeCode });
    } catch {
      /* kurucu değilse yalnızca kendi ekranında durdur */
    }
    stopPlayback();
  }

  function copyText(value, label) {
    navigator.clipboard?.writeText(value).then(
      () => {
        setStatus(`${label} kopyalandı.`);
        setTimeout(() => setStatus(""), 2000);
      },
      () => setError("Kopyalanamadı; adresi elle kopyala."),
    );
  }

  function leaveRoom() {
    getRoomSocket().disconnect();
    clearActiveRoom(safeCode);
    window.location.assign("/dublaj/");
  }

  if (!room || !scene || !currentPlayer) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-16">
        <section className="surface w-full rounded-sm p-7">
          <Link href="/tr/oda-kur" className="text-sm text-dim hover:text-parchment">
            ← Odalara dön
          </Link>
          <h1 className="mt-6 text-3xl font-bold tracking-[-0.03em] text-parchment">Oda {safeCode}</h1>
          <p className="mt-2 text-sm text-muted">{error || status || "Görünen adınla odaya katıl."}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              join(nameInput.trim(), avatar);
            }}
            className="mt-5 space-y-3"
          >
            <input
              className="field focus-ring"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              minLength={2}
              maxLength={24}
              placeholder="Görünen adın"
              required
            />
            <div className="flex flex-wrap gap-1.5">
              {AVATAR_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setAvatar(choice)}
                  aria-pressed={avatar === choice}
                  className={`focus-ring grid h-10 w-10 place-items-center rounded-sm border text-lg ${
                    avatar === choice ? "border-brass/60 bg-brass/15" : "border-line bg-white/[0.03]"
                  }`}
                >
                  {choice}
                </button>
              ))}
            </div>
            <button className="button-primary w-full" type="submit">
              Odaya katıl
            </button>
          </form>
          {error && (
            <p role="alert" className="mt-3 text-sm text-[#f0b4b4]">
              {error}
            </p>
          )}
        </section>
      </main>
    );
  }

  const activeLine = scene.lines.find((line) => line.id === playback.lineId);
  const myLines = scene.lines.filter(
    (line) => currentPlayer.characterId && line.characterId === currentPlayer.characterId,
  );
  const recordedCount = scene.lines.filter((line) => room.recordings?.[line.id]).length;

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-ink/95 px-5 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <button onClick={leaveRoom} className="focus-ring flex items-center gap-2 rounded-sm text-sm font-bold tracking-[0.14em] text-parchment">
            <Seal className="h-7 w-7" />
            <span className="wordmark text-base">REPLİK KULÜBÜ</span>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-dim">ODA KODU</span>
            <button
              className="focus-ring rounded-sm border border-line px-3 py-1.5 font-mono font-bold tracking-[0.18em] text-brass"
              onClick={() => copyText(safeCode, "Oda kodu")}
              title="Oda kodunu kopyala"
            >
              {safeCode} ⧉
            </button>
            <button
              type="button"
              className="button-secondary min-h-9 px-3 text-xs"
              onClick={() => copyText(window.location.href, "Oda bağlantısı")}
            >
              Bağlantıyı kopyala
            </button>
            <span className="text-xs text-dim">{room.players.length} oyuncu</span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[1fr_340px]">
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-brass">
                {scene.film} · {scene.age}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-[-0.03em] text-parchment">{scene.title}</h1>
            </div>
            <a href={scene.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-dim hover:text-brass">
              Kaynak ve lisans ↗
            </a>
          </div>

          <div
            className={`relative aspect-video overflow-hidden rounded-sm border bg-black shadow-glow ${
              take.phase === "recording" ? "border-red-500/60" : "border-line"
            }`}
          >
            <div ref={videoMountRef} className="h-full w-full" />
            {!videoReady && (
              <div className="absolute inset-0 grid place-items-center text-sm text-dim">
                Video oynatıcı yükleniyor…
              </div>
            )}
            {take.phase === "recording" && (
              <span className="absolute left-3 top-3 flex items-center gap-2 rounded-sm bg-rust px-3 py-1 text-xs font-bold text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> KAYIT
              </span>
            )}
            {take.phase && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${take.phase === "recording" ? "bg-red-400" : "bg-sage"}`} />
                    {take.phase === "countdown" ? `Hazır ol! ${take.count}` : "Kaydediliyor…"}
                  </span>
                  <span className="text-xs text-parchment">{scene.characters.find((c) => c.id === scene.lines.find((l) => l.id === take.lineId)?.characterId)?.name}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full ${take.phase === "recording" ? "bg-red-400" : "bg-sage"}`}
                    style={{ width: `${(take.phase === "recording" ? take.progress : 0) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {!take.phase && playback.active && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-brass" />
                    {playback.pending ? "Dublaj birazdan başlıyor…" : "Dublaj oynatılıyor"}
                  </span>
                  {activeLine && (
                    <span className="truncate text-xs text-parchment">
                      {scene.characters.find((c) => c.id === activeLine.characterId)?.name}
                    </span>
                  )}
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-brass" style={{ width: `${playback.progress * 100}%` }} />
                </div>
              </div>
            )}
          </div>

          <div className="surface mt-4 rounded-sm p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-sm border border-line bg-brass/[0.05] text-xl"
                  aria-hidden="true"
                >
                  🎙️
                </span>
                <div>
                  <h2 className="font-bold">Stüdyo</h2>
                  <p className="text-xs text-dim">
                    {currentCharacter ? (
                      <>
                        Rolün:{" "}
                        <span className="font-semibold" style={{ color: currentCharacter.color }}>
                          {currentCharacter.name}
                        </span>
                      </>
                    ) : (
                      "Oda kurucusunun sana rol atamasını bekle"
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleReady}
                className={`button-secondary ${currentPlayer.ready ? "border-sage/40 text-sage" : ""}`}
              >
                {currentPlayer.ready ? "Hazırsın ✓" : "Hazırım"}
              </button>
            </div>

            {!currentCharacter ? (
              <p className="mt-4 rounded-sm border border-brass/25 bg-brass/[0.06] p-3 text-sm text-brass">
                Henüz bir karakterin yok; oda kurucusu roller bölümünden sana rol atayabilir.
              </p>
            ) : myLines.length === 0 ? (
              <p className="mt-4 rounded-sm border border-line bg-white/[0.02] p-3 text-sm text-muted">
                Bu sahnede rolüne ait replik yok.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {myLines.map((line) => {
                  const local = localRecordings[line.id];
                  const submitted = room.recordings?.[line.id];
                  const isTaking = take.lineId === line.id;
                  return (
                    <article
                      key={line.id}
                      className={`rounded-sm border p-4 transition ${
                        isTaking
                          ? "border-red-400/40 bg-red-400/[0.06]"
                          : submitted
                            ? "border-sage/30 bg-sage/[0.05]"
                            : "border-brass/25 bg-brass/[0.05]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: currentCharacter.color }} />
                          <span className="font-semibold" style={{ color: currentCharacter.color }}>
                            {currentCharacter.name}
                          </span>
                          {submitted && <span className="text-sage">· odaya gönderildi ✓</span>}
                        </span>
                        <span className="font-mono text-dim">
                          {line.start.toFixed(1)}s – {line.end.toFixed(1)}s
                        </span>
                      </div>
                      <p className="mt-2 text-base leading-7 text-parchment">{line.text}</p>

                      {isTaking && take.phase ? (
                        <div className="mt-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2 text-sm font-semibold">
                              <span className={`h-2.5 w-2.5 rounded-full ${take.phase === "recording" ? "bg-red-400" : "bg-sage"}`} />
                              {take.phase === "countdown" ? `Hazır ol! ${take.count}` : "Kaydediliyor…"}
                            </span>
                            <button onClick={stopRecording} className="button-secondary border-red-400/40 text-[#f0b4b4]">
                              ■ {take.phase === "countdown" ? "İptal" : "Kaydı bitir"}
                            </button>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                              className={`h-full rounded-full transition-all ${take.phase === "recording" ? "bg-red-400" : "bg-sage"}`}
                              style={{ width: `${(take.phase === "recording" ? take.progress : 0) * 100}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => startRecording(line)}
                            disabled={Boolean(take.phase)}
                            className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-rust px-5 font-bold text-white shadow-lg transition hover:bg-[#a62a2a] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-white" />
                            {local ? "Yeniden kaydet" : "Kaydı başlat"}
                          </button>
                          {local && (
                            <>
                              <audio className="h-10 max-w-[220px]" controls src={local.url} />
                              <button onClick={() => submitRecording(line)} className="button-primary min-h-10 px-4 text-sm">
                                Odaya gönder
                              </button>
                            </>
                          )}
                          {!local && !submitted && (
                            <span className="text-xs text-dim">
                              Video repliğin başına sarar, geri sayımdan sonra kayıt başlar.
                            </span>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {status && (
              <p role="status" className="mt-3 text-xs text-sage">
                {status}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-3 text-sm text-[#f0b4b4]">
                {error}
              </p>
            )}
          </div>

          <div className="surface mt-4 rounded-sm p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">Senaryo</h2>
              <span className="text-xs text-dim">
                {recordedCount}/{scene.lines.length} replik kaydı hazır
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {scene.lines.map((line, index) => {
                const character = scene.characters.find((item) => item.id === line.characterId);
                const owner = room.players.find((player) => player.characterId === line.characterId);
                const submitted = room.recordings?.[line.id];
                const isActive = playback.lineId === line.id || take.lineId === line.id;
                return (
                  <div
                    key={line.id}
                    className={`flex gap-3 rounded-sm border p-3 transition ${
                      isActive ? "border-brass/50 bg-brass/[0.08]" : "border-line bg-white/[0.02]"
                    }`}
                  >
                    <span className="w-6 shrink-0 text-center font-mono text-xs text-dim">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: character?.color }} />
                        <span className="font-semibold" style={{ color: character?.color }}>
                          {character?.name}
                        </span>
                        <span className="text-dim">· {owner?.name || "rol bekliyor"}</span>
                        {submitted && <span className="text-sage">· hazır ✓</span>}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-parchment">{line.text}</p>
                    </div>
                    <span className="shrink-0 self-start font-mono text-[11px] text-dim">
                      {line.start.toFixed(0)}–{line.end.toFixed(0)}s
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="surface rounded-sm p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Oyuncular</h2>
              <span className="text-xs text-dim">{room.players.length}/8</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-dim">
              Oda kurucusu rolleri değiştirebilir. Boş roller seyirci olarak kalır. Bağlantısı kopan oyuncular 30 sn içinde dönebilir.
            </p>
            <div className="mt-4 space-y-2">
              {room.players.map((player) => (
                <div key={player.id || player.name} className="flex items-center gap-3 rounded-sm border border-line p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-base font-bold text-brass">
                    {player.avatar || player.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {player.name}
                      {player.id === room.hostId && (
                        <span className="ml-2 text-[10px] uppercase text-dim">Kurucu</span>
                      )}
                      {!player.connected && (
                        <span className="ml-2 text-[10px] uppercase text-brass">bağlantı yok</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-dim">
                      {scene.characters.find((character) => character.id === player.characterId)?.name || "Seyirci"} ·{" "}
                      {player.ready ? "hazır" : "bekliyor"}
                    </p>
                  </div>
                  {playerId === room.hostId && player.connected && (
                    <select
                      aria-label={`${player.name} karakteri`}
                      className="max-w-24 rounded-sm border border-line bg-ink px-2 py-2 text-xs"
                      value={player.characterId || ""}
                      onChange={(event) => setCharacter(player.id, event.target.value)}
                    >
                      <option value="" disabled>
                        Rol seç
                      </option>
                      {scene.characters.map((character) => (
                        <option key={character.id} value={character.id}>
                          {character.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {player.id === playerId && player.id !== room.hostId && <span className="text-[10px] text-sage">Sen</span>}
                </div>
              ))}
            </div>
          </section>

          <section className="surface rounded-sm p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-bold">Ortak izleme</h2>
                <p className="mt-1 text-xs text-dim">
                  {recordedCount}/{scene.lines.length} replik kaydı hazır
                </p>
              </div>
              <span className="text-xl text-brass">♫</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brass to-sage transition-all"
                style={{ width: `${scene.lines.length ? (recordedCount / scene.lines.length) * 100 : 0}%` }}
              />
            </div>
            {playback.active ? (
              <button onClick={requestStop} className="button-secondary mt-4 w-full border-red-400/40 text-[#f0b4b4]">
                ■ Oynatmayı durdur
              </button>
            ) : (
              <button
                onClick={startPlayback}
                disabled={playerId !== room.hostId || !allRecorded || !allReady || !videoReady}
                className="button-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-40"
                title={
                  playerId !== room.hostId
                    ? "Oynatmayı oda kurucusu başlatır"
                    : !allReady
                      ? "Önce herkes Hazırım düğmesine basmalı"
                      : !allRecorded
                        ? "Önce tüm replikler kaydedilmeli"
                        : ""
                }
              >
                ▶ Dublajı birlikte oynat
              </button>
            )}
            {playerId !== room.hostId && (
              <p className="mt-2 text-center text-[11px] text-dim">Oynatmayı oda kurucusu başlatır.</p>
            )}
          </section>

          <section className="rounded-sm border border-line bg-white/[0.02] p-4 text-xs leading-5 text-dim">
            <p className="font-semibold text-parchment">{scene.film} · CC BY 3.0</p>
            <p className="mt-1">{scene.credit}</p>
            <a href={scene.licenseUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-brass hover:text-parchment">
              Lisans koşulları ↗
            </a>
          </section>
        </aside>
      </div>
    </main>
  );
}
