"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export const ROLL_DURATION = 1250;

const PIPS: Record<number, number[]> = {
  1: [4], 2: [2, 6], 3: [2, 4, 6],
  4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
const HALF_PI = Math.PI / 2;
// The rolled value faces upward, toward the overhead camera.
const POSES: Record<number, [number, number]> = {
  1: [-HALF_PI, 0], 2: [0, 0], 3: [-HALF_PI, -HALF_PI],
  4: [-HALF_PI, HALF_PI], 5: [Math.PI, 0], 6: [-HALF_PI, Math.PI],
};
// Three.js box material order: right, left, top, bottom, front, back.
const FACES = [3, 4, 2, 5, 1, 6];
const FACE_ROTATIONS = [
  [0, HALF_PI], [0, -HALF_PI], [-HALF_PI, 0],
  [HALF_PI, 0], [0, 0], [0, Math.PI],
];
const RADIUS = 0.13;
// RoundedBoxGeometry allocates part of its UV space to the rounded edge.
const UV_SCALE = 1 - 2 * RADIUS + Math.PI * RADIUS / 2;
const PIP_RADIUS = 0.072;

function makeDie() {
  const model = new THREE.Group();
  const geometry = new RoundedBoxGeometry(1, 1, 1, 8, RADIUS);
  const masks: THREE.CanvasTexture[] = [];
  const materials = FACES.map((face) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "white";
    context.fillRect(0, 0, 512, 512);
    context.fillStyle = "black";
    for (const pip of PIPS[face]) {
      context.beginPath();
      context.arc((0.25 + (pip % 3) * 0.25) * 512,
        (0.25 + Math.floor(pip / 3) * 0.25) * 512,
        PIP_RADIUS / UV_SCALE * 512, 0, Math.PI * 2);
      context.fill();
    }
    const mask = new THREE.CanvasTexture(canvas);
    mask.anisotropy = 4;
    masks.push(mask);
    return new THREE.MeshPhysicalMaterial({
      color: "#ffffff", roughness: 0.32, metalness: 0,
      clearcoat: 0.35, clearcoatRoughness: 0.24,
      alphaMap: mask, alphaTest: 0.5,
    });
  });
  const body = new THREE.Mesh(geometry, materials);
  body.castShadow = true;
  body.receiveShadow = true;
  model.add(body);

  // Openings in the shell reveal actual concave pip meshes below the surface.
  const profile = Array.from({ length: 13 }, (_, step) => {
    const radius = (PIP_RADIUS + 0.001) * step / 12;
    return new THREE.Vector2(radius, -0.035 * (1 - (step / 12) ** 2));
  });
  const pipGeometry = new THREE.LatheGeometry(profile, 40);
  pipGeometry.rotateX(HALF_PI);
  const pipMaterial = new THREE.MeshStandardMaterial({
    color: "#202020", roughness: 0.52, metalness: 0, side: THREE.DoubleSide,
  });
  FACES.forEach((face, faceIndex) => {
    const faceGroup = new THREE.Group();
    faceGroup.rotation.set(FACE_ROTATIONS[faceIndex][0], FACE_ROTATIONS[faceIndex][1], 0);
    PIPS[face].forEach((pip) => {
      const pocket = new THREE.Mesh(pipGeometry, pipMaterial);
      pocket.position.set(((pip % 3) - 1) * 0.25 * UV_SCALE,
        (1 - Math.floor(pip / 3)) * 0.25 * UV_SCALE, 0.5005);
      pocket.castShadow = true;
      pocket.receiveShadow = true;
      faceGroup.add(pocket);
    });
    model.add(faceGroup);
  });
  return {
    model,
    dispose() {
      geometry.dispose();
      pipGeometry.dispose();
      pipMaterial.dispose();
      materials.forEach((material) => material.dispose());
      masks.forEach((mask) => mask.dispose());
    },
  };
}

function bounce(t: number) {
  const hops = [[0, 0.39, 0.85], [0.39, 0.67, 0.32], [0.67, 0.88, 0.08]];
  for (const [start, end, height] of hops) {
    if (t >= start && t <= end) {
      const u = (t - start) / (end - start);
      return 4 * height * u * (1 - u);
    }
  }
  return 0;
}

export function RollingDie({ value, rolling = false, rollId = 0, index = 0, lightAngle = -35 }: {
  value: number;
  rolling?: boolean;
  rollId?: number;
  index?: number;
  lightAngle?: number;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const current = useRef({ value, rolling, rollId, index, lightAngle });
  const update = useRef<(() => void) | null>(null);
  const [useFlatDice, setUseFlatDice] = useState(false);

  useEffect(() => {
    current.current = { value, rolling, rollId, index, lightAngle };
    update.current?.();
  }, [value, rolling, rollId, index, lightAngle]);

  useEffect(() => {
    const element = host.current!;
    // Touch devices use the same 3D dice. Fall back only if WebGL cannot initialize.
    setUseFlatDice(false);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setUseFlatDice(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    element.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
    camera.position.set(2.6, 6.2, 3.8);
    camera.lookAt(0, 0.3, 0);
    // Overscan leaves room for airborne corners and the shadow outside the button.
    camera.zoom = 1.72 / 1.6;
    camera.updateProjectionMatrix();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    // Scene environments use this intensity instead of material.envMapIntensity.
    // A dim reflection fill preserves bright, midtone, and shaded face values.
    scene.environmentIntensity = 0.06;
    room.dispose();
    pmrem.dispose();
    const die = makeDie();
    scene.add(die.model);
    const key = new THREE.DirectionalLight("#ffffff", 3.2);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.1, far: 15 });
    key.shadow.normalBias = 0.015;
    key.shadow.bias = -0.0002;
    key.shadow.radius = 4;
    scene.add(key);
    const fill = new THREE.DirectionalLight("#ffffff", 0.12);
    fill.position.set(4, 2, -3);
    scene.add(fill, new THREE.HemisphereLight("#ffffff", "#555555", 0.12));
    const floorGeometry = new THREE.PlaneGeometry(12, 12);
    const floorMaterial = new THREE.ShadowMaterial({ color: "#000000", opacity: 0.3 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -HALF_PI;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    scene.add(floor);

    let frame = 0;
    let started = 0;
    let activeRoll = -1;
    let wasRolling = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const matrix = new THREE.Matrix4();
    function render(now = performance.now()) {
      cancelAnimationFrame(frame);
      const state = current.current;
      if (state.rolling && (!wasRolling || activeRoll !== state.rollId)) {
        started = now;
        activeRoll = state.rollId;
      }
      wasRolling = state.rolling;
      const t = state.rolling && !reducedMotion.matches
        ? THREE.MathUtils.clamp((now - started - state.index * 28) / 1100, 0, 1) : 1;
      const [landX, landY] = POSES[state.value];
      // Angular momentum eases into a small rocking settle.
      const spin = (1 - t) ** 2.1;
      const rock = t > 0.7 ? Math.sin((t - 0.7) / 0.3 * Math.PI * 3) * (1 - t) * 0.35 : 0;
      die.model.rotation.set(landX + spin * Math.PI * (state.index % 2 ? -6 : 6) + rock,
        landY + spin * Math.PI * (state.index % 2 ? 4 : -4), 0);
      matrix.makeRotationFromEuler(die.model.rotation);
      const m = matrix.elements;
      // Raise the rotating model by its support height to keep it above the table.
      const support = (0.5 - RADIUS) * (Math.abs(m[1]) + Math.abs(m[5]) + Math.abs(m[9])) + RADIUS;
      die.model.position.set(Math.sin(t * Math.PI * 2) * (1 - t) * 0.16,
        support - 0.5 + (t < 1 ? bounce(t) : 0), 0);
      const angle = THREE.MathUtils.degToRad(state.lightAngle);
      key.position.set(Math.sin(angle) * 4, 6, Math.cos(angle) * 2.8);
      renderer.render(scene, camera);
      if (state.rolling && t < 1) frame = requestAnimationFrame(render);
    }
    update.current = () => render();
    const observer = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width * 2, height * 1.6, false);
      camera.aspect = (width * 2) / (height * 1.6);
      camera.updateProjectionMatrix();
      render();
    });
    observer.observe(element);
    const onMotionChange = () => render();
    reducedMotion.addEventListener("change", onMotionChange);
    // Render only when something changes or the die is moving.
    render();
    return () => {
      update.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      reducedMotion.removeEventListener("change", onMotionChange);
      die.dispose();
      floorGeometry.dispose();
      floorMaterial.dispose();
      environment.dispose();
      key.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return <span ref={host} className={`die-scene${useFlatDice ? " die-lightweight" : ""}${rolling ? " is-rolling" : ""}`} aria-hidden="true">
    {useFlatDice && <span className="die-webgl-fallback">{Array.from({ length: 9 }, (_, pip) => <i key={pip} className={PIPS[value].includes(pip) ? "pip-on" : ""} />)}</span>}
  </span>;
}
