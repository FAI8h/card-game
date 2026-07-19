export function calculateWon(player, handSize) {
  const cardMap = new Map();
  const cards = player.hand;

  for (const card of cards) {
    if (!cardMap.has(card.rank)) {
      cardMap.set(card.rank, 1);
      continue;
    }
    cardMap.set(card.rank, cardMap.get(card.rank) + 1);
  }

  const expectedQuads = handSize / 4;
  return cardMap.size === expectedQuads;
}
