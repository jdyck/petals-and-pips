"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ROLL_DURATION, RollingDie } from "../components/rolling-die";

export default function DicePrototype() {
  const [value, setValue] = useState(5);
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
        <Link href="/" className="die-preview-back">← Back to Lucky Five</Link>
        <span className="eyebrow">MOTION PROTOTYPE · 01</span>
      </header>
      <section className="die-preview-card">
        <div className="eyebrow"><span className="eyebrow-line" /> A LITTLE LUCK IN MOTION</div>
        <h1>Give it a <em>roll.</em></h1>
        <p>A tumble, a bounce, a little suspense.</p>
        <div className="die-preview-table">
          <span className="die-preview-table-label">THE DICE TABLE</span>
          <div className="die-preview-die">
            <RollingDie value={value} rolling={rolling} rollId={rollId} />
          </div>
          <div className="die-preview-result" aria-live="polite" aria-atomic="true">
            {rolling ? "ROLLING…" : <>LANDED ON <strong>{value}</strong></>}
          </div>
        </div>
        <button className="roll-button die-preview-roll" disabled={rolling} onClick={() => roll()}>
          <span className="roll-icon" aria-hidden="true">↻</span>
          {rolling ? "LET IT ROLL…" : "ROLL THE DIE"}
          <span className="button-arrow" aria-hidden="true">→</span>
        </button>
        <div className="die-preview-faces" aria-label="Preview each landing face">
          <span>TRY A FACE</span>
          {[1, 2, 3, 4, 5, 6].map((face) => (
            <button key={face} disabled={rolling} aria-label={`Roll and land on ${face}`} aria-pressed={!rolling && value === face} onClick={() => roll(face)}>{face}</button>
          ))}
        </div>
      </section>
    </main>
  );
}
