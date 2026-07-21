// ---- 4. Route by actionType -> 5. handler ----
// Each handler takes (state, playerId, payload) and returns { ok, reason?, ... }.
// The actual take/discard logic lives in whatever you registered via
// registerGame() in matchManager - this just looks it up and calls it.
import { sendTo } from "./connectionRegistry.js";
import { getMatchState, getGameHandlers } from "./matchManager.js";
import { broadcastMatchState } from "./redaction.js";

const actionHandlers = {
  take(state, playerId, payload, gameHandlers) {
    return gameHandlers.take(state, playerId, payload.source);
  },
  discard(state, playerId, payload, gameHandlers) {
    return gameHandlers.discard(state, playerId, payload.cardId);
  },
};

export function handleAction(playerId, msg) {
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

  const gameHandlers = getGameHandlers(msg.matchId);
  if (!gameHandlers) {
    sendTo(playerId, { type: "error", reason: "no_game_handlers_registered" });
    return;
  }

  const result = handler(state, playerId, msg.payload, gameHandlers);

  if (!result.ok) {
    sendTo(playerId, { type: "actionRejected", reason: result.reason });
    return;
  }

  // ---- 6. broadcast ----
  broadcastMatchState(msg.matchId, state);
};

