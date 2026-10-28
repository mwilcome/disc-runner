import { MID_Y, OPEN_X, PITCH_LEFT, PITCH_RIGHT, SIDELINE_BOT, SIDELINE_TOP, clamp, isEndZone, type Vec } from './field';
import { flightTime, flightTo, routeSpeed, sampleFlight, type Flight, type RouteId, type ThrowKind } from './throw';

export interface Athlete {
  team: 0 | 1;
  squad: 0 | 1 | 2;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  vx: number;
  vy: number;
  route: RouteId;
  hair: number;
  lunge: number;
  leadX: number;
  leadY: number;
  homing: boolean;
}

export interface DiscState {
  mode: 'held' | 'flight';
  holder: number;
  x: number;
  y: number;
  z: number;
  kind: ThrowKind;
  age: number;
  originX: number;
  originY: number;
  aimX: number;
  aimY: number;
  speed: number;
  hang: number;
  maxZ: number;
  catchRadius: number;
  thrownBy: number;
  target: number;
}

export type Phase = 'ready' | 'live' | 'celebrate' | 'end';

export interface Match {
  players: Athlete[];
  disc: DiscState;
  poss: 0 | 1;
  userAttack: 1 | -1;
  control: number;
  phase: Phase;
  phaseT: number;
  message: string;
  clock: number;
  half: 1 | 2;
  halfLength: number;
  score: [number, number];
  stall: number;
  routeT: number;
  liveT: number;
  userThrow: number;
  userSpeed: number;
  userCatch: number;
  aiWait: number;
  celebrate: 'goal' | 'turn' | 'half' | 'end' | null;
  userSquad: 0 | 1 | 2;
  oppSquad: 0 | 1 | 2;
}

export interface FrameInput {
  moveX: number;
  moveY: number;
  flight: Flight | null;
  switchTo: number | null;
  lunge: boolean;
}

export const IDLE: FrameInput = { moveX: 0, moveY: 0, flight: null, switchTo: null, lunge: false };

/** Staggered depths so a snap reads as a play, not a drill line. */
const FORM: { x: number; y: number; route: RouteId }[] = [
  { x: 36, y: -108, route: 'out' },
  { x: 250, y: -58, route: 'slant' },
  { x: 16, y: -8, route: 'hook' },
  { x: -124, y: 28, route: 'thrower' },
  { x: 210, y: 70, route: 'in' },
  { x: 372, y: 118, route: 'deep' },
  { x: 78, y: 158, route: 'out' },
];
const CUSHION: { x: number; y: number }[] = [
  { x: 58, y: -28 },
  { x: 30, y: 24 },
  { x: 92, y: -12 },
  { x: 46, y: 22 },
  { x: 108, y: -16 },
  { x: 34, y: 32 },
  { x: 72, y: -26 },
];

export function attackOf(match: Match): 1 | -1 {
  if (match.poss === 0) return match.userAttack;
  return match.userAttack === 1 ? -1 : 1;
}

export function teamOf(index: number): 0 | 1 {
  return index < 7 ? 0 : 1;
}

export function createMatch(opts: {
  userSquad: 0 | 1 | 2;
  oppSquad: 0 | 1 | 2;
  halfLength: number;
  throwLv: number;
  speedLv: number;
  catchLv: number;
}): Match {
  const players: Athlete[] = [];
  for (let i = 0; i < 14; i += 1) {
    const team: 0 | 1 = i < 7 ? 0 : 1;
    players.push({
      team,
      squad: team === 0 ? opts.userSquad : opts.oppSquad,
      x: 0,
      y: MID_Y,
      homeX: 0,
      homeY: MID_Y,
      vx: 0,
      vy: 0,
      route: 'thrower',
      hair: i % 3,
      lunge: 0,
      leadX: 0,
      leadY: 0,
      homing: false,
    });
  }
  const match: Match = {
    players,
    disc: {
      mode: 'held',
      holder: 3,
      x: 0,
      y: 0,
      z: 0.3,
      kind: 'floater',
      age: 0,
      originX: 0,
      originY: 0,
      aimX: 1,
      aimY: 0,
      speed: 0,
      hang: 1,
      maxZ: 1,
      catchRadius: 40,
      thrownBy: -1,
      target: -1,
    },
    poss: 0,
    userAttack: 1,
    control: 3,
    phase: 'ready',
    phaseT: 0,
    message: 'DRAG BACK TO THROW',
    clock: opts.halfLength,
    half: 1,
    halfLength: opts.halfLength,
    score: [0, 0],
    stall: 8,
    routeT: 0,
    liveT: 0,
    userThrow: opts.throwLv,
    userSpeed: opts.speedLv,
    userCatch: opts.catchLv,
    aiWait: 0,
    celebrate: null,
    userSquad: opts.userSquad,
    oppSquad: opts.oppSquad,
  };
  spot(match, OPEN_X);
  return match;
}

export function spot(match: Match, ballX: number): void {
  const dir = attackOf(match);
  const x = clamp(ballX, PITCH_LEFT + 140, PITCH_RIGHT - 140);
  for (let i = 0; i < 7; i += 1) {
    const off = match.players[match.poss === 0 ? i : i + 7]!;
    const slot = FORM[i]!;
    const y = clamp(MID_Y + slot.y, SIDELINE_TOP + 52, SIDELINE_BOT - 18);
    place(off, x + slot.x * dir, y, slot.route);
  }
  for (let i = 0; i < 7; i += 1) {
    const def = match.players[match.poss === 0 ? i + 7 : i]!;
    const mark = match.players[match.poss === 0 ? i : i + 7]!;
    const gap = CUSHION[i]!;
    const y = clamp(mark.y + gap.y, SIDELINE_TOP + 52, SIDELINE_BOT - 18);
    place(def, mark.x + gap.x * dir, y, 'thrower');
  }
  match.disc.mode = 'held';
  match.disc.holder = (match.poss === 0 ? 0 : 7) + 3;
  match.disc.thrownBy = -1;
  match.disc.target = -1;
  match.control = match.disc.holder;
  match.routeT = 0;
  match.stall = 8;
  match.liveT = 0;
  match.aiWait = 0;
  match.phase = 'ready';
  match.phaseT = 0;
  match.celebrate = null;
  match.message = 'DRAG BACK TO THROW';
  if (match.poss === 1) {
    match.control = 3;
    match.phase = 'live';
    match.message = 'DRAG TO RUN';
  }
  syncHeld(match);
}

function place(p: Athlete, x: number, y: number, route: RouteId): void {
  p.x = x;
  p.y = y;
  p.homeX = x;
  p.homeY = y;
  p.vx = 0;
  p.vy = 0;
  p.route = route;
  p.lunge = 0;
  p.homing = false;
}

export function launch(match: Match, flight: Flight, by: number): void {
  const leads = receiverLeads(match, flight.kind);
  const arriveAt = flightTime(flight.kind);
  match.disc.mode = 'flight';
  match.disc.holder = -1;
  match.disc.thrownBy = by;
  match.disc.age = 0;
  match.disc.kind = flight.kind;
  match.disc.originX = flight.origin.x;
  match.disc.originY = flight.origin.y;
  match.disc.aimX = flight.aim.x;
  match.disc.aimY = flight.aim.y;
  match.disc.speed = flight.speed;
  match.disc.hang = flight.hang;
  match.disc.maxZ = flight.maxZ;
  match.disc.catchRadius = flight.catchRadius;
  match.disc.x = flight.origin.x;
  match.disc.y = flight.origin.y;
  match.disc.z = 0.2;
  match.phase = 'live';
  match.message = flight.kind === 'flick' ? 'FLICK' : 'FLOATER';
  match.disc.target = -1;
  const arrive = {
    x: flight.origin.x + flight.aim.x * flight.speed * arriveAt,
    y: flight.origin.y + flight.aim.y * flight.speed * arriveAt,
  };
  let n = 0;
  match.players.forEach((p, i) => {
    if (p.team !== match.poss || i === by) {
      p.homing = false;
      return;
    }
    const lead = leads[n++] ?? { x: p.x, y: p.y };
    p.homeX = p.x;
    p.homeY = p.y;
    p.leadX = lead.x;
    p.leadY = lead.y;
    p.homing = true;
    if (Math.hypot(lead.x - arrive.x, lead.y - arrive.y) < 18) match.disc.target = i;
  });
}

export function step(match: Match, dt: number, input: FrameInput): void {
  if (match.phase === 'end') return;
  if (match.phase === 'celebrate') {
    match.phaseT += dt;
    if (match.phaseT >= 1.35) finishCelebrate(match);
    return;
  }
  if (match.phase === 'ready') {
    match.phaseT += dt;
    if (input.switchTo != null && match.players[input.switchTo]?.team === 0) match.control = input.switchTo;
    if (!input.flight) return;
    match.phase = 'live';
  }
  if (match.phase === 'live') {
    match.clock -= dt;
    match.liveT += dt;
    match.routeT += dt;
    if (match.clock <= 0) {
      onClock(match);
      return;
    }
  }
  if (input.switchTo != null && match.players[input.switchTo]?.team === 0) {
    match.control = input.switchTo;
  }
  movePeople(match, dt, input);
  if (input.lunge) tryLunge(match);
  stepLunge(match, dt);
  if (input.flight && canThrow(match)) launch(match, input.flight, match.control);
  else maybeAiThrow(match);
  if (match.disc.mode === 'held') {
    syncHeld(match);
    match.stall -= dt;
    if (match.stall <= 0) {
      turnover(match, 'STALL');
      return;
    }
    if (match.liveT > 2.8 && touchedByDefense(match)) {
      turnover(match, 'BLOCK');
      return;
    }
  } else {
    stepFlight(match, dt);
  }
}

function canThrow(match: Match): boolean {
  if (match.disc.mode !== 'held') return false;
  const holder = match.players[match.disc.holder];
  return !!holder && holder.team === match.poss && match.disc.holder === match.control;
}

function movePeople(match: Match, dt: number, input: FrameInput): void {
  const dir = attackOf(match);
  for (let i = 0; i < match.players.length; i += 1) {
    const p = match.players[i]!;
    const offense = p.team === match.poss;
    const controlled = i === match.control && p.team === 0;
    const hasDisc = match.disc.mode === 'held' && match.disc.holder === i;
    if (hasDisc) {
      p.vx = 0;
      p.vy = 0;
      continue;
    }
    if (controlled && p.lunge <= 0) {
      const sp = moverSpeed(match, p.team);
      p.vx = input.moveX * sp;
      p.vy = input.moveY * sp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.y = clamp(p.y, SIDELINE_TOP + 8, SIDELINE_BOT - 8);
      continue;
    }
    if (p.lunge > 0) continue;
    if (offense && p.homing && match.disc.mode === 'flight') {
      const u = clamp(match.disc.age / flightTime(match.disc.kind), 0, 1);
      p.vx = p.leadX - p.homeX;
      p.vy = p.leadY - p.homeY;
      p.x = p.homeX + (p.leadX - p.homeX) * u;
      p.y = p.homeY + (p.leadY - p.homeY) * u;
      continue;
    }
    if (!offense) {
      const mark = markFor(match, i);
      const gx = mark.x - dir * (i % 7 === 0 ? 20 : 40);
      const gy = mark.y;
      const sp = moverSpeed(match, p.team) * (i % 7 === 0 ? 0.78 : 0.9);
      const dx = gx - p.x;
      const dy = gy - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      const stepDist = Math.min(dist, sp * dt);
      p.vx = (dx / dist) * sp;
      p.vy = (dy / dist) * sp;
      p.x += (dx / dist) * stepDist;
      p.y += (dy / dist) * stepDist;
    }
  }
}

function markFor(match: Match, defenderIndex: number): Athlete {
  const slot = defenderIndex % 7;
  const offenseBase = match.poss === 0 ? 0 : 7;
  return match.players[offenseBase + slot] ?? match.players[match.disc.holder] ?? match.players[0]!;
}

function moverSpeed(match: Match, team: 0 | 1): number {
  if (team === 0) return 150 * (1 + 0.22 * match.userSpeed);
  return 142;
}

function tryLunge(match: Match): void {
  if (match.poss !== 1 || match.disc.mode !== 'held') return;
  const me = match.players[match.control];
  const holder = match.players[match.disc.holder];
  if (!me || !holder || me.team !== 0) return;
  if (Math.hypot(me.x - holder.x, me.y - holder.y) > 110) return;
  me.lunge = 0.36;
  const dx = holder.x - me.x;
  const dy = holder.y - me.y;
  const dist = Math.hypot(dx, dy) || 1;
  me.vx = (dx / dist) * 280;
  me.vy = (dy / dist) * 280;
}

function stepLunge(match: Match, dt: number): void {
  for (const p of match.players) {
    if (p.lunge <= 0) continue;
    p.lunge -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (match.disc.mode === 'held') {
      const holder = match.players[match.disc.holder];
      if (holder && Math.hypot(p.x - holder.x, p.y - holder.y) < 22) {
        turnover(match, 'BLOCK');
        return;
      }
    }
  }
}

function maybeAiThrow(match: Match): void {
  if (match.poss !== 1 || match.disc.mode !== 'held' || match.phase !== 'live') return;
  match.aiWait += 0;
  match.aiWait = match.liveT;
  if (match.liveT < 2.4) return;
  const holder = match.players[match.disc.holder];
  if (!holder) return;
  const dir = attackOf(match);
  const leads = receiverLeads(match, 'floater');
  if (leads.length === 0) return;
  let lead = leads[0]!;
  for (const next of leads) if (next.x * dir > lead.x * dir) lead = next;
  launch(match, flightTo({ x: holder.x, y: holder.y }, lead, 'floater', 0), match.disc.holder);
}

function stepFlight(match: Match, dt: number): void {
  match.disc.age += dt;
  const sample = sampleFlight(asFlight(match), match.disc.age);
  match.disc.x = sample.x;
  match.disc.y = sample.y;
  match.disc.z = sample.z;
  if (match.disc.age < flightTime(match.disc.kind) * 0.62) return;
  const off = nearest(match, sample, (p, i) => p.team === match.poss && i !== match.disc.thrownBy);
  const def = nearest(match, sample, (p) => p.team !== match.poss);
  const over = sample.z > (match.disc.kind === 'floater' ? 0.9 : 1.5);
  if (!over && def.dist < 26 && def.dist + 4 < off.dist) {
    turnover(match, 'BLOCK');
    return;
  }
  const zOk = sample.z >= 0.12 && sample.z <= 2.4;
  const aimed = match.disc.target;
  const catchIndex = aimed >= 0 ? aimed : off.index;
  const catchDist = aimed >= 0 ? Math.hypot((match.players[aimed]?.x ?? 0) - sample.x, (match.players[aimed]?.y ?? 0) - sample.y) : off.dist;
  if (zOk && catchIndex >= 0 && catchDist <= match.disc.catchRadius) {
    catchDisc(match, catchIndex, sample.x);
    return;
  }
  if (sample.y < SIDELINE_TOP - 8 || sample.y > SIDELINE_BOT + 8) {
    turnover(match, 'OUT');
    return;
  }
  if (match.disc.age >= match.disc.hang) turnover(match, 'DROP');
}

function catchDisc(match: Match, index: number, x: number): void {
  const dir = attackOf(match);
  const catcher = match.players[index]!;
  match.disc.mode = 'held';
  match.disc.holder = index;
  match.disc.z = 0.3;
  match.stall = 8;
  match.liveT = 0;
  match.aiWait = 0;
  if (isEndZone(x, dir) || isEndZone(catcher.x, dir) || isEndZone(catcher.leadX, dir)) {
    celebrate(match, 'goal', 'GOAL');
    return;
  }
  for (const p of match.players) {
    if (p.team !== match.poss) continue;
    p.homeX = p.x;
    p.homeY = p.y;
  }
  let n = 0;
  const kinds: RouteId[] = ['deep', 'slant', 'out', 'in', 'hook', 'deep'];
  for (const p of match.players) {
    if (p.team !== match.poss) continue;
    p.route = p === catcher ? 'thrower' : kinds[n++] ?? 'deep';
    p.homeX = p.x;
    p.homeY = p.y;
  }
  match.routeT = 0;
  if (catcher.team === 0) match.control = index;
  match.message = catcher.team === 0 ? 'DRAG BACK TO THROW' : 'DRAG TO RUN';
  syncHeld(match);
}

function nearest(
  match: Match,
  at: Vec,
  pred: (p: Athlete, i: number) => boolean,
): { index: number; dist: number } {
  let index = -1;
  let dist = Infinity;
  match.players.forEach((p, i) => {
    if (!pred(p, i)) return;
    const d = Math.hypot(p.x - at.x, p.y - at.y);
    if (d < dist) {
      dist = d;
      index = i;
    }
  });
  return { index, dist };
}

function touchedByDefense(match: Match): boolean {
  const holder = match.players[match.disc.holder];
  if (!holder) return false;
  return match.players.some(
    (p) => p.team !== match.poss && Math.hypot(p.x - holder.x, p.y - holder.y) < 16,
  );
}

function turnover(match: Match, message: string): void {
  celebrate(match, 'turn', message);
}

function celebrate(match: Match, kind: 'goal' | 'turn' | 'half' | 'end', message: string): void {
  match.phase = 'celebrate';
  match.celebrate = kind;
  match.phaseT = 0;
  match.message = message;
  if (kind === 'goal') match.score[match.poss] += 1;
}

function finishCelebrate(match: Match): void {
  if (match.celebrate === 'end') {
    match.phase = 'end';
    return;
  }
  if (match.celebrate === 'half') {
    match.half = 2;
    match.clock = match.halfLength;
    match.userAttack = match.userAttack === 1 ? -1 : 1;
    match.poss = 1;
    spot(match, attackOf(match) === 1 ? 1500 : 2800);
    return;
  }
  if (match.celebrate === 'goal' || match.celebrate === 'turn') {
    match.poss = match.poss === 0 ? 1 : 0;
    const dir = attackOf(match);
    spot(match, dir === 1 ? 1560 : 2860);
  }
}

function onClock(match: Match): void {
  match.clock = 0;
  if (match.half === 1) {
    celebrate(match, 'half', 'HALF');
    return;
  }
  celebrate(match, 'end', 'FULL TIME');
}

function syncHeld(match: Match): void {
  const holder = match.players[match.disc.holder];
  if (!holder || match.disc.mode !== 'held') return;
  const dir = attackOf(match);
  match.disc.x = holder.x + dir * 26;
  match.disc.y = holder.y - 46;
  match.disc.z = 0.25;
}

function asFlight(match: Match): Flight {
  return {
    origin: { x: match.disc.originX, y: match.disc.originY },
    aim: { x: match.disc.aimX, y: match.disc.aimY },
    speed: match.disc.speed,
    hang: match.disc.hang,
    maxZ: match.disc.maxZ,
    kind: match.disc.kind,
    catchRadius: match.disc.catchRadius,
  };
}

function breakY(p: Athlete): number {
  const side = p.y < MID_Y ? -1 : 1;
  if (p.route === 'out') return side * 78;
  if (p.route === 'in') return -side * 62;
  if (p.route === 'slant') return -side * 50;
  if (p.route === 'hook') return -side * 16;
  return side * 14;
}

export function receiverLeads(match: Match, kind: ThrowKind): Vec[] {
  const dir = attackOf(match);
  const time = flightTime(kind);
  const speed = routeSpeed(match.poss === 0 ? match.userSpeed : 0);
  const leads: Vec[] = [];
  match.players.forEach((p, i) => {
    if (p.team !== match.poss || i === match.disc.holder) return;
    const factor = p.route === 'deep' ? 1 : p.route === 'slant' ? 0.78 : p.route === 'hook' ? 0.4 : 0.66;
    leads.push({
      x: p.x + dir * speed * time * factor,
      y: clamp(p.y + breakY(p), SIDELINE_TOP + 20, SIDELINE_BOT - 20),
    });
  });
  return leads;
}

export function leadsFor(match: Match, kind: ThrowKind): Vec[] {
  return receiverLeads(match, kind);
}

export function eligible(match: Match): number[] {
  if (match.disc.mode === 'flight') return match.disc.target >= 0 ? [match.disc.target] : [];
  if (match.disc.mode !== 'held') return [];
  const ids: number[] = [];
  match.players.forEach((p, i) => {
    if (p.team === match.poss && i !== match.disc.holder) ids.push(i);
  });
  return ids;
}

export function lungeReady(match: Match): boolean {
  if (match.poss === 0 || match.disc.mode !== 'held' || match.phase !== 'live') return false;
  const me = match.players[match.control];
  const holder = match.players[match.disc.holder];
  if (!me || !holder || me.team !== 0) return false;
  return Math.hypot(me.x - holder.x, me.y - holder.y) < 110;
}
