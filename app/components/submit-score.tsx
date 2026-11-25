"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { totalScore, type Participant } from "../lib/game";
import { beatsLeaderboard, qualifyingHighScores } from "../lib/high-score-celebration";

export function SubmitScore({ players, finished, deviceScore, ready }: { players: Participant[]; finished: boolean; deviceScore: number | null; ready: boolean }) {
  const { isLoaded, isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const { isAuthenticated } = useConvexAuth();
  const accountScore = useQuery(api.play.myScore, isAuthenticated ? {} : "skip");
  const leaders = useQuery(api.play.leaders, isAuthenticated ? {} : "skip");
  const submit = useMutation(api.play.submitLocal);
  const previousDeviceScore = useRef<number | null>(null);
  const decided = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [eligible, setEligible] = useState<Participant[]>([]);
  const [globalRecord, setGlobalRecord] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!finished) {
      previousDeviceScore.current = deviceScore;
      decided.current = false;
      setOpen(false); setDone(false); setEligible([]); setSelected(0);
      return;
    }
    if (decided.current || !ready || !isLoaded || (isSignedIn && (!isAuthenticated || accountScore === undefined || leaders === undefined))) return;
    const previous = isSignedIn ? accountScore : previousDeviceScore.current;
    const qualifying = qualifyingHighScores(players, previous ?? null);
    decided.current = true;
    if (!qualifying.length) return;
    const best = Math.max(...qualifying.map(player => totalScore(player.scores, player.bonus)));
    setEligible(qualifying);
    setSelected(qualifying.findIndex(player => totalScore(player.scores, player.bonus) === best));
    setGlobalRecord(!!isSignedIn && leaders !== undefined && beatsLeaderboard(best, leaders[0]?.score ?? null));
    setOpen(true);
  }, [finished, deviceScore, ready, isLoaded, isSignedIn, isAuthenticated, accountScore, leaders, players]);
  useEffect(() => {
    if (!isSignedIn) { setName(null); return; }
    let cancelled = false;
    fetch("/api/screen-name").then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { if (!cancelled) setName(data.screenName || ""); }).catch(() => { if (!cancelled) setError("Could not load your profile."); });
    return () => { cancelled = true; };
  }, [isSignedIn]);
  useEffect(() => {
    const modal = dialog.current;
    if (open && modal && !modal.open) modal.showModal();
    return () => { if (modal?.open) modal.close(); };
  }, [open]);
  async function save() {
    if (busy || !isAuthenticated || name === null || !eligible[selected]) return;
    const score = totalScore(eligible[selected].scores, eligible[selected].bonus);
    if (accountScore === undefined || (accountScore !== null && score <= accountScore)) { setError("This score no longer beats your account high score."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/screen-name", { method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({screenName: name}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save your screen name.");
      window.dispatchEvent(new CustomEvent("pips-screen-name-changed", { detail: data.screenName }));
      await submit({ name: data.screenName, score });
      setDone(true); setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add your score."); }
    finally { setBusy(false); }
  }
  if (!finished || !eligible.length) return null;
  if (!open) return done ? null : <button className="header-button" type="button" onClick={() => setOpen(true)}>Add your score</button>;
  const score = totalScore(eligible[selected].scores, eligible[selected].bonus);
  const selectedIsGlobal = globalRecord && (!leaders?.length || score > leaders[0].score);
  return <dialog ref={dialog} className="five-kind-celebration high-score-celebration" aria-labelledby="personal-high-score-title" onCancel={event => { event.preventDefault(); if (!busy) setOpen(false); }}>
    <button className="modal-close" type="button" disabled={busy} onClick={() => setOpen(false)} aria-label="Close">×</button>
    <p className="celebration-player">{eligible.length > 1 ? eligible[selected].name : "A lovely game, well played"}</p>
    <h2 id="personal-high-score-title">{selectedIsGlobal ? "New High Score!" : "New Personal High Score!"}</h2>
    <div className="celebration-points">{score}</div><p>points</p>
    {eligible.length > 1 && <label>Your score <select value={selected} onChange={e => setSelected(Number(e.target.value))}>{eligible.map((player, index) => <option key={index} value={index}>{player.name} — {totalScore(player.scores, player.bonus)} points</option>)}</select></label>}
    {!isLoaded ? <p>Loading…</p> : !isSignedIn ? <button className="rules-done" type="button" onClick={() => { dialog.current?.close(); setOpen(false); openSignIn(); }}>Sign in to add your score</button> : <>
      {name === null ? <p>Loading your profile…</p> : <label>Screen name <input value={name} maxLength={24} onChange={e => setName(e.target.value)} /></label>}
      <button className="rules-done" type="button" disabled={busy || !isAuthenticated || name === null} onClick={() => void save()}>Add to leaderboard</button>
    </>}
    {error && <p role="alert">{error}</p>}
    <button className="header-button" type="button" disabled={busy} onClick={() => setOpen(false)}>Maybe later</button>
  </dialog>;
}
