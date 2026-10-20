"use client";

import { CaretRight, PlusCircle } from "@phosphor-icons/react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import HomeScreenInstall from "./home-screen-install";
import GameLoading from "./game-loading";
import { DiceMotionToggle, useDiceMotion } from "./dice-motion";
import { ROLL_DURATION, RollingDie } from "./rolling-die";
import { DEFAULT_DICE_SHADING } from "../lib/dice-shading";
import type { DiceShading } from "../lib/dice-shading";
import { dicePipColor } from "../lib/dice";
import { DEFAULT_GAME_THEME, gameThemeStyle, randomGameTheme } from "../lib/game-themes";
import { loadGameBackground } from "../lib/game-loading";

import { CATEGORIES, aiHoldPlan, aiTarget, chooseAiCategory, createGame, gameReducer, matchResult, rankScoreOptions, rollDie, rollFive, selectScoreSuggestions, totalScore, upperSubtotal } from "../lib/game";
import type { Category, FiveKindCelebration, GameMode } from "../lib/game";

const GAME_DICE_SHADING = DEFAULT_DICE_SHADING;
const GAME_MODES: { mode: GameMode; title: string; description: string }[] = [
  { mode: "solo", title: "1 player", description: "No opponent" },
  { mode: "local2", title: "2 players", description: "Pass the device" },
  { mode: "local3", title: "3 players", description: "Pass the device" },
  { mode: "local4", title: "4 players", description: "Pass the device" },
  { mode: "computer", title: "1 player vs computer", description: "Play against the computer" },
];

function Dice({ values, held, onToggle, disabled, unrolled = false, rolling = false, rollId = 0, label = "Your dice", animateWithReducedMotion = false, shading = GAME_DICE_SHADING, onReadyChange }: {
  values: number[];
  held?: boolean[];
  onToggle?: (index: number) => void;
  disabled?: boolean;
  unrolled?: boolean;
  rolling?: boolean;
  rollId?: number;
  label?: string;
  animateWithReducedMotion?: boolean;
  shading?: DiceShading;
  onReadyChange?: (index: number, ready: boolean) => void;
}) {
  return (
    <div className="dice-tray" aria-label={label}>
      {values.map((value, index) => {
        const isHeld = held?.[index] ?? false;
        const isRolling = rolling && !isHeld;
        const dieContents = <RollingDie value={value} unrolled={unrolled} rolling={isRolling} rollId={isHeld ? 0 : rollId} index={index} turnDegrees={0} tiltDegrees={4} fpsLimit={16} shading={shading} animateWithReducedMotion={animateWithReducedMotion} onReadyChange={(ready) => onReadyChange?.(index, ready)} />;
        return (
          <button
            className={`die-button${isHeld ? " is-held" : ""}`}
            type="button"
            key={index}
            onClick={() => onToggle?.(index)}
            disabled={disabled || !onToggle}
            aria-pressed={onToggle ? isHeld : undefined}
            aria-label={`Die ${index + 1}: ${unrolled ? "not rolled" : isRolling ? "rolling" : value}${isHeld ? ", held" : onToggle ? ", tap to hold" : ""}`}
          >
            {dieContents}
            <span className="hold-caption">{isHeld ? "Held" : ""}</span>
          </button>
        );
      })}
    </div>
  );
}

function Celebration({ award, onContinue, shading }: { award: FiveKindCelebration; onContinue: () => void; shading: DiceShading }) {
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
    <Dice values={award.dice} label={`${award.playerName} rolled five ${award.dice[0]}s`} shading={shading} />
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

function ScorecardPopup({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const modal = dialog.current!;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    modal.showModal();
    return () => {
      modal.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function dismiss() {
    dialog.current?.close();
    onClose();
  }

  return <dialog ref={dialog} id="scorecard-popup" className="rules-modal scorecard-modal" aria-label="Scorecard" onCancel={(event) => { event.preventDefault(); dismiss(); }} onClick={(event) => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dismiss();
  }}>
    <button className="modal-close" type="button" autoFocus onClick={dismiss} aria-label="Close scorecard">×</button>
    {children}
  </dialog>;
}

export default function Game({ initialMode = "solo" }: { initialMode?: GameMode }) {
  const diceMotion = useDiceMotion();
  const [state, dispatch] = useReducer(gameReducer, initialMode, createGame);
  // Keep the server and first client render identical, then pick the opening theme.
  const [theme, setTheme] = useState(DEFAULT_GAME_THEME);
  const [themeChosen, setThemeChosen] = useState(false);
  const [loadedBackground, setLoadedBackground] = useState<string | null>(null);
  const [backgroundError, setBackgroundError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [readyDice, setReadyDice] = useState([false, false, false, false, false]);
  useEffect(() => {
    setTheme(randomGameTheme());
    setThemeChosen(true);
  }, []);
  useEffect(() => {
    if (!themeChosen) return;
    let cancelled = false;
    setBackgroundError(false);
    void Promise.all([loadGameBackground(theme.background), document.fonts.ready])
      .then(() => { if (!cancelled) setLoadedBackground(theme.background); })
      .catch(() => { if (!cancelled) setBackgroundError(true); });
    return () => { cancelled = true; };
  }, [theme.background, themeChosen, loadAttempt]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [allScoresOpen, setAllScoresOpen] = useState(false);
  const [compactScorecard, setCompactScorecard] = useState(false);
  const [scorecardOpen, setScorecardOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 699px)");
    function updateLayout() {
      setCompactScorecard(media.matches);
      setScorecardOpen(false);
    }
    updateLayout();
    media.addEventListener("change", updateLayout);
    return () => media.removeEventListener("change", updateLayout);
  }, []);
  const [nextMode, setNextMode] = useState<GameMode>(initialMode);
  const [surfaceColor, setSurfaceColor] = useState<string | null>(null);
  const [shadowDarkness, setShadowDarkness] = useState(Math.round(GAME_DICE_SHADING.shadowDarkness * 100));
  const diceShading = useMemo<DiceShading>(() => process.env.NODE_ENV === "development"
    ? { ...GAME_DICE_SHADING, ...(surfaceColor ? { surfaceColor, topWhite: 1, shadowTint: surfaceColor === GAME_DICE_SHADING.surfaceColor ? GAME_DICE_SHADING.shadowTint : surfaceColor } : {}), shadowDarkness: shadowDarkness / 100 }
    : GAME_DICE_SHADING, [surfaceColor, shadowDarkness]);
  const { players, currentPlayer, phase, dice, held, rollsLeft, rolling, rollId, status, celebration, jokerChoice } = state;
  const player = players[currentPlayer];
  const isBusy = phase === "computer";
  const humanTurn = phase === "ready" || phase === "playing";
  const diceVisible = phase !== "handoff" && phase !== "finished";
  const loading = !themeChosen || loadedBackground !== theme.background || (diceVisible && !readyDice.every(Boolean));
  const canStartRoll = !loading && humanTurn && !rolling && rollsLeft > 0 && !celebration;
  const canRoll = canStartRoll && !(dice.length > 0 && held.every(Boolean));
  const canScore = phase === "playing" && dice.length === 5 && !rolling && !celebration;
  const round = Math.min(13, Math.min(...players.map((item) => item.scores.filter((score) => score !== null).length)) + 1);
  const rankedOptions = canScore ? rankScoreOptions(dice, player.scores) : [];
  const scoreOptions = [...rankedOptions].sort((a, b) => a.index - b.index);
  const suggestions = selectScoreSuggestions(rankedOptions);

  function updateDieReady(index: number, ready: boolean) {
    setReadyDice((current) => current[index] === ready ? current : current.map((value, position) => position === index ? ready : value));
  }

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
    if (loading || phase !== "computer" || celebration) return;
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
  }, [loading, phase, currentPlayer, players, celebration]);

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
    setTheme(randomGameTheme(theme.id));
    dispatch({ type: "reset", mode });
    setSetupOpen(false);
    setAllScoresOpen(false);
    setScorecardOpen(false);
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

  const scorecard = (
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
              <tr className="subtotal-row score-summary-row"><th scope="row" title="Each additional five of a kind earns +100 points">Five of a kind bonus</th>{players.map((item, index) => <td className={index === currentPlayer ? "player-score-cell" : ""} key={item.name}>{item.bonus ? `+${item.bonus}` : "–"}</td>)}</tr>
            </tbody>
            <tfoot><tr className="total-row"><th scope="row" title="Including bonuses">Total</th>{players.map((item, index) => <td className={index === currentPlayer ? "player-score-cell" : ""} key={item.name}>{totalScore(item.scores, item.bonus)}</td>)}</tr></tfoot>
          </table>
        </div>
      </div>
  );

  return <div className="game-viewport" style={gameThemeStyle(theme)} data-theme={theme.id}>
    {loading && <GameLoading error={backgroundError} onRetry={() => { setBackgroundError(false); setLoadAttempt((attempt) => attempt + 1); }} />}
    <div className={`game-wrapper${loading ? " is-loading" : ""}`} inert={loading} aria-hidden={loading} aria-busy={loading}><main className="page-shell">
    <header className="topbar">
      <button className="header-button new-game-button" type="button" onClick={() => { setNextMode(state.mode); setSetupOpen(true); }}>New game</button>
      <h1 className="brand-name">Pips &amp; Petals</h1>
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
                  <Dice values={dice.length ? dice : [1, 1, 1, 1, 1]} unrolled={!dice.length} held={held} onToggle={isBusy ? undefined : (index) => dispatch({ type: "hold", index })} disabled={!dice.length || rolling || !humanTurn || rollsLeft === 0} rolling={rolling} rollId={rollId} label={dice.length ? `${player.name}’s dice` : "Roll the dice to start"} animateWithReducedMotion={diceMotion.animateDice} shading={diceShading} onReadyChange={updateDieReady} />
                </div>}
          </div>
          <div className="play-actions">
            {phase === "handoff" ? <button className="roll-button" type="button" onClick={() => dispatch({ type: "ready" })}>{player.name} is ready</button>
              : phase === "finished" ? <button className="roll-button" type="button" onClick={() => startGame(state.mode)}>Play again</button>
                : rollsLeft > 0 ? <button className="roll-button" type="button" onClick={roll} disabled={!canRoll}>
                  <span>{isBusy ? "Computer’s turn" : jokerChoice ? "Choose a score" : dice.length ? "Roll again" : "Roll the dice"}</span>
                  {humanTurn && <span className="roll-count" role="status">{rollsLeft} {rollsLeft === 1 ? "roll" : "rolls"} left</span>}
                </button> : null}
            {humanTurn && rollsLeft === 0 && <span className="roll-count" role="status">0 rolls left</span>}
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
          {process.env.NODE_ENV === "development" && <details className="dev-controls">
            <summary>Dev mode</summary>
            <div className="dev-controls-panel">
              <label className="dev-dice-color">Dice surface <input type="color" value={surfaceColor ?? GAME_DICE_SHADING.surfaceColor} onChange={(event) => setSurfaceColor(event.target.value)} /></label>
              <p><code>{(surfaceColor ?? GAME_DICE_SHADING.surfaceColor).toUpperCase()}</code> · {dicePipColor(surfaceColor ?? GAME_DICE_SHADING.surfaceColor) === "#ffffff" ? "White" : "Dark"} pips (automatic)</p>
              <label className="dev-dice-shadow">
                <span>Shadow darkness <span>{shadowDarkness}%</span></span>
                <input type="range" min="0" max="100" step="1" value={shadowDarkness} onChange={(event) => setShadowDarkness(Number(event.target.value))} aria-label="Shadow darkness" aria-valuetext={`${shadowDarkness} percent`} />
              </label>
              <button className="header-button" type="button" disabled={surfaceColor === null && shadowDarkness === Math.round(GAME_DICE_SHADING.shadowDarkness * 100)} onClick={() => { setSurfaceColor(null); setShadowDarkness(Math.round(GAME_DICE_SHADING.shadowDarkness * 100)); }}>Reset dice appearance</button>
              <button className="header-button" type="button" disabled={!canStartRoll} onClick={rollFiveKind}>Roll five of a kind</button>
            </div>
          </details>}
        </div>
        <div className="live-status" aria-live="polite">{phase === "finished" ? "" : status}</div>
        <button className="header-button scorecard-toggle" type="button" aria-haspopup="dialog" aria-expanded={scorecardOpen} aria-controls={scorecardOpen ? "scorecard-popup" : undefined} onClick={() => setScorecardOpen(true)}>Scorecard</button>
      </div>

      {!compactScorecard && scorecard}
    </section>

    {compactScorecard && scorecardOpen && <ScorecardPopup onClose={() => setScorecardOpen(false)}>{scorecard}</ScorecardPopup>}

    {allScoresOpen && <ScoreChoices options={scoreOptions} onChoose={chooseScore} onClose={() => setAllScoresOpen(false)} />}

    {celebration && <Celebration award={celebration} onContinue={() => dispatch({ type: "dismissCelebration" })} shading={diceShading} />}

    {setupOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSetupOpen(false); }}>
      <section className="rules-modal setup-modal" role="dialog" aria-modal="true" aria-labelledby="setup-title">
        <button className="modal-close" type="button" onClick={() => setSetupOpen(false)} aria-label="Close game setup">×</button>
        <h2 id="setup-title">New game</h2>
        <fieldset className="game-mode-options">
          <legend>Players</legend>
          {GAME_MODES.map(({ mode, title, description }) => <button className="game-mode-option" type="button" key={mode} aria-pressed={nextMode === mode} onClick={() => setNextMode(mode)}>
            <span><strong>{title}</strong><span className="game-mode-description">{description}</span></span>
            <span className="game-mode-check" aria-hidden="true">{nextMode === mode ? "✓" : ""}</span>
          </button>)}
        </fieldset>
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
