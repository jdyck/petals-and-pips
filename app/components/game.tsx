"use client";

import Image from "next/image";
import { CaretRight, PlusCircle } from "@phosphor-icons/react";
import { useEffect, useReducer, useRef, useState } from "react";
import HomeScreenInstall from "./home-screen-install";
import { DiceMotionToggle, useDiceMotion } from "./dice-motion";
import { ROLL_DURATION, RollingDie } from "./rolling-die";
import { DEFAULT_DICE_SHADING } from "../lib/dice-shading";

import { CATEGORIES, aiHoldPlan, aiTarget, chooseAiCategory, createGame, gameReducer, matchResult, rankScoreOptions, rollDie, rollFive, selectScoreSuggestions, totalScore, upperSubtotal } from "../lib/game";
import type { Category, FiveKindCelebration, GameMode } from "../lib/game";

const GAME_DICE_SHADING = { ...DEFAULT_DICE_SHADING, topWhite: 0.99, shadowDarkness: 0.14, shadowTint: "#d8d2c3" };

function Dice({ values, held, onToggle, disabled, unrolled = false, rolling = false, rollId = 0, label = "Your dice", animateWithReducedMotion = false }: {
  values: number[];
  held?: boolean[];
  onToggle?: (index: number) => void;
  disabled?: boolean;
  unrolled?: boolean;
  rolling?: boolean;
  rollId?: number;
  label?: string;
  animateWithReducedMotion?: boolean;
}) {
  return (
    <div className="dice-tray" aria-label={label}>
      {values.map((value, index) => {
        const isHeld = held?.[index] ?? false;
        const isRolling = rolling && !isHeld;
        const dieContents = <RollingDie value={value} unrolled={unrolled} rolling={isRolling} rollId={isHeld ? 0 : rollId} index={index} turnDegrees={0} tiltDegrees={4} fpsLimit={16} shading={GAME_DICE_SHADING} animateWithReducedMotion={animateWithReducedMotion} />;
        return onToggle ? (
          <button
            className={`die-button${isHeld ? " is-held" : ""}`}
            type="button"
            key={index}
            onClick={() => onToggle(index)}
            disabled={disabled}
            aria-pressed={isHeld}
            aria-label={`Die ${index + 1}: ${unrolled ? "not rolled" : isRolling ? "rolling" : value}${isHeld ? ", held" : ", tap to hold"}`}
          >
            {dieContents}
            <span className="hold-caption">{isHeld ? "Held" : ""}</span>
          </button>
        ) : (
          <span className="opponent-die" key={index} aria-label={`Die ${index + 1}: ${unrolled ? "not rolled" : isRolling ? "rolling" : value}`}>
            {dieContents}
            <span className="hold-caption" aria-hidden="true" />
          </span>
        );
      })}
    </div>
  );
}

function Celebration({ award, onContinue }: { award: FiveKindCelebration; onContinue: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    return () => modal?.close();
  }, []);

  return <dialog ref={dialog} className="five-kind-celebration" aria-labelledby="celebration-title" aria-describedby={award.categoryLabel === null || award.bonusPoints ? "celebration-detail" : undefined} onCancel={(event) => { event.preventDefault(); onContinue(); }}>
    <p className="celebration-player">{award.playerName}</p>
    <h2 id="celebration-title">{award.bonusPoints ? "Five of a kind bonus!" : "Five of a kind!"}</h2>
    <div className="celebration-points">+{award.bonusPoints || award.score}</div>
    <Dice values={award.dice} label={`${award.playerName} rolled five ${award.dice[0]}s`} />
    {(award.categoryLabel === null || award.bonusPoints > 0) && <p id="celebration-detail">{award.categoryLabel === null ? "100 bonus points added! Your matching upper box is already filled. Choose an open category in the lower section for your joker score." : `100 bonus points added, plus ${award.score} points automatically scored in ${award.categoryLabel}.`}</p>}
    <button className="rules-done" type="button" autoFocus onClick={onContinue}>{award.categoryLabel === null ? "Choose a category" : "Continue"}</button>
  </dialog>;
}

function ScoreChoices({ options, onChoose, onClose }: {
  options: { category: Category; index: number; points: number }[];
  onChoose: (index: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    return () => modal?.close();
  }, []);
  return <dialog ref={dialog} className="rules-modal score-choices-modal" aria-labelledby="score-choices-title" onCancel={onClose}>
    <button className="modal-close" type="button" onClick={onClose} aria-label="Close score choices">×</button>
    <h2 id="score-choices-title">Choose your score</h2>
    <p>One card, one turn. Make it count.</p>
    <div className="score-choices">
      {options.map(({ category, index, points }) => <button type="button" key={category.id} title={category.hint} onClick={() => onChoose(index)}><span>{category.label}</span><strong>{points} pts</strong><CaretRight size={20} weight="thin" aria-hidden="true" /></button>)}
    </div>
  </dialog>;
}

export default function Game({ initialMode = "solo" }: { initialMode?: GameMode }) {
  const diceMotion = useDiceMotion();
  const [state, dispatch] = useReducer(gameReducer, initialMode, createGame);
  const [helpOpen, setHelpOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [allScoresOpen, setAllScoresOpen] = useState(false);
  const [nextMode, setNextMode] = useState<GameMode>(initialMode);
  const { players, currentPlayer, phase, dice, held, rollsLeft, rolling, rollId, status, celebration, jokerChoice } = state;
  const player = players[currentPlayer];
  const isBusy = phase === "computer";
  const humanTurn = phase === "ready" || phase === "playing";
  const canStartRoll = humanTurn && !rolling && rollsLeft > 0 && !celebration;
  const canRoll = canStartRoll && !(dice.length > 0 && held.every(Boolean));
  const canScore = phase === "playing" && dice.length === 5 && !rolling && !celebration;
  const round = Math.min(13, Math.min(...players.map((item) => item.scores.filter((score) => score !== null).length)) + 1);
  const rankedOptions = canScore ? rankScoreOptions(dice, player.scores) : [];
  const scoreOptions = [...rankedOptions].sort((a, b) => a.index - b.index);
  const suggestions = selectScoreSuggestions(rankedOptions);

  function chooseScore(index: number) {
    if (!canScore) return;
    dispatch({ type: "score", index });
    setAllScoresOpen(false);
  }

  useEffect(() => {
    if (!rolling || isBusy) return;
    const timer = window.setTimeout(() => dispatch({ type: "settle" }), ROLL_DURATION);
    return () => window.clearTimeout(timer);
  }, [rolling, isBusy, rollId]);

  useEffect(() => {
    if (phase !== "computer" || celebration) return;
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
  }, [phase, currentPlayer, players, celebration]);

  function roll() {
    if (!canRoll) return;
    dispatch({ type: "roll", dice: dice.length ? dice.map((die, index) => held[index] ? die : rollDie()) : rollFive() });
  }

  function rollFiveKind() {
    if (!canStartRoll) return;
    held.forEach((isHeld, index) => { if (isHeld) dispatch({ type: "hold", index }); });
    dispatch({ type: "roll", dice: Array(5).fill(rollDie()) });
  }

  function startGame(mode: GameMode) {
    dispatch({ type: "reset", mode });
    setSetupOpen(false);
    setAllScoresOpen(false);
  }

  function scoreRows(group: Category["group"]) {
    return CATEGORIES.filter((category) => category.group === group).map((category) => {
      const index = CATEGORIES.findIndex((item) => item.id === category.id);
      return <tr key={category.id} className="score-row">
        <th scope="row" title={category.hint}><span>{category.label}</span></th>
        {players.map((item, playerIndex) => {
          const score = item.scores[index];
          const active = playerIndex === currentPlayer;
          return <td key={item.name} className={active ? "player-score-cell" : "other-score-cell"}>
            <span className={score === null ? "empty-score" : "filled-score"}>{score ?? "—"}</span>
          </td>;
        })}
      </tr>;
    });
  }

  return <div className="game-viewport"><div className="game-wrapper"><main className="page-shell">
    <header className="topbar">
      <button className="header-button new-game-button" type="button" onClick={() => { setNextMode(state.mode); setSetupOpen(true); }}>New game</button>
      <h1 className="brand-name">
        <Image className="brand-logo" src="/pips-and-petals-wordmark.png" alt="Pips & Petals" width={372} height={86} preload unoptimized />
      </h1>
      <div className="topbar-right">
        <HomeScreenInstall />
        <button className="header-button" type="button" onClick={() => setHelpOpen(true)}>How to play</button>
      </div>
    </header>

    <section className={`game-layout${players.length > 2 ? " game-layout-multi" : ""}`} aria-label="Pips & Petals game">
      <div className="play-column">
        <div className="play-card">
          <div className="play-card-top">
            <span className="round-mini">Round {round} of 13</span>
          </div>
          <div className="dice-stage">
            {phase === "finished" ? <p className="turn-message match-result" aria-live="polite">{matchResult(players)}</p>
              : phase === "handoff" ? <p className="turn-message">Pass the device to {player.name}.</p>
                : <div className="dice-display">
                  <Dice values={dice.length ? dice : [1, 1, 1, 1, 1]} unrolled={!dice.length} held={held} onToggle={isBusy ? undefined : (index) => dispatch({ type: "hold", index })} disabled={!dice.length || rolling || !humanTurn || rollsLeft === 0} rolling={rolling} rollId={rollId} label={dice.length ? `${player.name}’s dice` : "Roll the dice to start"} animateWithReducedMotion={diceMotion.animateDice} />
                </div>}
          </div>
          <div className="play-actions">
            {phase === "handoff" ? <button className="roll-button" type="button" onClick={() => dispatch({ type: "ready" })}>{player.name} is ready</button>
              : phase === "finished" ? <button className="roll-button" type="button" onClick={() => startGame(state.mode)}>Play again</button>
                : rollsLeft > 0 ? <button className="roll-button" type="button" onClick={roll} disabled={!canRoll}>{isBusy ? "Computer’s turn" : rolling ? "Rolling…" : jokerChoice ? "Choose a score" : dice.length ? "Roll again" : "Roll the dice"}</button> : null}
            {humanTurn && <span className="roll-count" role="status">{rolling ? "Rolling…" : `${rollsLeft} ${rollsLeft === 1 ? "roll" : "rolls"} left`}</span>}
          </div>
        </div>

        <div className="scoring-heading"><span>{phase === "finished" ? "A lovely game, well played" : phase === "handoff" ? "A fresh turn awaits" : canScore ? "Tap a card to score" : isBusy ? `${player.name}’s turn` : rolling ? "Rolling…" : "Roll to find your next score"}</span></div>
        <div className="score-suggestions" aria-label="Suggested scores">
          {Array.from({ length: 3 }, (_, position) => {
            const suggestion = suggestions[position];
            if (!suggestion) return <div className="suggestion-card" key={`empty-${position}`} aria-hidden="true" />;
            const { category, index, points } = suggestion;
            return <button className="suggestion-card" type="button" key={category.id} onClick={() => chooseScore(index)} aria-label={`Score ${points} points in ${category.label}`}>
              <span className="suggestion-name">{category.label}</span>
              <span className="suggestion-points">{points}<span> pts</span></span>
              <CaretRight className="suggestion-arrow" size={24} weight="thin" aria-hidden="true" />
            </button>;
          })}
        </div>
        <button className="choose-score-button" type="button" disabled={!canScore} onClick={() => setAllScoresOpen(true)}>
          <PlusCircle size={30} weight="thin" aria-hidden="true" /><span>Choose another score</span>
        </button>
        {jokerChoice && <p className="joker-choice-message" role="status">+100 bonus added. Choose an open category in the lower section of the scorecard.</p>}
        <div className="play-utilities">
          <DiceMotionToggle {...diceMotion} />
          {process.env.NODE_ENV === "development" && <details className="dev-controls"><summary>Dev mode</summary><button className="header-button" type="button" disabled={!canStartRoll} onClick={rollFiveKind}>Roll five of a kind</button></details>}
        </div>
        <div className="live-status" aria-live="polite">{phase === "finished" ? "" : status}</div>
      </div>

      <div className="scoreboard-card">
        <h2 className="scorecard-title">Scorecard</h2>
        <div className="score-table-wrap" tabIndex={0} role="region" aria-label="Player scores">
          <table className={`score-table${players.length > 2 ? " score-table-multi" : ""}`}>
            <colgroup>
              <col style={{ width: players.length > 2 ? "29.5%" : "58%" }} />
              {players.map((item) => <col key={item.name} style={{ width: `${(players.length > 2 ? 70.5 : 42) / players.length}%` }} />)}
            </colgroup>
            <thead><tr>
              <th scope="col">Player</th>
              {players.map((item, index) => <th scope="col" key={item.name} className={phase !== "finished" && index === currentPlayer ? "column-active" : ""} title={item.computer ? "Computer opponent" : item.name} aria-label={item.name}>
                {index + 1}
              </th>)}
            </tr></thead>
            <tbody>
              {scoreRows("upper")}
              <tr className="subtotal-row score-summary-row">
                <th scope="row" title="Total of selected scores from Ones through Sixes, before the bonus">Subtotal</th>
                {players.map((item, index) => <td className={index === currentPlayer ? "player-score-cell" : ""} key={item.name}>{upperSubtotal(item.scores)}</td>)}
              </tr>
              <tr className="subtotal-row score-summary-row"><th scope="row" title="Reach 63 from Ones through Sixes for a 35-point bonus">Bonus (63+)</th>{players.map((item, index) => <td className={index === currentPlayer ? "player-score-cell" : ""} key={item.name} title={`${upperSubtotal(item.scores)} / 63 points`}>{upperSubtotal(item.scores) >= 63 ? 35 : item.scores.slice(0, 6).every((score) => score !== null) ? 0 : "–"}</td>)}</tr>
              {scoreRows("lower")}
              {players.some((item) => item.bonus > 0) && <tr className="subtotal-row five-kind-bonus-row"><th scope="row" title="Each additional five of a kind earns +100 points">Five of a kind bonus</th>{players.map((item, index) => <td className={index === currentPlayer ? "player-score-cell" : ""} key={item.name}>{item.bonus ? `+${item.bonus}` : "–"}</td>)}</tr>}
            </tbody>
            <tfoot><tr className="total-row"><th scope="row" title="Including bonuses">Total</th>{players.map((item, index) => <td className={index === currentPlayer ? "player-score-cell" : ""} key={item.name}>{totalScore(item.scores, item.bonus)}</td>)}</tr></tfoot>
          </table>
        </div>
      </div>
    </section>

    {allScoresOpen && <ScoreChoices options={scoreOptions} onChoose={chooseScore} onClose={() => setAllScoresOpen(false)} />}

    {celebration && <Celebration award={celebration} onContinue={() => dispatch({ type: "dismissCelebration" })} />}

    {setupOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSetupOpen(false); }}>
      <section className="rules-modal setup-modal" role="dialog" aria-modal="true" aria-labelledby="setup-title">
        <button className="modal-close" type="button" onClick={() => setSetupOpen(false)} aria-label="Close game setup">×</button>
        <h2 id="setup-title">New game</h2>
        <label className="game-mode-label" htmlFor="game-mode">Players</label>
        <select id="game-mode" className="game-mode-select" value={nextMode} onChange={(event) => setNextMode(event.target.value as GameMode)}>
          <option value="solo">1 player · no opponent</option>
          <option value="local2">2 players · pass the device</option>
          <option value="local3">3 players · pass the device</option>
          <option value="local4">4 players · pass the device</option>
          <option value="computer">1 player vs computer</option>

        </select>
        {players.some((item) => item.scores.some((score) => score !== null)) && <p>Starting a new game resets the current scores.</p>}
        <button className="rules-done" type="button" onClick={() => startGame(nextMode)}>Start game</button>
      </section>
    </div>}

    {helpOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}>
      <section className="rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title">
        <button className="modal-close" type="button" onClick={() => setHelpOpen(false)} aria-label="Close rules">×</button>
        <h2 id="rules-title">How to play.</h2>
        <p>{state.mode === "solo" ? "Play on your own and aim for your highest score. After scoring, roll again to start your next turn." : state.mode === "computer" ? "Player 2 is the computer opponent." : "Take turns in player order. After scoring, pass the device to the next player and tap Ready."} On your turn, roll all five dice, then choose which dice to keep before rolling again. You can roll up to three times.</p>
        <div className="rules-steps">
          <div><b>01</b><span><strong>Roll</strong> Start with all five dice.</span></div>
          <div><b>02</b><span><strong>Hold</strong> Tap dice to keep them. Roll the rest up to twice more.</span></div>
          <div><b>03</b><span><strong>Score</strong> Choose one open category. Every category is used once.</span></div>
        </div>
        <p className="rules-note">Reach 63 in the upper section for a 35-point bonus. Your first five of a kind automatically scores 50 and ends your turn. Every additional five of a kind automatically earns +100, with no limit on repeats, if you previously scored 50 in that category. The game also automatically scores the matching upper box if it is open. If that box is filled, choose an open lower category for your joker score: Full house scores 25, Small straight 30, Large straight 40, and the other lower categories score the dice total. You cannot reroll after collecting the bonus. If the lower section is full, the game automatically fills an open upper box. The computer chooses its own category. Scoring zero in Five of a kind means you cannot earn these bonuses. {state.mode === "solo" ? "Your game ends after thirteen rounds, with all categories filled. Try to beat your score next time." : "Highest total after thirteen rounds wins."}</p>
        <button className="rules-done" type="button" onClick={() => setHelpOpen(false)}>Got it</button>
      </section>
    </div>}
  </main></div></div>;
}
