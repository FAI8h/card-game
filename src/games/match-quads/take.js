export function canTake(state, playerId, source) {
  const isMyTurn = state.players[state.turnIndex].id === playerId;
  if (!isMyTurn) return false;

  // ADD THIS: Must be in the 'take' phase to take!
  if (state.turnPhase !== "take") return false;

  if (source === "deck") {
    return state.deck.length > 0;
  }
  if (source === "discardPile") {
    return state.discardPile.length > 0;
  }
  return false; 
};

export function takeCard(state, playerId, source) {
  // source is either "deck" or "discardPile"
  const pile = source === "deck" ? state.deck : state.discardPile;
  const card = pile.pop(); // remove the top card from that pile

  const player = state.players.find((p) => p.id === playerId);
  player.hand.push(card); // give it to the player

  return card; // return it so we can show it to the player ("here's what you took")
}