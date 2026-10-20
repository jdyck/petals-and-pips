const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function compile(file, imports = {}) {
  const context = { exports: {}, ...imports };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  return context.exports;
}

const game = compile("../app/lib/game.ts");
const key = "pips-and-petals-device-high-score";
const human = (bonus = 0) => ({ name: "Player 1", computer: false, scores: Array(13).fill(0), bonus });

function session(saved = null, blocked = false) {
  const values = new Map(saved === null ? [] : [[key, saved]]);
  let state = null;
  let effect;
  const { useDeviceHighScore } = compile("../app/components/use-device-high-score.ts", {
    window: { localStorage: {
      getItem: (key) => { if (blocked) throw new Error("Storage blocked"); return values.get(key) ?? null; },
      setItem: (key, value) => { if (blocked) throw new Error("Storage blocked"); values.set(key, value); },
    } },
    require: (id) => id === "../lib/game" ? game : {
      useState: () => [state, (update) => { state = typeof update === "function" ? update(state) : update; }],
      useEffect: (callback) => { effect = callback; },
    },
  });
  return {
    values,
    update(players, finished = false) { useDeviceHighScore(players, finished); effect(); return state; },
  };
}

test("loads a saved device high score without counting an unfinished game", () => {
  const record = session("312");
  assert.equal(record.update([human(500)]), 312);
  assert.equal(record.values.get(key), "312");
  assert.equal(session().update([human(500)]), null);
});

test("records the highest human total including both bonuses and excludes computers", () => {
  const player = human(100);
  player.scores.fill(10, 0, 6);
  player.scores[5] = 30;
  const record = session();
  assert.equal(record.update([player, human(200), { ...human(1000), computer: true }], true), 215);
  assert.equal(record.values.get(key), "215");
  assert.equal(session(record.values.get(key)).update([human()]), 215);
});

test("keeps a higher record across lower games and new games", () => {
  const record = session("400");
  assert.equal(record.update([human(300)], true), 400);
  assert.equal(record.update([human()]), 400);
  assert.equal(record.values.get(key), "400");
});

test("ignores incomplete scorecards and still records a completed zero score", () => {
  const record = session();
  assert.equal(record.update([{ ...human(500), scores: Array(13).fill(null) }], true), null);
  assert.equal(record.update([human()], true), 0);
  assert.equal(record.values.get(key), "0");
});

test("ignores invalid stored scores", () => {
  for (const value of ["", "-1", "NaN", "2.5", "Infinity", "9007199254740992"]) {
    assert.equal(session(value).update([human()]), null);
  }
});

test("storage failures preserve the record for this visit", () => {
  const record = session(null, true);
  assert.equal(record.update([human(300)], true), 300);
  assert.equal(record.update([human(100)], true), 300);
  assert.equal(record.update([human()]), 300);
});
