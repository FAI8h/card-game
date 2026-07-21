// WS message layer for the card game server.
// Pipeline: client -> buffer -> JSON.parse -> validate shape -> route -> handler -> broadcast
//
// Swap the imports below for your real engine/game1 files -
// function names here (takeCard, discardCard, canTake, canDiscard,
// advanceTurn, calculateWon) match what we built together in chat.
// Adjust names/paths to match what you actually wrote.

import { WebSocketServer } from "ws";
import { createLobby, joinLobby, startMatch, getRoom } from "./lobbyManager.js";

// ---- 1. Connection registry: one connection per playerId ----

const connections = new Map(); // playerId -> ws

function registerConnection(playerId, ws) {
  const existing = connections.get(playerId);
  if (existing) existing.close(); // kick stale/old connection, no multi-device support
  connections.set(playerId, ws);
}

function removeConnection(playerId, ws) {
  // only remove if this is still the current connection for that player
  // (guards against a late "close" event from an already-replaced socket)
  if (connections.get(playerId) === ws) {
    connections.delete(playerId);
  }
}

function sendTo(playerId, msg) {
  const ws = connections.get(playerId);
  if (!ws || ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(msg));
}

// ---- 2/3. Parse + validate shape ----

function parseMessage(raw) {
  try {
    return JSON.parse(raw.toString());
  } catch {
    return null; // not valid JSON
  }
}

// Minimum shape every action message must have before we even try to route it.
function isValidActionMessage(msg) {
  return (
    msg &&
    typeof msg === "object" &&
    msg.type === "action" &&
    typeof msg.actionType === "string" &&
    typeof msg.matchId === "string"
  );
}

function broadcastRoom(room) {
  for (const player of room.players) {
    sendTo(player.id, { type: "lobbyState", room });
  }
}

function handleLobbyMessage(playerId, msg) {
  switch (msg.type) {
    case "create_lobby": {
      // msg.gameType, msg.targetPlayerCount
      const room = createLobby(playerId, msg.gameType, msg.targetPlayerCount);
      broadcastRoom(room);
      return true;
    }
    case "join_lobby": {
      // msg.roomId
      const result = joinLobby(msg.roomId, playerId);
      if (!result.ok) {
        sendTo(playerId, { type: "error", reason: result.reason });
        return true;
      }
      broadcastRoom(result.room);
      return true;
    }
    case "start_match": {
      // msg.roomId
      const result = startMatch(msg.roomId, playerId);
      if (!result.ok) {
        sendTo(playerId, { type: "error", reason: result.reason });
        return true;
      }
      broadcastRoom(result.room);
      // TODO: this is the actual hook point to create real match state
      // (deal cards, etc) once matchManager exists - result.room has
      // gameType + players, everything createMatchState needs.
      return true;
    }
    default:
      return false; // not a lobby message, let the caller try something else
  }
}

// ---- 4. Route by actionType -> 5. handler ----
// Each handler takes (state, playerId, payload) and returns { ok, reason?, ... }
// TODO: replace these with your real functions from game1/engine.
const actionHandlers = {
  take(state, playerId, payload) {
    // e.g. return playerTake(state, playerId, payload.source);
    throw new Error("wire this up to your real take() function");
  },
  discard(state, playerId, payload) {
    // e.g. return playerDiscard(state, playerId, payload.cardId);
    throw new Error("wire this up to your real discard() function");
  },
};

// TODO: replace with however you're storing live match state
// (e.g. a Map<matchId, state> from your matchManager).
function getMatchState(matchId) {
  throw new Error("wire this up to wherever match state actually lives");
}

function handleAction(playerId, msg) {
  const handler = actionHandlers[msg.actionType];
  if (!handler) {
    sendTo(playerId, { type: "error", reason: "unknown_action_type" });
    return;
  }

  const state = getMatchState(msg.matchId);
  if (!state) {
    sendTo(playerId, { type: "error", reason: "match_not_found" });
    return;
  }

  const result = handler(state, playerId, msg.payload);

  if (!result.ok) {
    sendTo(playerId, { type: "actionRejected", reason: result.reason });
    return;
  }

  // ---- 6. broadcast ----
  broadcastMatchState(msg.matchId, state);
}

// TODO: replace with your real redaction function (per-player view,
// hiding other hands / deck contents / discard pile except top).
function redactForPlayer(state, playerId) {
  throw new Error("wire this up to your real redaction function");
}

function broadcastMatchState(matchId, state) {
  for (const player of state.players) {
    sendTo(player.id, {
      type: "matchState",
      matchId,
      state: redactForPlayer(state, player.id),
    });
  }
}

// ---- Wiring it all together on each connection ----

function handleConnection(ws, playerId) {
  registerConnection(playerId, ws);

  ws.on("message", (raw) => {
    const msg = parseMessage(raw);

    if (msg === null) {
      sendTo(playerId, { type: "error", reason: "invalid_json" });
      return;
    }

    // Lobby messages (create_lobby, join_lobby, start_match) are handled
    // separately from in-match actions (take, discard) - different shape,
    // different stage of the game's lifecycle.
    try {
      const wasLobbyMessage = handleLobbyMessage(playerId, msg);
      if (wasLobbyMessage) return;
    } catch (err) {
      console.error(`[wsRouter] lobby handler error for ${playerId}:`, err.message);
      sendTo(playerId, { type: "error", reason: "internal_error" });
      return;
    }

    if (!isValidActionMessage(msg)) {
      sendTo(playerId, { type: "error", reason: "invalid_message_shape" });
      return;
    }

    // A single player's action should never be able to take down the whole
    // server (and every other match on it). Anything unexpected inside a
    // handler - a bug, an unwired TODO, whatever - gets caught here and
    // reported back to just that player.
    try {
      handleAction(playerId, msg);
    } catch (err) {
      console.error(`[wsRouter] handler error for ${playerId}:`, err.message);
      sendTo(playerId, { type: "error", reason: "internal_error" });
    }
  });

  ws.on("close", () => {
    removeConnection(playerId, ws);
  });
}

// ---- Bootstrapping the server ----
// No auth yet - playerId comes straight from a query param, on purpose,
// per what we agreed (add real auth later).

export function startServer(port) {
  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, "http://localhost");
    const playerId = url.searchParams.get("playerId");

    if (!playerId) {
      ws.close(4001, "playerId required");
      return;
    }

    handleConnection(ws, playerId);
  });

  console.log(`card game WS server listening on :${port}`);
  return wss;
}