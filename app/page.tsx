"use client";

import { useEffect, useRef, useState } from "react";
import { ROLL_DURATION, RollingDie } from "./components/rolling-die";

type CategoryId =
  | "ones"
  | "twos"
  | "threes"
  | "fours"
  | "fives"
  | "sixes"
  | "threeKind"
  | "fourKind"
  | "fullHouse"
  | "smallStraight"
  | "largeStraight"
  | "yahtzee"
  | "chance";

type Category = { id: CategoryId; label: string; hint: string; group: "upper" | "lower"; face?: number };
type ScoreCard = Array<number | null>;
type Player = "you" | "computer";
type Turn = "ready" | "you" | "computer" | "finished";

const CATEGORIES: Category[] = [
  { id: "ones", label: "Aces", hint: "Count the ones", group: "upper", face: 1 },
  { id: "twos", label: "Twos", hint: "Count the twos", group: "upper", face: 2 },
  { id: "threes", label: "Threes", hint: "Count the threes", group: "upper", face: 3 },
  { id: "fours", label: "Fours", hint: "Count the fours", group: "upper", face: 4 },
  { id: "fives", label: "Fives", hint: "Count the fives", group: "upper", face: 5 },
  { id: "sixes", label: "Sixes", hint: "Count the sixes", group: "upper", face: 6 },
  { id: "threeKind", label: "Three of a kind", hint: "At least 3 alike · sum all dice", group: "lower" },
  { id: "fourKind", label: "Four of a kind", hint: "At least 4 alike · sum all dice", group: "lower" },
  { id: "fullHouse", label: "Full house", hint: "Three of one, two of another", group: "lower" },
  { id: "smallStraight", label: "Small straight", hint: "4 in a row", group: "lower" },
  { id: "largeStraight", label: "Large straight", hint: "5 in a row", group: "lower" },
  { id: "yahtzee", label: "Yahtzee", hint: "All 5 dice alike", group: "lower" },
  { id: "chance", label: "Chance", hint: "Sum of all dice", group: "lower" },
];

const EMPTY_CARD: ScoreCard = Array(13).fill(null);
const DIE = [1, 2, 3, 4, 5, 6];

function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

function rollFive() {
  return Array.from({ length: 5 }, rollDie);
}

function countFaces(dice: number[]) {
  return DIE.map((face) => dice.filter((die) => die === face).length);
}

function scoreCategory(id: CategoryId, dice: number[]) {
  if (dice.length !== 5) return 0;
  const counts = countFaces(dice);
  const sum = dice.reduce((total, die) => total + die, 0);
  const unique = DIE.filter((face) => counts[face - 1] > 0);
  const hasRun = (length: number) => {
    let longest = 0;
    let previous = 0;
    for (const face of unique) {
      longest = face === previous + 1 ? longest + 1 : 1;
      previous = face;
      if (longest >= length) return true;
    }
    return false;
  };

  switch (id) {
    case "ones": return counts[0] * 1;
    case "twos": return counts[1] * 2;
    case "threes": return counts[2] * 3;
    case "fours": return counts[3] * 4;
    case "fives": return counts[4] * 5;
    case "sixes": return counts[5] * 6;
    case "threeKind": return Math.max(...counts) >= 3 ? sum : 0;
    case "fourKind": return Math.max(...counts) >= 4 ? sum : 0;
    case "fullHouse": return counts.includes(3) && counts.includes(2) ? 25 : 0;
    case "smallStraight": return hasRun(4) ? 30 : 0;
    case "largeStraight": return hasRun(5) ? 40 : 0;
    case "yahtzee": return Math.max(...counts) === 5 ? 50 : 0;
    case "chance": return sum;
  }
}

function upperSubtotal(card: ScoreCard) {
  return card.slice(0, 6).reduce<number>((total, score) => total + (score ?? 0), 0);
}

function totalScore(card: ScoreCard, yahtzeeBonus = 0) {
  const upper = upperSubtotal(card);
  const bonus = upper >= 63 ? 35 : 0;
  return upper + bonus + card.slice(6).reduce<number>((total, score) => total + (score ?? 0), 0) + yahtzeeBonus;
}

function hasYahtzee(dice: number[]) {
  return dice.length === 5 && Math.max(...countFaces(dice)) === 5;
}

function playableCategoryIndices(card: ScoreCard, dice: number[]) {
  const available = CATEGORIES.map((_, index) => index).filter((index) => card[index] === null);
  if (!hasYahtzee(dice) || card[CATEGORIES.findIndex((category) => category.id === "yahtzee")] !== 50) return available;

  const matchingUpper = dice[0] - 1;
  if (card[matchingUpper] === null) return [matchingUpper];
  const availableLower = available.filter((index) => CATEGORIES[index].group === "lower");
  return availableLower.length ? availableLower : available;
}

function categoryAward(id: CategoryId, dice: number[], card: ScoreCard) {
  const earnsBonus = hasYahtzee(dice) && card[CATEGORIES.findIndex((category) => category.id === "yahtzee")] === 50;
  let score = scoreCategory(id, dice);
  if (earnsBonus) {
    if (id === "fullHouse") score = 25;
    if (id === "smallStraight") score = 30;
    if (id === "largeStraight") score = 40;
  }
  return { score, bonusPoints: earnsBonus ? 100 : 0 };
}

function longestRun(dice: number[]) {
  const values = [...new Set(dice)].sort((a, b) => a - b);
  let best = 0;
  let current = 0;
  let previous = 0;
  for (const value of values) {
    current = value === previous + 1 ? current + 1 : 1;
    best = Math.max(best, current);
    previous = value;
  }
  return best;
}

function aiTarget(dice: number[], card: ScoreCard): CategoryId {
  const counts = countFaces(dice);
  const maxCount = Math.max(...counts);
  const maxFace = counts.indexOf(maxCount) + 1;
  const sum = dice.reduce((total, die) => total + die, 0);
  const run = longestRun(dice);
  const pairCount = counts.filter((count) => count === 2).length;
  const potential: Record<CategoryId, number> = {
    ones: counts[0] + (5 - counts[0]) * 0.4,
    twos: 2 * (counts[1] + (5 - counts[1]) * 0.4),
    threes: 3 * (counts[2] + (5 - counts[2]) * 0.4),
    fours: 4 * (counts[3] + (5 - counts[3]) * 0.4),
    fives: 5 * (counts[4] + (5 - counts[4]) * 0.4),
    sixes: 6 * (counts[5] + (5 - counts[5]) * 0.4),
    threeKind: maxCount >= 3 ? sum + 8 : maxCount === 2 ? sum * 0.65 + 8 : sum * 0.2 + 4,
    fourKind: maxCount >= 3 ? sum + 6 : maxCount === 2 ? 13 : 4,
    fullHouse: counts.includes(3) && counts.includes(2) ? 30 : pairCount >= 2 ? 23 : maxCount >= 2 ? 14 : 5,
    smallStraight: run >= 4 ? 35 : run * 7 + (new Set(dice).size >= 4 ? 5 : 0),
    largeStraight: run >= 5 ? 45 : run * 7 + 2,
    yahtzee: maxCount === 5 ? 60 : maxCount === 4 ? 39 : maxCount === 3 ? 22 : maxCount === 2 ? 10 : 2,
    chance: sum,
  };

  let target: CategoryId = "chance";
  let best = -Infinity;
  const playable = new Set(playableCategoryIndices(card, dice));
  CATEGORIES.forEach((category) => {
    if (!playable.has(CATEGORIES.findIndex((item) => item.id === category.id))) return;
    if (potential[category.id] > best) {
      best = potential[category.id];
      target = category.id;
    }
  });
  return target;
}

function aiHoldPlan(dice: number[], target: CategoryId) {
  const counts = countFaces(dice);
  const maxCount = Math.max(...counts);
  const maxFace = counts.indexOf(maxCount) + 1;
  if (["ones", "twos", "threes", "fours", "fives", "sixes"].includes(target)) {
    const face = CATEGORIES.find((category) => category.id === target)?.face;
    return dice.map((die) => die === face);
  }
  if (target === "chance") return dice.map(() => true);
  if (target === "smallStraight" || target === "largeStraight") {
    const windowSize = target === "smallStraight" ? 4 : 5;
    let bestFaces: number[] = [];
    for (let start = 1; start <= 7 - windowSize; start += 1) {
      const window = Array.from({ length: windowSize }, (_, index) => start + index);
      const matching = window.filter((face) => dice.includes(face));
      if (matching.length > bestFaces.length) bestFaces = matching;
    }
    return dice.map((die, index) => bestFaces.includes(die) && dice.indexOf(die) === index);
  }
  if (target === "fullHouse") {
    const pairs = counts.map((count, index) => ({ count, face: index + 1 })).filter((item) => item.count === 2);
    const triples = counts.map((count, index) => ({ count, face: index + 1 })).filter((item) => item.count === 3);
    const preferred = pairs.length >= 2 ? pairs.map((item) => item.face) : triples.length ? [triples[0].face] : maxCount >= 2 ? [maxFace] : [];
    return dice.map((die) => preferred.includes(die));
  }
  if (maxCount < 2) return dice.map(() => false);
  return dice.map((die) => die === maxFace);
}

function chooseAiCategory(dice: number[], card: ScoreCard) {
  let bestIndex = -1;
  let bestScore = -1;
  const playable = playableCategoryIndices(card, dice);
  CATEGORIES.forEach((category, index) => {
    if (!playable.includes(index)) return;
    const score = categoryAward(category.id, dice, card).score;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  if (bestScore > 0) return bestIndex;

  const sacrificeOrder: CategoryId[] = ["yahtzee", "largeStraight", "fourKind", "fullHouse", "smallStraight", "threeKind", "ones", "twos", "threes", "fours", "fives", "sixes", "chance"];
  const sacrifice = sacrificeOrder.find((id) => playable.includes(CATEGORIES.findIndex((category) => category.id === id)));
  return CATEGORIES.findIndex((category) => category.id === sacrifice);
}

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
            <span className="hold-caption">{isHeld ? "HELD" : "KEEP"}</span>
          </button>
        ) : (
          <span className="opponent-die" key={index} aria-label={`Die ${index + 1}: ${isRolling ? "rolling" : value}`}>{dieContents}</span>
        );
      })}
    </div>
  );
}

function ScoreSummary({ player, score, active, icon }: { player: string; score: number; active: boolean; icon: string }) {
  return (
    <div className={`summary-card${active ? " summary-active" : ""}`}>
      <div className="summary-avatar" aria-hidden="true">{icon}</div>
      <div className="summary-copy">
        <span>{player}</span>
        <strong>{score}</strong>
      </div>
      {active && <span className="playing-dot" aria-label="Current turn" />}
    </div>
  );
}

function totalLabel(playerCard: ScoreCard, computerCard: ScoreCard, playerBonus = 0, computerBonus = 0) {
  if (playerCard.some((score) => score === null) || computerCard.some((score) => score === null)) return "Match score";
  const yours = totalScore(playerCard, playerBonus);
  const theirs = totalScore(computerCard, computerBonus);
  if (yours === theirs) return "A perfect tie";
  return yours > theirs ? "You take the win" : "Milo takes the win";
}

export default function Home() {
  const [playerScores, setPlayerScores] = useState<ScoreCard>(() => [...EMPTY_CARD]);
  const [computerScores, setComputerScores] = useState<ScoreCard>(() => [...EMPTY_CARD]);
  const [playerYahtzeeBonus, setPlayerYahtzeeBonus] = useState(0);
  const [computerYahtzeeBonus, setComputerYahtzeeBonus] = useState(0);
  const [turn, setTurn] = useState<Turn>("ready");
  const [dice, setDice] = useState<number[]>([]);
  const [held, setHeld] = useState<boolean[]>(Array(5).fill(false));
  const [rollsLeft, setRollsLeft] = useState(3);
  const [computerDice, setComputerDice] = useState<number[]>([]);
  const [computerRollsLeft, setComputerRollsLeft] = useState(2);
  const [status, setStatus] = useState("Roll the dice to start your first turn.");
  const [rolling, setRolling] = useState(false);
  const [rollId, setRollId] = useState(0);
  const [computerRolling, setComputerRolling] = useState(false);
  const [computerHeld, setComputerHeld] = useState<boolean[]>(Array(5).fill(false));
  const [computerRollId, setComputerRollId] = useState(0);
  const rollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const gameId = useRef(0);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => () => {
    gameId.current += 1;
    if (rollTimer.current) clearTimeout(rollTimer.current);
  }, []);

  const playerTurns = playerScores.filter((score) => score !== null).length;
  const computerTurns = computerScores.filter((score) => score !== null).length;
  const completedRounds = Math.min(playerTurns, computerTurns);
  const round = turn === "finished" ? 13 : Math.min(turn === "computer" ? Math.max(playerTurns, 1) : completedRounds + 1, 13);
  const yourTurn = turn === "you" || turn === "ready";

  function startNewGame() {
    gameId.current += 1;
    if (rollTimer.current) clearTimeout(rollTimer.current);
    setComputerRolling(false);
    setComputerHeld(Array(5).fill(false));
    setPlayerScores([...EMPTY_CARD]);
    setComputerScores([...EMPTY_CARD]);
    setPlayerYahtzeeBonus(0);
    setComputerYahtzeeBonus(0);
    setTurn("ready");
    setDice([]);
    setHeld(Array(5).fill(false));
    setRollsLeft(3);
    setComputerDice([]);
    setComputerRollsLeft(2);
    setRolling(false);
    setStatus("Roll the dice to start your first turn.");
  }

  function rollPlayerDice() {
    if (rolling || !yourTurn || rollsLeft === 0 || (dice.length > 0 && held.every(Boolean))) return;
    setRolling(true);
    setRollId((id) => id + 1);
    const token = gameId.current;
    const nextDice = dice.length === 0 ? rollFive() : dice.map((die, index) => held[index] ? die : rollDie());
    setDice(nextDice);
    setRollsLeft((left) => left - 1);
    setTurn("you");
    const repeatYahtzee = hasYahtzee(nextDice) && playerScores[CATEGORIES.findIndex((category) => category.id === "yahtzee")] === 50;
    setStatus("Your dice are rolling...");
    rollTimer.current = setTimeout(() => {
      if (gameId.current !== token) return;
      setRolling(false);
      setStatus(repeatYahtzee ? "Yahtzee bonus! Choose a legal score on the card." : "Tap dice to hold them, then roll again or choose a score.");
    }, ROLL_DURATION);
  }

  function toggleHeld(index: number) {
    if (rolling || turn !== "you" || rollsLeft === 0) return;
    setHeld((current) => current.map((value, itemIndex) => itemIndex === index ? !value : value));
  }

  async function computerPlay(initialCard: ScoreCard, initialBonus: number, token: number, playerIsDone: boolean, finalPlayerCard: ScoreCard, finalPlayerBonus: number) {
    const pause = (duration: number) => new Promise<void>((resolve) => window.setTimeout(resolve, duration));
    let hand = rollFive();
    setComputerRollsLeft(2);
    setComputerDice(hand);
    setComputerHeld(Array(5).fill(false));
    setComputerRollId((id) => id + 1);
    setComputerRolling(true);
    setStatus("Milo is rolling...");
    for (let reroll = 0; reroll < 2; reroll += 1) {
      await pause(ROLL_DURATION);
      if (gameId.current !== token) return;
      setComputerRolling(false);
      await pause(300);
      if (gameId.current !== token) return;
      const target = aiTarget(hand, initialCard);
      const holds = aiHoldPlan(hand, target);
      if (holds.every(Boolean)) break;
      setComputerHeld(holds);
      setComputerRollId((id) => id + 1);
      setComputerRolling(true);
      hand = hand.map((die, index) => holds[index] ? die : rollDie());
      setComputerRollsLeft((left) => Math.max(0, left - 1));
      setComputerDice(hand);
    }
    await pause(ROLL_DURATION);
    if (gameId.current !== token) return;
    setComputerRolling(false);
    const chosenIndex = chooseAiCategory(hand, initialCard);
    const chosenCategory = CATEGORIES[chosenIndex];
    const nextCard = [...initialCard];
    const award = categoryAward(chosenCategory.id, hand, initialCard);
    nextCard[chosenIndex] = award.score;
    const nextBonus = initialBonus + award.bonusPoints;
    setComputerScores(nextCard);
    setComputerYahtzeeBonus(nextBonus);
    setComputerDice([]);
    setComputerRollsLeft(2);

    if (playerIsDone) {
      setTurn("finished");
      setStatus(totalLabel(finalPlayerCard, nextCard, finalPlayerBonus, nextBonus));
      return;
    }
    setTurn("you");
    setDice([]);
    setHeld(Array(5).fill(false));
    setRollsLeft(3);
    setStatus(`Milo scored ${nextCard[chosenIndex]} in ${chosenCategory.label}.${award.bonusPoints ? " Yahtzee bonus: +100." : ""} Your next turn is ready.`);
  }

  function scorePlayerTurn(index: number) {
    if (rolling || turn !== "you" || dice.length !== 5 || !playableCategoryIndices(playerScores, dice).includes(index)) return;
    const category = CATEGORIES[index];
    const nextPlayerCard = [...playerScores];
    const award = categoryAward(category.id, dice, playerScores);
    nextPlayerCard[index] = award.score;
    const nextPlayerBonus = playerYahtzeeBonus + award.bonusPoints;
    setPlayerScores(nextPlayerCard);
    setPlayerYahtzeeBonus(nextPlayerBonus);
    setTurn("computer");
    setStatus(award.bonusPoints ? "Yahtzee bonus: +100. Milo is choosing a category..." : "Milo is choosing a category...");
    void computerPlay(computerScores, computerYahtzeeBonus, gameId.current, nextPlayerCard.every((score) => score !== null), nextPlayerCard, nextPlayerBonus);
  }

  function displayScore(card: ScoreCard, index: number) {
    return card[index] === null ? "—" : card[index];
  }

  const isBusy = turn === "computer";
  const canRoll = !rolling && yourTurn && rollsLeft > 0 && !(dice.length > 0 && held.every(Boolean));

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Lucky Five home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /><i /></span>
          <span className="brand-name">LUCKY <b>FIVE</b><small>THE DICE TABLE</small></span>
        </a>
        <div className="topbar-right">
          <span className="versus-pill"><span /> ONE PLAYER <b>·</b> VS COMPUTER</span>
          <button className="text-button" type="button" onClick={() => setHelpOpen(true)}>How to play <span aria-hidden="true">↗</span></button>
          <button className="new-game-button" type="button" onClick={startNewGame}><span aria-hidden="true">↻</span> New game</button>
        </div>
      </header>

      <section className="intro" id="top">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> A CLASSIC DICE DUEL</div>
          <h1>Roll with <em>it.</em></h1>
          <p>Five dice, thirteen chances. Make every roll count.</p>
        </div>
        <div className="round-indicator">
          <div className="round-label">ROUND</div>
          <div><strong>{turn === "finished" ? "13" : String(round).padStart(2, "0")}</strong><span> / 13</span></div>
          <div className="round-track"><span style={{ width: `${(completedRounds / 13) * 100}%` }} /></div>
        </div>
      </section>

      <section className="game-layout" aria-label="Yahtzee game">
        <div className="scoreboard-card">
          <div className="scoreboard-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> THE SCORECARD</div>
              <h2>Keep your eyes<br />on the prize.</h2>
            </div>
            <div className="scoreboard-icon" aria-hidden="true">✳</div>
          </div>

          <div className="score-summaries">
            <ScoreSummary player="YOU" score={totalScore(playerScores, playerYahtzeeBonus)} active={yourTurn && turn !== "ready"} icon="Y" />
            <div className="versus-mark">VS</div>
            <ScoreSummary player="MILO" score={totalScore(computerScores, computerYahtzeeBonus)} active={isBusy} icon="M" />
          </div>

          <div className="score-table-wrap">
            <table className="score-table">
              <thead>
                <tr>
                  <th scope="col">CATEGORY</th>
                  <th scope="col" className={yourTurn ? "column-active" : ""}>YOU</th>
                  <th scope="col" className={isBusy ? "column-active" : ""}>MILO</th>
                </tr>
              </thead>
              <tbody>
                <tr className="section-row"><th colSpan={3}>UPPER SECTION <span>63 for a +35 bonus</span></th></tr>
                {CATEGORIES.filter((category) => category.group === "upper").map((category) => {
                  const index = CATEGORIES.findIndex((item) => item.id === category.id);
                  const isAvailable = playerScores[index] === null;
                  const canPick = playableCategoryIndices(playerScores, dice).includes(index);
                  return (
                    <tr key={category.id} className={isAvailable && turn === "you" && dice.length === 5 ? "score-row score-row-ready" : "score-row"}>
                      <th scope="row"><span>{category.label}</span><small>{category.hint}</small></th>
                      <td className="player-score-cell">
                        {isAvailable && turn === "you" && dice.length === 5 && canPick ? (
                          <button type="button" className="score-pick" disabled={rolling} onClick={() => scorePlayerTurn(index)} aria-label={`Score ${categoryAward(category.id, dice, playerScores).score} points in ${category.label}`}>
                            {categoryAward(category.id, dice, playerScores).score} <span>↵</span>
                          </button>
                        ) : isAvailable && turn === "you" && dice.length === 5 ? <span className="joker-locked">LOCKED</span> : <span className={playerScores[index] === null ? "empty-score" : "filled-score"}>{displayScore(playerScores, index)}</span>}
                      </td>
                      <td className="computer-score-cell"><span className={computerScores[index] === null ? "empty-score" : "filled-score"}>{displayScore(computerScores, index)}</span></td>
                    </tr>
                  );
                })}
                <tr className="subtotal-row"><th scope="row">Upper subtotal</th><td>{upperSubtotal(playerScores)}{upperSubtotal(playerScores) >= 63 && <span className="bonus-tag">+35</span>}</td><td>{upperSubtotal(computerScores)}{upperSubtotal(computerScores) >= 63 && <span className="bonus-tag">+35</span>}</td></tr>
                <tr className="subtotal-row yahtzee-bonus-row"><th scope="row">Yahtzee bonus</th><td>{playerYahtzeeBonus ? `+${playerYahtzeeBonus}` : "—"}</td><td>{computerYahtzeeBonus ? `+${computerYahtzeeBonus}` : "—"}</td></tr>
                <tr className="section-row"><th colSpan={3}>LOWER SECTION <span>the big combinations</span></th></tr>
                {CATEGORIES.filter((category) => category.group === "lower").map((category) => {
                  const index = CATEGORIES.findIndex((item) => item.id === category.id);
                  const isAvailable = playerScores[index] === null;
                  const canPick = playableCategoryIndices(playerScores, dice).includes(index);
                  return (
                    <tr key={category.id} className={isAvailable && turn === "you" && dice.length === 5 ? "score-row score-row-ready" : "score-row"}>
                      <th scope="row"><span>{category.label}</span><small>{category.hint}</small></th>
                      <td className="player-score-cell">
                        {isAvailable && turn === "you" && dice.length === 5 && canPick ? (
                          <button type="button" className="score-pick" disabled={rolling} onClick={() => scorePlayerTurn(index)} aria-label={`Score ${categoryAward(category.id, dice, playerScores).score} points in ${category.label}`}>
                            {categoryAward(category.id, dice, playerScores).score} <span>↵</span>
                          </button>
                        ) : isAvailable && turn === "you" && dice.length === 5 ? <span className="joker-locked">LOCKED</span> : <span className={playerScores[index] === null ? "empty-score" : "filled-score"}>{displayScore(playerScores, index)}</span>}
                      </td>
                      <td className="computer-score-cell"><span className={computerScores[index] === null ? "empty-score" : "filled-score"}>{displayScore(computerScores, index)}</span></td>
                    </tr>
                  );
                })}
                <tr className="total-row"><th scope="row">TOTAL <small>including bonus</small></th><td>{totalScore(playerScores, playerYahtzeeBonus)}</td><td>{totalScore(computerScores, computerYahtzeeBonus)}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="scorecard-foot"><span className="foot-star">✳</span> {turn === "finished" ? totalLabel(playerScores, computerScores, playerYahtzeeBonus, computerYahtzeeBonus) : "Pick a row after your final roll to score."}</div>
        </div>

        <div className="play-column">
          <div className={`play-card${turn === "finished" ? " play-card-finished" : ""}`}>
            <div className="play-card-top">
              <span className={`turn-pill${isBusy ? " turn-pill-computer" : ""}`}><i /> {turn === "finished" ? "MATCH COMPLETE" : isBusy ? "MILO’S TURN" : "YOUR TURN"}</span>
              <span className="round-mini">{turn === "finished" ? "FINAL SCORE" : `ROUND ${String(round).padStart(2, "0")}`}</span>
            </div>

            <div className="play-headline">
              <div className="opponent-row">
                <div className="milo-avatar" aria-hidden="true">M</div>
                <div><span>AT THE TABLE WITH</span><strong>Milo <small>· COMPUTER</small></strong></div>
                <div className={`milo-status${isBusy ? " status-thinking" : ""}`}>{isBusy ? "THINKING" : "READY"}</div>
              </div>
              <h2>{turn === "finished" ? (totalScore(playerScores, playerYahtzeeBonus) === totalScore(computerScores, computerYahtzeeBonus) ? "Dead even." : totalScore(playerScores, playerYahtzeeBonus) > totalScore(computerScores, computerYahtzeeBonus) ? "You did it." : "Good game.") : isBusy ? "Milo’s rolling." : turn === "ready" ? "Your move." : "Make it count."}</h2>
              <p>{turn === "finished" ? `${totalLabel(playerScores, computerScores, playerYahtzeeBonus, computerYahtzeeBonus)} · ${totalScore(playerScores, playerYahtzeeBonus)} to ${totalScore(computerScores, computerYahtzeeBonus)}` : isBusy ? "Let’s see what he comes up with." : turn === "ready" ? "Give the dice their first roll." : "Tap any die to hold it for your next roll."}</p>
            </div>

            <div className={`dice-stage${turn === "finished" ? " stage-finished" : ""}`}>
              <div className="dice-stage-header">
                <span>{isBusy ? "MILO’S DICE" : "YOUR DICE"}</span>
                <div className="roll-count" aria-label={`${isBusy ? computerRollsLeft : rollsLeft} rolls remaining`}>
                  <span className="roll-dots">{[0, 1, 2].map((dot) => <i key={dot} className={dot < (isBusy ? computerRollsLeft : rollsLeft) ? "dot-on" : ""} />)}</span>
                  {turn === "ready" ? "3 ROLLS" : isBusy ? "MILO ROLLS" : `${rollsLeft} LEFT`}
                </div>
              </div>
              {isBusy ? (
                <Dice values={computerDice.length ? computerDice : [1, 2, 3, 4, 5]} held={computerHeld} rolling={computerRolling} rollId={computerRollId} label="Milo’s dice" />
              ) : dice.length ? (
                <Dice values={dice} held={held} onToggle={toggleHeld} disabled={rolling || turn !== "you" || rollsLeft === 0} rolling={rolling} rollId={rollId} />
              ) : (
                <div className="dice-placeholder" aria-hidden="true"><span>?</span><span>?</span><span>?</span><span>?</span><span>?</span></div>
              )}
              <div className="dice-legend"><span><i className="legend-held" /> HELD FOR NEXT ROLL</span><span>{rolling || computerRolling ? "ROLLING…" : isBusy ? `${computerDice.reduce((sum, die) => sum + die, 0)} TOTAL` : dice.length ? `${dice.reduce((sum, die) => sum + die, 0)} TOTAL` : "FIVE DICE · ONE CUP"}</span></div>
            </div>

            <div className="play-actions">
              {turn !== "finished" && <button className="roll-button" type="button" onClick={rollPlayerDice} disabled={!canRoll || isBusy}>
                <span className="roll-icon" aria-hidden="true">↻</span>
                {rolling ? "ROLLING…" : turn === "ready" ? "ROLL THE DICE" : "ROLL AGAIN"}
                <span className="button-arrow" aria-hidden="true">→</span>
              </button>}
              {turn === "finished" ? <button className="roll-button" type="button" onClick={startNewGame}><span className="roll-icon" aria-hidden="true">↻</span> PLAY AGAIN <span className="button-arrow" aria-hidden="true">→</span></button> : <div className="action-hint"><span className="hint-icon">↗</span><span>{turn === "ready" ? "Start your turn" : isBusy ? "Opponent is taking a turn" : rollsLeft > 0 ? "Hold dice or bank your score" : "Choose a score on the card"}</span></div>}
            </div>
            <div className="live-status" aria-live="polite"><span className={isBusy ? "live-pulse" : ""} />{status}</div>
          </div>

          <div className="tip-card">
            <div className="tip-icon" aria-hidden="true">✳</div>
            <div><span>TABLE TIP</span><p>Chasing the upper bonus? Aim for <b>63 points</b> across Aces through Sixes.</p></div>
            <span className="tip-spark" aria-hidden="true">✦</span>
          </div>
        </div>
      </section>

      <footer className="page-footer"><span>LUCKY FIVE <i>·</i> GOOD LUCK OUT THERE</span><span>THIRTEEN CATEGORIES. ONE WINNER.</span></footer>

      {helpOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}>
        <section className="rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title">
          <button className="modal-close" type="button" onClick={() => setHelpOpen(false)} aria-label="Close rules">×</button>
          <div className="eyebrow"><span className="eyebrow-line" /> THE QUICK GUIDE</div>
          <h2 id="rules-title">How to play.</h2>
          <p>Take turns with Milo. On your turn, roll all five dice, then choose which dice to keep before rolling again. You can roll up to three times.</p>
          <div className="rules-steps">
            <div><b>01</b><span><strong>Roll</strong> Start with all five dice.</span></div>
            <div><b>02</b><span><strong>Hold</strong> Tap dice to keep them. Roll the rest up to twice more.</span></div>
            <div><b>03</b><span><strong>Score</strong> Choose one open category. Every category is used once.</span></div>
          </div>
          <p className="rules-note">Reach 63 in the upper section for a 35-point bonus. A repeat Yahtzee after scoring 50 earns +100. If its matching upper box is open, use that; otherwise score in an open lower box using joker values. Highest total after thirteen rounds wins.</p>
          <button className="rules-done" type="button" onClick={() => setHelpOpen(false)}>GOT IT <span>→</span></button>
        </section>
      </div>}
    </main>
  );
}
