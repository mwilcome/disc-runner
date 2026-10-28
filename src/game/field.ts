export type Lane = 0 | 1 | 2;

export interface Vec {
  x: number;
  y: number;
}

export interface Athlete {
  x: number;
  y: number;
  lane: Lane;
}

export const FIELD = {
  width: 390,
  height: 844,
  endZoneTop: 72,
  endZoneBottom: 250,
  minY: 168,
  plantX: 195,
  plantY: 660,
  lanes: [78, 195, 312] as const,
};

export const RUN_SPEED = 205;
export const SLIDE_SPEED = 880;
export const RETURN_RELEASE = 0.42;
export const RETURN_FLIGHT = 0.78;
export const RETURN_ARRIVE = RETURN_RELEASE + RETURN_FLIGHT;
export const CUTTER_SPEED = 118;
const CUT_START = 0.3;
const CUT_DUR = 0.42;

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function isEndZone(y: number): boolean {
  return y >= FIELD.endZoneTop && y <= FIELD.endZoneBottom;
}

export function nearestLane(x: number): Lane {
  let best: Lane = 1;
  let bestDist = Infinity;
  for (const lane of [0, 1, 2] as const) {
    const dist = Math.abs(FIELD.lanes[lane] - x);
    if (dist < bestDist) {
      best = lane;
      bestDist = dist;
    }
  }
  return best;
}

export function clampLane(lane: number): Lane {
  if (lane <= 0) return 0;
  if (lane >= 2) return 2;
  return 1;
}

export function runnerY(runStartY: number, time: number): number {
  return Math.max(FIELD.minY, runStartY - RUN_SPEED * time);
}

export function returnSpot(runStartY: number, lane: Lane): Vec {
  return { x: FIELD.lanes[lane], y: runnerY(runStartY, RETURN_ARRIVE) };
}

function smoothstep(u: number): number {
  const t = clamp(u, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Scripted cut. Once the cutter crosses into the end zone they plant and hold. */
export function cutterSpot(anchor: Vec, elapsed: number, cutLane: Lane): Vec {
  const startX = cutLane === 2 ? FIELD.lanes[0] + 16 : FIELD.lanes[2] - 16;
  const startY = Math.max(FIELD.minY + 12, Math.min(anchor.y - 108, anchor.y - 48));
  const plantY = Math.max(FIELD.minY, FIELD.endZoneBottom - 36);
  const secondsToPlant = Math.max(0, (startY - plantY) / CUTTER_SPEED);
  const t = Math.min(Math.max(0, elapsed), secondsToPlant);
  const y = startY - t * CUTTER_SPEED;
  const along = smoothstep((t - CUT_START) / CUT_DUR);
  const x = startX + (FIELD.lanes[cutLane] - startX) * along;
  return { x, y };
}

export function markHome(playerY: number): Vec {
  const low = FIELD.endZoneBottom + 56;
  const high = Math.max(low, playerY - 110);
  return { x: FIELD.lanes[1], y: clamp(playerY - 190, low, high) };
}
