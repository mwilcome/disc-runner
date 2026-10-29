import { describe, expect, it } from 'vitest';
import { EZ_RIGHT_START } from './field';
import { createMatch, launch, spot, step, type FrameInput, type Match } from './match';
import { flightFromPlan, flightTo } from './throw';

const idle: FrameInput = { moveX: 0, moveY: 0, flight: null, switchTo: null, lunge: false };

function fresh(): Match {
  return createMatch({
    userSquad: 0,
    oppSquad: 1,
    halfLength: 60,
    throwLv: 0,
    speedLv: 0,
    catchLv: 0,
  });
}

function park(match: Match, keep: number[]): void {
  match.players.forEach((p, i) => {
    if (keep.includes(i)) return;
    p.route = 'thrower';
    p.x = 500;
    p.y = 220;
    p.homeX = 500;
    p.homeY = 220;
  });
}

describe('slingshot and catch', () => {
  it('turns the disc over when it lands on empty grass', () => {
    const match = fresh();
    const holder = match.disc.holder;
    const thrower = match.players[holder]!;
    park(match, [holder]);
    const flight = flightTo({ x: thrower.x, y: thrower.y }, { x: thrower.x + 280, y: thrower.y + 40 }, 'floater', 0);
    launch(match, flight, holder);
    for (let i = 0; i < 130; i += 1) step(match, 1 / 60, idle);
    expect(match.message).toBe('INCOMPLETE');
    expect(match.phase).toBe('celebrate');
    const landed = match.disc.x;
    for (let i = 0; i < 140; i += 1) step(match, 1 / 60, idle);
    expect(match.poss).toBe(1);
    expect(match.disc.mode).toBe('held');
    expect(Math.abs(match.disc.x - landed)).toBeLessThan(280);
  });

  it('completes when a receiver is inside the catch radius', () => {
    const match = fresh();
    const holder = match.disc.holder;
    const thrower = match.players[holder]!;
    const spot = { x: thrower.x + 200, y: thrower.y };
    park(match, [holder, 0]);
    const receiver = match.players[0]!;
    receiver.route = 'thrower';
    receiver.x = spot.x;
    receiver.y = spot.y;
    receiver.homeX = spot.x;
    receiver.homeY = spot.y;
    launch(match, flightTo({ x: thrower.x, y: thrower.y }, spot, 'floater', 0), holder);
    for (let i = 0; i < 140; i += 1) {
      step(match, 1 / 60, idle);
      if (match.disc.mode === 'held') break;
    }
    expect(match.disc.holder).toBe(0);
    expect(match.poss).toBe(0);
    expect(match.message).not.toBe('INCOMPLETE');
  });

  it('misses a receiver standing outside the catch radius', () => {
    const match = fresh();
    const holder = match.disc.holder;
    const thrower = match.players[holder]!;
    const spot = { x: thrower.x + 220, y: thrower.y };
    park(match, [holder, 0]);
    const receiver = match.players[0]!;
    receiver.route = 'thrower';
    receiver.x = spot.x;
    receiver.y = spot.y + 90;
    receiver.homeX = receiver.x;
    receiver.homeY = receiver.y;
    launch(match, flightTo({ x: thrower.x, y: thrower.y }, spot, 'floater', 0), holder);
    for (let i = 0; i < 130; i += 1) step(match, 1 / 60, idle);
    expect(match.message).toBe('INCOMPLETE');
  });
});

describe('end zone', () => {
  it('scores when the disc is caught in the end zone', () => {
    const match = fresh();
    const holder = match.disc.holder;
    const thrower = match.players[holder]!;
    const spotAt = { x: EZ_RIGHT_START + 60, y: thrower.y };
    park(match, [holder, 0]);
    const receiver = match.players[0]!;
    receiver.route = 'thrower';
    receiver.x = spotAt.x;
    receiver.y = spotAt.y;
    receiver.homeX = spotAt.x;
    receiver.homeY = spotAt.y;
    launch(match, flightTo({ x: thrower.x, y: thrower.y }, spotAt, 'floater', 0), holder);
    for (let i = 0; i < 140; i += 1) {
      step(match, 1 / 60, idle);
      if (match.message === 'GOAL') break;
    }
    expect(match.message).toBe('GOAL');
    expect(match.score[0]).toBe(1);
  });

  it('does not score a catch short of the goal line', () => {
    const match = fresh();
    const holder = match.disc.holder;
    const thrower = match.players[holder]!;
    const spotAt = { x: EZ_RIGHT_START - 90, y: thrower.y };
    park(match, [holder, 0]);
    const receiver = match.players[0]!;
    receiver.route = 'thrower';
    receiver.x = spotAt.x;
    receiver.y = spotAt.y;
    receiver.homeX = spotAt.x;
    receiver.homeY = spotAt.y;
    launch(match, flightTo({ x: thrower.x, y: thrower.y }, spotAt, 'floater', 0), holder);
    for (let i = 0; i < 140; i += 1) {
      step(match, 1 / 60, idle);
      if (match.disc.mode === 'held') break;
    }
    expect(match.message).toBe('CATCH');
    expect(match.score[0]).toBe(0);
  });
});

describe('roles and coverage', () => {
  it('does not let the thrower run or switch on offense', () => {
    const match = fresh();
    const holder = match.disc.holder;
    const x = match.players[holder]!.x;
    step(match, 0.2, { moveX: 1, moveY: 0, flight: null, switchTo: 0, lunge: false });
    expect(match.control).toBe(holder);
    expect(match.players[holder]!.x).toBeCloseTo(x, 0);
  });

  it('moves receivers on their routes while the thrower is planted', () => {
    const match = fresh();
    const deep = match.players[5]!;
    const before = deep.x;
    const lane = deep.y;
    for (let i = 0; i < 40; i += 1) step(match, 1 / 60, idle);
    expect(match.phase).toBe('ready');
    expect(match.clock).toBe(60);
    expect(deep.x).toBeGreaterThan(before + 20);
    expect(Math.abs(deep.y - lane)).toBeLessThan(40);
  });

  it('switches the controlled runner on defense', () => {
    const match = fresh();
    match.poss = 1;
    spot(match, 2000);
    expect(match.control).toBe(3);
    const before = match.players[1]!.x;
    step(match, 0.35, { moveX: 1, moveY: 0, flight: null, switchTo: 1, lunge: false });
    expect(match.control).toBe(1);
    expect(match.players[1]!.x).toBeGreaterThan(before + 5);
  });

  it('drops defenders into zones instead of glued pairs', () => {
    const match = fresh();
    let closest = Infinity;
    for (let d = 7; d < 14; d += 1) {
      for (let o = 0; o < 7; o += 1) {
        const def = match.players[d]!;
        const off = match.players[o]!;
        closest = Math.min(closest, Math.hypot(def.x - off.x, def.y - off.y));
      }
    }
    expect(closest).toBeGreaterThan(80);
    const thrower = match.players[match.disc.holder]!;
    let rush = Infinity;
    for (let d = 7; d < 14; d += 1) {
      const def = match.players[d]!;
      rush = Math.min(rush, Math.hypot(def.x - thrower.x, def.y - thrower.y));
    }
    expect(rush).toBeGreaterThan(110);
  });
});

describe('flight plan', () => {
  it('builds a free-point floater from a slow drag', () => {
    const flight = flightFromPlan(
      { x: 100, y: 200 },
      { kind: 'floater', aim: { x: 1, y: 0 }, power: 1 },
      0,
    );
    expect(flight.aim.x).toBe(1);
    expect(flight.speed * flight.hang).toBeGreaterThan(400);
  });
});
