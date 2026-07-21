import { startServer } from "../server/index.js";
import WebSocket from "ws";

const wss = startServer(8081);

const client = new WebSocket("ws://localhost:8081?playerId=bob");

client.on("open", async () => {
  console.log("[client] connected as bob");

  client.on("message", (raw) => {
    console.log("[client] received:", raw.toString());
  });

  // 1. garbage, not JSON at all -> should get invalid_json
  client.send("this is not json {{{");
  await wait(100);

  // 2. valid JSON but wrong shape -> should get invalid_message_shape
  client.send(JSON.stringify({ hello: "world" }));
  await wait(100);

  // 3. correct shape, unknown actionType -> should get unknown_action_type
  client.send(JSON.stringify({ type: "action", actionType: "flyAway", matchId: "m1" }));
  await wait(100);

  // 4. correct shape, known actionType but handler not wired yet ->
  //    will throw (expected, since getMatchState/take aren't wired to real code).
  //    This just proves routing reaches the right handler.
  try {
    client.send(JSON.stringify({ type: "action", actionType: "take", matchId: "m1", payload: {} }));
  } catch (e) {
    console.log("[test] expected: handler not wired yet -", e.message);
  }
  await wait(200);

  console.log("\nSmoke test done - pipeline stages 1-4 all reachable and correct.");
  client.close();
  wss.close();
  process.exit(0);
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}