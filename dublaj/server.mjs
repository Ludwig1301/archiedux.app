import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { getScene } from "./lib/scenes.js";
import { RoomStore } from "./server/room-store.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const dev = process.argv.includes("--dev");
const port = Number(process.env.DUBLAJ_PORT || 3100);
const nextApp = next({ dev, dir: root });
const handle = nextApp.getRequestHandler();
const roomStore = new RoomStore((room) => broadcastRoom(room));

await nextApp.prepare();

const server = http.createServer((request, response) => handle(request, response));
const io = new SocketServer(server, {
  path: "/dublaj/socket.io",
  maxHttpBufferSize: 2_000_000,
  cors: { origin: false },
});

function acknowledge(callback, operation) {
  try {
    callback?.({ ok: true, ...operation() });
  } catch (error) {
    callback?.({ ok: false, error: error.message || "İşlem tamamlanamadı." });
  }
}

function broadcastRoom(room) {
  io.to(room.code).emit("room:update", roomStore.snapshot(room));
}

io.on("connection", (socket) => {
  socket.on("room:create", (payload, callback) => {
    acknowledge(callback, () => {
      const { room, player } = roomStore.create(payload || {});
      roomStore.setSocketId(room, player, socket.id);
      socket.join(room.code);
      return {
        room: roomStore.snapshot(room),
        scene: getScene(room.sceneId),
        playerId: socket.id,
      };
    });
  });

  socket.on("room:join", (payload, callback) => {
    acknowledge(callback, () => {
      const { room, player } = roomStore.join({
        code: payload?.code,
        name: payload?.name,
        clientId: payload?.clientId,
        avatar: payload?.avatar,
      });
      roomStore.setSocketId(room, player, socket.id);
      socket.join(room.code);
      broadcastRoom(room);
      return {
        room: roomStore.snapshot(room),
        scene: getScene(room.sceneId),
        playerId: socket.id,
      };
    });
  });

  socket.on("room:rejoin", (payload, callback) => {
    acknowledge(callback, () => {
      const { room, player } = roomStore.rejoin({
        code: payload?.code,
        clientId: payload?.clientId,
      });
      roomStore.setSocketId(room, player, socket.id);
      socket.join(room.code);
      broadcastRoom(room);
      return {
        room: roomStore.snapshot(room),
        scene: getScene(room.sceneId),
        playerId: socket.id,
      };
    });
  });

  socket.on("room:assign", (payload, callback) => {
    acknowledge(callback, () => {
      const room = roomStore.get(payload?.code);
      roomStore.assign(room, socket.id, payload?.playerId, payload?.characterId);
      broadcastRoom(room);
      return { room: roomStore.snapshot(room) };
    });
  });

  socket.on("room:ready", (payload, callback) => {
    acknowledge(callback, () => {
      const room = roomStore.get(payload?.code);
      roomStore.setReady(room, socket.id, payload?.ready);
      broadcastRoom(room);
      return { room: roomStore.snapshot(room) };
    });
  });

  socket.on("room:recording", (payload, callback) => {
    acknowledge(callback, () => {
      const room = roomStore.get(payload?.code);
      const audio =
        Buffer.isBuffer(payload?.audio)
          ? payload.audio
          : payload?.audio instanceof Uint8Array
            ? Buffer.from(payload.audio)
            : null;
      roomStore.saveRecording(room, socket.id, payload?.lineId, {
        audio,
        mimeType: payload?.mimeType,
      });
      broadcastRoom(room);
      return { room: roomStore.snapshot(room) };
    });
  });

  socket.on("room:play", (payload, callback) => {
    acknowledge(callback, () => {
      const room = roomStore.get(payload?.code);
      const playbackAt = roomStore.startPlayback(room, socket.id);
      const state = roomStore.snapshot(room, true);
      io.to(room.code).emit("playback:start", { ...state, playbackAt });
      return { playbackAt };
    });
  });

  socket.on("disconnect", () => {
    for (const room of roomStore.rooms.values()) {
      if (room.players.some((player) => player.id === socket.id)) {
        roomStore.markDisconnected(room, socket.id);
        if (room.players.length > 0) broadcastRoom(room);
      }
    }
  });
});

server.listen(port, process.env.DUBLAJ_HOST || "127.0.0.1", () => {
  console.log(`Dublaj servisi ${dev ? "geliştirme" : "üretim"} modunda :${port} portunda çalışıyor.`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    io.close(() => process.exit(0));
  });
}
