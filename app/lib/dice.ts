import type { DiceShading } from "./dice-shading";

export const ROLL_DURATION = 1250;
export const DIE_RADIUS = 0.13;
export const DIE_COLOR = "#fff9f0";
export const DIE_LIGHT_ANGLE = -48;

// Preview adjustments relative to the game's current ivory material.
export function diceWhiteBalance(temperature: number, tint = 0) {
  const warmth = Math.max(-100, Math.min(100, temperature)) / 100;
  const tintAmount = Math.max(-100, Math.min(100, tint)) / 100;
  const base = [255, 249, 240];
  const target = warmth < 0 ? [199, 224, 255] : [255, 218, 176];
  return "#" + base.map((channel, index) => {
    const balanced = channel + (target[index] - channel) * Math.abs(warmth);
    const tintScale = tintAmount > 0
      ? (index === 1 ? 1 - tintAmount * 0.2 : 1)
      : (index !== 1 ? 1 + tintAmount * 0.15 : 1);
    return Math.round(balanced * tintScale).toString(16).padStart(2, "0");
  }).join("");
}
export const PIP_COLOR = "#111111";
export const PIP_RADIUS = 0.081;
export const DIE_UV_SCALE = 1 - 2 * DIE_RADIUS + Math.PI * DIE_RADIUS / 2;
export const HALF_PI = Math.PI / 2;
// Fill more of the tray while retaining overscan for the airborne roll.
export const DIE_CAMERA_ZOOM = 1.8;
// Match the canvas overscan in globals.css without increasing backing resolution.
export const DIE_CANVAS_SCALE = 1.2;

// Edit these angles to adjust every dice renderer. Values are in degrees.
// Tilt: 0 looks straight down; larger values show more of the side faces.
export const DIE_TILT_DEGREES = 18.5;
// Sideways: 0 keeps the dice square; negative values turn the other way.
export const DIE_SIDEWAYS_DEGREES = 10;
// Individual turns for the five dice, from left to right.
export const DIE_TURN_DEGREES = [-10, -5, 0, 5, 10];

const viewDistance = 7.492;
export function dieCameraPosition(turnDegrees = DIE_SIDEWAYS_DEGREES, tiltDegrees = DIE_TILT_DEGREES): [number, number, number] {
  const viewTilt = tiltDegrees * Math.PI / 180;
  const sideways = turnDegrees * Math.PI / 180;
  return [
    Math.sin(sideways) * Math.sin(viewTilt) * viewDistance,
    0.3 + Math.cos(viewTilt) * viewDistance,
    Math.cos(sideways) * Math.sin(viewTilt) * viewDistance,
  ];
}

export const PIPS: Record<number, number[]> = {
  1: [4], 2: [2, 6], 3: [2, 4, 6],
  4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

// Right, left, top, bottom, front, back. Opposite faces sum to seven.
export const DIE_FACES = [3, 4, 2, 5, 1, 6];
export const FACE_ROTATIONS = [
  [0, HALF_PI], [0, -HALF_PI], [-HALF_PI, 0],
  [HALF_PI, 0], [0, 0], [0, Math.PI],
];
export const LANDING_POSES: Record<number, [number, number]> = {
  1: [-HALF_PI, 0], 2: [0, 0], 3: [-HALF_PI, -HALF_PI],
  4: [-HALF_PI, HALF_PI], 5: [Math.PI, 0], 6: [-HALF_PI, Math.PI],
};

export type DieState = { value: number; rolling: boolean; rollId: number; index: number; lightAngle: number; turnDegrees?: number; tiltDegrees?: number; dieColor?: string; brightness?: number; shading?: DiceShading; unrolled?: boolean };
export type DiePose = { rotation: [number, number, number]; position: [number, number, number]; light: [number, number, number]; progress: number; turnDegrees: number; tiltDegrees?: number; dieColor: string; brightness: number; shading?: DiceShading; unrolled?: boolean };
export type DiceRenderer = {
  element: HTMLElement;
  kind: "full" | "compatible" | "css";
  resize: (width: number, height: number) => void;
  render: (pose: DiePose) => void;
  dispose: () => void;
};
export type DiceQuality = "auto" | "full" | "compatible";

export function prefersCompatibleDice(userAgent: string) {
  const iosVersion = /(?:iPad|iPhone|iPod).*OS (\d+)[_.]/.exec(userAgent);
  if (iosVersion) return Number(iosVersion[1]) < 16;
  // iPads requesting desktop websites identify as Macintosh / Safari.
  const safariVersion = /Version\/(\d+)[.\d]*.*Safari\//.exec(userAgent);
  return safariVersion !== null && Number(safariVersion[1]) < 16;
}

export function bounce(t: number) {
  const hops = [[0, 0.39, 0.85], [0.39, 0.67, 0.32], [0.67, 0.88, 0.08]];
  for (const [start, end, height] of hops) {
    if (t >= start && t <= end) {
      const u = (t - start) / (end - start);
      return 4 * height * u * (1 - u);
    }
  }
  return 0;
}

export function diePose(state: DieState, elapsed: number, reducedMotion: boolean): DiePose {
  const t = state.rolling && !reducedMotion ? Math.max(0, Math.min(1, (elapsed - state.index * 28) / 1100)) : 1;
  const [landX, landY] = LANDING_POSES[state.value];
  const spin = (1 - t) ** 2.1;
  const rock = t > 0.7 ? Math.sin((t - 0.7) / 0.3 * Math.PI * 3) * (1 - t) * 0.35 : 0;
  // Fewer turns keep the tumble readable at the game's capped frame rate.
  const x = landX + spin * Math.PI * (state.index % 2 ? -2 : 2) + rock;
  const y = landY + spin * Math.PI * (state.index % 2 ? 1.5 : -1.5);
  // The Y row of an XYZ rotation matrix, with Z=0, gives the support height.
  const support = (0.5 - DIE_RADIUS) * (Math.abs(Math.sin(x) * Math.sin(y)) + Math.abs(Math.cos(x)) + Math.abs(Math.sin(x) * Math.cos(y))) + DIE_RADIUS;
  const angle = state.lightAngle * Math.PI / 180;
  return {
    rotation: [x, y, 0],
    position: [Math.sin(t * Math.PI * 2) * (1 - t) * 0.16, support - 0.5 + (t < 1 ? bounce(t) : 0), 0],
    light: [Math.sin(angle) * 4, 6, Math.cos(angle) * 2.8],
    progress: t,
    turnDegrees: state.turnDegrees ?? DIE_SIDEWAYS_DEGREES,
    tiltDegrees: state.tiltDegrees ?? DIE_TILT_DEGREES,
    dieColor: state.dieColor ?? DIE_COLOR,
    brightness: state.brightness ?? 1,
    shading: state.shading,
    unrolled: state.unrolled,
  };
}

export function pipMask(face: number, size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas textures are unavailable.");
  context.fillStyle = "white";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "black";
  for (const pip of PIPS[face]) {
    context.beginPath();
    context.arc((0.25 + (pip % 3) * 0.25) * size,
      (0.25 + Math.floor(pip / 3) * 0.25) * size,
      PIP_RADIUS / DIE_UV_SCALE * size, 0, Math.PI * 2);
    context.fill();
  }
  return canvas;
}
