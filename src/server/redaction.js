import { sendTo } from "./connectionRegistry.js";

function redactForPlayer(state, playerId) {
  const redactedPlayers = state.players.map((player) => {
    if (player.id === playerId) {
      return player; // this is me - full detail, my real hand
    }
    return {
      id: player.id,
      handCount: player.hand.length,
      connected: player.connected,
    };
  });

  return {
    matchId: state.matchId,
    turnIndex: state.turnIndex,
    turnPhase: state.turnPhase,
    phase: state.phase,
    winnerId: state.winnerId,
      players: redactedPlayers,
      discardedPileCount: state.discardPile.length,
    deckCount : state.deck.length
  };
}

function broadcastMatchState(matchId, state) {
  for (const player of state.players) {
    sendTo(player.id, {
      type: "matchState",
      matchId,
      state: redactForPlayer(state, player.id),
    });
  }
};

export {
    redactForPlayer,
    broadcastMatchState
}