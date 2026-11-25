"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef, useState } from "react";
import { createGame } from "../lib/game";
import type { GameState } from "../lib/game";
import { DEFAULT_GAME_THEME, gameThemeStyle, randomGameTheme } from "../lib/game-themes";
import Game from "./game";
import GameLoading from "./game-loading";
import { ROLL_DURATION } from "./rolling-die";

type OnlineGame = { state: GameState; seat: number; count: number; code: string; forfeitedBy: number | null; opponentLastSeen: number; serverTime: number };
type Props = {
  game: OnlineGame | null | undefined;
  code: string;
  name: string;
  act: (action: "roll" | "hold" | "score", index?: number) => void;
  leave: () => void;
  back: () => void;
  error: string;
  busy: boolean;
};

export default function OnlineGameView({ game, code, name, act, leave, back, error, busy }: Props) {
  const [theme, setTheme] = useState(DEFAULT_GAME_THEME);
  const [soloState, setSoloState] = useState<GameState | null>(null);
  const selfForfeited = game?.forfeitedBy != null && game.forfeitedBy === game.seat;
  const [animatingRoll, setAnimatingRoll] = useState(false);
  const lastRoll = useRef<{ code: string; id: number } | null>(null);
  useEffect(() => {
    if (!game) return;
    const previous = lastRoll.current;
    lastRoll.current = { code: game.code, id: game.state.rollId };
    if (!previous || previous.code !== game.code || previous.id === game.state.rollId) return;
    setAnimatingRoll(true);
    const timer = window.setTimeout(() => setAnimatingRoll(false), ROLL_DURATION);
    return () => window.clearTimeout(timer);
  }, [game?.code, game?.state.rollId]);
  useEffect(() => { setTheme(randomGameTheme()); }, []);
  const heartbeat = useMutation(api.play.heartbeat);
  useEffect(() => {
    if (soloState || !game || game.forfeitedBy !== null || game.state.phase === "finished") return;
    const send = () => { void heartbeat({ code: game.code }).catch(() => {}); };
    send();
    const timer = window.setInterval(send, 15000);
    return () => window.clearInterval(timer);
  }, [game?.code, game?.forfeitedBy, game?.state.phase, heartbeat, soloState]);
  const disconnected = !!game && game.forfeitedBy === null && game.state.phase !== "finished" && game.serverTime - game.opponentLastSeen > 60000;
  const [dismissedConnection, setDismissedConnection] = useState(false);
  useEffect(() => { if (!disconnected) setDismissedConnection(false); }, [disconnected]);
  const connectionDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = connectionDialog.current;
    if (disconnected && !dismissedConnection && dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [disconnected, dismissedConnection]);
  const forfeitDialog = useRef<HTMLDialogElement>(null);
  const opponentForfeited = game?.forfeitedBy != null && game.forfeitedBy !== game.seat;
  useEffect(() => {
    const dialog = forfeitDialog.current;
    if (opponentForfeited && dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [opponentForfeited]);
  function continueSolo() {
    if (!game) return;
    const player = game.state.players[game.seat];
    const ownTurn = game.state.currentPlayer === game.seat && game.state.phase === "playing";
    const finished = player.scores.every(score => score !== null);
    const solo: GameState = { ...createGame("solo"), players: [player], phase: finished ? "finished" : ownTurn ? "playing" : "ready", ...(ownTurn && !finished ? { dice: game.state.dice, held: game.state.held, rollsLeft: game.state.rollsLeft, rollId: game.state.rollId, jokerChoice: game.state.jokerChoice } : {}) };
    sessionStorage.removeItem("pips-online-game");
    setSoloState(solo);
  }
  if (soloState) return <Game initialState={soloState} initialTheme={theme} />;
  if (game) return <><Game initialTheme={theme} online={{ state: game.state, seat: game.seat, count: game.count, forfeited: game.forfeitedBy !== null, busy, rolling: animatingRoll, act, leave: game.state.phase === "finished" || selfForfeited ? back : leave, opponent: game.state.players.find((_, index) => index !== game.seat)?.name ?? name }} />
    {error && <p className="online-error" role="alert">{error}</p>}
    {disconnected && !dismissedConnection && <dialog ref={connectionDialog} className="rules-modal scorecard-modal" aria-labelledby="connection-title" onCancel={event => { event.preventDefault(); setDismissedConnection(true); }}><h2 id="connection-title">Connection issue</h2><p>The other player hasn’t responded. They may have lost their connection or left the game.</p><button className="rules-done" type="button" onClick={() => setDismissedConnection(true)}>Keep waiting</button></dialog>}
    {opponentForfeited && <dialog ref={forfeitDialog} className="rules-modal scorecard-modal" aria-labelledby="forfeit-title" onCancel={event => { event.preventDefault(); back(); }}><h2 id="forfeit-title">Your opponent forfeited</h2><p>{game.state.players[game.forfeitedBy!]?.name ?? "The other player"} left the game.</p><button className="rules-done" type="button" onClick={continueSolo}>Continue solo</button><button className="header-button forfeit-back" type="button" onClick={back} disabled={busy}>Back to game</button></dialog>}
  </>;
  return <div className="game-viewport" style={gameThemeStyle(theme)}><main className="page-shell">{error && <p role="alert">{error}</p>}{game === undefined && code ? <GameLoading /> : <section className="online-lobby"><h2>{code ? "Game unavailable" : "Ready to play?"}</h2><button className="header-button" type="button" onClick={back}>Back to game</button></section>}</main></div>;
}
