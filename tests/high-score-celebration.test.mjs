import { expect, test } from "vitest";
import { beatsLeaderboard, qualifyingHighScores } from "../app/lib/high-score-celebration";

const player = (name, score, computer = false) => ({ name, computer, scores: Array(13).fill(score), bonus: 0 });

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
