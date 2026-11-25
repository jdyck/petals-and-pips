"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { totalScore, type Participant } from "../lib/game";

export function SubmitScore({ players }: { players: Participant[] }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { isAuthenticated } = useConvexAuth();
  const submit = useMutation(api.play.submitLocal);
  const [name, setName] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    fetch("/api/screen-name").then(r => { if (!r.ok) throw new Error("Could not load your profile."); return r.json(); }).then(data => { if (!cancelled) setName(data.screenName || ""); }).catch(() => { if (!cancelled) setError("Could not load your profile."); });
    return () => { cancelled = true; };
  }, [isSignedIn]);
  async function save() {
    if (busy || !isAuthenticated || name === null) return;
    setBusy(true); setError("");
    try {
      if (!name.trim()) throw new Error("Enter a screen name.");
      const response = await fetch("/api/screen-name", { method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({screenName: name}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save your screen name.");
      await submit({ name: data.screenName, score: totalScore(players[selected].scores, players[selected].bonus) });
      setDone(true);
      setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add your score."); }
    finally { setBusy(false); }
  }
  if (!open) return done ? null : <button className="header-button" type="button" onClick={() => setOpen(true)}>Add your score</button>;
  return <div className="modal-backdrop" role="presentation" onKeyDown={event => { if (event.key === "Escape" && !busy && !event.defaultPrevented) { event.stopPropagation(); setOpen(false); } }}><section className="rules-modal submit-score-modal" role="dialog" aria-modal="true" aria-labelledby="submit-score-title">
    <button className="modal-close" type="button" disabled={busy} onClick={() => setOpen(false)} aria-label="Close">×</button>
    <h2 id="submit-score-title">Add your score</h2>
    <p>Add your score from this game to the leaderboard.</p>
    {!isLoaded ? <p>Loading…</p> : !isSignedIn ? <SignInButton mode="modal"><button className="rules-done" type="button">Sign in to add your score</button></SignInButton> : <>
      {players.length > 1 && <label>Your score <select value={selected} onChange={e => setSelected(Number(e.target.value))}>{players.map((player, index) => <option key={index} value={index}>{player.name} — {totalScore(player.scores, player.bonus)} points</option>)}</select></label>}
      {players.length === 1 && <p>{totalScore(players[0].scores, players[0].bonus)} points</p>}
      {name === null ? <p>Loading your profile…</p> : <label>Screen name <input value={name} maxLength={24} onChange={e => setName(e.target.value)} /></label>}
      <button className="rules-done" type="button" disabled={busy || !isAuthenticated || name === null} onClick={() => void save()}>Add my score</button>
    </>}
    {error && <p role="alert">{error}</p>}
  </section></div>;
}
