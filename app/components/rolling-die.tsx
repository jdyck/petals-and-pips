"use client";

import { useEffect, useRef } from "react";
import { diePose, DIE_SIDEWAYS_DEGREES, DIE_TILT_DEGREES, DIE_COLOR, DIE_LIGHT_ANGLE } from "../lib/dice";
import { initializeDiceRenderer } from "../lib/dice-renderer";
import type { DiceQuality, DiceRenderer } from "../lib/dice";
import type { DiceShading } from "../lib/dice-shading";

export { ROLL_DURATION } from "../lib/dice";

export function RollingDie({ value, rolling = false, rollId = 0, index = 0, lightAngle = DIE_LIGHT_ANGLE, turnDegrees = DIE_SIDEWAYS_DEGREES, tiltDegrees = DIE_TILT_DEGREES, quality = "auto", animateWithReducedMotion = false, fpsLimit = 0, dieColor = DIE_COLOR, brightness = 1, shading, unrolled = false }: {
  value: number;
  rolling?: boolean;
  rollId?: number;
  index?: number;
  lightAngle?: number;
  turnDegrees?: number;
  tiltDegrees?: number;
  quality?: DiceQuality;
  animateWithReducedMotion?: boolean;
  // Zero follows the display's refresh rate.
  fpsLimit?: number;
  dieColor?: string;
  brightness?: number;
  shading?: DiceShading;
  unrolled?: boolean;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const current = useRef({ value, rolling, rollId, index, lightAngle, turnDegrees, tiltDegrees, animateWithReducedMotion, fpsLimit, dieColor, brightness, shading, unrolled });
  const update = useRef<(() => void) | null>(null);

  useEffect(() => {
    current.current = { value, rolling, rollId, index, lightAngle, turnDegrees, tiltDegrees, animateWithReducedMotion, fpsLimit, dieColor, brightness, shading, unrolled };
    update.current?.();
  }, [value, rolling, rollId, index, lightAngle, turnDegrees, tiltDegrees, animateWithReducedMotion, fpsLimit, dieColor, brightness, shading, unrolled]);

  useEffect(() => {
    const element = host.current!;
    let renderer: DiceRenderer | null = null;
    let frame = 0;
    let started = performance.now();
    let activeRoll = -1;
    let wasRolling = false;
    let disposed = false;
    let nextRenderAt = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function render(now = performance.now(), force = true) {
      cancelAnimationFrame(frame);
      if (disposed || !renderer) return;
      const state = current.current;
      if (state.rolling && (!wasRolling || activeRoll !== state.rollId)) {
        started = now;
        activeRoll = state.rollId;
      }
      wasRolling = state.rolling;
      const pose = diePose(state, now - started, reducedMotion.matches && !state.animateWithReducedMotion);
      const interval = Number.isFinite(state.fpsLimit) && state.fpsLimit > 0 ? 1000 / state.fpsLimit : 0;
      // Skip drawing between capped frames, but always show updates and the landing.
      // Motion uses elapsed time so lowering FPS never slows the roll itself.
      if (force || !interval || now + 0.1 >= nextRenderAt || pose.progress === 1) {
        renderer.render(pose);
        nextRenderAt = force || !interval
          ? now + interval
          : nextRenderAt + interval * Math.max(1, Math.floor((now - nextRenderAt) / interval) + 1);
      }
      if (state.rolling && pose.progress < 1) frame = requestAnimationFrame((time) => render(time, false));
    }

    function resize() {
      if (!renderer) return;
      const { width, height } = element.getBoundingClientRect();
      if (!width || !height) return;
      renderer.resize(width, height);
      render();
    }

    function releaseRenderer() {
      if (!renderer) return;
      const previous = renderer;
      renderer = null;
      previous.element.removeEventListener("webglcontextlost", onContextLost);
      previous.dispose();
      previous.element.remove();
    }

    function initialize(preferred: DiceQuality | "css") {
      renderer = initializeDiceRenderer(preferred, navigator.userAgent, (next) => {
        const { width, height } = element.getBoundingClientRect();
        next.resize(width || 52, height || 82);
        const state = current.current;
        next.render(diePose(state, performance.now() - started, reducedMotion.matches && !state.animateWithReducedMotion));
      });
      element.dataset.renderer = renderer.kind;
      element.appendChild(renderer.element);
      renderer.element.addEventListener("webglcontextlost", onContextLost);
      render();
    }

    function onContextLost(event: Event) {
      event.preventDefault();
      if (disposed) return;
      const next = renderer?.kind === "full" ? "compatible" : "css";
      releaseRenderer();
      initialize(next);
    }

    const onMotionChange = () => render();
    update.current = onMotionChange;
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    reducedMotion.addEventListener("change", onMotionChange);
    initialize(quality);
    return () => {
      disposed = true;
      update.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      reducedMotion.removeEventListener("change", onMotionChange);
      releaseRenderer();
    };
  }, [quality]);

  return <span ref={host} className={`die-scene${rolling ? " is-rolling" : ""}${unrolled ? " is-unrolled" : ""}`} data-animate-with-reduced-motion={animateWithReducedMotion} aria-hidden="true">
    <span className="die-roll-placeholder">?</span>
    {unrolled && <span className="die-unrolled-mark">?</span>}
  </span>;
}
