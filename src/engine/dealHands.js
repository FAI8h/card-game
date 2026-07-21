export function dealHands(deck, playerIds, handSize) {
  const players = playerIds.map((id) => ({
    id,
    hand: [],
    connected: true
  }));

  for (let round = 0; round < handSize; round++) {
    for (const player of players) {
      const card = deck.pop();
      player.hand.push(card);
    }
}

return players;
};