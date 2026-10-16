import { prefersCompatibleDice } from "./dice";
import { createFullDiceRenderer } from "./dice-full";
import { createCompatibleDiceRenderer } from "./dice-compatible";
import { createCssDiceRenderer } from "./dice-css";
import type { DiceQuality, DiceRenderer } from "./dice";

const factories = { full: createFullDiceRenderer, compatible: createCompatibleDiceRenderer, css: createCssDiceRenderer };

// All three factories live in the initial bundle so the installed game can also
// switch renderers offline without fetching a chunk that has never been cached.
export function initializeDiceRenderer(
  quality: DiceQuality | "css",
  userAgent: string,
  initialize: (renderer: DiceRenderer) => void,
  renderers: typeof factories = factories,
): DiceRenderer {
  const compatible = quality === "compatible" || (quality === "auto" && prefersCompatibleDice(userAgent));
  const candidates: Array<keyof typeof factories> = quality === "css" ? ["css"] : compatible ? ["compatible", "css"] : ["full", "compatible", "css"];
  for (const kind of candidates) {
    let renderer: DiceRenderer | undefined;
    try {
      renderer = renderers[kind]();
      initialize(renderer);
      return renderer;
    } catch (error) {
      if (renderer) {
        renderer.dispose();
        renderer.element.remove();
      }
      if (kind === "css") throw error;
    }
  }
  throw new Error("No dice renderer is available.");
}
