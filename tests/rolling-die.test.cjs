const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function simulateRoll({ fpsLimit = 0, reducedMotion = false, frameTimes, unrolled = false, rolling = true, visibilityChanges = new Map() } = {}) {
  const effects = [];
  const draws = [];
  const readiness = [];
  const pending = new Map();
  let now = 0;
  let frameId = 0;
  const listeners = new Map();
  const document = {
    hidden: false,
    addEventListener: (type, callback) => listeners.set(type, callback),
    removeEventListener: (type) => listeners.delete(type),
  };
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
    exports: {}, require: (id) => imports[id], document,
    performance: { now: () => now }, navigator: { userAgent: "test" },
    window: { matchMedia: () => ({ matches: reducedMotion, addEventListener() {}, removeEventListener() {} }) },
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: (callback) => { pending.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: (id) => pending.delete(id),
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, "../app/components/rolling-die.tsx"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, context);
  const element = context.exports.RollingDie({ value: 6, rolling, rollId: 1, fpsLimit, unrolled, onReadyChange: (ready) => readiness.push({ ready, drawCount: draws.length }) });
  element.props.ref.current = host;
  const cleanups = effects.map((effect) => effect());
  const initialDraws = [...draws];
  // Exclude initialization draws from the animation's frame count.
  draws.length = 0;
  const times = frameTimes ?? Array.from({ length: 160 }, (_, i) => (i + 1) * 1000 / 120);
  for (const time of times) {
    now = time;
    if (visibilityChanges.has(time)) {
      document.hidden = visibilityChanges.get(time);
      listeners.get("visibilitychange")?.();
    }
    const callbacks = [...pending.values()];
    pending.clear();
    callbacks.forEach((callback) => callback(now));
  }
  const remainingFrames = pending.size;
  cleanups.forEach((cleanup) => cleanup?.());
  assert.equal(pending.size, 0, "Unmount cancels scheduled frames");
  assert.equal(listeners.size, 0, "Unmount removes visibility listeners");
  return { draws, remainingFrames, initialDraws, readiness };
}

test("unrolled dice warm pips before reporting ready and clear readiness on release", () => {
  const { initialDraws, readiness } = simulateRoll({ unrolled: true, rolling: false, frameTimes: [] });
  assert.equal(initialDraws[0].pose.unrolled, false, "Pips and shell shader are rendered during warmup");
  assert.equal(initialDraws.at(-1).pose.unrolled, true, "Warmup restores the blank starting die");
  assert.deepEqual(readiness, [{ ready: true, drawCount: initialDraws.length }, { ready: false, drawCount: 0 }]);
});

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

test("background tabs stop drawing and resume at the elapsed roll position", () => {
  const { draws, remainingFrames } = simulateRoll({
    fpsLimit: 30,
    frameTimes: [50, 100, 200, 600, 900, 1200],
    visibilityChanges: new Map([[100, true], [900, false]]),
  });
  assert.deepEqual(draws.map((draw) => draw.time), [50, 900, 1200]);
  assert.ok(Math.abs(draws[1].pose.progress - 900 / 1100) < 1e-10);
  assert.equal(draws.at(-1).pose.progress, 1);
  assert.equal(remainingFrames, 0);
});

test("a roll that finishes while hidden resumes on its landing and stays idle", () => {
  const { draws, remainingFrames } = simulateRoll({
    frameTimes: [50, 100, 2000, 2100],
    visibilityChanges: new Map([[100, true], [2000, false]]),
  });
  assert.deepEqual(draws.map((draw) => draw.time), [50, 2000]);
  assert.equal(draws.at(-1).pose.progress, 1);
  assert.equal(remainingFrames, 0);
});
