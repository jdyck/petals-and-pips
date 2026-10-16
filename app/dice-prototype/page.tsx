"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ROLL_DURATION, RollingDie } from "../components/rolling-die";
import { DiceMotionToggle, useDiceMotion } from "../components/dice-motion";
import type { DiceQuality } from "../lib/dice";
import { DIE_LIGHT_ANGLE } from "../lib/dice";
import { DEFAULT_DICE_SHADING } from "../lib/dice-shading";

export default function DicePrototype() {
  const diceMotion = useDiceMotion();
  const [value, setValue] = useState(5);
  const [lightAngle, setLightAngle] = useState(DIE_LIGHT_ANGLE);
  const [rolling, setRolling] = useState(false);
  const [rollId, setRollId] = useState(0);
  const [quality, setQuality] = useState<DiceQuality>("auto");
  const [fpsLimit, setFpsLimit] = useState(16);
  const [topWhite, setTopWhite] = useState(Math.round(DEFAULT_DICE_SHADING.topWhite * 100));
  const [shadowDarkness, setShadowDarkness] = useState(Math.round(DEFAULT_DICE_SHADING.shadowDarkness * 100));
  const [shadowTint, setShadowTint] = useState(DEFAULT_DICE_SHADING.shadowTint);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function roll(forcedValue?: number) {
    if (rolling) return;
    setValue(forcedValue ?? Math.floor(Math.random() * 6) + 1);
    setRollId((id) => id + 1);
    setRolling(true);
    timer.current = setTimeout(() => setRolling(false), ROLL_DURATION);
  }

  return (
    <main className="die-preview-page">
      <header className="die-preview-header">
        <Link href="/" className="die-preview-back">← Back to Petals & Pips</Link>
      </header>
      <section className="die-preview-card">
        <h1>Dice preview</h1>
        <div className="die-preview-table">
          <div className="die-preview-die">
            <RollingDie value={value} rolling={rolling} rollId={rollId} lightAngle={lightAngle} quality={quality} fpsLimit={fpsLimit} shading={{ topWhite: topWhite / 100, shadowDarkness: shadowDarkness / 100, shadowTint }} animateWithReducedMotion={diceMotion.animateDice} />
          </div>
          <div className="die-preview-result" aria-live="polite" aria-atomic="true">
            {rolling ? "Rolling…" : <>Landed on <strong>{value}</strong></>}
          </div>
        </div>
        <button className="roll-button die-preview-roll" disabled={rolling} onClick={() => roll()}>
          {rolling ? "Rolling…" : "Roll the die"}
        </button>
        <fieldset className="die-preview-balance">
          <legend>Top &amp; shadows</legend>
          <label className="die-preview-light">
            <span>Top whiteness <small>{topWhite}%</small></span>
            <input type="range" min="80" max="100" step="1" value={topWhite} onChange={(event) => setTopWhite(Number(event.target.value))} aria-label="Top whiteness" aria-valuetext={`${topWhite} percent`} />
            <span className="die-preview-light-ends"><small>Soft white</small><small>Pure white</small></span>
          </label>
          <label className="die-preview-light">
            <span>Shadow darkness <small>{shadowDarkness}%</small></span>
            <input type="range" min="0" max="100" step="1" value={shadowDarkness} onChange={(event) => setShadowDarkness(Number(event.target.value))} aria-label="Shadow darkness" aria-valuetext={`${shadowDarkness} percent`} />
            <span className="die-preview-light-ends"><small>Lighter</small><small>Darker</small></span>
          </label>
          <div className="die-preview-color">
            <label className="die-preview-tint">Shadow tint <input type="color" value={shadowTint} onChange={(event) => setShadowTint(event.target.value)} aria-label="Shadow tint" /><code>{shadowTint.toUpperCase()}</code></label>
          </div>
          <div className="die-preview-tint-presets">
            <button type="button" className="header-button" onClick={() => setShadowTint("#c5c5c5")}>Neutral</button>
            <button type="button" className="header-button" onClick={() => setShadowTint("#b8c5d6")}>Cool</button>
            <button type="button" className="header-button" onClick={() => setShadowTint("#d6c3b0")}>Warm</button>
          </div>
          <p className="die-preview-help">Keep the top near-white while adjusting the shaded sides. Tint changes only the shadows, and follows the dice as they roll.</p>
          <button type="button" className="header-button" onClick={() => { setTopWhite(Math.round(DEFAULT_DICE_SHADING.topWhite * 100)); setShadowDarkness(Math.round(DEFAULT_DICE_SHADING.shadowDarkness * 100)); setShadowTint(DEFAULT_DICE_SHADING.shadowTint); }}>Reset appearance</button>
        </fieldset>
        <label className="die-preview-quality">
          <span>Dice appearance</span>
          <select value={quality} disabled={rolling} onChange={(event) => setQuality(event.target.value as DiceQuality)}>
            <option value="auto">Automatic</option>
            <option value="full">Original 3D</option>
            <option value="compatible">Lighter 3D</option>
          </select>
        </label>
        <label className="die-preview-light">
          <span>Frame rate limit <small>{fpsLimit} FPS</small></span>
          <input type="range" min="10" max="60" step="1" value={fpsLimit} onChange={(event) => setFpsLimit(Number(event.target.value))} aria-label="Frame rate limit" aria-valuetext={`${fpsLimit} frames per second`} aria-describedby="fps-help" />
          <span className="die-preview-light-ends"><small>10 FPS</small><small>60 FPS</small></span>
        </label>
        <p className="die-preview-help" id="fps-help">Try 60, 30, and 15 FPS to compare smoothness. This caps rendering; your device may run slower. Roll timing stays the same.</p>
        <label className="die-preview-light">
          <span>Move the light <small>{lightAngle}°</small></span>
          <input type="range" min="-80" max="80" value={lightAngle} onChange={(event) => setLightAngle(Number(event.target.value))} aria-label="Light angle" />
          <span className="die-preview-light-ends"><small>Left</small><small>Right</small></span>
        </label>
        <DiceMotionToggle {...diceMotion} />
        <div className="die-preview-faces" aria-label="Preview each landing face">
          <span>Try a face</span>
          {[1, 2, 3, 4, 5, 6].map((face) => (
            <button key={face} disabled={rolling} aria-label={`Roll and land on ${face}`} aria-pressed={!rolling && value === face} onClick={() => roll(face)}>{face}</button>
          ))}
        </div>
      </section>
    </main>
  );
}
