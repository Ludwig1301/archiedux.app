import assert from "node:assert/strict";
import test from "node:test";
import { RoomStore } from "./room-store.mjs";

function makeRoom() {
  const store = new RoomStore();
  const created = store.create({ name: "Deniz", sceneId: "tears-of-steel-opening" });
  store.setSocketId(created.room, created.player, "socket-host");
  const guest = store.join({ code: created.room.code, name: "Ada" });
  store.setSocketId(guest.room, guest.player, "socket-guest");
  store.assign(created.room, "socket-host", "socket-host", "thom");
  return { store, room: created.room };
}

test("creates a room with a host and assigns the first available role", () => {
  const { room } = makeRoom();
  assert.match(room.code, /^[2-9A-HJ-NP-Z]{6}$/);
  assert.equal(room.hostId, "socket-host");
  assert.equal(room.players[0].characterId, "thom");
  assert.equal(room.players[1].characterId, "celia");
});

test("only the host can assign roles and assignments swap cleanly", () => {
  const { store, room } = makeRoom();
  assert.throws(
    () => store.assign(room, "socket-guest", "socket-guest", "thom"),
    /yalnızca oda kurucusu/,
  );
  store.assign(room, "socket-host", "socket-guest", "thom");
  assert.equal(room.players[1].characterId, "thom");
  assert.equal(room.players[0].characterId, "celia");
});

test("rejects duplicate room names and records from another character", () => {
  const { store, room } = makeRoom();
  assert.throws(() => store.join({ code: room.code, name: "deniz" }), /zaten kullanılıyor/);
  assert.throws(
    () => store.saveRecording(room, "socket-host", "celia-1", { audio: Buffer.from("voice") }),
    /sana atanmadı/,
  );
});

test("requires every line before starting shared playback", () => {
  const { store, room } = makeRoom();
  assert.throws(() => store.startPlayback(room, "socket-host"), /herkes hazır/);
  store.setReady(room, "socket-host", true);
  store.setReady(room, "socket-guest", true);
  assert.throws(() => store.startPlayback(room, "socket-host"), /tüm replik kayıtları/);
  store.saveRecording(room, "socket-guest", "celia-1", { audio: Buffer.from("celia") });
  store.saveRecording(room, "socket-host", "thom-2", { audio: Buffer.from("thom") });
  assert.ok(store.startPlayback(room, "socket-host") > Date.now());
});

test("limits uploaded recording size and removes the final empty room", () => {
  const { store, room } = makeRoom();
  assert.throws(
    () =>
      store.saveRecording(room, "socket-guest", "celia-1", {
        audio: Buffer.alloc(1_500_001),
      }),
    /çok büyük/,
  );
  store.removePlayer(room, "socket-host");
  store.removePlayer(room, "socket-guest");
  assert.equal(store.rooms.has(room.code), false);
});
