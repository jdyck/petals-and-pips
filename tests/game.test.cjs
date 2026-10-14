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
const { CATEGORIES, createGame, gameReducer, matchResult, playableCategoryIndices, totalScore, chooseAiCategory } = context.exports;
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

test("repeat five of a kind bonus and joker locks belong to the current player", () => {
  let state = createGame("local4");
  const fiveKind = CATEGORIES.findIndex((category) => category.id === "fiveKind");
  state.players[0].scores[fiveKind] = 50;
  state = roll(state, [6, 6, 6, 6, 6]);
  assert.equal(step(state, { type: "score", index: 6 }), state);
  state = step(state, { type: "score", index: 5 });
  assert.equal(state.players[0].scores[5], 30);
  assert.equal(state.players[0].bonus, 100);
  assert.equal(state.players[1].bonus, 0);
  assert.equal(state.players[1].scores[5], null);
  assert.equal(totalScore(state.players[0].scores, state.players[0].bonus), 180);
});

test("a player can collect multiple five of a kind bonuses across turns", () => {
  let state = createGame("local2");
  const fiveKind = CATEGORIES.findIndex((category) => category.id === "fiveKind");
  state = step(roll(state, [6, 6, 6, 6, 6]), { type: "score", index: fiveKind });
  assert.equal(state.players[0].scores[fiveKind], 50);
  assert.equal(state.players[0].bonus, 0);

  const repeatCategories = [5, 8, 9, 10];
  const expectedScores = [30, 25, 30, 40];
  for (let repeat = 0; repeat < repeatCategories.length; repeat++) {
    state = step(state, { type: "ready" });
    state = step(roll(state), { type: "score", index: repeat });
    state = step(state, { type: "ready" });
    state = roll(state, [6, 6, 6, 6, 6]);
    assert.match(state.status, /collect \+100 bonus points/);
    assert.equal(state.players[0].bonus, repeat * 100);
    state = step(state, { type: "score", index: repeatCategories[repeat] });
    assert.equal(state.players[0].scores[repeatCategories[repeat]], expectedScores[repeat]);
    assert.equal(state.players[0].scores[fiveKind], 50);
    assert.equal(state.players[0].bonus, (repeat + 1) * 100);
    assert.equal(state.players[1].bonus, 0);
    assert.equal(step(state, { type: "score", index: repeatCategories[repeat] }), state);
  }
  assert.equal(totalScore(state.players[0].scores, state.players[0].bonus), 575);
});

test("five of a kind bonuses require a previous score of 50", () => {
  const fiveKind = CATEGORIES.findIndex((category) => category.id === "fiveKind");
  for (const previousScore of [null, 0]) {
    let state = createGame("local2");
    state.players[0].scores[fiveKind] = previousScore;
    state = roll(state, [6, 6, 6, 6, 6]);
    assert.ok(playableCategoryIndices(state.players[0].scores, state.dice).includes(12));
    state = step(state, { type: "score", index: 12 });
    assert.equal(state.players[0].scores[12], 30);
    assert.equal(state.players[0].bonus, 0);
  }
});

test("rerolling a qualifying five of a kind does not bank a bonus", () => {
  let state = createGame("local2");
  const fiveKind = CATEGORIES.findIndex((category) => category.id === "fiveKind");
  state.players[0].scores[fiveKind] = 50;
  state = roll(state, [6, 6, 6, 6, 6]);
  assert.match(state.status, /Score in Sixes/);
  assert.equal(state.players[0].bonus, 0);
  state = roll(state, [1, 2, 3, 4, 5]);
  state = step(state, { type: "score", index: 10 });
  assert.equal(state.players[0].scores[10], 40);
  assert.equal(state.players[0].bonus, 0);
});

test("a final-turn repeat bonus is included in the winner's total", () => {
  let state = createGame("computer");
  const fiveKind = CATEGORIES.findIndex((category) => category.id === "fiveKind");
  state.players.forEach((player) => { player.scores = Array(13).fill(0); });
  state.players[0].scores[fiveKind] = 50;
  state.players[0].scores[12] = null;
  state.players[0].bonus = 200;
  state = roll(state, [6, 6, 6, 6, 6]);
  assert.equal(chooseAiCategory(state.dice, state.players[0].scores), 12);
  state = step(state, { type: "score", index: 12 });
  assert.equal(state.phase, "finished");
  assert.equal(state.players[0].bonus, 300);
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
