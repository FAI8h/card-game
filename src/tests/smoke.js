import WebSocket from "ws";
import { startServer } from "../server/index.js";
import { registerGame } from "../server/matchManager.js";

import { dealHands } from "../engine/dealHands.js";
import { canTake, takeCard } from "../games/match-quads/take.js";
import { canDiscard, discardCard } from "../games/match-quads/discard.js";
import { advanceTurn } from "../games/match-quads/advanceTurn.js";
import { calculateWon } from "../games/match-quads/calculateWon.js";
import { buildInitialDeck, handSizeFor } from "../engine/card.js";

registerGame("game1", {
  buildInitialDeck,
  handSizeFor,
  dealHands,
  canTake,
  takeCard,
  canDiscard,
  discardCard,
  advanceTurn,
  calculateWon,
});

const wss = startServer(8084);

function connect(playerId) {
  const ws = new WebSocket(`ws://localhost:8084?playerId=${playerId}`);
  return new Promise((resolve) => ws.on("open", () => resolve(ws)));
}
function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let latestState = { alice: null, bob: null };
function listenFor(ws, name) {
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === "matchState") latestState[name] = msg.state;
  });
}

const alice = await connect("alice");
const bob = await connect("bob");
listenFor(alice, "alice");
listenFor(bob, "bob");

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

alice.send(JSON.stringify({ type: "start_match", roomId }));
await wait(150);

console.log("[test] handSize used:", latestState.alice.players.find(p => p.id === "alice").hand.length, "(should be 16 for 2 players)\n");

// Play automated turns: each player, on their turn, takes from deck then
// discards a random card, until someone wins or we hit a safety cap.
// This proves take -> discard -> advanceTurn -> calculateWon all chain
// correctly using the REAL functions, not mocks.
function currentTurn() {
  return latestState.alice.turnIndex === 0 ? "alice" : "bob";
}

function attemptTake(ws, matchId, source) {
  return new Promise((resolve) => {
    const onMsg = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "matchState" || msg.type === "actionRejected") {
        ws.off("message", onMsg);
        resolve(msg.type === "matchState");
      }
    };
    ws.on("message", onMsg);
    ws.send(JSON.stringify({ type: "action", actionType: "take", matchId, payload: { source } }));
  });
}

const conns = { alice, bob };
let rounds = 0;
const MAX_ROUNDS = 3000; // now that source fallback works, give it a real shot at converging

while (latestState.alice.phase === "playing" && rounds < MAX_ROUNDS) {
  const playerName = currentTurn();
  const ws = conns[playerName];

  // Client has no visibility into deck/discard counts (by design), so it
  // must try a source and fall back if rejected - same as a real Godot
  // client would have to.
  const took = await attemptTake(ws, roomId, "deck");
  if (!took) {
    await attemptTake(ws, roomId, "discardPile");
  }

  const myState = latestState[playerName];
  const myHand = myState.players.find((p) => p.id === playerName).hand;
  const cardToDiscard = myHand[Math.floor(Math.random() * myHand.length)];

  ws.send(JSON.stringify({ type: "action", actionType: "discard", matchId: roomId, payload: { cardId: cardToDiscard.id } }));
  await wait(15);

  rounds++;
}

console.log(`[test] finished after ${rounds} rounds`);
console.log(`[test] match phase: ${latestState.alice.phase}`);
console.log(`[test] winnerId: ${latestState.alice.winnerId}`);

alice.close();
bob.close();
wss.close();
process.exit(0);