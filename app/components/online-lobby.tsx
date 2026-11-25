"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef, useState } from "react";

export function OnlineLobby({ onBack }: { onBack: () => void }) {
  const { isLoaded, isSignedIn } = useAuth();
  return <><button className="online-lobby-back" type="button" onClick={onBack}>← Back to game modes</button><h2 id="setup-title">Play together.</h2>{!isLoaded ? <p>Loading your account…</p> : !isSignedIn ? <><p>Sign in with your Appfun Games account to play online.</p><SignInButton mode="modal"><button className="rules-done" type="button">Sign in or create an account</button></SignInButton></> : !process.env.NEXT_PUBLIC_CONVEX_URL ? <p>Online play is not configured.</p> : <SignedInLobby />}</>;
}
function SignedInLobby() {
  const { isAuthenticated } = useConvexAuth();
  const [name, setName] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lease = useRef("");
  const transitioning = useRef(false);
  const heartbeat = useMutation(api.lobby.heartbeat);
  const leave = useMutation(api.lobby.leave);
  const challenge = useMutation(api.lobby.challenge);
  const respond = useMutation(api.lobby.respond);
  const dismiss = useMutation(api.lobby.dismiss);
  const updateScoreName = useMutation(api.play.updateScoreName);
  const lobby = useQuery(api.lobby.list, isAuthenticated && name ? {} : "skip");
  useEffect(() => {
    fetch("/api/screen-name").then(async response => { if (!response.ok) throw new Error("Could not load your Appfun profile."); return response.json(); }).then(data => { setName(data.screenName || ""); setInput(data.screenName || ""); }).catch(() => setError("Could not load your Appfun profile."));
  }, []);
  useEffect(() => {
    if (!isAuthenticated || !name) return;
    const myLease = crypto.randomUUID(); lease.current = myLease;
    const ping = () => { if (!transitioning.current) void heartbeat({name, lease: myLease}).catch(() => setError("Could not connect to the lobby.")); };
    ping(); const timer = window.setInterval(ping, 15000);
    return () => { window.clearInterval(timer); void leave({lease: myLease}).catch(() => {}); };
  }, [isAuthenticated, name, heartbeat, leave]);
  useEffect(() => {
    const accepted = [...(lobby?.incoming || []), ...(lobby?.outgoing || [])].find(item => item.status === "accepted" && item.gameCode && item.gameCode !== sessionStorage.getItem("pips-last-match"));
    if (accepted?.gameCode && !transitioning.current) {
      transitioning.current = true; sessionStorage.setItem("pips-last-match", accepted.gameCode); sessionStorage.setItem("pips-online-game", accepted.gameCode); window.location.assign("/online");
    }
  }, [lobby]);
  async function run(action: () => Promise<unknown>) { if (busy) return; setBusy(true); setError(""); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); } }
  if (name === null) return <>{error ? <p role="alert">{error}</p> : <p>Loading your profile…</p>}</>;
  if (!name) return <><p>Choose a screen name for your Appfun Games account.</p><form className="online-lobby-form" onSubmit={event => { event.preventDefault(); void run(async () => { const response = await fetch("/api/screen-name", {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({screenName: input})}); const data = await response.json(); if (!response.ok) throw new Error(data.error); window.dispatchEvent(new CustomEvent("pips-screen-name-changed", { detail: data.screenName })); if (isAuthenticated) await updateScoreName({name: data.screenName}); setName(data.screenName); }); }}><label htmlFor="lobby-name">Screen name</label><input id="lobby-name" maxLength={24} value={input} onChange={event => setInput(event.target.value)} /><button className="rules-done" type="submit" disabled={busy}>Save screen name</button></form>{error && <p role="alert">{error}</p>}</>;
  if (!isAuthenticated) return <p>Connecting to online games…</p>;
  return <><p>Playing as <strong>{name}</strong></p>{error && <p role="alert">{error}</p>}
    <div className="online-lobby-players"><h3>Players in the lobby</h3>{!lobby ? <p>Finding players…</p> : lobby.players.length === 0 ? <p>No other players here yet. Stay in the lobby while a friend joins.</p> : lobby.players.map(player => <div className="online-lobby-player" key={player.userId}><span>{player.name}</span><button className="header-button" type="button" disabled={busy || lobby.outgoing.some(c => c.status === "pending")} onClick={() => void run(() => challenge({to: player.userId}))}>Challenge</button></div>)}</div>
    {lobby?.incoming.filter(c => c.status === "pending").map(c => <div className="online-challenge" key={c._id}><p><strong>{c.fromName}</strong> wants to play with you.</p><div><button className="rules-done" disabled={busy} onClick={() => void run(() => respond({id:c._id, accept:true}))}>Accept</button><button className="header-button" disabled={busy} onClick={() => void run(() => respond({id:c._id, accept:false}))}>Decline</button></div></div>)}
    {lobby?.outgoing.filter(c => c.status === "pending" || c.status === "declined").map(c => <div className="online-challenge" key={c._id}><p>{c.status === "pending" ? `Waiting for ${c.toName} to respond…` : `${c.toName} declined the challenge.`}</p><button className="header-button" disabled={busy} onClick={() => void run(() => dismiss({id:c._id}))}>{c.status === "pending" ? "Cancel challenge" : "Dismiss"}</button></div>)}
  </>;
}
