// ---- 4. Route by actionType -> 5. handler ----
// Each handler takes (state, playerId, payload) and returns { ok, reason?, ... }.
// The actual take/discard logic lives in whatever you registered via
// registerGame() in matchManager - this just looks it up and calls it.
import { sendTo } from "./connectionRegistry.js";
import { getMatchState, getGameHandlers } from "./matchManager.js";
import { broadcastMatchState } from "./redaction.js";

function resolveHandler(gameHandlers, preferredName, fallbackName) {
  return gameHandlers[preferredName] ?? gameHandlers[fallbackName] ?? null;
}

function isSuccessResult(result) {
  if (result && typeof result === "object" && Object.prototype.hasOwnProperty.call(result, "ok")) {
    return result.ok;
  }
  return Boolean(result);
}

function applyTurnFlow(state, gameHandlers) {
  if (typeof gameHandlers.advanceTurn === "function") {
    gameHandlers.advanceTurn(state);
  }

  if (typeof gameHandlers.calculateWon === "function") {
    for (const player of state.players) {
      if (gameHandlers.calculateWon(player, player.hand.length)) {
        state.phase = "ended";
        state.winnerId = player.id;
        break;
      }
    }
  }
}

const actionHandlers = {
  take(state, playerId, payload, gameHandlers) {
    const takeHandler = resolveHandler(gameHandlers, "take", "takeCard");
    if (!takeHandler) {
      return { ok: false, reason: "no_take_handler" };
    }

    if (typeof gameHandlers.canTake === "function" && !gameHandlers.canTake(state, playerId, payload?.source)) {
      return { ok: false, reason: "take_not_allowed" };
    }

    return takeHandler(state, playerId, payload?.source);
  },
  discard(state, playerId, payload, gameHandlers) {
    const discardHandler = resolveHandler(gameHandlers, "discard", "discardCard");
    if (!discardHandler) {
      return { ok: false, reason: "no_discard_handler" };
    }

    if (typeof gameHandlers.canDiscard === "function" && !gameHandlers.canDiscard(state, playerId, payload?.cardId)) {
      return { ok: false, reason: "discard_not_allowed" };
    }

    return discardHandler(state, playerId, payload?.cardId);
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

  if (!isSuccessResult(result)) {
    sendTo(playerId, { type: "actionRejected", reason: result.reason ?? "action_failed" });
    return;
  }

  applyTurnFlow(state, gameHandlers);

  // ---- 6. broadcast ----
  broadcastMatchState(msg.matchId, state);
};

