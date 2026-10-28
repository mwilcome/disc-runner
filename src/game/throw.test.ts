import { describe, expect, it } from 'vitest';
import { FIELD, isEndZone } from './field';
import {
  airReach,
  assistedPlan,
  discFromPlan,
  discSample,
  discToTarget,
  dragToThrow,
  releaseSpeed,
  sweetSpot,
  TUNING,
} from './throw';

describe('dragToThrow', () => {
  it('flies opposite the drag', () => {
    const plan = dragToThrow({ dx: 0, dy: 120, durationMs: 400, releaseSpeed: 0.2 });
    expect(plan).not.toBeNull();
    expect(plan!.aim.x).toBeCloseTo(0, 5);
    expect(plan!.aim.y).toBeCloseTo(-1, 5);
    expect(plan!.kind).toBe('floater');
    expect(plan!.power).toBeGreaterThan(0.5);
    expect(plan!.power).toBeLessThanOrEqual(1);
  });

  it('aims left when the drag goes right', () => {
    const plan = dragToThrow({ dx: 80, dy: 30, durationMs: 360, releaseSpeed: 0.1 })!;
    expect(plan.aim.x).toBeLessThan(0);
    expect(Math.hypot(plan.aim.x, plan.aim.y)).toBeCloseTo(1, 5);
  });

  it('ignores a tap that is too short to be a throw', () => {
    expect(dragToThrow({ dx: 8, dy: 10, durationMs: 40, releaseSpeed: 2 })).toBeNull();
  });

  it('clamps a long pull to full power', () => {
    const plan = dragToThrow({ dx: 0, dy: 400, durationMs: 500, releaseSpeed: 0.2 })!;
    expect(plan.power).toBe(1);
  });

  it('calls a fast or very short drag a flick', () => {
    expect(dragToThrow({ dx: 0, dy: 100, durationMs: 400, releaseSpeed: 1.2 })!.kind).toBe('flick');
    expect(dragToThrow({ dx: 0, dy: 80, durationMs: 120, releaseSpeed: 0.1 })!.kind).toBe('flick');
    expect(dragToThrow({ dx: 0, dy: 100, durationMs: 280, releaseSpeed: 0.2 })!.kind).toBe('floater');
  });
});

describe('releaseSpeed', () => {
  it('measures the recent window and ignores a single sample', () => {
    expect(releaseSpeed([{ t: 0, x: 0, y: 0 }])).toBe(0);
    const speed = releaseSpeed([
      { t: 0, x: 0, y: 0 },
      { t: 40, x: 0, y: 20 },
      { t: 80, x: 0, y: 60 },
    ]);
    expect(speed).toBeCloseTo(60 / 80, 5);
  });
});

describe('trajectory', () => {
  it('keeps a flick faster and lower than a floater', () => {
    const origin = { x: 0, y: 0 };
    const flick = discFromPlan(origin, { kind: 'flick', aim: { x: 0, y: -1 }, power: 1 });
    const floater = discFromPlan(origin, { kind: 'floater', aim: { x: 0, y: -1 }, power: 1 });
    const flickAt = discSample({ ...flick, age: 0.25 });
    const floatAt = discSample({ ...floater, age: 0.25 });
    expect(Math.abs(flickAt.y)).toBeGreaterThan(Math.abs(floatAt.y));
    expect(floater.maxZ).toBeGreaterThan(flick.maxZ);
    expect(floater.hang).toBeGreaterThan(flick.hang);
    expect(floater.catchRadius).toBeGreaterThan(flick.catchRadius);
    expect(TUNING.floater.maxZ).toBeGreaterThan(1);
    expect(TUNING.flick.maxZ).toBeLessThan(1);
  });

  it('can reach the end zone in the air with either throw', () => {
    expect(airReach(FIELD.plantY, FIELD.endZoneBottom, 'floater')).toBe(true);
    expect(airReach(FIELD.plantY, FIELD.endZoneBottom, 'flick')).toBe(true);
  });

  it('locks a floater aimed near the cutter and leaves a flick alone', () => {
    const origin = { x: FIELD.plantX, y: FIELD.plantY };
    const target = { x: FIELD.lanes[0], y: 214 };
    const angle = Math.atan2(target.y - origin.y, target.x - origin.x);
    const off = angle + (20 * Math.PI) / 180;
    const floater = assistedPlan(
      origin,
      { kind: 'floater', aim: { x: Math.cos(off), y: Math.sin(off) }, power: 0.3 },
      target,
    );
    const toTarget = Math.atan2(target.y - origin.y, target.x - origin.x);
    const locked = Math.atan2(floater.aim.y, floater.aim.x);
    expect(Math.abs(locked - toTarget)).toBeLessThan(0.05);

    const flick = assistedPlan(
      origin,
      { kind: 'flick', aim: { x: Math.cos(off), y: Math.sin(off) }, power: 1 },
      target,
    );
    expect(flick.aim.x).toBeCloseTo(Math.cos(off), 5);
    expect(assistedPlan(origin, floater, null).aim).toEqual(floater.aim);
  });

  it('puts a full-power aim ring inside the end zone', () => {
    for (const kind of ['floater', 'flick'] as const) {
      const plan = dragToThrow({ dx: 0, dy: 400, durationMs: 500, releaseSpeed: kind === 'flick' ? 1.4 : 0.1 })!;
      expect(plan.power).toBe(1);
      expect(plan.kind).toBe(kind);
      const ring = sweetSpot({ x: FIELD.plantX, y: FIELD.plantY }, plan);
      expect(isEndZone(ring.y)).toBe(true);
    }
  });

  it('puts an aimed pass on the target while it is still catchable', () => {
    const origin = { x: 10, y: 400 };
    const target = { x: 80, y: 220 };
    const disc = discToTarget(origin, target, 'floater', 0.6, 'player');
    const at = discSample({ ...disc, age: 0.6 });
    expect(at.x).toBeCloseTo(target.x, 3);
    expect(at.y).toBeCloseTo(target.y, 3);
    expect(at.z).toBeGreaterThan(disc.zMin);
    expect(at.z).toBeLessThan(disc.zMax);
    expect(disc.hang).toBeGreaterThan(0.6);
  });
});
