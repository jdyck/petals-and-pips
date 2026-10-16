const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../app/lib/game.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const { CATEGORIES, createGame, gameReducer, matchResult, playableCategoryIndices, totalScore, chooseAiCategory, rankScoreOptions, selectScoreSuggestions, aiTarget, aiHoldPlan } = context.exports;
const step = (state, action) => gameReducer(state, action);
const roll = (state, dice = [1, 2, 3, 4, 5]) => step(step(state, { type: state.phase === "computer" ? "computerRoll" : "roll", dice, held: Array(5).fill(false) }), { type: "settle" });

for (const count of [2, 3, 4]) {
  test(`${count} local players complete thirteen rounds in order`, () => {
    let state = createGame(`local${count}`);
    assert.equal(state.players.length, count);
    assert.ok(state.players.every((player) => !player.computer));
    assert.notEqual(state.players[0].scores, state.players[1].scores);
    for (let round = 0; round < 13; round++) {
      for (let player = 0; player < count; player++) {
        assert.equal(state.currentPlayer, player);
        assert.equal(state.phase, round === 0 && player === 0 ? "ready" : "handoff");
        if (state.phase === "handoff") {
          assert.equal(step(state, { type: "roll", dice: [1, 2, 3, 4, 5] }), state);
          assert.equal(step(state, { type: "score", index: round }), state);
          state = step(state, { type: "ready" });
        }
        state = roll(state);
        state = step(state, { type: "score", index: round });
        assert.equal(state.players[player].scores.filter((score) => score !== null).length, round + 1);
        assert.equal(state.dice.length, 0);
        assert.equal(state.rollsLeft, 3);
        assert.ok(state.held.every((held) => !held));
      }
    }
    assert.equal(state.phase, "finished");
    assert.ok(state.players.every((player) => player.scores.every((score) => score !== null)));
    assert.match(state.status, /tie/);
    assert.equal(step(state, { type: "ready" }), state);
    assert.equal(step(state, { type: "score", index: 0 }), state);
    assert.equal(step(state, { type: "roll", dice: [1, 2, 3, 4, 5] }), state);
  });
}

test("computer mode still alternates and completes", () => {
  let state = createGame("computer");
  assert.equal(state.players[1].name, "Player 2");
  assert.equal(state.players[1].computer, true);
  for (let round = 0; round < 13; round++) {
    state = step(roll(state), { type: "score", index: round });
    assert.equal(state.phase, "computer");
    state = roll(state);
    const index = chooseAiCategory(state.dice, state.players[1].scores);
    assert.ok(playableCategoryIndices(state.players[1].scores, state.dice).includes(index));
    state = step(state, { type: "score", index });
    assert.equal(state.phase, round === 12 ? "finished" : "ready");
  }
});

test("rolling and used categories cannot be scored; rolls stop at three", () => {
  let state = createGame("local4");
  assert.equal(step(state, { type: "score", index: 0 }), state);
  state = step(state, { type: "roll", dice: [1, 2, 3, 4, 5] });
  assert.equal(step(state, { type: "score", index: 0 }), state);
  assert.equal(step(state, { type: "hold", index: 0 }), state);
  state = step(state, { type: "settle" });
  state = step(state, { type: "hold", index: 0 });
  assert.equal(state.held[0], true);
  state = roll(roll(state));
  assert.equal(state.rollsLeft, 0);
  assert.equal(step(state, { type: "roll", dice: [1, 2, 3, 4, 5] }), state);
  state = step(state, { type: "score", index: 0 });
  assert.equal(step(state, { type: "score", index: 0 }), state);
});

const fiveKind = CATEGORIES.findIndex((category) => category.id === "fiveKind");
const dismiss = (state) => step(state, { type: "dismissCelebration" });

test("solo play completes thirteen turns without an opponent or handoff", () => {
  let state = createGame("solo");
  assert.equal(state.players.length, 1);
  assert.equal(state.players[0].computer, false);
  for (let index = 0; index < CATEGORIES.length; index++) {
    assert.equal(state.currentPlayer, 0);
    assert.equal(state.phase, "ready");
    state = roll(state);
    state = step(state, { type: "hold", index: 0 });
    state = step(state, { type: "score", index });
    assert.equal(state.players[0].scores.filter((score) => score !== null).length, index + 1);
    assert.equal(state.dice.length, 0);
    assert.equal(state.rollsLeft, 3);
    assert.ok(state.held.every((held) => !held));
    assert.doesNotMatch(state.status, /Pass|Player 2|computer/i);
  }
  assert.equal(state.phase, "finished");
  assert.equal(state.status, "You scored 100 points.");
  assert.equal(step(state, { type: "roll", dice: [1, 2, 3, 4, 5] }), state);
  assert.equal(step(state, { type: "score", index: 0 }), state);
  state = step(state, { type: "reset", mode: state.mode });
  assert.equal(state.mode, "solo");
  assert.equal(state.players.length, 1);
  assert.equal(state.phase, "ready");
  assert.ok(state.players[0].scores.every((score) => score === null));
});

test("a solo five of a kind resumes the same player's next turn after celebration", () => {
  let state = roll(createGame("solo"), [4, 4, 4, 4, 4]);
  assert.equal(state.players[0].scores[fiveKind], 50);
  assert.equal(state.currentPlayer, 0);
  assert.equal(state.phase, "ready");
  assert.equal(state.celebration.score, 50);
  assert.equal(step(state, { type: "roll", dice: [1, 2, 3, 4, 5] }), state);
  state = roll(dismiss(state));
  assert.equal(state.phase, "playing");
  assert.equal(state.rollsLeft, 2);
});

test("solo final score includes upper and repeat bonuses, and mode changes reset scores", () => {
  let state = createGame("solo");
  state.players[0].scores = [3, 6, 9, 12, 15, 18, 0, 0, 0, 0, 0, 50, null];
  state.players[0].bonus = 200;
  state = roll(state, [6, 6, 6, 6, 6]);
  assert.equal(state.jokerChoice, true);
  assert.equal(state.players[0].bonus, 300);
  state = step(dismiss(state), { type: "score", index: 12 });
  assert.equal(state.phase, "finished");
  assert.equal(state.status, "You scored 478 points.");
  state = step(state, { type: "reset", mode: "computer" });
  assert.equal(state.players.length, 2);
  assert.equal(state.players[1].computer, true);
  state = step(state, { type: "reset", mode: "solo" });
  assert.equal(state.players.length, 1);
  assert.equal(state.phase, "ready");
  assert.equal(state.players[0].bonus, 0);
  assert.ok(state.players[0].scores.every((score) => score === null));
});

for (const rollNumber of [1, 2, 3]) {
  test(`first five of a kind on roll ${rollNumber} scores automatically after settling`, () => {
    let state = createGame("local2");
    for (let n = 1; n < rollNumber; n++) state = roll(state);
    state = step(state, { type: "roll", dice: [4, 4, 4, 4, 4] });
    assert.equal(state.players[0].scores[fiveKind], null);
    assert.equal(state.celebration, null);
    state = step(state, { type: "settle" });
    assert.equal(state.players[0].scores[fiveKind], 50);
    assert.equal(state.players[0].scores[10], null);
    assert.equal(state.players[0].bonus, 0);
    assert.equal(state.currentPlayer, 1);
    assert.equal(state.phase, "handoff");
    assert.equal(state.dice.length, 0);
    assert.equal(state.rollsLeft, 3);
    assert.ok(state.held.every((held) => !held));
    assert.equal(state.celebration.playerName, "Player 1");
    assert.equal(state.celebration.categoryLabel, "Five of a kind");
    assert.equal(state.celebration.score, 50);
    assert.equal(state.celebration.bonusPoints, 0);
    assert.equal(Array.from(state.celebration.dice).join(","), "4,4,4,4,4");
    for (const action of [{ type: "settle" }, { type: "ready" }, { type: "score", index: 12 }, { type: "hold", index: 0 }, { type: "roll", dice: [1, 2, 3, 4, 5] }]) {
      assert.equal(step(state, action), state);
    }
    state = dismiss(state);
    assert.equal(state.celebration, null);
    assert.equal(state.players[0].scores[fiveKind], 50);
    state = step(state, { type: "ready" });
    assert.equal(state.phase, "ready");
  });
}

test("repeat five of a kind automatically scores the matching upper box for the current player", () => {
  let state = createGame("local4");
  state.players[0].scores[fiveKind] = 50;
  state = roll(state, [6, 6, 6, 6, 6]);
  assert.equal(state.players[0].scores[5], 30);
  assert.equal(state.players[0].scores[6], null);
  assert.equal(state.players[0].bonus, 100);
  assert.equal(state.players[1].bonus, 0);
  assert.equal(state.players[1].scores[5], null);
  assert.equal(totalScore(state.players[0].scores, state.players[0].bonus), 180);
  assert.equal(state.celebration.bonusPoints, 100);
  assert.equal(state.celebration.categoryLabel, "Sixes");
  assert.equal(state.currentPlayer, 1);
});

test("repeat bonuses accumulate across turns with the player choosing joker categories", () => {
  let state = roll(createGame("local2"), [6, 6, 6, 6, 6]);
  assert.equal(state.players[0].scores[fiveKind], 50);
  assert.equal(state.players[0].bonus, 0);

  const repeatCategories = [5, 8, 9, 10];
  const expectedScores = [30, 25, 30, 40];
  for (let repeat = 0; repeat < repeatCategories.length; repeat++) {
    state = step(dismiss(state), { type: "ready" });
    state = step(roll(state), { type: "score", index: repeat });
    state = step(state, { type: "ready" });
    state = roll(state, [6, 6, 6, 6, 6]);
    assert.equal(state.players[0].scores[fiveKind], 50);
    assert.equal(state.players[0].bonus, (repeat + 1) * 100);
    assert.equal(state.players[1].bonus, 0);
    assert.equal(state.celebration.bonusPoints, 100);
    assert.equal(step(state, { type: "settle" }), state);
    if (repeat > 0) {
      assert.equal(state.jokerChoice, true);
      assert.equal(state.players[0].scores[repeatCategories[repeat]], null);
      state = step(dismiss(state), { type: "score", index: repeatCategories[repeat] });
    }
    assert.equal(state.players[0].scores[repeatCategories[repeat]], expectedScores[repeat]);
    assert.equal(state.players[0].bonus, (repeat + 1) * 100);
    assert.equal(state.jokerChoice, false);
    assert.equal(step(state, { type: "score", index: repeatCategories[repeat] }), state);
  }
  assert.equal(totalScore(state.players[0].scores, state.players[0].bonus), 575);
});

for (const [category, score] of [[6, 30], [7, 30], [8, 25], [9, 30], [10, 40], [12, 30]]) {
  test(`a player can choose ${CATEGORIES[category].label} for a joker score without a second bonus`, () => {
    let state = createGame("computer");
    state.players[0].scores[fiveKind] = 50;
    state.players[0].scores[5] = 18;
    state = roll(state, [6, 6, 6, 6, 6]);
    assert.equal(state.currentPlayer, 0);
    assert.equal(state.phase, "playing");
    assert.equal(state.players[0].bonus, 100);
    assert.equal(state.players[0].scores[category], null);
    assert.equal(state.players[0].scores[5], 18);
    assert.equal(state.celebration.categoryLabel, null);
    assert.equal(step(state, { type: "score", index: category }), state);
    state = dismiss(state);
    assert.equal(state.jokerChoice, true);
    assert.equal(state.dice.join(","), "6,6,6,6,6");
    assert.equal(state.rollsLeft, 0);
    assert.equal(step(state, { type: "roll", dice: [1, 2, 3, 4, 5] }), state);
    assert.equal(step(state, { type: "hold", index: 0 }), state);
    assert.equal(step(state, { type: "settle" }), state);
    assert.equal(step(state, { type: "score", index: 0 }), state);
    assert.equal(step(state, { type: "score", index: 5 }), state);
    state = step(state, { type: "score", index: category });
    assert.equal(state.players[0].scores[category], score);
    assert.equal(state.players[0].bonus, 100);
    assert.equal(state.currentPlayer, 1);
    assert.equal(state.phase, "computer");
    assert.equal(state.jokerChoice, false);
    assert.equal(state.celebration, null);
    assert.equal(step(state, { type: "score", index: category }), state);
  });
}

test("reset clears a banked joker choice and its bonus", () => {
  let state = createGame("local2");
  state.players[0].scores[fiveKind] = 50;
  state.players[0].scores[5] = 18;
  state = roll(state, [6, 6, 6, 6, 6]);
  state = step(state, { type: "reset", mode: "computer" });
  assert.equal(state.jokerChoice, false);
  assert.equal(state.celebration, null);
  assert.equal(state.players[0].bonus, 0);
  assert.ok(state.players[0].scores.every((score) => score === null));
});

test("a scratched five of a kind remains manual and does not earn a bonus", () => {
  let state = createGame("local2");
  state.players[0].scores[fiveKind] = 0;
  state = roll(state, [6, 6, 6, 6, 6]);
  assert.equal(state.phase, "playing");
  assert.equal(state.celebration, null);
  assert.ok(playableCategoryIndices(state.players[0].scores, state.dice).includes(12));
  state = step(state, { type: "score", index: 12 });
  assert.equal(state.players[0].scores[12], 30);
  assert.equal(state.players[0].bonus, 0);
});

test("automatic bonus falls back to an upper box when all lower boxes and the matching upper box are filled", () => {
  let state = createGame("local2");
  state.players[0].scores = Array(13).fill(0);
  state.players[0].scores[fiveKind] = 50;
  state.players[0].scores[0] = null;
  state.players[0].scores[4] = null;
  state = roll(state, [6, 6, 6, 6, 6]);
  assert.equal(state.players[0].scores[0], 0);
  assert.equal(state.players[0].scores[4], null);
  assert.equal(state.players[0].bonus, 100);
  assert.equal(state.celebration.categoryLabel, "Ones");
});

test("celebration pauses the next computer turn and reset clears it", () => {
  let state = roll(createGame("computer"), [3, 3, 3, 3, 3]);
  assert.equal(state.phase, "computer");
  const action = { type: "computerRoll", dice: [1, 2, 3, 4, 5], held: Array(5).fill(false) };
  assert.equal(step(state, action), state);
  assert.equal(step(dismiss(state), action).rolling, true);
  state = step(state, { type: "reset", mode: "local4" });
  assert.equal(state.celebration, null);
  assert.ok(state.players.every((player) => player.scores[fiveKind] === null && player.bonus === 0));
});

test("the computer automatically scores its own five of a kind and repeat bonus", () => {
  for (const previousScore of [null, 50]) {
    let state = createGame("computer");
    state = step(roll(state), { type: "score", index: 12 });
    state.players[1].scores[fiveKind] = previousScore;
    state = roll(state, [2, 2, 2, 2, 2]);
    assert.equal(state.phase, "ready");
    assert.equal(state.currentPlayer, 0);
    assert.equal(state.players[1].scores[fiveKind], 50);
    assert.equal(state.players[1].bonus, previousScore === 50 ? 100 : 0);
    assert.equal(state.players[1].scores[1], previousScore === 50 ? 10 : null);
    assert.equal(state.players[0].scores[fiveKind], null);
    assert.equal(state.celebration.playerName, "Player 2");
    assert.equal(step(state, { type: "score", index: 12 }), state);
  }
});

test("the computer chooses a lower joker category when its matching upper box is filled", () => {
  let state = createGame("computer");
  state = step(roll(state), { type: "score", index: 12 });
  state.players[1].scores[fiveKind] = 50;
  state.players[1].scores[5] = 18;
  state = roll(state, [6, 6, 6, 6, 6]);
  assert.equal(state.players[1].scores[10], 40);
  assert.equal(state.players[1].bonus, 100);
  assert.equal(state.jokerChoice, false);
  assert.equal(state.phase, "ready");
  assert.equal(state.celebration.categoryLabel, "Large straight");
});

test("a final-turn repeat bonus is banked before choosing and included in the winner's total", () => {
  let state = createGame("computer");
  state.players.forEach((player) => { player.scores = Array(13).fill(0); });
  state.players[0].scores[fiveKind] = 50;
  state.players[0].scores[12] = null;
  state.players[0].bonus = 200;
  state = roll(state, [6, 6, 6, 6, 6]);
  assert.equal(state.phase, "playing");
  assert.equal(state.players[0].scores[12], null);
  assert.equal(state.players[0].bonus, 300);
  assert.equal(state.celebration.bonusPoints, 100);
  state = step(dismiss(state), { type: "score", index: 12 });
  assert.equal(state.phase, "finished");
  assert.equal(state.players[0].scores[12], 30);
  assert.equal(state.players[0].bonus, 300);
  assert.equal(state.status, "Player 1 wins with 380 points.");
  assert.equal(state.celebration, null);
  state = dismiss(state);
  assert.equal(state.phase, "finished");
  assert.equal(state.status, "Player 1 wins with 380 points.");
});

test("results include every winner and upper bonuses; mode changes reset all cards", () => {
  let state = createGame("local4");
  state.players[2].scores = [3, 6, 9, 12, 15, 18, 0, 0, 0, 0, 0, 0, 0];
  assert.equal(totalScore(state.players[2].scores), 98);
  assert.equal(matchResult(state.players), "Player 3 wins with 98 points.");
  state.players[3].scores = [...state.players[2].scores];
  assert.equal(matchResult(state.players), "Player 3 and Player 4 tie with 98 points.");
  state = step(state, { type: "reset", mode: "computer" });
  assert.equal(state.players.length, 2);
  assert.equal(state.currentPlayer, 0);
  assert.equal(state.phase, "ready");
  assert.ok(state.players.every((player) => player.scores.every((score) => score === null) && player.bonus === 0));
});


test("suggestions and computer scoring favor three or four matching top-section dice over sum categories", () => {
  for (let face = 1; face <= 6; face++) {
    for (const count of [3, 4]) {
      const card = Array(13).fill(null);
      const dice = [...Array(count).fill(face), face % 6 + 1];
      if (count === 3) dice.push((face + 1) % 6 + 1);
      const options = rankScoreOptions(dice, card);
      assert.equal(options[0].index, face - 1);
      assert.equal(options[0].points, count * face);
      assert.equal(chooseAiCategory(dice, card), face - 1);
      assert.equal(aiTarget(dice, card), CATEGORIES[face - 1].id);
      for (const id of ["threeKind", "fourKind", "chance"]) {
        assert.ok(options.findIndex((option) => option.category.id === id) > 0);
      }
    }
  }
});

test("a full house outranks a top-section triple and the computer keeps all five dice", () => {
  for (let face = 1; face <= 6; face++) {
    const dice = [face, face, face, face % 6 + 1, face % 6 + 1];
    const card = Array(13).fill(null);
    assert.equal(rankScoreOptions(dice, card)[0].category.id, "fullHouse");
    assert.equal(chooseAiCategory(dice, card), 8);
    assert.equal(aiTarget(dice, card), "fullHouse");
    assert.ok(aiHoldPlan(dice, "fullHouse").every(Boolean));
    card[8] = 25;
    assert.equal(chooseAiCategory(dice, card), face - 1);
  }
});

test("four higher dice recover an earlier top-section shortfall and secure the bonus", () => {
  const card = [1, 6, 9, 12, 15, null, null, null, null, null, null, null, null];
  const dice = [6, 6, 6, 6, 2];
  assert.equal(chooseAiCategory(dice, card), 5);
  assert.equal(rankScoreOptions(dice, card)[0].category.id, "sixes");
  assert.equal(aiTarget(dice, card), "sixes");
  const threeSixes = [...card];
  threeSixes[5] = 18;
  const fourSixes = [...card];
  fourSixes[5] = 24;
  assert.equal(totalScore(threeSixes), 61);
  assert.equal(totalScore(fourSixes), 102);
});

test("earlier extra matches can make two dice enough to finish the bonus", () => {
  const card = [3, 6, 9, 16, 20, null, null, null, null, null, null, null, null];
  assert.equal(chooseAiCategory([6, 6, 4, 3, 2], card), 5);
});

test("bonus chasing ends when it is already earned or cannot be reached", () => {
  const earned = [null, 10, 15, 20, 0, 18, null, null, null, null, null, null, null];
  assert.equal(chooseAiCategory([1, 1, 1, 6, 5], earned), 6);
  const impossible = [0, 0, 0, 0, 0, null, null, null, null, null, null, null, null];
  assert.equal(chooseAiCategory([6, 6, 6, 6, 1], impossible), 6);
});

test("recommendations exclude used or joker-locked boxes and do not mutate dice or scores", () => {
  const card = Array(13).fill(null);
  card[11] = 50;
  card[5] = 18;
  const dice = [6, 6, 6, 6, 6];
  const beforeCard = [...card];
  const beforeDice = [...dice];
  const legal = playableCategoryIndices(card, dice);
  const options = rankScoreOptions(dice, card);
  assert.equal(options.length, legal.length);
  assert.ok(options.every((option) => legal.includes(option.index)));
  assert.equal(options[0].category.id, "largeStraight");
  assert.deepEqual(card, beforeCard);
  assert.deepEqual(dice, beforeDice);
  assert.equal(rankScoreOptions([], card).length, 0);
  assert.equal(rankScoreOptions(dice, Array(13).fill(0)).length, 0);
});


test("Chance occupies the third suggestion slot behind two strategic options", () => {
  const options = rankScoreOptions([4, 4, 4, 2, 6], Array(13).fill(null));
  const suggestions = selectScoreSuggestions(options);
  assert.equal(suggestions[0].category.id, "fours");
  assert.equal(suggestions[1].category.id, "threeKind");
  assert.equal(suggestions[2].category.id, "chance");
});

test("Chance stays third when only one of the other suggestions scores zero", () => {
  const card = Array(13).fill(0);
  for (const index of [3, 8, 12]) card[index] = null;
  const suggestions = selectScoreSuggestions(rankScoreOptions([4, 4, 4, 2, 6], card));
  assert.equal(suggestions[0].category.id, "fours");
  assert.equal(suggestions[1].points, 0);
  assert.equal(suggestions[2].category.id, "chance");
});

test("Chance is first when both other suggestions are zero", () => {
  const card = Array(13).fill(0);
  for (const index of [7, 8, 12]) card[index] = null;
  const suggestions = selectScoreSuggestions(rankScoreOptions([1, 2, 3, 4, 6], card));
  assert.equal(suggestions[0].category.id, "chance");
  assert.equal(suggestions[1].points, 0);
  assert.equal(suggestions[2].points, 0);
});

test("Chance keeps its third slot when only one other positive category remains", () => {
  const card = Array(13).fill(0);
  card[3] = card[12] = null;
  const suggestions = selectScoreSuggestions(rankScoreOptions([4, 4, 4, 2, 6], card));
  assert.equal(suggestions[0].category.id, "fours");
  assert.equal(suggestions[1], undefined);
  assert.equal(suggestions[2].category.id, "chance");
});

test("Chance is the first option when it is the only available category", () => {
  const card = Array(13).fill(0);
  card[12] = null;
  const suggestions = selectScoreSuggestions(rankScoreOptions([1, 2, 3, 4, 6], card));
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].category.id, "chance");
});

test("used or unavailable Chance does not appear in the suggestions", () => {
  const card = Array(13).fill(null);
  card[12] = 20;
  const options = rankScoreOptions([4, 4, 4, 2, 6], card);
  const suggestions = selectScoreSuggestions(options);
  assert.equal(suggestions.length, 3);
  assert.ok(suggestions.every((option) => option.category.id !== "chance"));
  assert.deepEqual(suggestions, options.slice(0, 3));
  assert.equal(selectScoreSuggestions([]).length, 0);
});
