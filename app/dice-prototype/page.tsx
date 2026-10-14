"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ROLL_DURATION, RollingDie } from "../components/rolling-die";

export default function DicePrototype() {
  const [value, setValue] = useState(5);
  const [lightAngle, setLightAngle] = useState(-35);
  const [rolling, setRolling] = useState(false);
  const [rollId, setRollId] = useState(0);
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
            <RollingDie value={value} rolling={rolling} rollId={rollId} lightAngle={lightAngle} />
          </div>
          <div className="die-preview-result" aria-live="polite" aria-atomic="true">
            {rolling ? "Rolling…" : <>Landed on <strong>{value}</strong></>}
          </div>
        </div>
        <label className="die-preview-light">
          <span>Move the light <small>{lightAngle}°</small></span>
          <input type="range" min="-80" max="80" value={lightAngle} onChange={(event) => setLightAngle(Number(event.target.value))} aria-label="Light angle" />
          <span className="die-preview-light-ends"><small>Left</small><small>Right</small></span>
        </label>
        <button className="roll-button die-preview-roll" disabled={rolling} onClick={() => roll()}>
          {rolling ? "Rolling…" : "Roll the die"}
        </button>
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
