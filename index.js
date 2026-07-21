// index.js
import dotenv from "dotenv";
dotenv.config();

import { startServer } from "./src/server/index.js";

import { registerGame } from "./src/server/matchManager.js";

// 1. Import shared engine utilities
import { buildInitialDeck, handSizeFor } from "./src/engine/card.js";
import { dealHands } from "./src/engine/dealHands.js";

// 2. Import match-quads specific rules
import { canTake, takeCard, canDiscard, discardCard, advanceTurn, calculateWon } from "./src/games/match-quads/index.js";

// 3. Register the game with the REAL handlers
registerGame("match-quads", {
  buildInitialDeck,
  handSizeFor,
  dealHands,
  canTake,
  takeCard,
  canDiscard,
  discardCard,
  advanceTurn,
  calculateWon
});

// 4. Start the server
const PORT = process.env.PORT || 5000;
startServer(PORT);