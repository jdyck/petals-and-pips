const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const { test } = require("node:test");
const ts = require("typescript");
const three = import("three");

function load(name, imports = {}, extraExports = "") {
  const source = fs.readFileSync(path.join(__dirname, `../app/lib/${name}.ts`), "utf8");
  const compiled = ts.transpileModule(source + extraExports, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const context = { exports: {}, require: (id) => imports[id] };
  vm.runInNewContext(compiled, context);
  return context.exports;
}

const dice = load("dice");
const shading = load("dice-shading");
const pipGeometryHelpers = load("dice-pips", { "./dice": dice });
const { initializeDiceRenderer } = load("dice-renderer", {
  "./dice": dice, "./dice-full": {}, "./dice-compatible": {}, "./dice-css": {},
});
const currentSafari = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15";
const olderIPad = "Mozilla/5.0 (iPad; CPU OS 15_8 like Mac OS X) Version/15.6 Mobile/15E148 Safari/604.1";
const noInitialization = () => {};

test("pip contrast follows the chosen surface color, including saturated colors", () => {
  for (const color of ["#000000", "#111111", "#23395d", "#0000ff"]) {
    assert.equal(dice.dicePipColor(color), "#ffffff", color);
  }
  for (const color of ["#ffffff", "#fff9f0", "#ffff00", "#00ff00"]) {
    assert.equal(dice.dicePipColor(color), dice.PIP_COLOR, color);
  }
  const state = { value: 5, rolling: false, rollId: 0, index: 0, lightAngle: 0 };
  assert.equal(dice.diePose(state, 0, false).pipColor, dice.PIP_COLOR);
  assert.equal(dice.diePose({ ...state, shading: { ...shading.DEFAULT_DICE_SHADING, surfaceColor: "#23395d" } }, 0, false).pipColor, "#ffffff");
});

test("custom surface colors match in the shader and CSS and reset to white", () => {
  const controls = shading.createDiceShading();
  const shader = { uniforms: {}, fragmentShader: "#include <colorspace_fragment>" };
  controls.onBeforeCompile(shader);
  const style = { topWhite: 1, shadowDarkness: 0.14, shadowTint: "#224466", surfaceColor: "#224466" };
  controls.update(style);
  assert.equal(shading.diceSurfaceColor(style, 1, 0.5), "#224466");
  assert.equal(shading.diceSurfaceColor(style, 0, 1), "#1d3a58");
  assert.deepEqual(Array.from(shader.uniforms.diceSurfaceColor.value), [34 / 255, 68 / 255, 102 / 255]);
  controls.update(shading.DEFAULT_DICE_SHADING);
  assert.deepEqual(Array.from(shader.uniforms.diceSurfaceColor.value), [1, 1, 1]);
});

test("the private WebGL 1 engine coexists with modern Three.js in either import order", () => {
  for (const legacyFirst of [false, true]) {
    execFileSync(process.execPath, ["--input-type=module", "--eval", `
      import assert from "node:assert/strict";
      globalThis.window = {};
      const warnings = [];
      console.warn = (...args) => warnings.push(args.join(" "));
      const loadLegacy = async () => {
        const engine = await import("./app/lib/three-legacy/index.mjs");
        const { RoundedBoxGeometry } = await import("./app/lib/three-legacy/addons/RoundedBoxGeometry.mjs");
        const { RoomEnvironment } = await import("./app/lib/three-legacy/addons/RoomEnvironment.mjs");
        const geometry = new RoundedBoxGeometry();
        const room = new RoomEnvironment();
        assert.ok(geometry instanceof engine.BoxGeometry);
        assert.ok(room instanceof engine.Scene);
        geometry.dispose();
        room.dispose();
        return engine;
      };
      let legacy, modern;
      if (${legacyFirst}) {
        legacy = await loadLegacy();
        assert.equal(window.__THREE__, undefined);
        modern = await import("three");
      } else {
        modern = await import("three");
        legacy = await loadLegacy();
      }
      assert.notEqual(legacy.Scene, modern.Scene);
      assert.equal(window.__THREE__, modern.REVISION);
      assert.deepEqual(warnings, []);
    `], { cwd: path.join(__dirname, ".."), stdio: "pipe" });
  }
});

test("shadow controls leave the upward face white and change only shaded sides", () => {
  for (const shadowTint of ["#b8c5d6", "#ff8080", "#80ff80"]) {
    for (const shadowDarkness of [0, 0.45, 1]) {
      const style = { topWhite: 0.98, shadowDarkness, shadowTint };
      assert.equal(shading.diceSurfaceColor(style, 1, 0.5), "#fafafa");
      if (shadowDarkness === 1) assert.equal(shading.diceSurfaceColor(style, 0, 1), "#000000");
    }
  }
  const style = shading.DEFAULT_DICE_SHADING;
  const light = parseInt(shading.diceSurfaceColor({ ...style, shadowDarkness: 0.2 }, 0, 1).slice(1), 16);
  const dark = parseInt(shading.diceSurfaceColor({ ...style, shadowDarkness: 0.8 }, 0, 1).slice(1), 16);
  assert.ok(light > dark);
});

test("shadow shader uniforms update live and can return to ordinary game lighting", () => {
  const controls = shading.createDiceShading();
  const shader = { uniforms: {}, fragmentShader: "#include <colorspace_fragment>" };
  controls.onBeforeCompile(shader);
  assert.equal(shader.uniforms.diceStyled.value, false);
  controls.update({ topWhite: 0.97, shadowDarkness: 0.6, shadowTint: "#ff0000" });
  assert.equal(shader.uniforms.diceStyled.value, true);
  assert.equal(shader.uniforms.diceTopWhite.value, 0.97);
  assert.equal(shader.uniforms.diceShadowDarkness.value, 0.6);
  assert.deepEqual(Array.from(shader.uniforms.diceShadowTint.value), [1, 0, 0]);
  controls.update();
  assert.equal(shader.uniforms.diceStyled.value, false);
});

function factories(fail = []) {
  const calls = [];
  const renderers = {};
  for (const kind of ["full", "compatible", "css"]) {
    renderers[kind] = () => {
      calls.push(kind);
      if (fail.includes(kind)) throw new Error("Renderer unavailable");
      return { kind, element: { remove: () => calls.push(`remove:${kind}`) }, resize() {}, render() {}, dispose: () => calls.push(`dispose:${kind}`) };
    };
  }
  return { calls, renderers };
}

test("older iPads, including desktop-mode Safari, select compatible 3D", () => {
  for (const ua of [olderIPad, olderIPad.replace("OS 15_8", "OS 14_8"), "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Version/15.6 Safari/605.1.15"]) {
    const f = factories();
    assert.equal(initializeDiceRenderer("auto", ua, noInitialization, f.renderers).kind, "compatible");
    assert.deepEqual(f.calls, ["compatible"]);
  }
});

test("modern phones, tablets and desktop browsers retain original 3D", () => {
  for (const ua of [currentSafari, olderIPad.replace("OS 15_8", "OS 18_1").replace("Version/15.6", "Version/18.1"), "Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36"]) {
    const f = factories();
    assert.equal(initializeDiceRenderer("auto", ua, noInitialization, f.renderers).kind, "full");
    assert.deepEqual(f.calls, ["full"]);
  }
});

test("a failed WebGL 2 renderer falls back to WebGL 1, then CSS 3D", () => {
  const f = factories(["full"]);
  assert.equal(initializeDiceRenderer("auto", currentSafari, noInitialization, f.renderers).kind, "compatible");
  assert.deepEqual(f.calls, ["full", "compatible"]);
  const none = factories(["full", "compatible"]);
  assert.equal(initializeDiceRenderer("auto", currentSafari, noInitialization, none.renderers).kind, "css");
  assert.deepEqual(none.calls, ["full", "compatible", "css"]);
});

test("initial shader errors release the failed renderer before switching", () => {
  const f = factories();
  const renderer = initializeDiceRenderer("auto", currentSafari, (item) => {
    if (item.kind === "full") throw new Error("Shader compilation failed");
  }, f.renderers);
  assert.equal(renderer.kind, "compatible");
  assert.deepEqual(f.calls, ["full", "dispose:full", "remove:full", "compatible"]);
});

test("preview controls can compare both renderers on the same device", () => {
  assert.equal(initializeDiceRenderer("full", olderIPad, noInitialization, factories().renderers).kind, "full");
  assert.equal(initializeDiceRenderer("compatible", currentSafari, noInitialization, factories().renderers).kind, "compatible");
});

test("both 3D renderers land with the rolled face pointing upward", async () => {
  const THREE = await three;
  const normals = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (let value = 1; value <= 6; value++) {
    const pose = dice.diePose({ value, rolling: false, rollId: 1, index: 0, lightAngle: -35 }, 0, false);
    const normal = new THREE.Vector3(...normals[dice.DIE_FACES.indexOf(value)]);
    normal.applyEuler(new THREE.Euler(...pose.rotation));
    assert.ok(normal.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-10, `Face ${value} should face up`);
    assert.ok(Math.abs(pose.position[1]) < 1e-10);
    assert.equal(pose.progress, 1);
  }
});

test("individual dice turns preserve camera distance, elevation, and an upright view", async () => {
  const THREE = await three;
  const target = new THREE.Vector3(0, 0.3, 0);
  const initial = new THREE.Vector3(...dice.dieCameraPosition());
  for (const turnDegrees of dice.DIE_TURN_DEGREES) {
    const pose = dice.diePose({ value: 2, rolling: false, rollId: 1, index: 0, lightAngle: -35, turnDegrees }, 0, false);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(...dice.dieCameraPosition(pose.turnDegrees));
    camera.lookAt(target);
    assert.equal(pose.turnDegrees, turnDegrees);
    assert.ok(Math.abs(camera.position.distanceTo(target) - initial.distanceTo(target)) < 1e-10);
    assert.ok(Math.abs(camera.position.y - initial.y) < 1e-10);
    const screenRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    assert.ok(Math.abs(screenRight.y) < 1e-10, "Turning must not roll the rendered image");
  }
});

test("a near-overhead game view preserves camera distance and the default preview angle", async () => {
  const THREE = await three;
  const target = new THREE.Vector3(0, 0.3, 0);
  const initial = new THREE.Vector3(...dice.dieCameraPosition());
  const state = { value: 4, rolling: false, rollId: 0, index: 0, lightAngle: -48 };
  const overhead = dice.diePose({ ...state, tiltDegrees: 4, turnDegrees: 0 }, 0, false);
  const position = new THREE.Vector3(...dice.dieCameraPosition(overhead.turnDegrees, overhead.tiltDegrees));
  assert.ok(Math.abs(position.distanceTo(target) - initial.distanceTo(target)) < 1e-10);
  assert.ok(position.y > initial.y, "The game camera should look down from a higher angle");
  assert.equal(dice.diePose(state, 0, false).tiltDegrees, dice.DIE_TILT_DEGREES);
  assert.deepEqual(overhead.rotation, dice.diePose(state, 0, false).rotation);
});

test("roll motion keeps the rounded model above the table and respects reduced motion", async () => {
  const THREE = await three;
  const state = { value: 6, rolling: true, rollId: 1, index: 4, lightAngle: 60 };
  for (let elapsed = 0; elapsed <= dice.ROLL_DURATION; elapsed += 13) {
    const pose = dice.diePose(state, elapsed, false);
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...pose.rotation)).elements;
    const support = (0.5 - dice.DIE_RADIUS) * (Math.abs(m[1]) + Math.abs(m[5]) + Math.abs(m[9])) + dice.DIE_RADIUS;
    assert.ok(pose.position[1] - support >= -0.500000001);
  }
  const reduced = dice.diePose(state, 0, true);
  assert.equal(reduced.progress, 1);
  assert.ok(Math.abs(reduced.position[1]) < 1e-10);
});

test("indexed pip batches preserve every original triangle and normal in both engines", async () => {
  for (const [THREE, steps, segments] of [[await three, 12, 40], [await import("../app/lib/three-legacy/index.mjs"), 8, 24]]) {
    const profile = Array.from({ length: steps + 1 }, (_, step) => new THREE.Vector2(
      (dice.PIP_RADIUS + 0.001) * step / steps, -0.035 * (1 - (step / steps) ** 2),
    ));
    const source = new THREE.LatheGeometry(profile, segments);
    source.rotateX(dice.HALF_PI);
    const combined = pipGeometryHelpers.combinePipGeometry(source);
    const vertexCount = source.getAttribute("position").count;
    const indexCount = source.getIndex().count;
    assert.equal(combined.positions.length, vertexCount * 21 * 3);
    assert.equal(combined.indices.length, indexCount * 21);
    assert.ok(combined.positions.length < indexCount * 21 * 3 / 4, "Index reuse cuts attributes by over 75%");
    let pocket = 0;
    for (const [faceIndex, face] of dice.DIE_FACES.entries()) {
      const rotation = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...dice.FACE_ROTATIONS[faceIndex], 0));
      for (const pip of dice.PIPS[face]) {
        const transform = rotation.clone().multiply(new THREE.Matrix4().makeTranslation(
          ((pip % 3) - 1) * 0.25 * dice.DIE_UV_SCALE, (1 - Math.floor(pip / 3)) * 0.25 * dice.DIE_UV_SCALE, 0.5005,
        ));
        const original = source.clone().applyMatrix4(transform);
        for (const [name, actual] of [["position", combined.positions], ["normal", combined.normals]]) {
          const expected = original.getAttribute(name).array;
          const offset = pocket * expected.length;
          for (let i = 0; i < expected.length; i++) {
            assert.ok(Math.abs(actual[offset + i] - expected[i]) < 1e-6, `${name} differs on face ${face}`);
          }
        }
        for (let i = 0; i < indexCount; i++) {
          assert.equal(combined.indices[pocket * indexCount + i], pocket * vertexCount + source.getIndex().getX(i));
        }
        original.dispose();
        pocket++;
      }
    }
    source.dispose();
  }
});

test("the lighter model combines all recessed pips while retaining their geometry", async () => {
  const legacy = await import("../app/lib/three-legacy/index.mjs");
  const rounded = await import("../app/lib/three-legacy/addons/RoundedBoxGeometry.mjs");
  const { makeDie } = load("dice-compatible", {
    "./dice-shading": shading,
    "./dice-pips": pipGeometryHelpers,
    "./three-legacy/index.mjs": legacy,
    "./three-legacy/addons/RoundedBoxGeometry.mjs": rounded,
    "./three-legacy/addons/RoomEnvironment.mjs": {},
    "./dice": { ...dice, pipMask: () => ({ width: 256, height: 256 }) },
  }, "\nexport { makeDie };\n");
  const die = makeDie();
  assert.equal(die.model.children.length, 2, "Only the body and one combined pip mesh need drawing");
  const pockets = die.model.children[1].geometry;
  const positions = pockets.getAttribute("position");
  const normals = pockets.getAttribute("normal");
  assert.equal(positions.count, 21 * 25 * 9);
  assert.equal(pockets.getIndex().count, 21 * 24 * 8 * 6);
  const bytes = positions.array.byteLength + normals.array.byteLength + pockets.getIndex().array.byteLength;
  const previousBytes = 21 * 24 * 8 * 6 * 3 * 4 * 2;
  assert.ok(bytes < previousBytes * 0.28, "Indexed pip buffers use at least 72% less memory");
  assert.equal(normals.count, positions.count);
  pockets.computeBoundingBox();
  for (const axis of ["x", "y", "z"]) {
    assert.ok(Math.abs(pockets.boundingBox.max[axis] - 0.5005) < 1e-6);
    assert.ok(Math.abs(pockets.boundingBox.min[axis] + 0.5005) < 1e-6);
  }
  for (let i = 0; i < normals.count; i += 97) {
    assert.ok(Math.abs(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) - 1) < 1e-6);
  }
  die.dispose();
});

test("unrolled 3D dice hide pip holes and restore every pip on the first roll", async () => {
  const engines = [
    ["dice-full", {
      three: await three,
      "three/addons/geometries/RoundedBoxGeometry.js": await import("three/addons/geometries/RoundedBoxGeometry.js"),
      "three/addons/environments/RoomEnvironment.js": {},
    }],
    ["dice-compatible", {
      "./three-legacy/index.mjs": await import("../app/lib/three-legacy/index.mjs"),
      "./three-legacy/addons/RoundedBoxGeometry.mjs": await import("../app/lib/three-legacy/addons/RoundedBoxGeometry.mjs"),
      "./three-legacy/addons/RoomEnvironment.mjs": {},
    }],
  ];
  for (const [name, imports] of engines) {
    const { makeDie } = load(name, {
      ...imports,
      "./dice-shading": shading,
      "./dice-pips": pipGeometryHelpers,
      "./dice": { ...dice, pipMask: () => ({ width: 256, height: 256 }) },
    }, "\nexport { makeDie };\n");
    const die = makeDie();
    assert.equal(die.model.children.length, 2, `${name} batches all 21 pips in one mesh`);
    const body = die.model.children[0];
    const pips = die.model.children.slice(1);
    const pipMeshes = pips.flatMap((node) => node.isMesh ? [node] : node.children);
    die.setPipColor("#ffffff");
    assert.ok(pipMeshes.every((mesh) => mesh.material.color.getHexString() === "ffffff"));
    die.setPipColor(dice.PIP_COLOR);
    assert.ok(pipMeshes.every((mesh) => mesh.material.color.getHexString() === "111111"));
    const masks = body.material.map((material) => material.alphaMap);
    die.setUnrolled(true);
    assert.equal(body.visible, true);
    assert.ok(pips.every((mesh) => !mesh.visible));
    assert.ok(body.material.every((material) => material.alphaMap === null));
    const versions = body.material.map((material) => material.version);
    die.setUnrolled(true);
    body.material.forEach((material, index) => assert.equal(material.version, versions[index]));
    die.setUnrolled(false);
    assert.ok(pips.every((mesh) => mesh.visible));
    body.material.forEach((material, index) => assert.equal(material.alphaMap, masks[index]));
    die.dispose();
  }
});
