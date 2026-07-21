// Lobby lifecycle - lives BEFORE match state exists.
// A lobby becomes a match only when the host hits start (friends) or it
// auto-fills (matchmaking, not built yet - room code join only for now).

import { randomUUID } from "node:crypto";

const rooms = new Map(); // roomId -> room object

function shortCode() {
  // room codes players actually type/share should be short, not a full UUID
  return randomUUID().slice(0, 6).toUpperCase();
}

export function createLobby(hostId, gameType, targetPlayerCount) {
  const roomId = shortCode();

  const room = {
    roomId,
    gameType,
    targetPlayerCount,
    hostId,
    players: [{ id: hostId }],
    status: "waiting", // "waiting" | "started"
  };

  rooms.set(roomId, room);
  return room;
}

export function joinLobby(roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, reason: "room_not_found" };
  if (room.status !== "waiting") return { ok: false, reason: "already_started" };
  if (room.players.find((p) => p.id === playerId)) return { ok: false, reason: "already_in_room" };
  if (room.players.length >= room.targetPlayerCount) return { ok: false, reason: "room_full" };

  room.players.push({ id: playerId });
  return { ok: true, room };
}

export function startMatch(roomId, requesterId) {
  const room = rooms.get(roomId);
  if (!room) return { ok: false, reason: "room_not_found" };
  if (room.status !== "waiting") return { ok: false, reason: "already_started" };
  if (room.hostId !== requesterId) return { ok: false, reason: "only_host_can_start" };
  // TODO: decide - can the host start early with fewer than targetPlayerCount,
  // or does it need to be exactly full? Locking to "must be full" for now.
  if (room.players.length !== room.targetPlayerCount) return { ok: false, reason: "room_not_full" };

  room.status = "started";
  return { ok: true, room };
}

export function getRoom(roomId) {
  return rooms.get(roomId) ?? null;
}