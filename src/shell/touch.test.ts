import { describe, expect, it } from 'vitest';
import { clientToGame } from './touch';

describe('clientToGame', () => {
  it('maps a retina CSS box into the 960x540 world, including camera scroll', () => {
    const rect = { left: 100, top: 50, width: 480, height: 270 };
    expect(clientToGame(100, 50, rect, 960, 540, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(clientToGame(340, 185, rect, 960, 540, 0, 0)).toEqual({ x: 480, y: 270 });
    expect(clientToGame(580, 320, rect, 960, 540, 12, 8)).toEqual({ x: 972, y: 548 });
  });

  it('does not divide by a zero-size canvas', () => {
    const point = clientToGame(10, 10, { left: 0, top: 0, width: 0, height: 0 }, 960, 540, 0, 0);
    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.y)).toBe(true);
  });
});
