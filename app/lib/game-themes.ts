import type { CSSProperties } from "react";
import themes from "../../public/bgs/themes.json";

export const GAME_THEMES = themes;
export type GameTheme = (typeof GAME_THEMES)[number];
export const DEFAULT_GAME_THEME = GAME_THEMES[0];

export function randomGameTheme(previousId?: string): GameTheme {
  const choices = GAME_THEMES.filter((theme) => theme.id !== previousId);
  return choices[Math.floor(Math.random() * choices.length)];
}

function mix(color: string, other: string, amount: number) {
  return "#" + [1, 3, 5].map((offset) => {
    const from = parseInt(color.slice(offset, offset + 2), 16);
    const to = parseInt(other.slice(offset, offset + 2), 16);
    return Math.round(from + (to - from) * amount).toString(16).padStart(2, "0");
  }).join("");
}

export function gameThemeStyle(theme: GameTheme): CSSProperties {
  const { accent } = theme;
  return {
    "--game-background": `url("${theme.background}")`,
    "--ink": mix(accent, "#17202a", 0.65),
    "--ink-soft": mix(accent, "#17202a", 0.35),
    "--muted": mix(accent, "#17202a", 0.2),
    "--accent": accent,
    "--accent-hover": mix(accent, "#17202a", 0.2),
    "--accent-disabled": mix(accent, "#59616a", 0.3),
    "--surface": mix(accent, "#ffffff", 0.89),
    "--surface-hover": mix(accent, "#ffffff", 0.8),
    "--suggestion-surface": mix(accent, "#ffffff", 0.95),
    "--dice-surface": mix(accent, "#ffffff", 0.92),
    "--line": mix(accent, "#ffffff", 0.75),
    "--line-strong": mix(accent, "#ffffff", 0.4),
  } as CSSProperties;
}
