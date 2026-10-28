import { describe, expect, it } from 'vitest';
import { EZ_RIGHT_START, OPEN_X, isEndZone } from './field';
import { assistFlight, dragToThrow, flightTime, flightTo, releaseSpeed, routePoint, routeSpeed, sampleFlight } from './throw';

describe('dragToThrow', () => {
  it('flies opposite the drag', () => {
    const plan = dragToThrow({ dx: -120, dy: 0, durationMs: 400, releaseSpeed: 0.1 });
    expect(plan?.aim.x).toBeCloseTo(1, 5);
    expect(plan?.kind).toBe('floater');
  });

  it('calls a fast drag a flick', () => {
    expect(dragToThrow({ dx: -80, dy: 10, durationMs: 400, releaseSpeed: 1.1 })?.kind).toBe('flick');
    expect(dragToThrow({ dx: -80, dy: 0, durationMs: 120, releaseSpeed: 0.1 })?.kind).toBe('flick');
    expect(dragToThrow({ dx: 4, dy: 4, durationMs: 40, releaseSpeed: 2 })).toBeNull();
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
    const at = sampleFlight(flight, flightTime('floater'));
    expect(at.x).toBeCloseTo(lead.x, 1);
    expect(at.z).toBeGreaterThan(0.4);
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

  it('locks a floater aimed near a receiver and leaves a sideways flick alone', () => {
    const origin = { x: 0, y: 0 };
    const lead = { x: 200, y: 40 };
    const toward = dragToThrow({ dx: -200, dy: -30, durationMs: 400, releaseSpeed: 0.1 })!;
    const locked = assistFlight(origin, toward, [lead], 0);
    expect(locked.aim.y).toBeGreaterThan(0);
    const at = sampleFlight(locked, flightTime('floater'));
    expect(at.x).toBeCloseTo(lead.x, 0);
    const flick = dragToThrow({ dx: 0, dy: -80, durationMs: 100, releaseSpeed: 1 })!;
    const raw = assistFlight(origin, flick, [lead], 0);
    expect(Math.abs(raw.aim.x)).toBeLessThan(0.2);
  });
});
