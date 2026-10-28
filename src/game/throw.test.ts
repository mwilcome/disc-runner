import { describe, expect, it } from 'vitest';
import { EZ_RIGHT_START, OPEN_X, isEndZone } from './field';
import { assistFlight, dragToThrow, flightFromPlan, flightTime, flightTo, landingOf, releaseSpeed, routePoint, routeSpeed, sampleFlight } from './throw';

describe('dragToThrow', () => {
  it('flies opposite the drag', () => {
    const plan = dragToThrow({ dx: -120, dy: 0, durationMs: 400, releaseSpeed: 0.1 });
    expect(plan?.aim.x).toBeCloseTo(1, 5);
    expect(plan?.kind).toBe('floater');
  });

  it('calls a fast release a flick and ignores a short pull', () => {
    expect(dragToThrow({ dx: -80, dy: 10, durationMs: 400, releaseSpeed: 1.1 })?.kind).toBe('flick');
    expect(dragToThrow({ dx: -80, dy: 0, durationMs: 120, releaseSpeed: 0.1 })?.kind).toBe('floater');
    expect(dragToThrow({ dx: 8, dy: 4, durationMs: 40, releaseSpeed: 2 })).toBeNull();
  });
});

describe('releaseSpeed', () => {
  it('measures the recent window', () => {
    expect(releaseSpeed([{ t: 0, x: 0, y: 0 }])).toBe(0);
    expect(
      releaseSpeed([
        { t: 0, x: 0, y: 0 },
        { t: 40, x: 20, y: 0 },
        { t: 80, x: 60, y: 0 },
      ]),
    ).toBeCloseTo(60 / 80, 5);
  });
});

describe('routes and flight', () => {
  it('puts a full floater to the deep route in the end zone', () => {
    const home = { x: EZ_RIGHT_START - 180, y: 300 };
    const lead = routePoint(home, 'deep', 1, flightTime('floater'), routeSpeed(0));
    expect(isEndZone(lead.x, 1)).toBe(true);
    expect(lead.x).toBeGreaterThan(EZ_RIGHT_START);
    const flight = flightTo({ x: OPEN_X - 52, y: 300 }, lead, 'floater', 0);
    const mid = sampleFlight(flight, flight.hang * 0.5);
    const at = sampleFlight(flight, flight.hang);
    expect(mid.z).toBeGreaterThan(0.4);
    expect(at.x).toBeCloseTo(lead.x, 0);
    expect(at.z).toBe(0);
    expect(flight.maxZ).toBeGreaterThan(1);
  });

  it('keeps a flick lower and faster to arrive', () => {
    const lead = { x: 400, y: 300 };
    const floater = flightTo({ x: 100, y: 300 }, lead, 'floater', 0);
    const flick = flightTo({ x: 100, y: 300 }, lead, 'flick', 0);
    expect(flightTime('flick')).toBeLessThan(flightTime('floater'));
    expect(flick.maxZ).toBeLessThan(floater.maxZ);
    expect(sampleFlight(flick, flightTime('flick') * 0.5).z).toBeLessThan(
      sampleFlight(floater, flightTime('floater') * 0.5).z,
    );
  });

  it('keeps a slingshot on the drag even when a receiver is nearby', () => {
    const origin = { x: 0, y: 0 };
    const lead = { x: 200, y: 80 };
    const toward = dragToThrow({ dx: -200, dy: 0, durationMs: 400, releaseSpeed: 0.1 })!;
    const flight = assistFlight(origin, toward, [lead], 0);
    expect(flight.aim.x).toBeCloseTo(1, 5);
    expect(flight.aim.y).toBeCloseTo(0, 5);
    const at = sampleFlight(flight, flight.hang);
    expect(Math.abs(at.y - lead.y)).toBeGreaterThan(40);
    expect(landingOf(flight).x).toBeCloseTo(at.x, 4);
    expect(landingOf(flight).y).toBeCloseTo(at.y, 4);
  });

  it('puts the crosshair on the same spot the disc reaches', () => {
    const plan = dragToThrow({ dx: -90, dy: 30, durationMs: 360, releaseSpeed: 0.2 })!;
    const flight = flightFromPlan({ x: 40, y: 80 }, plan, 0);
    const land = landingOf(flight);
    const at = sampleFlight(flight, flight.hang);
    expect(at.x).toBeCloseTo(land.x, 4);
    expect(at.y).toBeCloseTo(land.y, 4);
    expect(at.z).toBe(0);
  });
});
