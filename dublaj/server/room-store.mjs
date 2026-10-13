import { randomInt } from "node:crypto";
import { getScene } from "../lib/scenes.js";

const CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const ROOM_CODE_LENGTH = 6;
const MAX_ROOM_PLAYERS = 8;
const MAX_ACTIVE_ROOMS = 200;
const MAX_RECORDING_BYTES = 1_500_000;

function cleanName(name) {
  if (typeof name !== "string") return "";
  return name.replace(/[<>]/g, "").trim().slice(0, 24);
}

export class RoomStore {
  constructor() {
    this.rooms = new Map();
  }

  create({ name, sceneId }) {
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

    const player = { id: null, name: playerName, characterId: null, ready: false };
    room.players.push(player);
    this.rooms.set(room.code, room);
    return { room, player };
  }

  join({ code, name }) {
    const room = this.get(code);
    const playerName = cleanName(name);
    if (playerName.length < 2) throw new Error("Görünen ad en az 2 karakter olmalı.");
    if (room.players.length >= MAX_ROOM_PLAYERS) throw new Error("Oda dolu.");
    if (room.players.some((player) => player.name.toLowerCase() === playerName.toLowerCase())) {
      throw new Error("Bu ad odada zaten kullanılıyor.");
    }

    const player = { id: null, name: playerName, characterId: null, ready: false };
    room.players.push(player);
    return { room, player };
  }

  setSocketId(room, player, socketId) {
    player.id = socketId;
    if (!room.hostId) room.hostId = socketId;
    this.#assignAvailableCharacter(room, player);
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
      playerId,
      playerName: player.name,
      mimeType,
      audio: payload.audio,
    });
  }

  startPlayback(room, actorId) {
    if (actorId !== room.hostId) throw new Error("Oynatmayı oda kurucusu başlatabilir.");
    const scene = getScene(room.sceneId);
    if (!room.players.every((player) => player.ready)) {
      throw new Error("Önce odadaki herkes hazır olduğunu belirtmeli.");
    }
    if (scene.lines.some((line) => !room.recordings.has(line.id))) {
      throw new Error("Önce tüm replik kayıtları tamamlanmalı.");
    }
    room.playbackAt = Date.now() + 5_000;
    return room.playbackAt;
  }

  removePlayer(room, socketId) {
    room.players = room.players.filter((player) => player.id !== socketId);
    for (const [lineId, recording] of room.recordings) {
      if (recording.playerId === socketId) room.recordings.delete(lineId);
    }
    if (room.hostId === socketId) room.hostId = room.players[0]?.id ?? null;
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
      players: room.players.map((player) => ({ ...player })),
      recordings,
      playbackAt: room.playbackAt,
    };
  }

  get(code) {
    const room = this.rooms.get(String(code || "").toUpperCase());
    if (!room) throw new Error("Bu oda bulunamadı veya kapatılmış.");
    return room;
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
