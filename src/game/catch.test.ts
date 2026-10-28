import { describe, expect, it } from 'vitest';
import { inCatchWindow, isContested, scoreValue } from './catch';
import { discFromPlan, TUNING, type Disc } from './throw';

function disc(kind: Disc['kind'], radius = 40): Disc {
  const made = discFromPlan({ x: 0, y: 0 }, { kind, aim: { x: 0, y: -1 }, power: 1 });
  return { ...made, age: 0.3, catchRadius: radius };
}

describe('catch window', () => {
  it('catches inside the radius at a legal height', () => {
    const d = disc('floater', 40);
    expect(inCatchWindow({ x: 10, y: 10, z: 0.8 }, { x: 0, y: 0 }, d)).toBe(true);
    expect(inCatchWindow({ x: 80, y: 0, z: 0.8 }, { x: 0, y: 0 }, d)).toBe(false);
  });

  it('rejects a disc that is still in the hand or too low', () => {
    const d = disc('flick', 40);
    expect(inCatchWindow({ x: 0, y: 0, z: 0.5 }, { x: 0, y: 0 }, { ...d, age: 0.01 })).toBe(false);
    expect(inCatchWindow({ x: 0, y: 0, z: 0 }, { x: 0, y: 0 }, d)).toBe(false);
  });

  it('gives the floater a wider window than the flick', () => {
    expect(TUNING.floater.catchRadius).toBeGreaterThan(TUNING.flick.catchRadius);
    expect(TUNING.floater.zMax).toBeGreaterThan(TUNING.flick.zMax);
  });
});

describe('mark', () => {
  const mark = { x: 0, y: 100 };

  it('lets a floater sail over a mark that knocks a flick down', () => {
    expect(isContested({ x: 0, y: 100, z: 1.2 }, mark, 'floater')).toBe(false);
    expect(isContested({ x: 0, y: 100, z: 0.45 }, mark, 'flick')).toBe(true);
    expect(isContested({ x: 80, y: 100, z: 0.45 }, mark, 'flick')).toBe(false);
  });
});

describe('score', () => {
  it('pays more for a flick', () => {
    expect(scoreValue('flick')).toBeGreaterThan(scoreValue('floater'));
    expect(scoreValue('floater')).toBe(1);
    expect(scoreValue('flick')).toBe(2);
  });
});
