import { startServer } from "../server/wsRouter.js";
import WebSocket from "ws";

const wss = startServer(8082);

function connect(playerId) {
  const ws = new WebSocket(`ws://localhost:8082?playerId=${playerId}`);
  ws.on("message", (raw) => console.log(`[${playerId}] received:`, raw.toString()));
  return new Promise((resolve) => ws.on("open", () => resolve(ws)));
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const alice = await connect("alice");
const bob = await connect("bob");

// bob tries to start a room that doesn't exist yet - should be rejected
bob.send(JSON.stringify({ type: "start_match", roomId: "WRONG1" }));
await wait(100);

// alice creates a 2-player lobby, capture the real roomId from the response
let roomId;
await new Promise((resolve) => {
  alice.once("message", (raw) => {
    roomId = JSON.parse(raw.toString()).room.roomId;
    resolve();
  });
  alice.send(JSON.stringify({ type: "create_lobby", gameType: "game1", targetPlayerCount: 2 }));
});
console.log("\n[test] captured roomId:", roomId, "\n");

// bob joins using the real roomId
bob.send(JSON.stringify({ type: "join_lobby", roomId }));
await wait(100);

// bob (not host) tries to start - should be rejected
bob.send(JSON.stringify({ type: "start_match", roomId }));
await wait(100);

// alice (host) starts it - should succeed, room is full (2/2)
alice.send(JSON.stringify({ type: "start_match", roomId }));
await wait(100);

console.log("\nLobby smoke test done.");
alice.close();
bob.close();
wss.close();
process.exit(0);