import { randomInt } from "node:crypto";
import { getScene } from "../lib/scenes.js";

const CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const ROOM_CODE_LENGTH = 6;
const MAX_ROOM_PLAYERS = 8;
const MAX_ACTIVE_ROOMS = 200;
const MAX_RECORDING_BYTES = 1_500_000;
const DISCONNECT_GRACE_MS = 30_000;

function cleanName(name) {
  if (typeof name !== "string") return "";
  return name.replace(/[<>]/g, "").trim().slice(0, 24);
}

function cleanAvatar(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[<>&"']/g, "").trim().slice(0, 4);
}

function cleanClientId(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}

export class RoomStore {
  constructor(onRoomChange) {
    this.rooms = new Map();
    this.onRoomChange = typeof onRoomChange === "function" ? onRoomChange : null;
  }

  create({ name, sceneId, clientId, avatar }) {
    const playerName = cleanName(name);
    const scene = getScene(sceneId);
    if (playerName.length < 2) throw new Error("Görünen ad en az 2 karakter olmalı.");
    if (!scene) throw new Error("Bu sahne bulunamadı.");
    if (this.rooms.size >= MAX_ACTIVE_ROOMS) {
      throw new Error("Şu anda oda kapasitesi dolu; biraz sonra tekrar dene.");
    }

    const room = {
      code: this.#newCode(),
      sceneId,
      hostId: null,
      players: [],
      recordings: new Map(),
      playbackAt: null,
    };

    const player = this.#makePlayer({ name: playerName, clientId, avatar });
    room.players.push(player);
    this.rooms.set(room.code, room);
    return { room, player };
  }

  join({ code, name, clientId, avatar }) {
    const room = this.get(code);
    const playerName = cleanName(name);
    if (playerName.length < 2) throw new Error("Görünen ad en az 2 karakter olmalı.");

    // Aynı tarayıcı sekmesi (sabit clientId) daha önce katılmışsa yeni bir
    // oyuncu açmak yerine mevcut kaydı canlandır; rol ve kayıtlar korunur.
    // Bu, sayfa yenilendiğinde "ad zaten kullanılıyor" hatasını da önler.
    const id = cleanClientId(clientId);
    const returning = id ? room.players.find((player) => player.clientId === id) : null;
    if (returning) {
      returning.name = playerName;
      const nextAvatar = cleanAvatar(avatar);
      if (nextAvatar) returning.avatar = nextAvatar;
      return { room, player: returning };
    }

    if (room.players.length >= MAX_ROOM_PLAYERS) throw new Error("Oda dolu.");
    if (room.players.some((player) => player.name.toLowerCase() === playerName.toLowerCase())) {
      throw new Error("Bu ad odada zaten kullanılıyor.");
    }

    const player = this.#makePlayer({ name: playerName, clientId, avatar });
    room.players.push(player);
    return { room, player };
  }

  setSocketId(room, player, socketId) {
    player.id = socketId;
    player.connected = true;
    this.#clearGrace(player);
    if (!room.hostId) room.hostId = socketId;
    if (!player.characterId) this.#assignAvailableCharacter(room, player);
  }

  // Kopan bağlantı 30 saniye boyunca "bağlantı koptu" olarak tutulur; bu
  // süre içinde aynı clientId ile dönen oyuncu rolünü kaybetmeden devam eder.
  markDisconnected(room, socketId) {
    const player = room.players.find((item) => item.id === socketId);
    if (!player) return;
    player.connected = false;
    player.id = null;
    if (room.hostId === socketId) {
      room.hostId = room.players.find((item) => item.connected && item.id)?.id ?? null;
    }
    this.#clearGrace(player);
    player.graceTimer = setTimeout(() => {
      if (player.connected) return;
      const index = room.players.indexOf(player);
      if (index >= 0) room.players.splice(index, 1);
      for (const [lineId, recording] of room.recordings) {
        if (recording.clientId && recording.clientId === player.clientId) room.recordings.delete(lineId);
      }
      if (!room.hostId) room.hostId = room.players.find((item) => item.id)?.id ?? null;
      if (room.players.length === 0) {
        this.rooms.delete(room.code);
      } else {
        this.#notify(room);
      }
    }, DISCONNECT_GRACE_MS);
    if (typeof player.graceTimer.unref === "function") player.graceTimer.unref();
  }

  rejoin({ code, clientId }) {
    const room = this.get(code);
    const id = cleanClientId(clientId);
    const player = id ? room.players.find((item) => item.clientId === id) : null;
    if (!player) throw new Error("Odaya yeniden bağlanılamadı; lütfen tekrar katıl.");
    return { room, player };
  }

  assign(room, actorId, playerId, characterId) {
    if (actorId !== room.hostId) throw new Error("Karakterleri yalnızca oda kurucusu atayabilir.");
    const character = getScene(room.sceneId).characters.find((item) => item.id === characterId);
    const player = room.players.find((item) => item.id === playerId);
    if (!character || !player) throw new Error("Oyuncu veya karakter bulunamadı.");
    const previousOwner = room.players.find(
      (item) => item.id !== playerId && item.characterId === characterId,
    );
    if (previousOwner) {
      previousOwner.characterId = player.characterId;
      previousOwner.ready = false;
    }
    player.characterId = characterId;
    player.ready = false;
    room.recordings.clear();
    room.playbackAt = null;
  }

  setReady(room, playerId, ready) {
    const player = room.players.find((item) => item.id === playerId);
    if (!player) throw new Error("Oyuncu odada bulunamadı.");
    player.ready = Boolean(ready);
  }

  saveRecording(room, playerId, lineId, payload) {
    const scene = getScene(room.sceneId);
    const player = room.players.find((item) => item.id === playerId);
    const line = scene.lines.find((item) => item.id === lineId);
    if (!player || !line || player.characterId !== line.characterId) {
      throw new Error("Bu replik sana atanmadı.");
    }
    if (!Buffer.isBuffer(payload?.audio) || payload.audio.length === 0) {
      throw new Error("Ses kaydı boş veya geçersiz.");
    }
    if (payload.audio.length > MAX_RECORDING_BYTES) {
      throw new Error("Ses kaydı çok büyük; en fazla 1.5 MB olabilir.");
    }
    const mimeType =
      typeof payload.mimeType === "string" && /^audio\/(webm|ogg|mp4)(;.*)?$/i.test(payload.mimeType)
        ? payload.mimeType
        : "audio/webm";

    room.recordings.set(lineId, {
      lineId,
      playerId: socketlessPlayerId(player),
      clientId: player.clientId,
      playerName: player.name,
      mimeType,
      audio: payload.audio,
    });
  }

  startPlayback(room, actorId) {
    if (actorId !== room.hostId) throw new Error("Oynatmayı oda kurucusu başlatabilir.");
    const scene = getScene(room.sceneId);
    const connected = room.players.filter((player) => player.connected);
    if (!connected.length || !connected.every((player) => player.ready)) {
      throw new Error("Önce odadaki herkes hazır olduğunu belirtmeli.");
    }
    if (scene.lines.some((line) => !room.recordings.has(line.id))) {
      throw new Error("Önce tüm replik kayıtları tamamlanmalı.");
    }
    room.playbackAt = Date.now() + 5_000;
    return room.playbackAt;
  }

  removePlayer(room, socketId) {
    const removed = room.players.find((player) => player.id === socketId);
    room.players = room.players.filter((player) => player.id !== socketId);
    for (const [lineId, recording] of room.recordings) {
      if (recording.playerId === socketId) room.recordings.delete(lineId);
    }
    if (removed) this.#clearGrace(removed);
    if (room.hostId === socketId) room.hostId = room.players.find((player) => player.id)?.id ?? null;
    if (room.players.length === 0) this.rooms.delete(room.code);
  }

  snapshot(room, includeAudio = false) {
    const recordings = {};
    for (const [lineId, recording] of room.recordings) {
      recordings[lineId] = {
        lineId,
        playerId: recording.playerId,
        playerName: recording.playerName,
        mimeType: recording.mimeType,
        audio: includeAudio ? recording.audio.toString("base64") : undefined,
      };
    }
    return {
      code: room.code,
      sceneId: room.sceneId,
      hostId: room.hostId,
      players: room.players.map((player) => ({
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        characterId: player.characterId,
        ready: player.ready,
        connected: player.connected,
      })),
      recordings,
      playbackAt: room.playbackAt,
    };
  }

  get(code) {
    const room = this.rooms.get(String(code || "").toUpperCase());
    if (!room) throw new Error("Bu oda bulunamadı veya kapatılmış.");
    return room;
  }

  #makePlayer({ name, clientId, avatar }) {
    return {
      id: null,
      clientId: cleanClientId(clientId) || null,
      name,
      avatar: cleanAvatar(avatar),
      characterId: null,
      ready: false,
      connected: true,
      graceTimer: null,
    };
  }

  #clearGrace(player) {
    if (player.graceTimer) {
      clearTimeout(player.graceTimer);
      player.graceTimer = null;
    }
  }

  #notify(room) {
    if (this.onRoomChange) this.onRoomChange(room);
  }

  #newCode() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      let code = "";
      for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
        code += CODE_CHARS[randomInt(CODE_CHARS.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    throw new Error("Şu anda oda kodu üretilemiyor; tekrar dene.");
  }

  #assignAvailableCharacter(room, player) {
    const characters = getScene(room.sceneId).characters;
    const assigned = new Set(room.players.map((item) => item.characterId).filter(Boolean));
    const available = characters.filter((item) => !assigned.has(item.id));
    player.characterId = available.length
      ? available[randomInt(available.length)].id
      : null;
  }
}

// Kayıtlar oyuncunun sabit clientId'siyle ilişkilendirilir; socket kopsa bile
// aynı oyuncunun kaydı ekranda kalır.
function socketlessPlayerId(player) {
  return player.id || `client:${player.clientId || player.name}`;
}
