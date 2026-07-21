// ---- Wiring it all together on each connection ----
import { WebSocketServer } from "ws";
import { registerConnection, removeConnection, sendTo } from "./connectionRegistry.js";
import { parseMessage, isValidActionMessage } from "./messageParsing.js";
import { handleLobbyMessage } from "./lobbyHandler.js";
import { handleAction } from "./actionHandler.js";

function handleConnection(ws, playerId) {
  registerConnection(playerId, ws);

  ws.on("message", (raw) => {
    const msg = parseMessage(raw);

    if (msg === null) {
      sendTo(playerId, { type: "error", reason: "invalid_json" });
      return;
    }

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
