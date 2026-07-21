// Bridges lobby -> real match state.
// Doesn't know HOW dealing/turns/win-checking work for any specific game -
// it just calls whatever functions you registered for that gameType.
// You wire your real game1 functions in via registerGame(), see bottom
// of this file for an example using YOUR actual function names.

const matches = new Map(); // matchId -> { state, gameType }
const games = new Map(); // gameType -> { dealHands, ... } (whatever the game needs)

// Call this once at server startup for each game you support.
// `handlers.dealHands` is required - it's the only thing matchManager
// itself needs to call directly. Everything else (take/discard/advanceTurn/
// calculateWon) is used later by the action pipeline, not here.
export function registerGame(gameType, handlers) {
  if (typeof handlers.dealHands !== "function") {
    throw new Error(`registerGame(${gameType}) needs a dealHands function`);
  }
  games.set(gameType, handlers);
}

export function createMatchFromRoom(room) {
  const gameHandlers = games.get(room.gameType);
  if (!gameHandlers) {
    throw new Error(`no game registered for gameType: ${room.gameType}`);
  }

  const playerIds = room.players.map((p) => p.id);

  // Your dealHands(deck, playerIds, handSize) needs a starting deck and a
  // hand size - matchManager doesn't know either of those, so the game's
  // own registration supplies them via buildInitialDeck/handSizeFor.
  const deck = gameHandlers.buildInitialDeck();
  const handSize = gameHandlers.handSizeFor(playerIds.length);
  const players = gameHandlers.dealHands(deck, playerIds, handSize);

  const state = {
    matchId: room.roomId, // reuse the room code as the match id, simplest option
    turnIndex: 0,
    turnPhase: "take",
    deck, // whatever's left after dealHands popped cards off
    discardPile: [],
    players,
    phase: "playing", // "playing" | "ended"
    winnerId: null,
  };

  matches.set(state.matchId, { state, gameType: room.gameType });
  return state;
}

export function getMatchState(matchId) {
  const entry = matches.get(matchId);
  return entry ? entry.state : null;
}

export function getGameHandlers(matchId) {
  const entry = matches.get(matchId);
  if (!entry) return null;
  return games.get(entry.gameType) ?? null;
}