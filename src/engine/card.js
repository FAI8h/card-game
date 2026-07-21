//? Standard 52-card deck + generic stack helpers.
//? Card shape kept minimal on purpose - add fields (e.g. `value` for scoring)

export const SUITS = ["hearts", "spades", "diamonds", "clubs"];
export const RANK = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];

function makeCardId(rank, suits) {
    return `${rank}-${suits}`;
};

export function createStandardDeck() {
    const deck = [];

    for (const suits of SUITS) {
        for (const rank of RANK) {
            deck.push({ id: makeCardId(rank, suits), rank, suits });
        }
    };

    return deck;
};



export function shuffle(deck) {
  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export function pop(stack) {
    if (stack.length === 0) return null;
    return stack.pop();
};

export function peekTop(stack) {
    if (stack.length === 0) return null;
    return stack[stack.length - 1];
};

export function push(stack, card) {
    stack.push(card);
}

export function buildInitialDeck() {
  return shuffle(createStandardDeck());
}


export function handSizeFor(playerCount) {
  const table = {
    2: 16,
    3: 12,
      4: 8,
    6: 4,
  };
  if (!table[playerCount]) {
    throw new Error(`no handSize defined yet for ${playerCount} players`);
  }
  return table[playerCount];
};
