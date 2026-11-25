import { totalScore, type Participant } from "./game";

export function qualifyingHighScores(players: Participant[], previous: number | null) {
  return players.filter(player => !player.computer && player.scores.every(score => score !== null) && totalScore(player.scores, player.bonus) > (previous ?? -1));
}

export function beatsLeaderboard(score: number, topScore: number | null) {
  return score > (topScore ?? -1);
}
