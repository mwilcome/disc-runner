import { MID_Y, SIDELINE_BOT, SIDELINE_TOP, clamp, type Vec } from './field';

export type ThrowKind = 'floater' | 'flick';
export type RouteId = 'thrower' | 'deep' | 'out' | 'in' | 'hook' | 'slant';

export interface ThrowPlan {
  kind: ThrowKind;
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
  releaseSpeed: number;
}

export interface Flight {
  origin: Vec;
  aim: Vec;
  speed: number;
  hang: number;
  maxZ: number;
  kind: ThrowKind;
  catchRadius: number;
}

export const MIN_PULL = 28;
const FULL_DRAG = 130;
const FLICK_SPEED = 0.85;

export function flightTime(kind: ThrowKind): number {
  return kind === 'flick' ? 0.52 : 1.15;
}

export function routeSpeed(level: number): number {
  return 200 * (1 + 0.2 * level);
}

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

/** 0 at a short pull, 1 at a full pull, smooth in between. */
export function pullPower(length: number): number {
  const t = clamp((length - MIN_PULL) / (FULL_DRAG - MIN_PULL), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Drag-opposite throw. A fast release is a flick. A short pull does not throw. */
export function dragToThrow(drag: DragGesture): ThrowPlan | null {
  const length = Math.hypot(drag.dx, drag.dy);
  if (length < MIN_PULL) return null;
  const kind: ThrowKind = drag.releaseSpeed >= FLICK_SPEED ? 'flick' : 'floater';
  return {
    kind,
    aim: { x: -drag.dx / length, y: -drag.dy / length },
    power: pullPower(length),
  };
}

export function routePoint(home: Vec, route: RouteId, dir: 1 | -1, t: number, speed: number): Vec {
  if (route === 'thrower') return { x: home.x, y: home.y };
  const s = Math.max(0, t) * speed;
  let x = home.x;
  let y = home.y;
  if (route === 'deep') x = home.x + dir * s;
  else if (route === 'hook') x = home.x + dir * Math.min(s, 120);
  else if (route === 'out') {
    x = home.x + dir * s * 0.82;
    const side = home.y < MID_Y ? SIDELINE_TOP + 36 : SIDELINE_BOT - 36;
    const step = Math.min(Math.abs(side - home.y), s * 0.35);
    y = home.y + Math.sign(side - home.y) * step;
  } else if (route === 'in') {
    x = home.x + dir * s * 0.78;
    y = home.y + (MID_Y - home.y) * Math.min(1, s / 240);
  } else {
    x = home.x + dir * s * 0.9;
    y = home.y + (MID_Y - home.y) * Math.min(1, s / 180);
  }
  return { x, y: clamp(y, SIDELINE_TOP + 16, SIDELINE_BOT - 16) };
}

export function sampleFlight(flight: Flight, age: number): { x: number; y: number; z: number } {
  const travel = flight.speed * Math.max(0, age);
  const x = flight.origin.x + flight.aim.x * travel;
  const y = flight.origin.y + flight.aim.y * travel;
  const n = flight.hang <= 0 ? 1 : age / flight.hang;
  if (n <= 0 || n >= 1) return { x, y, z: 0 };
  return { x, y, z: 4 * flight.maxZ * n * (1 - n) };
}

export function flightTo(origin: Vec, target: Vec, kind: ThrowKind, catchLevel: number): Flight {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dist = Math.hypot(dx, dy) || 1;
  const time = flightTime(kind);
  const hang = time / (kind === 'flick' ? 0.8 : 0.64);
  const radius = (kind === 'flick' ? 40 : 52) * (1 + 0.15 * catchLevel);
  return {
    origin: { x: origin.x, y: origin.y },
    aim: { x: dx / dist, y: dy / dist },
    speed: dist / hang,
    hang,
    maxZ: kind === 'flick' ? 0.58 : 1.7,
    kind,
    catchRadius: radius,
  };
}

export function flightFromPlan(origin: Vec, plan: ThrowPlan, catchLevel: number): Flight {
  const speed =
    plan.kind === 'flick' ? 460 + plan.power * 280 : 240 + plan.power * 180;
  const hang = plan.kind === 'flick' ? 0.42 + plan.power * 0.16 : 0.9 + plan.power * 0.45;
  return {
    origin: { x: origin.x, y: origin.y },
    aim: { x: plan.aim.x, y: plan.aim.y },
    speed,
    hang,
    maxZ: plan.kind === 'flick' ? 0.58 : 1.7,
    kind: plan.kind,
    catchRadius: (plan.kind === 'flick' ? 40 : 52) * (1 + 0.15 * catchLevel),
  };
}

/** Where the disc meets the ground. Aim is the drag, not a receiver. */
export function landingOf(flight: Flight): Vec {
  const at = sampleFlight(flight, flight.hang);
  return { x: at.x, y: at.y };
}

/** Slingshot. The drag picks a free point. Nearby players do not pull the disc. */
export function assistFlight(origin: Vec, plan: ThrowPlan, _leads: Vec[], catchLevel: number): Flight {
  return flightFromPlan(origin, plan, catchLevel);
}
