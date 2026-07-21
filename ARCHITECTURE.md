# Card Game Server Architecture

## Overview

This repository implements a multiplayer card game server with a clear split between:
- generic server infrastructure
- game-specific rule logic
- test and smoke coverage

## High-level Structure

### Root files
- `index.js`
  - Entry point for the application.
  - Loads environment variables with `dotenv`.
  - Starts the WebSocket server on `process.env.PORT` or `5000`.

- `package.json`
  - Uses ESM (`"type": "module"`).
  - Depends on `ws` for WebSocket support.

### Core directories
- `src/server/`
  - Core server wiring and message processing.
  - Keeps lobby lifecycle, match lifecycle, and connection management separate.

- `src/engine/`
  - Shared card utilities and deal logic.
  - Provides deck construction, shuffling, and hand sizing.

- `src/games/`
  - Game-specific rule implementations.
  - Current game: `match-quads`.

- `src/tests/`
  - Integration and smoke tests for server behavior.
  - Uses real WebSocket connections to verify lobby and match flow.

## Server Architecture

### `src/server/wsRouter.js`
- Main WebSocket request handler.
- Starts the `WebSocketServer`.
- Validates that each connection includes a `playerId` query parameter.
- Registers new connections in `connectionRegistry.js`.
- Delegates lobby messages to `lobbyHandler.js`.
- Delegates game action messages to `actionHandler.js`.
- Wraps handler calls in `try/catch` and sends an error response on unexpected crashes.

### `src/server/connectionRegistry.js`
- Manages active WebSocket connections keyed by `playerId`.
- `registerConnection(playerId, ws)` stores the connection and closes any previous duplicate.
- `removeConnection(playerId, ws)` removes a connection when it closes.
- `sendTo(playerId, msg)` sends JSON messages to a specific player.

### `src/server/messageParsing.js`
- Parses and validates incoming WebSocket messages.
- `parseMessage(raw)` returns an object or `null` for invalid JSON.
- `isValidActionMessage(msg)` checks the required shape for in-game actions.

### `src/server/lobbyManager.js`
- Manages pre-match lobby state.
- `createLobby(hostId, gameType, targetPlayerCount)` creates a new room.
- `joinLobby(roomId, playerId)` adds a player to an existing waiting room.
- `startMatch(roomId, requesterId)` moves a room from waiting to started.

### `src/server/lobbyHandler.js`
- Handles lobby-related client messages.
- Processes `create_lobby`, `join_lobby`, and `start_match` messages.
- Broadcasts lobby state back to connected players.
- When a room starts, converts the room into a real match using `matchManager.createMatchFromRoom()`.
- Broadcasts the initial `matchState` after match creation.

### `src/server/matchManager.js`
- Bridges lobby state into match state and keeps registered game logic.
- Stores active matches and registered game handler sets.
- `registerGame(gameType, handlers)` lets the server support a new game.
- `createMatchFromRoom(room)` builds match state by calling game-specific handlers.
- `getMatchState(matchId)` returns the current state for a match.
- `getGameHandlers(matchId)` returns the game rule set used by a match.

### `src/server/actionHandler.js`
- Processes in-play match actions after a match has started.
- Routes actions by `actionType` such as `take` and `discard`.
- Checks permissions using `canTake` and `canDiscard` before executing.
- Sends an `actionRejected` response when checks fail.
- Applies turn flow and win checks on success.
- Broadcasts updated state using `redaction.broadcastMatchState()`.

### `src/server/redaction.js`
- Prepares per-player match state payloads.
- Keeps a player’s own hand fully visible to them.
- Shows only hand counts for opponents.
- Hides the actual contents of the deck and discard pile.
- Broadcasts `matchState` to all players in a match.

## Game and Engine Architecture

### `src/engine/card.js`
- Contains generic deck utilities and card helpers.
- Generates a standard 52-card deck with `createStandardDeck()`.
- Shuffles cards with `shuffle()`.
- Provides stack helpers such as `pop`, `peekTop`, and `push`.
- Provides `buildInitialDeck()` and `handSizeFor(playerCount)`.

### `src/engine/dealHands.js`
- Deals initial cards to players.
- Creates player objects with empty hands and `connected: true`.
- Distributes cards from the deck into each player hand.

### `src/games/match-quads/`
- Contains the `match-quads` game implementation.
- `canTake(state, playerId, source)` validates turn and source availability.
- `takeCard(state, playerId, source)` moves a card from a pile into the player hand.
- `canDiscard(state, playerId, cardId)` validates turn and card ownership.
- `discardCard(state, playerId, cardId)` moves the card to the discard pile.
- `advanceTurn(state)` advances the turn phase and turn index.
- `calculateWon(player, handSize)` checks whether a player has completed a winning quads pattern.

## Test Architecture

### `src/tests/smoke.js`
- Full integration smoke test.
- Connects two players over real WebSockets.
- Exercises lobby creation, joining, match start, and turn flow.
- Verifies state broadcasts and game action handling.

### `src/tests/test.lobby.js`
- Smoke test for lobby lifecycle and server wiring.
- Verifies room creation, joining, and host-only match start behavior.

### `src/tests/test.match.js`
- Smoke test for match flow.
- Registers a minimal game handler set and verifies match state updates after actions.

## Message Flow Summary

1. A client opens a WebSocket connection with a `playerId` in the query string.
2. `wsRouter` registers the connection.
3. The client sends a JSON message.
4. `messageParsing` validates the payload.
5. `lobbyHandler` handles lobby messages.
6. If the message is not a lobby message, `wsRouter` routes it as an action.
7. `actionHandler` executes the matching game logic.
8. `redaction` sends the updated state back to the players.

## Extension Points

To add a new game type:

1. Implement game-specific logic in a new folder under `src/games/`.
2. Add shared engine utilities in `src/engine/` if needed.
3. Register the game by calling `registerGame(gameType, handlers)` before the server starts.
4. Use the same lobby messages with the new `gameType`.

### Required handlers for a new game
- `buildInitialDeck()`
- `handSizeFor(playerCount)`
- `dealHands(deck, playerIds, handSize)`

### Recommended additional handlers
- `canTake(state, playerId, source)`
- `takeCard(state, playerId, source)`
- `canDiscard(state, playerId, cardId)`
- `discardCard(state, playerId, cardId)`
- `advanceTurn(state)`
- `calculateWon(player, handSize)`

## Important Design Notes

- The server uses the room ID as the match identifier once a lobby starts.
- `playerId` is required for every WebSocket connection and is used for routing messages.
- The server keeps player-specific data private by redacting other players’ hands.
- Lobby flow is separated from match flow.
- Game rules live outside the server core so the same server framework can support multiple card games.
