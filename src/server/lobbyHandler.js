import { sendTo } from "./connectionRegistry.js";
import { createLobby,joinLobby, startMatch } from "./lobbyManager.js";
import { createMatchFromRoom } from "./matchManager.js";
import { broadcastMatchState } from "./redaction.js";

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

      // Lobby is now "started" - turn it into real match state (deal cards,
      // set up turn tracking) and broadcast that too so clients can switch
      // from "lobby screen" to "game screen".
      const state = createMatchFromRoom(result.room);
      broadcastMatchState(state.matchId, state);
      return true;
    }
    default:
      return false; // not a lobby message, let the caller try something else
  }
};

export {
    broadcastRoom,
    handleLobbyMessage,
}