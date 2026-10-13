"use client";

import { io } from "socket.io-client";

let socket;
let activeRoom = null;

export function getRoomSocket() {
  if (!socket) {
    socket = io({
      path: "/dublaj/socket.io",
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function getActiveRoomCode() {
  return activeRoom?.room?.code || "";
}

export function getActiveRoom() {
  return activeRoom;
}

export function setActiveRoom(roomState) {
  activeRoom = roomState;
}

export function updateActiveRoom(room) {
  if (activeRoom?.room?.code === room.code) {
    activeRoom = { ...activeRoom, room };
  }
}

export function clearActiveRoom(code) {
  if (activeRoom?.room?.code === code) activeRoom = null;
}
