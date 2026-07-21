export function advanceTurn(state) {
  if (state.turnPhase === "take") {
    state.turnPhase = "discard";
    return; // same player, just moved to the next step
  }

  if (state.turnPhase === "discard") {
    state.turnPhase = "take";
    state.turnIndex = (state.turnIndex + 1) % state.players.length;
    return; // discard was the last step, so now it's the next player's turn
  }
}