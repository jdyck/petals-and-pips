export type CategoryId =
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
  | "fiveKind"
  | "chance";

export type Category = { id: CategoryId; label: string; hint: string; group: "upper" | "lower"; face?: number; points?: number | "sum" };
export type ScoreCard = Array<number | null>;

export const CATEGORIES: Category[] = [
  { id: "ones", label: "Ones", hint: "Count the ones", group: "upper", face: 1 },
  { id: "twos", label: "Twos", hint: "Count the twos", group: "upper", face: 2 },
  { id: "threes", label: "Threes", hint: "Count the threes", group: "upper", face: 3 },
  { id: "fours", label: "Fours", hint: "Count the fours", group: "upper", face: 4 },
  { id: "fives", label: "Fives", hint: "Count the fives", group: "upper", face: 5 },
  { id: "sixes", label: "Sixes", hint: "Count the sixes", group: "upper", face: 6 },
  { id: "threeKind", label: "Three of a kind", hint: "At least 3 alike · sum all dice", group: "lower", points: "sum" },
  { id: "fourKind", label: "Four of a kind", hint: "At least 4 alike · sum all dice", group: "lower", points: "sum" },
  { id: "fullHouse", label: "Full house", hint: "Three of one, two of another", group: "lower", points: 25 },
  { id: "smallStraight", label: "Small straight", hint: "4 in a row", group: "lower", points: 30 },
  { id: "largeStraight", label: "Large straight", hint: "5 in a row", group: "lower", points: 40 },
  { id: "fiveKind", label: "Five of a kind", hint: "All 5 dice alike", group: "lower", points: 50 },
  { id: "chance", label: "Chance", hint: "Sum of all dice", group: "lower", points: "sum" },
];

const EMPTY_CARD: ScoreCard = Array(13).fill(null);
const DIE = [1, 2, 3, 4, 5, 6];

export function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

export function rollFive() {
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
    case "fiveKind": return Math.max(...counts) === 5 ? 50 : 0;
    case "chance": return sum;
  }
}

export function upperSubtotal(card: ScoreCard) {
  return card.slice(0, 6).reduce<number>((total, score) => total + (score ?? 0), 0);
}

export function totalScore(card: ScoreCard, fiveKindBonus = 0) {
  const upper = upperSubtotal(card);
  const bonus = upper >= 63 ? 35 : 0;
  return upper + bonus + card.slice(6).reduce<number>((total, score) => total + (score ?? 0), 0) + fiveKindBonus;
}

function hasFiveKind(dice: number[]) {
  return dice.length === 5 && Math.max(...countFaces(dice)) === 5;
}

export function playableCategoryIndices(card: ScoreCard, dice: number[]) {
  const available = CATEGORIES.map((_, index) => index).filter((index) => card[index] === null);
  if (!hasFiveKind(dice) || card[CATEGORIES.findIndex((category) => category.id === "fiveKind")] !== 50) return available;

  const matchingUpper = dice[0] - 1;
  if (card[matchingUpper] === null) return [matchingUpper];
  const availableLower = available.filter((index) => CATEGORIES[index].group === "lower");
  return availableLower.length ? availableLower : available;
}

export function categoryAward(id: CategoryId, dice: number[], card: ScoreCard) {
  const earnsBonus = hasFiveKind(dice) && card[CATEGORIES.findIndex((category) => category.id === "fiveKind")] === 50;
  let score = scoreCategory(id, dice);
  if (earnsBonus) {
    if (id === "fullHouse") score = 25;
    if (id === "smallStraight") score = 30;
    if (id === "largeStraight") score = 40;
  }
  return { score, bonusPoints: earnsBonus ? 100 : 0 };
}

function upperBonusPlan(card: ScoreCard) {
  const subtotal = upperSubtotal(card);
  // Three of every face totals 63. Banked extras offset earlier shortfalls.
  const onParTotal = DIE.reduce((sum, face) => sum + (card[face - 1] ?? 3 * face), 0);
  const maximum = DIE.reduce((sum, face) => sum + (card[face - 1] ?? 5 * face), 0);
  return { subtotal, shortfall: Math.max(0, 63 - onParTotal), chasing: subtotal < 63 && maximum >= 63 };
}

// Rank strategic value separately from the points actually written on the card.
export function rankScoreOptions(dice: number[], card: ScoreCard) {
  if (dice.length !== 5) return [];
  const bonus = upperBonusPlan(card);
  return playableCategoryIndices(card, dice).map((index) => {
    const category = CATEGORIES[index];
    const points = categoryAward(category.id, dice, card).score;
    let priority = points > 0 ? 1 : 0;
    if (points > 0) {
      if (category.face && bonus.chasing) {
        const par = 3 * category.face;
        if (points >= par || bonus.subtotal + points >= 63) {
          // Four (or five) matching dice can repair a missed three-of-a-face goal.
          priority = bonus.shortfall > 0 && points > par ? 3 : 2;
        }
      } else if (category.id === "fullHouse") priority = 4;
      else if (category.id === "smallStraight") priority = 5;
      else if (category.id === "largeStraight") priority = 6;
      else if (category.id === "fiveKind") priority = 7;
    }
    return { category, index, points, priority };
  }).sort((a, b) => b.priority - a.priority || b.points - a.points || a.index - b.index);
}

export function selectScoreSuggestions(options: ReturnType<typeof rankScoreOptions>) {
  const chance = options.find((option) => option.category.id === "chance");
  const alternatives = options.filter((option) => option.category.id !== "chance").slice(0, 2);
  if (!chance) return options.slice(0, 3);
  if (alternatives.every((option) => option.points === 0)) return [chance, ...alternatives];
  // Reserve the third slot even if only one other scoring category remains.
  return [alternatives[0], alternatives[1], chance];
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

export function aiTarget(dice: number[], card: ScoreCard): CategoryId {
  const bestMade = rankScoreOptions(dice, card)[0];
  if (bestMade && bestMade.priority >= 2) return bestMade.category.id;

  const counts = countFaces(dice);
  const maxCount = Math.max(...counts);
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
    fiveKind: maxCount === 5 ? 60 : maxCount === 4 ? 39 : maxCount === 3 ? 22 : maxCount === 2 ? 10 : 2,
    chance: sum,
  };

  const bonus = upperBonusPlan(card);
  if (bonus.chasing) {
    CATEGORIES.forEach((category) => {
      if (!category.face || card[category.face - 1] !== null) return;
      const count = counts[category.face - 1];
      const target = Math.min(5, 3 + Math.ceil(bonus.shortfall / category.face));
      const expectedMatches = count + (5 - count) * 0.4;
      // When behind par, favor matching higher faces that can cover more debt.
      potential[category.id] += 12 * Math.min(1, expectedMatches / target)
        + Math.min(bonus.shortfall, Math.max(0, expectedMatches - 3) * category.face);
    });
  }

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

export function aiHoldPlan(dice: number[], target: CategoryId) {
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
    if (counts.includes(3) && counts.includes(2)) return dice.map(() => true);
    const pairs = counts.map((count, index) => ({ count, face: index + 1 })).filter((item) => item.count === 2);
    const triples = counts.map((count, index) => ({ count, face: index + 1 })).filter((item) => item.count === 3);
    const preferred = pairs.length >= 2 ? pairs.map((item) => item.face) : triples.length ? [triples[0].face] : maxCount >= 2 ? [maxFace] : [];
    return dice.map((die) => preferred.includes(die));
  }
  if (maxCount < 2) return dice.map(() => false);
  return dice.map((die) => die === maxFace);
}

export function chooseAiCategory(dice: number[], card: ScoreCard) {
  const best = rankScoreOptions(dice, card)[0];
  if (best && best.points > 0) return best.index;
  const playable = playableCategoryIndices(card, dice);

  const sacrificeOrder: CategoryId[] = ["fiveKind", "largeStraight", "fourKind", "fullHouse", "smallStraight", "threeKind", "ones", "twos", "threes", "fours", "fives", "sixes", "chance"];
  const sacrifice = sacrificeOrder.find((id) => playable.includes(CATEGORIES.findIndex((category) => category.id === id)));
  return CATEGORIES.findIndex((category) => category.id === sacrifice);
}

export type GameMode = "solo" | "computer" | "local2" | "local3" | "local4";
export type Participant = { name: string; computer: boolean; scores: ScoreCard; bonus: number };
export type FiveKindCelebration = { playerName: string; dice: number[]; categoryLabel: string | null; score: number; bonusPoints: number };
export type GameState = {
  mode: GameMode;
  players: Participant[];
  currentPlayer: number;
  phase: "ready" | "playing" | "computer" | "handoff" | "finished";
  dice: number[];
  held: boolean[];
  rollsLeft: number;
  rolling: boolean;
  rollId: number;
  status: string;
  celebration: FiveKindCelebration | null;
  jokerChoice: boolean;
};
export type GameAction =
  | { type: "reset"; mode: GameMode }
  | { type: "ready" }
  | { type: "roll"; dice: number[] }
  | { type: "computerRoll"; dice: number[]; held: boolean[] }
  | { type: "settle" }
  | { type: "dismissCelebration" }
  | { type: "hold"; index: number }
  | { type: "score"; index: number };

export function createGame(mode: GameMode): GameState {
  const count = mode === "solo" ? 1 : mode === "local4" ? 4 : mode === "local3" ? 3 : 2;
  return {
    mode,
    players: Array.from({ length: count }, (_, index) => ({
      name: `Player ${index + 1}`,
      computer: mode === "computer" && index === 1,
      scores: [...EMPTY_CARD],
      bonus: 0,
    })),
    currentPlayer: 0,
    phase: "ready",
    dice: [],
    held: Array(5).fill(false),
    rollsLeft: 3,
    rolling: false,
    rollId: 0,
    status: "Player 1: roll the dice to start your turn.",
    celebration: null,
    jokerChoice: false,
  };
}

export function matchResult(players: Participant[]) {
  const totals = players.map((player) => totalScore(player.scores, player.bonus));
  if (players.length === 1) return `You scored ${totals[0]} points.`;
  const best = Math.max(...totals);
  const winners = players.filter((_, index) => totals[index] === best).map((player) => player.name);
  return winners.length === 1 ? `${winners[0]} wins with ${best} points.` : `${winners.join(" and ")} tie with ${best} points.`;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === "reset") return createGame(action.mode);
  if (action.type === "dismissCelebration") return state.celebration ? { ...state, celebration: null } : state;
  if (state.celebration) return state;
  const player = state.players[state.currentPlayer];
  const humanTurn = state.phase === "ready" || state.phase === "playing";
  switch (action.type) {
    case "ready":
      return state.phase === "handoff" ? { ...state, phase: "ready", status: `${player.name}: roll the dice to start your turn.` } : state;
    case "roll":
    case "computerRoll": {
      if (state.rolling || state.rollsLeft === 0 || action.dice.length !== 5 || action.dice.some((die) => !Number.isInteger(die) || die < 1 || die > 6)) return state;
      if (action.type === "roll" && (!humanTurn || (state.dice.length > 0 && state.held.every(Boolean)))) return state;
      if (action.type === "computerRoll" && state.phase !== "computer") return state;
      return {
        ...state,
        phase: action.type === "roll" ? "playing" : "computer",
        dice: action.dice,
        held: action.type === "computerRoll" ? action.held : state.held,
        rollsLeft: state.rollsLeft - 1,
        rolling: true,
        rollId: state.rollId + 1,
        status: `${player.name} is rolling…`,
      };
    }
    case "settle": {
      if (!state.rolling) return state;
      const settled = { ...state, rolling: false };
      const fiveKindIndex = CATEGORIES.findIndex((category) => category.id === "fiveKind");
      if (hasFiveKind(state.dice) && player.scores[fiveKindIndex] !== 0) {
        const chooseLower = !player.computer && player.scores[fiveKindIndex] === 50
          && player.scores[state.dice[0] - 1] !== null
          && playableCategoryIndices(player.scores, state.dice).some((index) => CATEGORIES[index].group === "lower");
        if (chooseLower) {
          return {
            ...settled,
            players: state.players.map((item, index) => index === state.currentPlayer ? { ...item, bonus: item.bonus + 100 } : item),
            rollsLeft: 0,
            jokerChoice: true,
            status: "Five of a kind bonus: +100 added! Choose an open lower category for your joker score.",
            celebration: { playerName: player.name, dice: [...state.dice], categoryLabel: null, score: 0, bonusPoints: 100 },
          };
        }
        const index = player.scores[fiveKindIndex] === null ? fiveKindIndex : chooseAiCategory(state.dice, player.scores);
        const category = CATEGORIES[index];
        const award = categoryAward(category.id, state.dice, player.scores);
        const scored = gameReducer(settled, { type: "score", index });
        return { ...scored, celebration: { playerName: player.name, dice: [...state.dice], categoryLabel: category.label, ...award } };
      }
      return { ...settled, status: state.phase === "computer" ? "Player 2 is choosing a score…" : state.rollsLeft === 0 ? "Choose a score on the card." : "Tap dice to hold them, then roll again or choose a score." };
    }
    case "hold":
      if (state.phase !== "playing" || state.rolling || state.rollsLeft === 0) return state;
      return { ...state, held: state.held.map((held, index) => index === action.index ? !held : held) };
    case "score": {
      if (state.rolling || !["playing", "computer"].includes(state.phase) || state.dice.length !== 5 || !playableCategoryIndices(player.scores, state.dice).includes(action.index)) return state;
      const category = CATEGORIES[action.index];
      const award = categoryAward(category.id, state.dice, player.scores);
      const players = state.players.map((item, index) => index === state.currentPlayer ? {
        ...item,
        scores: item.scores.map((score, categoryIndex) => categoryIndex === action.index ? award.score : score),
        bonus: item.bonus + (state.jokerChoice ? 0 : award.bonusPoints),
      } : item);
      const finished = players.every((item) => item.scores.every((score) => score !== null));
      const currentPlayer = finished ? state.currentPlayer : (state.currentPlayer + 1) % players.length;
      const next = players[currentPlayer];
      const needsHandoff = players.length > 1 && state.mode !== "computer";
      return {
        ...state,
        players,
        currentPlayer,
        phase: finished ? "finished" : next.computer ? "computer" : needsHandoff ? "handoff" : "ready",
        dice: [],
        held: Array(5).fill(false),
        rollsLeft: 3,
        rolling: false,
        jokerChoice: false,
        status: finished ? matchResult(players) : `${player.name} scored ${award.score} in ${category.label}.${award.bonusPoints ? " Five of a kind bonus: +100." : ""} ${next.computer ? "Player 2 is up next." : needsHandoff ? `Pass the device to ${next.name}.` : `${next.name}: roll to start your turn.`}`,
      };
    }
  }
}
