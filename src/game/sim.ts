import { isContested, inCatchWindow, scoreValue } from './catch';
import {
  FIELD,
  RETURN_FLIGHT,
  RETURN_RELEASE,
  SLIDE_SPEED,
  clamp,
  clampLane,
  cutterSpot,
  isEndZone,
  markHome,
  nearestLane,
  returnSpot,
  runnerY,
  type Athlete,
  type Lane,
  type Vec,
} from './field';
import {
  assistedPlan,
  discSample,
  discFromPlan,
  discToTarget,
  dragToThrow,
  type Disc,
  type DragGesture,
  type ThrowKind,
} from './throw';

export type Phase = 'throw' | 'flight' | 'run' | 'celebrate';

/**
 * Throw: planted with the disc. Drag releases a floater or a flick toward the cutter.
 * Flight: that disc is in the air.
 * Run: the cutter caught short of the end zone. You auto-run and slide lanes to catch the return.
 * A catch in the end zone scores. A drop ends the drive. A short return catch plants you again.
 */
export interface Match {
  phase: Phase;
  phaseTime: number;
  score: number;
  playCount: number;
  player: Athlete;
  cutter: Athlete;
  cutterElapsed: number;
  cutterCutLane: Lane;
  routeAnchor: Vec;
  defender: Vec;
  disc: Disc | null;
  returnLane: Lane | null;
  returnMark: Vec | null;
  runStartY: number;
  celebrate: 'score' | 'drop' | null;
  message: string;
  submessage: string;
}

export interface StepInput {
  dt: number;
  laneStep?: -1 | 0 | 1;
  skip?: boolean;
}

export function createMatch(options?: { score?: number; playCount?: number }): Match {
  const score = options?.score ?? 0;
  const playCount = options?.playCount ?? 0;
  const player: Athlete = { x: FIELD.plantX, y: FIELD.plantY, lane: 1 };
  return makeThrow(score, playCount, player, '');
}

export function throwDisc(match: Match, drag: DragGesture): Match {
  if (match.phase !== 'throw') return match;
  const plan = dragToThrow(drag);
  if (!plan) return match;
  const aimed = assistedPlan(match.player, plan, match.cutter);
  return releaseDisc(match, discFromPlan(match.player, aimed, 'player'));
}

export function releaseDisc(match: Match, disc: Disc): Match {
  if (match.phase !== 'throw') return match;
  return {
    ...match,
    phase: 'flight',
    phaseTime: 0,
    disc,
    message: disc.kind === 'flick' ? 'Flick' : 'Floater',
    submessage: '',
  };
}

const STEP = 1 / 60;

export function tick(match: Match, input: StepInput): Match {
  if (input.skip && match.phase === 'celebrate') {
    return createMatch({ score: match.score, playCount: match.playCount + 1 });
  }
  const dt = Math.max(0, input.dt);
  if (dt === 0) return match;
  const steps = Math.max(1, Math.ceil(dt / STEP));
  const h = dt / steps;
  let next = match;
  const laneStep = input.laneStep ?? 0;
  for (let i = 0; i < steps; i += 1) {
    const phase = next.phase;
    next = step(next, h, i === 0 ? laneStep : 0);
    if (next.phase !== phase) break;
  }
  return next;
}

function step(match: Match, dt: number, laneStep: -1 | 0 | 1): Match {
  switch (match.phase) {
    case 'throw':
      return stepThrow(match, dt);
    case 'flight':
      return stepFlight(match, dt);
    case 'run':
      return stepRun(match, dt, laneStep);
    case 'celebrate':
      return stepCelebrate(match, dt);
  }
}

function stepThrow(match: Match, dt: number): Match {
  const moved = advanceCutter(match, dt);
  const phaseTime = match.phaseTime + dt;
  return {
    ...match,
    ...moved,
    phaseTime,
    message: isEndZone(moved.cutter.y) ? 'In the end zone — throw' : 'Drag back to throw',
    submessage: phaseTime < 0.75 ? match.submessage : '',
  };
}

function stepFlight(match: Match, dt: number): Match {
  if (!match.disc) return { ...match, phase: 'throw' };
  const moved = advanceCutter(match, dt);
  const disc = { ...match.disc, age: match.disc.age + dt };
  const sample = discSample(disc);
  const next: Match = { ...match, ...moved, disc, phaseTime: match.phaseTime + dt };
  if (
    disc.thrownBy === 'player' &&
    sample.y > FIELD.endZoneBottom &&
    isContested(sample, next.defender, disc.kind)
  ) {
    return toDrop(next);
  }
  if (inCatchWindow(sample, next.cutter, disc)) return onCatch(next, sample);
  if (disc.age >= disc.hang) return toDrop(next);
  return next;
}

function stepRun(match: Match, dt: number, laneStep: -1 | 0 | 1): Match {
  const lane = clampLane(match.player.lane + laneStep);
  const phaseTime = match.phaseTime + dt;
  const player: Athlete = {
    x: approach(match.player.x, FIELD.lanes[lane], dt),
    y: runnerY(match.runStartY, phaseTime),
    lane,
  };

  let disc = match.disc;
  let spawned = false;
    if (!disc && phaseTime >= RETURN_RELEASE && match.returnMark) {
    const pass = discToTarget(match.cutter, match.returnMark, 'floater', RETURN_FLIGHT, 'cutter');
    disc = { ...pass, catchRadius: 64 };
    spawned = true;
  }
  if (!disc) return { ...match, player, phaseTime, disc: null };

  const age = spawned ? Math.max(0, phaseTime - RETURN_RELEASE) : disc.age + dt;
  disc = { ...disc, age };
  const sample = discSample(disc);
  const withDisc: Match = { ...match, player, disc, phaseTime };
  if (inCatchWindow(sample, player, disc)) return onCatch(withDisc, sample);
  if (age >= disc.hang) return toDrop(withDisc);
  return withDisc;
}

function stepCelebrate(match: Match, dt: number): Match {
  const phaseTime = match.phaseTime + dt;
  const hold = match.celebrate === 'score' ? 1.25 : 1.05;
  if (phaseTime >= hold) return createMatch({ score: match.score, playCount: match.playCount + 1 });
  return { ...match, phaseTime };
}

function onCatch(match: Match, sample: { x: number; y: number; z: number }): Match {
  const disc = match.disc;
  if (!disc) return match;
  const caughtInZone =
    isEndZone(sample.y) ||
    (disc.thrownBy === 'player' && isEndZone(match.cutter.y)) ||
    (disc.thrownBy === 'cutter' && isEndZone(match.player.y));
  if (caughtInZone) return toScore(match, scoreValue(disc.kind), disc.kind);
  if (disc.thrownBy === 'player') return startRun(match);
  return plant(match, sample);
}

function startRun(match: Match): Match {
  const lane = nearestLane(match.player.x);
  const returnLane = pickReturnLane(match, lane);
  const mark = returnSpot(match.player.y, returnLane);
  return {
    ...match,
    phase: 'run',
    phaseTime: 0,
    disc: null,
    player: { ...match.player, lane },
    returnLane,
    returnMark: mark,
    runStartY: match.player.y,
    celebrate: null,
    message: 'Slide to the mark',
    submessage: '',
  };
}

function plant(match: Match, at: { x: number; y: number }): Match {
  const lane = nearestLane(at.x);
  const player: Athlete = {
    x: FIELD.lanes[lane],
    y: clamp(at.y, FIELD.minY, FIELD.plantY),
    lane,
  };
  return makeThrow(match.score, match.playCount + 1, player, 'Planted');
}

function toScore(match: Match, points: number, kind: ThrowKind): Match {
  return {
    ...match,
    score: match.score + points,
    phase: 'celebrate',
    phaseTime: 0,
    disc: null,
    celebrate: 'score',
    message: 'Score',
    submessage: `+${points} ${kind}`,
    returnMark: null,
  };
}

function toDrop(match: Match): Match {
  return {
    ...match,
    phase: 'celebrate',
    phaseTime: 0,
    disc: null,
    celebrate: 'drop',
    message: 'Drop',
    submessage: 'Incomplete',
    returnMark: null,
  };
}

function makeThrow(score: number, playCount: number, player: Athlete, submessage: string): Match {
  const cutterCutLane: Lane = playCount % 2 === 0 ? 0 : 2;
  const routeAnchor = { x: player.x, y: player.y };
  const spot = cutterSpot(routeAnchor, 0, cutterCutLane);
  return {
    phase: 'throw',
    phaseTime: 0,
    score,
    playCount,
    player,
    routeAnchor,
    cutterCutLane,
    cutterElapsed: 0,
    cutter: { x: spot.x, y: spot.y, lane: cutterCutLane },
    defender: markHome(player.y),
    disc: null,
    returnLane: null,
    returnMark: null,
    runStartY: player.y,
    celebrate: null,
    message: 'Drag back to throw',
    submessage,
  };
}

function advanceCutter(match: Match, dt: number): Pick<Match, 'cutter' | 'cutterElapsed' | 'defender'> {
  const cutterElapsed = match.cutterElapsed + dt;
  const spot = cutterSpot(match.routeAnchor, cutterElapsed, match.cutterCutLane);
  return {
    cutterElapsed,
    cutter: { x: spot.x, y: spot.y, lane: match.cutterCutLane },
    defender: slide(match.defender, markHome(match.player.y), dt),
  };
}

function pickReturnLane(match: Match, current: Lane): Lane {
  const raw = ((match.playCount + 1) % 3) as Lane;
  return raw === current ? clampLane(raw + 1) : raw;
}

function slide(current: Vec, home: Vec, dt: number): Vec {
  const k = 1 - Math.exp(-dt * 4);
  return {
    x: current.x + (home.x - current.x) * k,
    y: current.y + (home.y - current.y) * k,
  };
}

function approach(current: number, target: number, dt: number): number {
  const delta = target - current;
  const max = SLIDE_SPEED * dt;
  if (Math.abs(delta) <= max) return target;
  return current + Math.sign(delta) * max;
}
