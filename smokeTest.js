// smokeTest.js
import WebSocket from 'ws';

const PORT = process.env.PORT;

// Helper to create a client connection and manage incoming messages
function createClient(playerId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:8080?playerId=${playerId}`);
    
    const messageQueue = [];
    const resolvers = {};

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      // If someone is waiting for this message type, resolve their promise
      if (resolvers[msg.type]) {
        resolvers[msg.type](msg);
        delete resolvers[msg.type];
      } else {
        messageQueue.push(msg);
      }
    });

    ws.on('error', (err) => reject(err));

    const waitForMessage = (type, timeout = 2000) => new Promise((resolve, reject) => {
      // Check if we already received this message type
      const index = messageQueue.findIndex(m => m.type === type);
      if (index !== -1) {
        return resolve(messageQueue.splice(index, 1)[0]);
      }
      // Otherwise, wait for it
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${type}`)), timeout);
      resolvers[type] = (msg) => {
        clearTimeout(timer);
        resolve(msg);
      };
    });

    ws.on('open', () => {
      resolve({
        ws,
        playerId,
        send: (msg) => ws.send(JSON.stringify(msg)),
        waitForMessage
      });
    });
  });
}

async function runTest() {
  console.log('🚀 Starting Smoke Test...\n');

  // 1. Connect two players
  console.log('Connecting players...');
  const p1 = await createClient('player1');
  const p2 = await createClient('player2');
  console.log('✅ Both players connected!\n');

  // 2. Player 1 creates a lobby
  console.log('Player 1 creating lobby (match-quads, 2 players)...');
  p1.send({ type: 'create_lobby', gameType: 'match-quads', targetPlayerCount: 2 });
  
  const p1LobbyState = await p1.waitForMessage('lobbyState');
  const roomId = p1LobbyState.room.roomId;
  console.log(`✅ Lobby created! Room Code: ${roomId}\n`);

  // 3. Player 2 joins the lobby
  console.log(`Player 2 joining lobby ${roomId}...`);
  p2.send({ type: 'join_lobby', roomId });
  
  await p2.waitForMessage('lobbyState');
  await p1.waitForMessage('lobbyState'); // P1 also gets updated lobby state
  console.log('✅ Player 2 joined!\n');

  // 4. Player 1 starts the match
  console.log('Player 1 starting the match...');
  p1.send({ type: 'start_match', roomId });
  
  const p1MatchStart = await p1.waitForMessage('matchState');
  const p2MatchStart = await p2.waitForMessage('matchState');
  console.log('✅ Match started! Cards dealt.\n');

  console.log('--- Initial State ---');
  console.log(`P1 Hand: ${p1MatchStart.state.players[0].hand.map(c => c.id).join(', ')}`);
  console.log(`P2 Hand Count: ${p2MatchStart.state.players[1].hand.length} (Hidden from P1)`);
  console.log(`Turn Phase: ${p1MatchStart.state.turnPhase}, Turn Index: ${p1MatchStart.state.turnIndex}\n`);

  // Verify it's P1's turn to take
  if (p1MatchStart.state.turnPhase !== 'take' || p1MatchStart.state.turnIndex !== 0) {
    throw new Error('Game did not start on P1 take phase!');
  }

  // 5. Player 1 takes from the deck
  console.log('Player 1 takes from deck...');
  p1.send({ 
    type: 'action', 
    actionType: 'take', 
    matchId: roomId, 
    payload: { source: 'deck' } 
  });

  const p1AfterTake = await p1.waitForMessage('matchState');
  await p2.waitForMessage('matchState'); // P2 gets updated state too
  console.log(`✅ P1 took a card. Phase is now: ${p1AfterTake.state.turnPhase}`);
  
  if (p1AfterTake.state.turnPhase !== 'discard') {
    throw new Error('Phase did not advance to discard after take!');
  }

  // 6. Player 1 discards a card
  const cardToDiscard = p1AfterTake.state.players[0].hand[0].id;
  console.log(`Player 1 discards ${cardToDiscard}...`);
  p1.send({ 
    type: 'action', 
    actionType: 'discard', 
    matchId: roomId, 
    payload: { cardId: cardToDiscard } 
  });

  const p1AfterDiscard = await p1.waitForMessage('matchState');
    const p2AfterDiscard = await p2.waitForMessage('matchState');
    console.log("p2 after discard : ", p2AfterDiscard.state);
    
  console.log(`✅ P1 discarded. Turn index is now: ${p1AfterDiscard.state.turnIndex}`);
  
  if (p1AfterDiscard.state.turnIndex !== 1 || p1AfterDiscard.state.turnPhase !== 'take') {
    throw new Error('Turn did not advance to P2 take phase!');
  }

  // 7. Player 1 tries to take out of turn (It's P2's turn now, so P1 should fail)
  console.log('\nPlayer 1 tries to take out of turn (should fail)...');
  p1.send({ 
    type: 'action', 
    actionType: 'take', 
    matchId: roomId, 
    payload: { source: 'deck' } 
  });

  const rejection = await p1.waitForMessage('actionRejected');
  console.log(`✅ Correctly rejected! Reason: ${rejection.reason}`);

  // 8. Player 2 takes properly
  console.log('\nPlayer 2 takes from discardPile...');
  p2.send({ 
    type: 'action', 
    actionType: 'take', 
    matchId: roomId, 
    payload: { source: 'discardPile' } 
  });

    const p2AfterTake = await p2.waitForMessage('matchState');
    console.log("p2 after take from disc pile : ", p2AfterTake.state);
    
  await p1.waitForMessage('matchState');
  
  // Let's also test that P2 can't take twice in a row (testing the phase check we just fixed)
  console.log('Player 2 tries to take again without discarding (should fail)...');
  p2.send({ 
    type: 'action', 
    actionType: 'take', 
    matchId: roomId, 
    payload: { source: 'discardPile' } 
  });
  const phaseRejection = await p2.waitForMessage('actionRejected');
  console.log(`✅ Correctly rejected double-take! Reason: ${phaseRejection.reason}`);

  const p2CardToDiscard = p2AfterTake.state.players[1].hand[0].id;
  
  console.log(`Player 2 discards ${p2CardToDiscard}...`);
  p2.send({ 
    type: 'action', 
    actionType: 'discard', 
    matchId: roomId, 
    payload: { cardId: p2CardToDiscard } 
  });

  await p2.waitForMessage('matchState');
  await p1.waitForMessage('matchState');
  console.log('✅ P2 completed their turn. Back to P1!\n');

  console.log('🎉 SMOKE TEST PASSED! 🎉');
  
  // Clean up
  p1.ws.close();
  p2.ws.close();
  process.exit(0);
}

runTest().catch(err => {
  console.error('❌ TEST FAILED:', err.message);
  process.exit(1);
});