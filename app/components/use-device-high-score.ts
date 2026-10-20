"use client";

import { useEffect, useState } from "react";
import { totalScore } from "../lib/game";
import type { Participant } from "../lib/game";

const STORAGE_KEY = "pips-and-petals-device-high-score";

export function useDeviceHighScore(players: Participant[], finished: boolean) {
  const [highScore, setHighScore] = useState<number | null>(null);

  useEffect(() => {
    let saved: number | null = null;
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      if (value !== null && /^\d+$/.test(value) && Number.isSafeInteger(Number(value))) {
        saved = Number(value);
      }
    } catch {
      // Scores still work for this visit when storage is unavailable.
    }

    const completedScores = finished
      ? players.filter((player) => !player.computer && player.scores.every((score) => score !== null))
        .map((player) => totalScore(player.scores, player.bonus))
      : [];
    const best = Math.max(saved ?? -1, ...completedScores);
    if (best < 0) return;

    setHighScore((current) => Math.max(current ?? -1, best));
    if (completedScores.length && (saved === null || best > saved)) {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(best));
      } catch {
        // Keep the record visible even when it cannot be saved.
      }
    }
  }, [players, finished]);

  return highScore;
}
