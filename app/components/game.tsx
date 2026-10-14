"use client";

import { useEffect, useReducer, useState } from "react";
import HomeScreenInstall from "./home-screen-install";
import { ROLL_DURATION, RollingDie } from "./rolling-die";
import { CATEGORIES, aiHoldPlan, aiTarget, categoryAward, chooseAiCategory, createGame, gameReducer, matchResult, playableCategoryIndices, rollDie, rollFive, totalScore, upperSubtotal } from "../lib/game";
import type { Category, GameMode } from "../lib/game";

function Dice({ values, held, onToggle, disabled, rolling = false, rollId = 0, label = "Your dice" }: {
  values: number[];
  held?: boolean[];
  onToggle?: (index: number) => void;
  disabled?: boolean;
  rolling?: boolean;
  rollId?: number;
  label?: string;
}) {
  return (
    <div className="dice-tray" aria-label={label}>
      {values.map((value, index) => {
        const isHeld = held?.[index] ?? false;
        const isRolling = rolling && !isHeld;
        const dieContents = <RollingDie value={value} rolling={isRolling} rollId={isHeld ? 0 : rollId} index={index} />;
        return onToggle ? (
          <button
            className={`die-button${isHeld ? " is-held" : ""}`}
            type="button"
            key={index}
            onClick={() => onToggle(index)}
            disabled={disabled}
            aria-pressed={isHeld}
            aria-label={`Die ${index + 1}: ${isRolling ? "rolling" : value}${isHeld ? ", held" : ", tap to hold"}`}
          >
            {dieContents}
            <span className="hold-caption">{isHeld ? "Held" : ""}</span>
          </button>
        ) : (
          <span className="opponent-die" key={index} aria-label={`Die ${index + 1}: ${isRolling ? "rolling" : value}`}>
            {dieContents}
            <span className="hold-caption" aria-hidden="true" />
          </span>
        );
      })}
    </div>
  );
}

export default function Game({ initialMode = "computer" }: { initialMode?: GameMode }) {
  const [state, dispatch] = useReducer(gameReducer, initialMode, createGame);
  const [helpOpen, setHelpOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [nextMode, setNextMode] = useState<GameMode>(initialMode);
  const { players, currentPlayer, phase, dice, held, rollsLeft, rolling, rollId, status } = state;
  const player = players[currentPlayer];
  const isBusy = phase === "computer";
  const humanTurn = phase === "ready" || phase === "playing";
  const canRoll = humanTurn && !rolling && rollsLeft > 0 && !(dice.length > 0 && held.every(Boolean));
  const canScore = phase === "playing" && dice.length === 5 && !rolling;
  const round = Math.min(13, Math.min(...players.map((item) => item.scores.filter((score) => score !== null).length)) + 1);
  const legalScores = playableCategoryIndices(player.scores, dice);
  const pendingFiveKindBonus = canScore ? categoryAward("chance", dice, player.scores).bonusPoints : 0;

  useEffect(() => {
    if (!rolling || isBusy) return;
    const timer = window.setTimeout(() => dispatch({ type: "settle" }), ROLL_DURATION);
    return () => window.clearTimeout(timer);
  }, [rolling, isBusy, rollId]);

  useEffect(() => {
    if (phase !== "computer") return;
    let cancelled = false;
    const pause = (duration: number) => new Promise<void>((resolve) => window.setTimeout(resolve, duration));
    async function play() {
      const card = players[currentPlayer].scores;
      let hand = rollFive();
      let holds = Array(5).fill(false);
      for (let roll = 0; roll < 3; roll += 1) {
        dispatch({ type: "computerRoll", dice: hand, held: holds });
        await pause(ROLL_DURATION);
        if (cancelled) return;
        dispatch({ type: "settle" });
        await pause(300);
        if (cancelled) return;
        if (roll === 2) break;
        holds = aiHoldPlan(hand, aiTarget(hand, card));
        if (holds.every(Boolean)) break;
        hand = hand.map((die, index) => holds[index] ? die : rollDie());
      }
      if (!cancelled) dispatch({ type: "score", index: chooseAiCategory(hand, card) });
    }
    void play();
    return () => { cancelled = true; };
  }, [phase, currentPlayer, players]);

  function roll() {
    if (!canRoll) return;
    dispatch({ type: "roll", dice: dice.length ? dice.map((die, index) => held[index] ? die : rollDie()) : rollFive() });
  }

  function startGame(mode: GameMode) {
    dispatch({ type: "reset", mode });
    setSetupOpen(false);
  }

  function scoreRows(group: Category["group"]) {
    return CATEGORIES.filter((category) => category.group === group).map((category) => {
      const index = CATEGORIES.findIndex((item) => item.id === category.id);
      const available = player.scores[index] === null;
      return <tr key={category.id} className={`score-row${canScore && available ? " score-row-ready" : ""}`}>
        <th scope="row" title={category.hint}><span>{category.label}{category.points !== undefined && <small className="category-worth">(+{category.points})</small>}</span></th>
        {players.map((item, playerIndex) => {
          const score = item.scores[index];
          const active = playerIndex === currentPlayer;
          const award = categoryAward(category.id, dice, item.scores);
          return <td key={item.name} className={active ? "player-score-cell" : "other-score-cell"}>
            {active && available && phase === "playing" && dice.length === 5 ? legalScores.includes(index) ? (
              <button type="button" className="score-pick" disabled={rolling} onClick={() => dispatch({ type: "score", index })} title={award.bonusPoints ? `Also earns a +${award.bonusPoints} five of a kind bonus` : undefined} aria-label={`${item.name}: score ${award.score} points in ${category.label}${award.bonusPoints ? ` and a ${award.bonusPoints}-point five of a kind bonus` : ""}`}>
                {award.score}
              </button>
            ) : <span className="joker-locked">LOCKED</span> : <span className={score === null ? "empty-score" : "filled-score"}>{score ?? "—"}</span>}
          </td>;
        })}
      </tr>;
    });
  }

  return <main className="page-shell">
    <header className="topbar">
      <h1 className="brand-name">Petals & Pips</h1>
      <div className="topbar-right">
        <HomeScreenInstall />
        <button className="header-button" type="button" onClick={() => setHelpOpen(true)}>How to play</button>
        <button className="header-button" type="button" onClick={() => { setNextMode(state.mode); setSetupOpen(true); }}>New game</button>
      </div>
    </header>

    <section className={`game-layout${players.length > 2 ? " game-layout-multi" : ""}`} aria-label="Petals & Pips game">
      <div className="scoreboard-card">
        <div className="score-table-wrap" tabIndex={0} role="region" aria-label="Player scores">
          <table className={`score-table${players.length > 2 ? " score-table-multi" : ""}`}>
            <colgroup>
              <col style={{ width: players.length > 2 ? "42%" : "58%" }} />
              {players.map((item) => <col key={item.name} style={{ width: `${(players.length > 2 ? 58 : 42) / players.length}%` }} />)}
            </colgroup>
            <thead><tr>
              <th scope="col" className="scorecard-title">Scorecard</th>
              {players.map((item, index) => <th scope="col" key={item.name} className={phase !== "finished" && index === currentPlayer ? "column-active" : ""} title={item.computer ? "Computer opponent" : item.name}>
                {item.name}
              </th>)}
            </tr></thead>
            <tbody>
              {scoreRows("upper")}
              <tr className="subtotal-row"><th scope="row" title="Reach 63 for a 35-point bonus">Upper / 63</th>{players.map((item) => <td key={item.name}>{upperSubtotal(item.scores)}{upperSubtotal(item.scores) >= 63 && <span className="bonus-tag">+35</span>}</td>)}</tr>
              {scoreRows("lower")}
              <tr className="subtotal-row five-kind-bonus-row"><th scope="row" title="After scoring 50 in Five of a kind, each additional five of a kind earns +100 when you choose an open category.">Five of a kind bonus <small>(+100 each)</small></th>{players.map((item, index) => <td key={item.name}>
                {item.bonus ? `+${item.bonus}` : "—"}
                {index === currentPlayer && pendingFiveKindBonus > 0 && <span className="pending-bonus" title="Added when you choose an open category">+{pendingFiveKindBonus} ready</span>}
              </td>)}</tr>
              <tr className="total-row"><th scope="row" title="Including bonuses">Total</th>{players.map((item) => <td key={item.name}>{totalScore(item.scores, item.bonus)}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="play-column">
        <div className="play-card">
          <div className="play-card-top">
            <h2 className="turn-pill">{phase === "finished" ? "Match complete" : phase === "handoff" ? `Pass to ${player.name}` : `${player.name}’s turn`}</h2>
            <span className="round-mini">Round {round} / 13</span>
          </div>
          <div className="dice-stage">
            {phase === "finished" ? <p className="turn-message match-result" aria-live="polite">{matchResult(players)}</p>
              : phase === "handoff" ? <p className="turn-message">Pass the device to {player.name}.</p>
                : <>
                  <div className="dice-stage-header"><span>{player.name}’s dice</span><span className="roll-count">{rollsLeft} rolls left</span></div>
                  <div className="dice-display">
                    {dice.length ? <Dice values={dice} held={held} onToggle={isBusy ? undefined : (index) => dispatch({ type: "hold", index })} disabled={rolling || !humanTurn || rollsLeft === 0} rolling={rolling} rollId={rollId} label={`${player.name}’s dice`} /> : <div className="dice-placeholder" aria-hidden="true"><span>?</span><span>?</span><span>?</span><span>?</span><span>?</span></div>}
                  </div>
                  <div className="dice-total" style={{ visibility: dice.length ? "visible" : "hidden" }}>Total: {dice.reduce((sum, die) => sum + die, 0)}</div>
                </>}
          </div>
          <div className="play-actions">
            {phase === "handoff" ? <button className="roll-button" type="button" onClick={() => dispatch({ type: "ready" })}>{player.name} is ready</button>
              : phase === "finished" ? <button className="roll-button" type="button" onClick={() => startGame(state.mode)}>Play again</button>
                : <button className="roll-button" type="button" onClick={roll} disabled={!canRoll}>{isBusy ? "Computer’s turn" : rolling ? "Rolling…" : dice.length ? "Roll again" : "Roll the dice"}</button>}
          </div>
          {state.mode !== "computer" && <div className="live-status" aria-live="polite">{phase === "finished" ? "" : status}</div>}
        </div>
      </div>
    </section>

    {setupOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSetupOpen(false); }}>
      <section className="rules-modal setup-modal" role="dialog" aria-modal="true" aria-labelledby="setup-title">
        <button className="modal-close" type="button" onClick={() => setSetupOpen(false)} aria-label="Close game setup">×</button>
        <h2 id="setup-title">New game</h2>
        <label className="game-mode-label" htmlFor="game-mode">Players</label>
        <select id="game-mode" className="game-mode-select" value={nextMode} onChange={(event) => setNextMode(event.target.value as GameMode)}>
          <option value="computer">Player 1 vs computer</option>
          <option value="local2">2 players · pass the device</option>
          <option value="local3">3 players · pass the device</option>
          <option value="local4">4 players · pass the device</option>
        </select>
        {players.some((item) => item.scores.some((score) => score !== null)) && <p>Starting a new game resets the current scores.</p>}
        <button className="rules-done" type="button" onClick={() => startGame(nextMode)}>Start game</button>
      </section>
    </div>}

    {helpOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}>
      <section className="rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title">
        <button className="modal-close" type="button" onClick={() => setHelpOpen(false)} aria-label="Close rules">×</button>
        <h2 id="rules-title">How to play.</h2>
        <p>{state.mode === "computer" ? "Player 2 is the computer opponent." : "Take turns in player order. After scoring, pass the device to the next player and tap Ready."} On your turn, roll all five dice, then choose which dice to keep before rolling again. You can roll up to three times.</p>
        <div className="rules-steps">
          <div><b>01</b><span><strong>Roll</strong> Start with all five dice.</span></div>
          <div><b>02</b><span><strong>Hold</strong> Tap dice to keep them. Roll the rest up to twice more.</span></div>
          <div><b>03</b><span><strong>Score</strong> Choose one open category. Every category is used once.</span></div>
        </div>
        <p className="rules-note">Reach 63 in the upper section for a 35-point bonus. Your first five of a kind scores 50. Every additional five of a kind earns +100, with no limit on repeats, if you previously scored 50 in that category. Choose an open category to collect the bonus and finish your turn: use the matching upper box if it is open; otherwise use an open lower box with joker values, or any open upper box if the lower section is full. Scoring zero in Five of a kind means you cannot earn these bonuses. Highest total after thirteen rounds wins.</p>
        <button className="rules-done" type="button" onClick={() => setHelpOpen(false)}>Got it</button>
      </section>
    </div>}
  </main>;
}
