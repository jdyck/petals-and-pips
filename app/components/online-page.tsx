"use client";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useState } from "react";
import OnlineGameView from "./online-game-view";
import GameLoading from "./game-loading";

export default function OnlinePage({ view, embedded = false }: { view: "leaderboard" | "game"; embedded?: boolean }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return view === "game" ? <GameLoading /> : <main className="online-page">Loading…</main>;
  if (!isSignedIn) return <main className="online-page">{!embedded && <a href="/">← Back to game</a>}<h1>{view === "leaderboard" ? "Leaderboard" : "Two-player online game"}</h1><p>Sign in with your Appfun Games account to {view === "leaderboard" ? "view the leaderboard" : "play online"}.</p><SignInButton mode="modal"><button>Sign in or create an account</button></SignInButton></main>;
  if (!process.env.NEXT_PUBLIC_CONVEX_URL) return <main className="online-page">Online play is not configured. {!embedded && <a href="/">Back to game</a>}</main>;
  return <Online view={view} embedded={embedded} />;
}
function Online({ view, embedded }: { view: "leaderboard" | "game"; embedded: boolean }) {
  const { isAuthenticated } = useConvexAuth();
  const [name, setName] = useState<string | null>(null), [input, setInput] = useState(""), [error, setError] = useState(""), [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [codeReady, setCodeReady] = useState(false);
  const leaders = useQuery(api.play.leaders, isAuthenticated && name && view === "leaderboard" ? {} : "skip");
  const game = useQuery(api.play.getGame, isAuthenticated && name && code && view === "game" ? {code} : "skip");
  const act = useMutation(api.play.act), leaveGame = useMutation(api.play.leaveGame), updateScoreName = useMutation(api.play.updateScoreName);
  useEffect(() => { fetch("/api/screen-name").then(r => r.json()).then(data => {setName(data.screenName || ""); setInput(data.screenName || "");}).catch(() => setError("Could not load your Appfun profile.")); const saved = sessionStorage.getItem("pips-online-game"); if (saved) setCode(saved); setCodeReady(true); }, []);
  async function run(work: () => Promise<unknown>) { if (busy) return; setBusy(true); try { setError(""); await work(); } catch (e) {setError(e instanceof Error ? e.message : "Something went wrong.");} finally { setBusy(false); } }
  async function saveName() { await run(async () => { const response = await fetch("/api/screen-name", {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({screenName: input})}); const data = await response.json(); if (!response.ok) throw new Error(data.error); setName(data.screenName); setInput(data.screenName); if (isAuthenticated) await updateScoreName({name: data.screenName}); setEditingName(false); }); }
  function remember(value: string) { setCode(value); if (value) sessionStorage.setItem("pips-online-game", value); else sessionStorage.removeItem("pips-online-game"); }
  if (view === "game" && !error && (!codeReady || name === null || (name && !isAuthenticated))) return <GameLoading />;
  if (view === "game" && name && isAuthenticated) return <OnlineGameView game={game} code={code} name={name} act={(action, index) => void run(() => act({code, action, ...(index === undefined ? {} : {index})}))} leave={() => void run(async () => { if (code && game) await leaveGame({code}); })} back={() => { remember(""); sessionStorage.setItem("pips-open-lobby", "1"); window.location.assign("/"); }} error={error} busy={busy} />;
  return <main className="online-page">{!embedded && <header><a href="/">← Back to game</a></header>}<h1>{view === "leaderboard" ? "Leaderboard" : "Two-player online game"}</h1>{error && <p role="alert">{error}</p>}{name === null ? <p>Loading your profile…</p> : !name ? <section><h2>Choose your screen name</h2><p>This name belongs to your Appfun Games account and can be used across Appfun games.</p><label>Screen name <input maxLength={24} value={input} onChange={e => setInput(e.target.value)} /></label><button onClick={saveName}>Save screen name</button></section> : <><div className="leaderboard-username"><span>Playing as <strong>{name}</strong></span> <button type="button" onClick={() => { setInput(name); setEditingName(true); }} aria-label="Edit screen name">Edit</button></div>{editingName && <form onSubmit={e => { e.preventDefault(); void saveName(); }}><label>Screen name <input maxLength={24} value={input} onChange={e => setInput(e.target.value)} autoFocus /></label><button type="submit" disabled={busy}>Save</button><button type="button" onClick={() => { setInput(name); setEditingName(false); }} disabled={busy}>Cancel</button></form>}{!isAuthenticated ? <p>Connecting to online games…</p> : <>
    {view === "leaderboard" && <section><h2>Top 10 leaderboard</h2><ol>{leaders?.map(entry => <li key={entry._id}><strong>{entry.name}</strong> — {entry.score} points · {entry.scoredAt ? new Date(entry.scoredAt).toLocaleDateString() : "date unknown"}{entry.source === "device" ? " (device import)" : ""}</li>)}</ol>{leaders?.length === 0 && <p>No scores yet.</p>}</section>}
</>}</>}</main>;
}
