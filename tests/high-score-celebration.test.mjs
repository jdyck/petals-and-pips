import { expect, test } from "vitest";
import { beatsLeaderboard, canAutomaticallyUpdate, previousHighScore, qualifyingHighScores } from "../app/lib/high-score-celebration";

const player = (name, score, computer = false) => ({ name, computer, scores: Array(13).fill(score), bonus: 0 });

test("automatic updates require an existing score and exactly one human player", () => {
  expect(canAutomaticallyUpdate([player("You", 10), player("Computer", 20, true)], 100)).toBe(true);
  expect(canAutomaticallyUpdate([player("You", 10), player("Friend", 20)], 100)).toBe(false);
  expect(canAutomaticallyUpdate([player("You", 10)], null)).toBe(false);
});

test("only completed human scores strictly above the previous record qualify", () => {
  const incomplete = { ...player("Incomplete", 20), scores: [null, ...Array(12).fill(20)] };
  expect(qualifyingHighScores([player("Tie", 10), player("Winner", 11), player("Computer", 30, true), incomplete], 130).map(p => p.name)).toEqual(["Winner"]);
  expect(qualifyingHighScores([player("First", 0)], null)).toHaveLength(1);
});

test("a leaderboard record must beat the top score", () => {
  expect(beatsLeaderboard(200, 200)).toBe(false);
  expect(beatsLeaderboard(201, 200)).toBe(true);
  expect(beatsLeaderboard(0, null)).toBe(true);
});

test("qualification uses the highest previous device or account score", () => {
  expect(previousHighScore(300, 200)).toBe(300);
  expect(previousHighScore(200, 300)).toBe(300);
  expect(previousHighScore(300, null)).toBe(300);
  expect(previousHighScore(null, null)).toBeNull();
  expect(qualifyingHighScores([player("Lower", 20)], previousHighScore(300, 200))).toHaveLength(0);
  expect(qualifyingHighScores([player("Higher", 24)], previousHighScore(300, 200))).toHaveLength(1);
});
