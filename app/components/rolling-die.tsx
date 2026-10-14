import type { CSSProperties } from "react";

export const ROLL_DURATION = 1250;

const PIPS: Record<number, number[]> = {
  1: [4], 2: [2, 6], 3: [2, 4, 6],
  4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

// Opposite faces add up to seven. Rotate the result toward the viewer.
const POSES: Record<number, [number, number]> = {
  1: [0, 0], 2: [-90, 0], 3: [0, -90],
  4: [0, 90], 5: [90, 0], 6: [0, 180],
};

export function RollingDie({ value, rolling = false, rollId = 0, index = 0 }: {
  value: number;
  rolling?: boolean;
  rollId?: number;
  index?: number;
}) {
  const [x, y] = POSES[value];
  const style = {
    "--land-x": `${x}deg`,
    "--land-y": `${y}deg`,
    "--spin-x": `${(index % 2 ? -1 : 1) * (720 + (rollId % 2) * 360)}deg`,
    "--spin-y": `${(index % 2 ? 1 : -1) * 720}deg`,
    "--throw-x": `${index % 2 ? 12 : -12}px`,
    "--roll-delay": `${index * 28}ms`,
    "--rest-z": `${index % 2 ? 4 : -4}deg`,
  } as CSSProperties;

  return (
    <span className={`die-scene${rolling ? " is-rolling" : ""}`} style={style} aria-hidden="true">
      <span className="die-shadow" key={`shadow-${rollId}`} />
      <span className="die-flight" key={`flight-${rollId}`}>
        <span className="die-view">
          <span className="die-cube">
            {[1, 6, 3, 4, 2, 5].map((face) => (
              <span className={`cube-face cube-face-${face}`} key={face}>
                {Array.from({ length: 9 }, (_, pip) => (
                  <i className={`cube-pip${PIPS[face].includes(pip) ? " visible" : ""}`} key={pip} />
                ))}
              </span>
            ))}
          </span>
        </span>
      </span>
    </span>
  );
}
