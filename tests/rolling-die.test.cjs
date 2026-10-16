const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function simulateRoll({ fpsLimit = 0, reducedMotion = false, frameTimes } = {}) {
  const effects = [];
  const draws = [];
  const pending = new Map();
  let now = 0;
  let frameId = 0;
  const host = {
    dataset: {}, appendChild() {},
    getBoundingClientRect: () => ({ width: 52, height: 82 }),
  };
  const renderer = {
    kind: "full",
    element: { addEventListener() {}, removeEventListener() {}, remove() {} },
    resize() {}, dispose() {},
    render: (pose) => draws.push({ time: now, pose }),
  };
  const diceContext = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../app/lib/dice.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, diceContext);
  const imports = {
    react: { useRef: (current) => ({ current }), useEffect: (effect) => effects.push(effect) },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "../lib/dice": diceContext.exports,
    "../lib/dice-renderer": { initializeDiceRenderer: (_quality, _ua, initialize) => { initialize(renderer); return renderer; } },
  };
  const context = {
    exports: {}, require: (id) => imports[id],
    performance: { now: () => now }, navigator: { userAgent: "test" },
    window: { matchMedia: () => ({ matches: reducedMotion, addEventListener() {}, removeEventListener() {} }) },
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: (callback) => { pending.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: (id) => pending.delete(id),
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../app/components/rolling-die.tsx"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context);
  const element = context.exports.RollingDie({ value: 6, rolling: true, rollId: 1, fpsLimit });
  element.props.ref.current = host;
  const cleanups = effects.map((effect) => effect());
  // Exclude initialization draws from the animation's frame count.
  draws.length = 0;
  const times = frameTimes ?? Array.from({ length: 160 }, (_, i) => (i + 1) * 1000 / 120);
  for (const time of times) {
    now = time;
    const callbacks = [...pending.values()];
    pending.clear();
    callbacks.forEach((callback) => callback(now));
  }
  const remainingFrames = pending.size;
  cleanups.forEach((cleanup) => cleanup?.());
  assert.equal(pending.size, 0, "Unmount cancels scheduled frames");
  return { draws, remainingFrames };
}

test("FPS limits reduce draws without changing roll duration or the landing", () => {
  for (const fpsLimit of [10, 14, 15, 16, 24, 30, 45, 60]) {
    const { draws, remainingFrames } = simulateRoll({ fpsLimit });
    assert.ok(Math.abs(draws.length - fpsLimit * 1.1) <= 2, `${fpsLimit} FPS produced ${draws.length} draws`);
    const landing = draws.at(-1);
    assert.ok(Math.abs(landing.time - 1100) < 9);
    assert.equal(landing.pose.progress, 1);
    assert.ok(Math.abs(landing.pose.position[1]) < 1e-10);
    assert.equal(remainingFrames, 0);
  }
});

test("game dice without a limit still render at the display refresh rate", () => {
  assert.equal(simulateRoll().draws.length, 132);
});

test("a stalled device skips missed frames and still renders the final pose", () => {
  const { draws, remainingFrames } = simulateRoll({ fpsLimit: 15, frameTimes: [8, 16, 250, 258, 500, 508, 1090, 1200] });
  assert.deepEqual(draws.map((draw) => draw.time), [250, 500, 1090, 1200]);
  assert.equal(draws.at(-1).pose.progress, 1);
  assert.equal(remainingFrames, 0);
});

test("FPS controls continue to respect reduced motion", () => {
  const { draws, remainingFrames } = simulateRoll({ fpsLimit: 30, reducedMotion: true });
  assert.equal(draws.length, 0);
  assert.equal(remainingFrames, 0);
});
