"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { scenes } from "../lib/scenes.js";
import { getRoomSocket, setActiveRoom } from "../lib/client-socket.js";
import { AVATAR_CHOICES, getClientId } from "../lib/avatars.js";
import { ArrowRightIcon, FilmIcon, LockIcon, UsersIcon } from "./icons.jsx";

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
  const [avatar, setAvatar] = useState(AVATAR_CHOICES[0]);
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
          ? await emitAck(socket, "room:create", { name, sceneId, clientId: getClientId(), avatar })
          : await emitAck(socket, "room:join", { name, code: code.toUpperCase(), clientId: getClientId(), avatar });
      sessionStorage.setItem("replikName", name.trim());
      sessionStorage.setItem("replikAvatar", avatar);
      setActiveRoom(response);
      router.push(`/tr/oda/${response.room.code}`);
    } catch (submissionError) {
      setError(submissionError.message || "İşlem tamamlanamadı.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="surface mt-8 max-w-2xl p-5 sm:p-7">
      <div className="grid grid-cols-2 gap-1 border border-line bg-black/25 p-1">
        {[
          ["create", "Oda kur", UsersIcon],
          ["join", "Kodla katıl", FilmIcon],
        ].map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(value);
              setError("");
            }}
            className={`focus-ring flex min-h-10 items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-sm font-semibold transition ${
              mode === value
                ? "bg-brass text-ink"
                : "text-dim hover:bg-white/[0.035] hover:text-parchment"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <label className="mt-6 block text-sm font-semibold text-parchment" htmlFor="room-name">
        Odada görünecek adın
      </label>
      <input
        id="room-name"
        className="field focus-ring mt-2"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={24}
        minLength={2}
        autoComplete="nickname"
        placeholder="Örn. Deniz"
        required
      />

      <span className="mt-6 block text-sm font-semibold text-parchment">Avatarın</span>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {AVATAR_CHOICES.map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => setAvatar(choice)}
            aria-pressed={avatar === choice}
            aria-label={`Avatar ${choice}`}
            className={`focus-ring grid h-10 w-10 place-items-center rounded-sm border text-lg transition ${
              avatar === choice
                ? "border-brass/60 bg-brass/15"
                : "border-line bg-white/[0.03] hover:border-brass/40"
            }`}
          >
            {choice}
          </button>
        ))}
      </div>

      {mode === "create" ? (
        <>
          <label className="mt-5 block text-sm font-semibold text-parchment" htmlFor="scene">
            Seslendirilecek sahne
          </label>
          <select
            id="scene"
            className="field focus-ring mt-2"
            value={sceneId}
            onChange={(event) => setSceneId(event.target.value)}
          >
            {scenes.map((scene) => (
              <option key={scene.id} value={scene.id}>
                {scene.title} · {scene.film}
              </option>
            ))}
          </select>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-dim">
            <LockIcon className="h-3.5 w-3.5 text-brass-dim" />
            Sahne kaynağı ve lisans bilgisi oda içinde de görünür.
          </p>
        </>
      ) : (
        <>
          <label className="mt-5 block text-sm font-semibold text-parchment" htmlFor="room-code">
            Oda kodu
          </label>
          <input
            id="room-code"
            className="field focus-ring mt-2 font-mono uppercase tracking-[0.2em]"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            minLength={6}
            maxLength={6}
            placeholder="ABC234"
            required
          />
          <p className="mt-2 text-[11px] text-dim">6 karakterlik oda kodunu arkadaşından al.</p>
        </>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-sm border border-rust/40 bg-rust/10 px-3 py-2 text-sm text-[#f0b4b4]">
          {error}
        </p>
      )}

      <button className="button-primary mt-6 w-full" type="submit" disabled={busy}>
        {busy ? "Bağlanıyor…" : mode === "create" ? "Odayı oluştur" : "Odaya katıl"}
        {!busy && <ArrowRightIcon className="h-4 w-4" />}
      </button>
    </form>
  );
}
