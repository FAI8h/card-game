// testWin.js
import { calculateWon } from './src/games/match-quads/index.js'; // adjust path if needed

// 1. Test a losing hand (mixed cards)
const loser = {
  id: "player1",
  hand: [
    { id: "A-hearts", rank: "A", suits: "hearts" },
    { id: "K-spades", rank: "K", suits: "spades" },
    { id: "Q-diamonds", rank: "Q", suits: "diamonds" },
    { id: "J-clubs", rank: "J", suits: "clubs" }
  ]
};

console.log("Loser wins?", calculateWon(loser, 4)); // Should be false

// 2. Test a winning hand (4 cards of the SAME rank)
const winner = {
  id: "player2",
  hand: [
    { id: "A-hearts", rank: "A", suits: "hearts" },
    { id: "A-spades", rank: "A", suits: "spades" },
    { id: "A-diamonds", rank: "A", suits: "diamonds" },
    { id: "A-clubs", rank: "A", suits: "clubs" }
  ]
};

console.log("Winner wins?", calculateWon(winner, 4)); // Should be true

// 3. Test the 16-card hand (4 sets of 4)
const bigWinner = {
  id: "player3",
  hand: [
    { rank: "A" }, { rank: "A" }, { rank: "A" }, { rank: "A" },
    { rank: "K" }, { rank: "K" }, { rank: "K" }, { rank: "K" },
    { rank: "Q" }, { rank: "Q" }, { rank: "Q" }, { rank: "Q" },
    { rank: "J" }, { rank: "J" }, { rank: "J" }, { rank: "J" },
  ]
};

console.log("Big Winner wins?", calculateWon(bigWinner, 16)); // Should be true