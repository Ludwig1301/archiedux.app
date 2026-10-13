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

function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(8_000).emit(event, payload, (timeoutError, response) => {
      if (timeoutError) return reject(new Error("Sunucudan yanıt alınamadı."));
      if (!response?.ok) return reject(new Error(response?.error || "İşlem tamamlanamadı."));
      resolve(response);
    });
  });
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
  const [status, setStatus] = useState("Odaya bağlanıyor…");
  const [error, setError] = useState("");
  const [recordingLine, setRecordingLine] = useState("");
  const [localRecordings, setLocalRecordings] = useState({});
  const [videoReady, setVideoReady] = useState(false);
  const [playbackPending, setPlaybackPending] = useState(false);
  const videoMountRef = useRef(null);
  const playerRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const localUrlsRef = useRef([]);
  const audioContextRef = useRef(null);
  const sceneRef = useRef(null);
  const safeCode = useMemo(() => String(code || "").toUpperCase(), [code]);

  const join = useCallback(async (displayName) => {
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
      const response = await emitAck(socket, "room:join", { code: safeCode, name: displayName });
      setPlayerId(response.playerId);
      setRoom(response.room);
      setScene(response.scene);
      sceneRef.current = response.scene;
      setActiveRoom(response);
      sessionStorage.setItem("replikName", displayName);
      setStatus("");
    } catch (joinError) {
      setError(joinError.message || "Odaya katılınamadı.");
      setStatus("");
    }
  }, [safeCode]);

  useEffect(() => {
    const rememberedName = sessionStorage.getItem("replikName") || "";
    setNameInput(rememberedName);
    const activeRoom = getActiveRoom();
    if (getActiveRoomCode() === safeCode && activeRoom) {
      setRoom(activeRoom.room);
      setScene(activeRoom.scene);
      sceneRef.current = activeRoom.scene;
      setPlayerId(activeRoom.playerId);
      setStatus("");
    } else if (rememberedName) {
      join(rememberedName);
    }

    const socket = getRoomSocket();
    const updateRoom = (nextRoom) => {
      updateActiveRoom(nextRoom);
      setRoom(nextRoom);
    };
    const playTogether = (message) => {
      const currentScene = sceneRef.current;
      if (!currentScene) return;
      setPlaybackPending(true);
      const delay = Math.max(0, message.playbackAt - Date.now());
      const player = playerRef.current;
      player?.mute();
      player?.seekTo(currentScene.sourceStart, true);
      setTimeout(() => {
        playerRef.current?.playVideo();
        setPlaybackPending(false);
      }, delay);
      const context = audioContextRef.current;
      if (!context) return;
      context.resume().then(async () => {
        for (const line of currentScene.lines) {
          const recording = message.recordings?.[line.id];
          if (!recording?.audio) continue;
          try {
            const raw = Uint8Array.from(atob(recording.audio), (character) => character.charCodeAt(0));
            const decoded = await context.decodeAudioData(raw.buffer);
            const source = context.createBufferSource();
            source.buffer = decoded;
            source.connect(context.destination);
            const waitSeconds = Math.max(0, (message.playbackAt - Date.now()) / 1000);
            const offset = Math.max(0, line.start - currentScene.sourceStart);
            source.start(context.currentTime + waitSeconds + offset);
          } catch (decodeError) {
            setError(`Bir ses kaydı oynatılamadı: ${decodeError.message}`);
          }
        }
      }).catch(() => {
        setError("Ses oynatımı için sayfada bir kez kayıt düğmesine basarak sesi etkinleştir.");
      });
    };
    socket.on("room:update", updateRoom);
    socket.on("playback:start", playTogether);
    return () => {
      socket.off("room:update", updateRoom);
      socket.off("playback:start", playTogether);
    };
  }, [join, safeCode]);

  useEffect(() => {
    let active = true;
    if (!scene?.videoId || !videoMountRef.current) return undefined;
    loadYouTubeApi().then((YT) => {
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
          onReady: () => { if (active) setVideoReady(true); },
          onError: () => setError("Sahne videosu bu oynatıcıda açılamadı. Kaynak sayfasından izlemeyi deneyin."),
        },
      });
    }).catch((playerError) => {
      if (active) setError(playerError.message || "Video oynatıcısı yüklenemedi.");
    });
    return () => {
      active = false;
      playerRef.current?.destroy();
      playerRef.current = null;
      setVideoReady(false);
    };
  }, [scene?.videoId, scene?.sourceStart, scene?.sourceEnd]);

  useEffect(() => () => {
    recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    localUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    audioContextRef.current?.close();
    clearActiveRoom(safeCode);
  }, [safeCode]);

  const currentPlayer = room?.players.find((player) => player.id === playerId);
  const currentCharacter = scene?.characters.find((character) => character.id === currentPlayer?.characterId);
  const allRecorded = Boolean(scene?.lines.length && scene.lines.every((line) => room?.recordings?.[line.id]));
  const allReady = Boolean(room?.players.length && room.players.every((player) => player.ready));

  async function startRecording(line) {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Bu tarayıcı mikrofon kaydını desteklemiyor. Güncel Chrome, Edge veya Firefox kullan.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find(
        (type) => MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecordingLine("");
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (!audioContextRef.current) audioContextRef.current = new AudioContext();
        await audioContextRef.current.resume().catch(() => {});
        const url = URL.createObjectURL(blob);
        localUrlsRef.current.push(url);
        setLocalRecordings((current) => ({ ...current, [line.id]: { blob, url } }));
      };
      recorderRef.current = recorder;
      recorder.start(200);
      setRecordingLine(line.id);
    } catch (recordError) {
      setError(recordError.message || "Mikrofon izni alınamadı.");
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
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
      await emitAck(getRoomSocket(), "room:play", { code: safeCode });
    } catch (playError) {
      setError(playError.message || "Oynatma başlatılamadı.");
    }
  }

  function leaveRoom() {
    getRoomSocket().disconnect();
    clearActiveRoom(safeCode);
    window.location.assign("/dublaj/");
  }

  if (!room || !scene || !currentPlayer) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-16">
        <section className="surface w-full rounded-2xl p-7">
          <Link href="/tr/oda-kur" className="text-sm text-zinc-500 hover:text-white">← Odalara dön</Link>
          <h1 className="mt-6 text-3xl font-black">Oda {safeCode}</h1>
          <p className="mt-2 text-sm text-zinc-400">{error || status || "Görünen adınla odaya katıl."}</p>
          {(!name || error) && (
            <form onSubmit={(event) => { event.preventDefault(); join(nameInput.trim()); }} className="mt-5 flex gap-2">
              <input
                className="focus-ring min-h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-4"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                minLength={2}
                maxLength={24}
                placeholder="Görünen adın"
                required
              />
              <button className="button-primary" type="submit">Katıl</button>
            </form>
          )}
          {error && <p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-ink/90 px-5 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <button onClick={leaveRoom} className="focus-ring rounded-md text-sm font-extrabold tracking-[0.14em]">REPLİK KULÜBÜ</button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">ODA KODU</span>
            <button
              className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 font-mono font-bold tracking-[0.18em] text-lilac"
              onClick={() => navigator.clipboard?.writeText(safeCode)}
              title="Oda kodunu kopyala"
            >
              {safeCode} ⧉
            </button>
            <span className="text-xs text-zinc-500">{room.players.length} oyuncu</span>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[1fr_340px]">
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-lilac">{scene.film} · {scene.age}</p>
              <h1 className="mt-1 text-2xl font-black">{scene.title}</h1>
            </div>
            <a href={scene.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-zinc-500 hover:text-lilac">Kaynak ve lisans ↗</a>
          </div>
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
            <div ref={videoMountRef} className="h-full w-full" />
            {!videoReady && <div className="absolute inset-0 grid place-items-center text-sm text-zinc-500">Lisanslı video oynatıcı yükleniyor…</div>}
            {playbackPending && <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-lilac px-4 py-2 text-sm font-bold text-ink">Birlikte oynatma başlıyor…</div>}
          </div>
          <div className="surface mt-4 rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">Repliklerin</h2>
                <p className="mt-1 text-xs text-zinc-500">Altyazıyı oku, repliğini kaydet ve odaya gönder. Kayıtlar oda üyeleriyle paylaşılır.</p>
              </div>
              <button
                type="button"
                onClick={toggleReady}
                className={`button-secondary ${currentPlayer.ready ? "border-mint/40 text-mint" : ""}`}
              >
                {currentPlayer.ready ? "Hazırsın ✓" : "Hazırım"}
              </button>
            </div>
            {!currentCharacter && <p className="mt-4 rounded-xl bg-amber-200/10 p-3 text-sm text-amber-100">Henüz bir karakterin yok; oda kurucusu sana rol atayabilir.</p>}
            <div className="mt-4 space-y-3">
              {scene.lines.map((line) => {
                const character = scene.characters.find((item) => item.id === line.characterId);
                const assignedPlayer = room.players.find((player) => player.characterId === line.characterId);
                const local = localRecordings[line.id];
                const submitted = room.recordings?.[line.id];
                const canRecord = currentPlayer.characterId === line.characterId;
                return (
                  <article key={line.id} className={`rounded-xl border p-4 ${canRecord ? "border-lilac/25 bg-lilac/[0.045]" : "border-white/[0.07] bg-white/[0.02]"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: character?.color }} />
                        <span className="font-semibold" style={{ color: character?.color }}>{character?.name}</span>
                        <span className="text-zinc-600">· {assignedPlayer?.name || "rol bekleniyor"}</span>
                      </div>
                      <span className="font-mono text-xs text-zinc-500">{line.start.toFixed(1)}s</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-100">{line.text}</p>
                    {canRecord && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {recordingLine === line.id ? (
                          <button onClick={stopRecording} className="button-secondary border-red-400/40 text-red-200">■ Kaydı bitir</button>
                        ) : (
                          <button onClick={() => startRecording(line)} className="button-secondary">● {local ? "Yeniden kaydet" : "Kaydet"}</button>
                        )}
                        {local && recordingLine !== line.id && (
                          <>
                            <audio className="h-9 max-w-[190px]" controls src={local.url} />
                            <button onClick={() => submitRecording(line)} className="button-primary min-h-9 px-3 text-xs">Odaya gönder</button>
                          </>
                        )}
                        {submitted && <span className="text-xs text-mint">Odaya gönderildi ✓</span>}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            {status && <p role="status" className="mt-3 text-xs text-mint">{status}</p>}
            {error && <p role="alert" className="mt-3 text-sm text-red-200">{error}</p>}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="surface rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Oyuncular</h2>
              <span className="text-xs text-zinc-500">{room.players.length}/8</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-zinc-500">Oda kurucusu rolleri değiştirebilir. Boş roller seyirci olarak kalır.</p>
            <div className="mt-4 space-y-2">
              {room.players.map((player) => (
                <div key={player.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 font-bold text-lilac">{player.name.slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{player.name}{player.id === room.hostId && <span className="ml-2 text-[10px] uppercase text-zinc-500">Kurucu</span>}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{scene.characters.find((character) => character.id === player.characterId)?.name || "Seyirci"} · {player.ready ? "hazır" : "bekliyor"}</p>
                  </div>
                  {playerId === room.hostId && (
                    <select
                      aria-label={`${player.name} karakteri`}
                      className="max-w-24 rounded-lg border border-white/10 bg-[#11131a] px-2 py-2 text-xs"
                      value={player.characterId || ""}
                      onChange={(event) => setCharacter(player.id, event.target.value)}
                    >
                      <option value="" disabled>Rol seç</option>
                      {scene.characters.map((character) => (
                        <option key={character.id} value={character.id}>{character.name}</option>
                      ))}
                    </select>
                  )}
                  {player.id === playerId && player.id !== room.hostId && <span className="text-[10px] text-mint">Sen</span>}
                </div>
              ))}
            </div>
          </section>
          <section className="surface rounded-2xl p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-bold">Ortak izleme</h2>
                <p className="mt-1 text-xs text-zinc-500">{scene.lines.filter((line) => room.recordings?.[line.id]).length}/{scene.lines.length} replik kaydı hazır</p>
              </div>
              <span className="text-xl text-lilac">♫</span>
            </div>
            <button
              onClick={startPlayback}
              disabled={playerId !== room.hostId || !allRecorded || !allReady || !videoReady}
              className="button-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-40"
              title={
                playerId !== room.hostId
                  ? "Oynatmayı oda kurucusu başlatır"
                  : !allReady
                    ? "Önce herkes Hazırım düğmesine basmalı"
                    : ""
              }
            >
              ▶ Dublajı birlikte oynat
            </button>
            {playerId !== room.hostId && <p className="mt-2 text-center text-[11px] text-zinc-600">Oynatmayı oda kurucusu başlatır.</p>}
          </section>
          <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-xs leading-5 text-zinc-500">
            <p className="font-semibold text-zinc-300">{scene.film} · CC BY 3.0</p>
            <p className="mt-1">{scene.credit}</p>
            <a href={scene.licenseUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-lilac hover:text-white">Lisans koşulları ↗</a>
          </section>
        </aside>
      </div>
    </main>
  );
}
