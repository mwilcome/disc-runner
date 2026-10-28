import { describe, expect, it } from 'vitest';
import {
  FIELD,
  clampLane,
  cutterSpot,
  isEndZone,
  nearestLane,
  returnSpot,
} from './field';

describe('field', () => {
  it('snaps x to the nearest of three lanes and clamps the edges', () => {
    expect(nearestLane(FIELD.lanes[0] + 10)).toBe(0);
    expect(nearestLane(FIELD.plantX)).toBe(1);
    expect(nearestLane(FIELD.lanes[2] - 4)).toBe(2);
    expect(clampLane(-3)).toBe(0);
    expect(clampLane(1)).toBe(1);
    expect(clampLane(8)).toBe(2);
  });

  it('treats the top band as the end zone', () => {
    expect(isEndZone(FIELD.endZoneBottom)).toBe(true);
    expect(isEndZone(FIELD.endZoneBottom + 1)).toBe(false);
    expect(isEndZone(FIELD.minY)).toBe(true);
  });

  it('sends the cutter from the wide side into the end zone', () => {
    const anchor = { x: FIELD.plantX, y: FIELD.plantY };
    const start = cutterSpot(anchor, 0, 0);
    const end = cutterSpot(anchor, 4, 0);
    expect(start.x).toBeGreaterThan(FIELD.lanes[1]);
    expect(start.y).toBeLessThan(anchor.y);
    expect(end.x).toBeCloseTo(FIELD.lanes[0], 0);
    expect(isEndZone(end.y)).toBe(true);
  });

  it('leads the first return short of the end zone and the next one into it', () => {
    const first = returnSpot(FIELD.plantY, 2);
    expect(first.x).toBe(FIELD.lanes[2]);
    expect(isEndZone(first.y)).toBe(false);
    expect(isEndZone(returnSpot(first.y, 0).y)).toBe(true);
  });
});
