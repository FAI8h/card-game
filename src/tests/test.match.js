import { startServer } from "../server/wsRouter.js";
import { registerGame } from "../server/matchManager.js";
import WebSocket from "ws";

// Minimal mock game so we can prove the WIRING works, without needing
// Faith's real engine files. Swap this whole registerGame() call for
// your real functions later - shape of what's required is here.
registerGame("game1", {
  buildInitialDeck() {
    // tiny fake deck, just enough for a 2-card hand each
    return [
      { id: "A-clubs", rank: "A", suit: "clubs" },
      { id: "2-clubs", rank: "2", suit: "clubs" },
      { id: "3-clubs", rank: "3", suit: "clubs" },
      { id: "4-clubs", rank: "4", suit: "clubs" },
      { id: "5-clubs", rank: "5", suit: "clubs" },
    ];
  },
  handSizeFor(playerCount) {
    return 2; // fixed small hand for this test
  },
  dealHands(deck, playerIds, handSize) {
    const players = playerIds.map((id) => ({ id, hand: [], connected: true }));
    for (let round = 0; round < handSize; round++) {
      for (const player of players) {
        player.hand.push(deck.pop());
      }
    }
    return players;
  },
  take(state, playerId, source) {
    const stack = source === "deck" ? state.deck : state.discardPile;
    if (stack.length === 0) return { ok: false, reason: `${source}_empty` };
    const player = state.players.find((p) => p.id === playerId);
    player.hand.push(stack.pop());
    state.turnPhase = "discard";
    return { ok: true };
  },
  discard(state, playerId, cardId) {
    const player = state.players.find((p) => p.id === playerId);
    const idx = player.hand.findIndex((c) => c.id === cardId);
    if (idx === -1) return { ok: false, reason: "card_not_in_hand" };
    const [card] = player.hand.splice(idx, 1);
    state.discardPile.push(card);
    state.turnPhase = "take";
    state.turnIndex = (state.turnIndex + 1) % state.players.length;
    return { ok: true };
  },
});

const wss = startServer(8083);

function connect(playerId) {
  const ws = new WebSocket(`ws://localhost:8083?playerId=${playerId}`);
  ws.on("message", (raw) => console.log(`[${playerId}] received:`, raw.toString()));
  return new Promise((resolve) => ws.on("open", () => resolve(ws)));
}
function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const alice = await connect("alice");
const bob = await connect("bob");

let roomId;
await new Promise((resolve) => {
  alice.once("message", (raw) => {
    roomId = JSON.parse(raw.toString()).room.roomId;
    resolve();
  });
  alice.send(JSON.stringify({ type: "create_lobby", gameType: "game1", targetPlayerCount: 2 }));
});

bob.send(JSON.stringify({ type: "join_lobby", roomId }));
await wait(100);

console.log("\n[test] alice starting match (should deal real hands)...\n");
alice.send(JSON.stringify({ type: "start_match", roomId }));
await wait(100);

console.log("\n[test] alice takes from deck...\n");
alice.send(JSON.stringify({ type: "action", actionType: "take", matchId: roomId, payload: { source: "deck" } }));
await wait(100);

console.log("\nSmoke test done.");
alice.close();
bob.close();
wss.close();
process.exit(0);