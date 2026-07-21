// ---- 2/3. Parse + validate shape ----

function parseMessage(raw) {
  try {
    return JSON.parse(raw.toString());
  } catch {
    return null; // not valid JSON
  }
}

// Minimum shape every action message must have before we even try to route it.
function isValidActionMessage(msg) {
  return (
    msg &&
    typeof msg === "object" &&
    msg.type === "action" &&
    typeof msg.actionType === "string" &&
    typeof msg.matchId === "string"
  );
};

export {
    parseMessage,
    isValidActionMessage,
}