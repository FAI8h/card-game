# Card Game Server Architecture

## Purpose

This repository implements a multiplayer card game server with a separation between generic server infrastructure and game-specific rule logic. The architecture is designed to support multiple game types by registering game handlers that implement deck building, hand dealing, and action processing.

## High-level structure

- `index.js`
  - Entrypoint for the application.
  - Loads environment variables via `dotenv`.
  - Starts the WebSocket server on `process.env.PORT` or `5000`.

- `package.json`
  - Uses ESM (`"type": "module"`).
  - Depends on `ws` for WebSocket support.

- `src/server/`
  - Core server wiring and message processing.
  - Keeps lobby lifecycle, match lifecycle, and connection management separate.

- `src/engine/`
  - Shared card utilities and deal logic.
  - Provides deck construction, shuffle, and hand sizing.

- `src/games/`
  - Game-specific rule implementations.
  - Current example: `match-quads`.

- `src/tests/`
  - Integration and smoke tests for server behavior.
  - Uses real WebSocket connections to verify lobby and match flow.

## Server architecture

### `src/server/wsRouter.js`

This file is the main WebSocket request handler.

Responsibilities:
- Starts the `WebSocketServer`.
- Validates that every connection includes a `playerId` query parameter.
- Registers new connections in `connectionRegistry.js`.
- Receives raw messages and forwards them for parsing.
- Delegates lobby messages to `lobbyHandler.js`.
- Delegates game action messages to `actionHandler.js`.
- Handles connection close events cleanly.

### `src/server/connectionRegistry.js`

Manages active WebSocket connections keyed by `playerId`.

Responsibilities:
- `registerConnection(playerId, ws)` stores the connection and closes any previous duplicate.
- `removeConnection(playerId, ws)` removes a connection when it closes.
- `sendTo(playerId, msg)` sends JSON messages to a particular player.

### `src/server/messageParsing.js`

Parses and validates incoming WebSocket messages.

Responsibilities:
- `parseMessage(raw)` returns an object or `null` for invalid JSON.
- `isValidActionMessage(msg)` checks the required shape for in-game actions.

### `src/server/lobbyManager.js`

Manages the pre-match lobby state.

Responsibilities:
- `createLobby(hostId, gameType, targetPlayerCount)` creates a new room.
- `joinLobby(roomId, playerId)` adds a player to an existing waiting room.
- `startMatch(roomId, requesterId)` moves a room from waiting to started.
- Uses a short generated room code as `roomId`.

### `src/server/lobbyHandler.js`

Handles lobby-related client messages.

Responsibilities:
- Processes `create_lobby`, `join_lobby`, and `start_match` messages.
- Broadcasts lobby state back to connected players.
- When a room starts, converts the room into a real match using `matchManager.createMatchFromRoom()`.
- Broadcasts initial `matchState` after match creation.

### `src/server/matchManager.js`

Bridges lobby state into match state and keeps registered game logic.

Responsibilities:
- Stores active matches and registered game handler sets.
- `registerGame(gameType, handlers)` lets the server support a new game.
- `createMatchFromRoom(room)` builds match state by calling game-specific handlers:
  - `buildInitialDeck()`
  - `handSizeFor(playerCount)`
  - `dealHands(deck, playerIds, handSize)`
- `getMatchState(matchId)` returns current state for a match.
- `getGameHandlers(matchId)` returns the game rule set used by a match.

### `src/server/actionHandler.js`

Processes in-play match actions after a match has already started.

Responsibilities:
- Routes action messages by `actionType`.
- Validates match existence and registered game handlers.
- Invokes registered game-specific handlers such as:
  - `take` / `takeCard`
  - `discard` / `discardCard`
- Optionally checks permissions using `canTake` and `canDiscard`.
- Advances turn state using `advanceTurn`.
- Evaluates win conditions using `calculateWon`.
- Broadcasts updated state using `redaction.broadcastMatchState()`.

### `src/server/redaction.js`

Prepares per-player match state payloads.

Responsibilities:
- Keeps a player's own hand fully visible to them.
- Shows only `handCount` for opponents.
- Omits the deck and discard pile entirely from client state.
- Broadcasts `matchState` to all players in a match.

## Game / engine architecture

### `src/engine/card.js`

Contains generic deck utilities and card helper functions.

Responsibilities:
- Generates a standard deck.
- Shuffles cards.
- Provides `buildInitialDeck()`.
- Defines `handSizeFor(playerCount)`.

### `src/engine/dealHands.js`

Deals initial cards to players.

Responsibilities:
- Creates player objects with empty hands.
- Distributes cards from the deck into each player hand.

### `src/games/match-quads/`

Contains an example game implementation.

Responsibilities:
- `take.js` determines whether a player can take and performs the take action.
- `discard.js` determines whether a player can discard and performs the discard action.
- `advanceTurn.js` moves the turn phase forward.
- `calculateWon.js` checks whether a player has met win conditions.

## Test architecture

### `src/tests/smoke.js`

A full integration smoke test.

Responsibilities:
- Registers a `game1` handler set with real engine/game logic.
- Starts a temporary WebSocket server on an available port.
- Connects two players and plays through lobby creation, join, and match start.
- Verifies match state broadcasts and action handling.

### `src/tests/test.lobby.js`

Smoke test for lobby lifecycle and basic server wiring.

Responsibilities:
- Connects two players.
- Creates a lobby and joins it.
- Checks that only the host can start the match.

### `src/tests/test.match.js`

Smoke test for match flow.

Responsibilities:
- Registers fake/minimal game handlers.
- Creates a lobby and starts a match.
- Sends game actions like `take` and verifies match state updates.

## Message flow summary

1. Client opens WebSocket connection with `playerId` in query string.
2. `wsRouter` registers the connection.
3. Client sends JSON messages.
4. `messageParsing` validates incoming payloads.
5. `lobbyHandler` intercepts lobby messages.
6. If the message is not a lobby message, `wsRouter` validates it as an action.
7. `actionHandler` processes the action, using the registered game implementation.
8. `redaction` sends state updates back to players.

## Extension points

To add a new game type:

- Implement game-specific logic in a new folder under `src/games/`.
- Implement shared game utilities or deck builders in `src/engine/` if needed.
- Register the game by calling `registerGame(gameType, handlers)` before starting the server.
- Use the same lobby messages with `gameType` set to the new type.

Required handlers for a new game:
- `buildInitialDeck()`
- `handSizeFor(playerCount)`
- `dealHands(deck, playerIds, handSize)`

Recommended additional handlers:
- `canTake(state, playerId, source)`
- `takeCard(state, playerId, source)`
- `canDiscard(state, playerId, cardId)`
- `discardCard(state, playerId, cardId)`
- `advanceTurn(state)`
- `calculateWon(player, handSize)`

## Important design notes

- The server treats `roomId` as the match identifier once a lobby starts.
- `playerId` is required on every WebSocket connection and is the key used for routing messages.
- The server keeps player-specific data private by redacting other players' hands.
- The architecture intentionally separates lobby flow from match flow.
- Game rules live outside the server core so the same server framework can support multiple card games.
