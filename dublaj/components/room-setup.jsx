"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { scenes } from "../lib/scenes.js";
import { getRoomSocket, setActiveRoom } from "../lib/client-socket.js";

function waitForConnection(socket) {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("connect", connected);
      socket.off("connect_error", failed);
      reject(new Error("Sunucuya bağlanılamadı. Biraz sonra tekrar dene."));
    }, 10_000);
    const connected = () => {
      clearTimeout(timer);
      socket.off("connect_error", failed);
      resolve();
    };
    const failed = () => {
      clearTimeout(timer);
      socket.off("connect", connected);
      reject(new Error("Sunucuya bağlanılamadı. Biraz sonra tekrar dene."));
    };
    socket.once("connect", connected);
    socket.once("connect_error", failed);
    socket.connect();
  });
}

function emitAck(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(8_000).emit(event, payload, (timeoutError, response) => {
      if (timeoutError) return reject(new Error("Sunucudan yanıt alınamadı."));
      if (!response?.ok) return reject(new Error(response?.error || "İşlem tamamlanamadı."));
      resolve(response);
    });
  });
}

export default function RoomSetup({ initialScene }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sceneId, setSceneId] = useState(
    scenes.some((scene) => scene.id === initialScene) ? initialScene : scenes[0].id,
  );
  const [code, setCode] = useState("");
  const [mode, setMode] = useState("create");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const socket = getRoomSocket();
      await waitForConnection(socket);
      const response =
        mode === "create"
          ? await emitAck(socket, "room:create", { name, sceneId })
          : await emitAck(socket, "room:join", { name, code: code.toUpperCase() });
      sessionStorage.setItem("replikName", name.trim());
      setActiveRoom(response);
      router.push(`/tr/oda/${response.room.code}`);
    } catch (submissionError) {
      setError(submissionError.message || "İşlem tamamlanamadı.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="surface mt-9 max-w-2xl rounded-2xl p-6 sm:p-8">
      <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1">
        {[
          ["create", "Oda kur"],
          ["join", "Kodla katıl"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => { setMode(value); setError(""); }}
            className={`focus-ring rounded-lg px-4 py-3 text-sm font-semibold ${
              mode === value ? "bg-lilac text-ink" : "text-zinc-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="mt-6 block text-sm font-semibold" htmlFor="room-name">Odada görünecek adın</label>
      <input
        id="room-name"
        className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-white placeholder:text-zinc-600"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={24}
        minLength={2}
        autoComplete="nickname"
        placeholder="Örn. Deniz"
        required
      />
      {mode === "create" ? (
        <>
          <label className="mt-5 block text-sm font-semibold" htmlFor="scene">Seslendirilecek sahne</label>
          <select
            id="scene"
            className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-[#11131a] px-4 text-white"
            value={sceneId}
            onChange={(event) => setSceneId(event.target.value)}
          >
            {scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.title} · {scene.film}</option>)}
          </select>
          <p className="mt-2 text-xs text-zinc-500">Sahne kaynağı ve lisans bilgisi oda içinde de görünür.</p>
        </>
      ) : (
        <>
          <label className="mt-5 block text-sm font-semibold" htmlFor="room-code">Oda kodu</label>
          <input
            id="room-code"
            className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 font-mono uppercase tracking-[0.2em] text-white placeholder:text-zinc-600"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            minLength={6}
            maxLength={6}
            placeholder="ABC234"
            required
          />
        </>
      )}
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      <button className="button-primary mt-6 w-full" type="submit" disabled={busy}>
        {busy ? "Bağlanıyor…" : mode === "create" ? "Odayı oluştur" : "Odaya katıl"}
      </button>
    </form>
  );
}
