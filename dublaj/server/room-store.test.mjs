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

test("rejoins a returning tab by clientId instead of creating a duplicate", () => {
  const store = new RoomStore();
  const created = store.create({
    name: "Deniz",
    sceneId: "tears-of-steel-opening",
    clientId: "tab-1",
  });
  store.setSocketId(created.room, created.player, "socket-host");
  store.markDisconnected(created.room, "socket-host");
  const again = store.join({ code: created.room.code, name: "Deniz", clientId: "tab-1" });
  assert.equal(again.player, created.player);
  assert.equal(again.room.players.length, 1);
  store.setSocketId(again.room, again.player, "socket-host-2");
  assert.equal(again.room.hostId, "socket-host-2");
});

test("marks disconnected players offline and hands the host role on", () => {
  const { store, room } = makeRoom();
  store.markDisconnected(room, "socket-host");
  assert.equal(room.players[0].connected, false);
  assert.equal(room.hostId, "socket-guest");
});

test("notifies when a disconnected player leaves after the grace period", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const sizes = [];
  const store = new RoomStore((room) => sizes.push(room.players.length));
  const created = store.create({
    name: "Deniz",
    sceneId: "tears-of-steel-opening",
    clientId: "tab-1",
  });
  store.setSocketId(created.room, created.player, "socket-host");
  const guest = store.join({ code: created.room.code, name: "Ada", clientId: "tab-2" });
  store.setSocketId(guest.room, guest.player, "socket-guest");
  store.markDisconnected(created.room, "socket-host");
  t.mock.timers.tick(30_000);
  assert.deepEqual(sizes, [1]);
  assert.equal(created.room.players.length, 1);
});

test("only the host can stop playback and snapshot exposes clientId", () => {
  const { store, room } = makeRoom();
  room.playbackAt = Date.now() + 5_000;
  assert.throws(() => store.stopPlayback(room, "socket-guest"), /yalnızca oda kurucusu/);
  store.stopPlayback(room, "socket-host");
  assert.equal(room.playbackAt, null);
  const snap = store.snapshot(room);
  assert.ok(snap.players.every((player) => "clientId" in player));
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
