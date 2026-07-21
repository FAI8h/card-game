const connections = new Map(); // playerId -> ws

export function registerConnection(playerId, ws) {
  const existing = connections.get(playerId);
  if (existing) existing.close();
  connections.set(playerId, ws);
}

export function removeConnection(playerId, ws) {
  if (connections.get(playerId) === ws) {
    connections.delete(playerId);
  }
}

export function sendTo(playerId, msg) {
  const ws = connections.get(playerId);
  if (!ws || ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(msg));
}
