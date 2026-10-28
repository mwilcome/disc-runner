import type { Vec } from './field';

export type ThrowKind = 'floater' | 'flick';

export interface ThrowPlan {
  kind: ThrowKind;
  /** Unit vector. Screen +y is downfield, so an upfield throw has negative y. */
  aim: Vec;
  power: number;
}

export interface DragSample {
  t: number;
  x: number;
  y: number;
}

export interface DragGesture {
  dx: number;
  dy: number;
  durationMs: number;
  /** Pixels per millisecond over the last moments of the drag. */
  releaseSpeed: number;
}

export interface Disc {
  origin: Vec;
  aim: Vec;
  speed: number;
  hang: number;
  maxZ: number;
  kind: ThrowKind;
  age: number;
  catchRadius: number;
  zMin: number;
  zMax: number;
  thrownBy: 'player' | 'cutter';
}

export interface DiscSample {
  x: number;
  y: number;
  z: number;
}

/** Pixels of screen lift per unit of disc height. Shared by the preview and the sprite. */
export const DISC_LIFT = 54;

const MIN_DRAG = 28;
const FULL_DRAG = 104;
const FLICK_SPEED = 0.72;
const FLICK_DURATION = 170;

export const TUNING = {
  floater: {
    minSpeed: 250,
    maxSpeed: 520,
    minHang: 0.92,
    maxHang: 1.3,
    maxZ: 1.72,
    catchRadius: 92,
    zMin: 0.12,
    zMax: 2.5,
  },
  flick: {
    minSpeed: 560,
    maxSpeed: 1040,
    minHang: 0.4,
    maxHang: 0.6,
    maxZ: 0.7,
    catchRadius: 36,
    zMin: 0.1,
    zMax: 1.3,
  },
} as const;

export function releaseSpeed(samples: DragSample[], windowMs = 90): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1]!;
  let first = samples[0]!;
  for (const sample of samples) {
    if (last.t - sample.t <= windowMs) {
      first = sample;
      break;
    }
  }
  const dt = last.t - first.t;
  if (dt < 8) return 0;
  return Math.hypot(last.x - first.x, last.y - first.y) / dt;
}

/**
 * Drag-opposite throw. The disc flies against the drag.
 * A fast or very short drag is a flick; a slower pull is a floater.
 */
export function dragToThrow(drag: DragGesture): ThrowPlan | null {
  const length = Math.hypot(drag.dx, drag.dy);
  if (length < MIN_DRAG) return null;
  const power = clamp01((length - MIN_DRAG) / (FULL_DRAG - MIN_DRAG));
  const kind: ThrowKind =
    drag.releaseSpeed >= FLICK_SPEED || drag.durationMs <= FLICK_DURATION ? 'flick' : 'floater';
  return {
    kind,
    aim: { x: -drag.dx / length, y: -drag.dy / length },
    power,
  };
}

export function discFromPlan(
  origin: Vec,
  plan: ThrowPlan,
  thrownBy: Disc['thrownBy'] = 'player',
): Disc {
  const tuning = TUNING[plan.kind];
  return {
    origin: { x: origin.x, y: origin.y },
    aim: { x: plan.aim.x, y: plan.aim.y },
    speed: tuning.minSpeed + (tuning.maxSpeed - tuning.minSpeed) * plan.power,
    hang: tuning.minHang + (tuning.maxHang - tuning.minHang) * plan.power,
    maxZ: tuning.maxZ,
    kind: plan.kind,
    age: 0,
    catchRadius: tuning.catchRadius,
    zMin: tuning.zMin,
    zMax: tuning.zMax,
    thrownBy,
  };
}

/** Places the disc on `target` at `flightTime`, still in the air (used for returns and tests). */
export function discToTarget(
  origin: Vec,
  target: Vec,
  kind: ThrowKind,
  flightTime: number,
  thrownBy: Disc['thrownBy'],
): Disc {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dist = Math.hypot(dx, dy);
  const safeTime = Math.max(0.05, flightTime);
  const tuning = TUNING[kind];
  return {
    origin: { x: origin.x, y: origin.y },
    aim: dist < 1 ? { x: 0, y: -1 } : { x: dx / dist, y: dy / dist },
    speed: dist < 1 ? 0 : dist / safeTime,
    // Arrive on the descending half so the disc is still in the air, then lands soon after.
    hang: safeTime / 0.8,
    maxZ: tuning.maxZ,
    kind,
    age: 0,
    catchRadius: tuning.catchRadius,
    zMin: tuning.zMin,
    zMax: tuning.zMax,
    thrownBy,
  };
}

export function discSample(disc: Disc): DiscSample {
  const travel = disc.speed * Math.max(0, disc.age);
  const x = disc.origin.x + disc.aim.x * travel;
  const y = disc.origin.y + disc.aim.y * travel;
  const n = disc.hang <= 0 ? 1 : disc.age / disc.hang;
  if (n <= 0 || n >= 1) return { x, y, z: 0 };
  return { x, y, z: 4 * disc.maxZ * n * (1 - n) };
}

export function trajectoryPoints(origin: Vec, plan: ThrowPlan, steps = 12): DiscSample[] {
  const disc = discFromPlan(origin, plan);
  const points: DiscSample[] = [];
  for (let i = 0; i <= steps; i += 1) {
    points.push(discSample({ ...disc, age: (disc.hang * i) / steps }));
  }
  return points;
}

/** Power whose aim ring (the catch marker) lands on `target`. */
export function planToward(origin: Vec, target: Vec, kind: ThrowKind): ThrowPlan | null {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return null;
  const tuning = TUNING[kind];
  let power = 1;
  let bestError = Infinity;
  for (let i = 0; i <= 48; i += 1) {
    const candidate = i / 48;
    const speed = tuning.minSpeed + (tuning.maxSpeed - tuning.minSpeed) * candidate;
    const hang = tuning.minHang + (tuning.maxHang - tuning.minHang) * candidate;
    const error = Math.abs(speed * hang * 0.75 - dist);
    if (error < bestError) {
      bestError = error;
      power = candidate;
    }
  }
  if (bestError > 36) return null;
  return { kind, aim: { x: dx / dist, y: dy / dist }, power };
}

const FLOATER_LOCK_COS = Math.cos((32 * Math.PI) / 180);

/** A floater aimed near the cutter locks onto them. Flicks stay where you aimed. */
export function assistedPlan(origin: Vec, plan: ThrowPlan, target: Vec | null): ThrowPlan {
  if (!target || plan.kind !== 'floater') return plan;
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return plan;
  const towardX = dx / dist;
  const towardY = dy / dist;
  const dot = plan.aim.x * towardX + plan.aim.y * towardY;
  if (dot < FLOATER_LOCK_COS) return plan;
  return planToward(origin, target, 'floater') ?? { ...plan, aim: { x: towardX, y: towardY } };
}

export function sweetSpot(origin: Vec, plan: ThrowPlan): DiscSample {
  const disc = discFromPlan(origin, plan);
  return discSample({ ...disc, age: disc.hang * 0.75 });
}

export function airReach(originY: number, endZoneBottom: number, kind: ThrowKind): boolean {
  const disc = discFromPlan({ x: 0, y: originY }, { kind, aim: { x: 0, y: -1 }, power: 1 });
  for (let i = 1; i < 30; i += 1) {
    const sample = discSample({ ...disc, age: (disc.hang * i) / 30 });
    if (sample.y <= endZoneBottom && sample.z >= disc.zMin && sample.z <= disc.zMax) return true;
  }
  return false;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
