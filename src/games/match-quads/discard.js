export function canDiscard(state, playerId, cardId) {
  const isMyTurn = state.players[state.turnIndex].id === playerId;
  if (!isMyTurn) return false;

  // ADD THIS: Must be in the 'discard' phase to discard!
  if (state.turnPhase !== "discard") return false;

  const player = state.players.find((p) => p.id === playerId);
  const cardIndex = player.hand.findIndex((c) => c.id === cardId);

  return cardIndex !== -1; 
};

export function discardCard(state, playerId, cardId) {
  const player = state.players.find((p) => p.id === playerId);
  const cardIndex = player.hand.findIndex((c) => c.id === cardId);

  const [card] = player.hand.splice(cardIndex, 1); // remove it from hand
  state.discardPile.push(card); // put it on top of discard pile

  return card;
}