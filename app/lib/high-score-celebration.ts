import { totalScore, type Participant } from "./game";

export function canAutomaticallyUpdate(players: Participant[], accountScore: number | null | undefined) {
  return accountScore != null && players.filter(player => !player.computer).length === 1;
}

export function previousHighScore(device: number | null, account: number | null) {
  if (device === null) return account;
  if (account === null) return device;
  return Math.max(device, account);
}

export function qualifyingHighScores(players: Participant[], previous: number | null) {
  return players.filter(player => !player.computer && player.scores.every(score => score !== null) && totalScore(player.scores, player.bonus) > (previous ?? -1));
}

export function beatsLeaderboard(score: number, topScore: number | null) {
  return score > (topScore ?? -1);
}
