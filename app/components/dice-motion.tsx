"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "pips-and-petals-animate-dice";

export function useDiceMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [animateDice, setAnimateDice] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
        ?? window.localStorage.getItem("petals-and-pips-animate-dice");
      setAnimateDice(saved === "true");
      if (saved !== null) window.localStorage.setItem(STORAGE_KEY, saved);
    } catch {
      // The toggle also works when browser storage is unavailable.
    }
    return () => preference.removeEventListener("change", update);
  }, []);

  function toggleAnimation(enabled: boolean) {
    setAnimateDice(enabled);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // Keep the choice for this visit even if it cannot be saved.
    }
  }

  return { reducedMotion, animateDice, toggleAnimation };
}

export function DiceMotionToggle({ reducedMotion, animateDice, toggleAnimation }: ReturnType<typeof useDiceMotion>) {
  if (!reducedMotion) return null;

  return <label className="dice-motion-toggle">
    <input type="checkbox" checked={animateDice} onChange={(event) => toggleAnimation(event.target.checked)} />
    <span>Animate dice</span>
  </label>;
}
