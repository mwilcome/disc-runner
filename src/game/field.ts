export interface Vec {
  x: number;
  y: number;
}

export const VIEW_W = 960;
export const VIEW_H = 540;

export const PITCH_LEFT = 100;
export const EZ_DEPTH = 520;
export const YARD = 40;
export const PLAY_LEN = 70 * YARD;
export const EZ_LEFT_END = PITCH_LEFT + EZ_DEPTH;
export const EZ_RIGHT_START = EZ_LEFT_END + PLAY_LEN;
export const PITCH_RIGHT = EZ_RIGHT_START + EZ_DEPTH;
export const WORLD_W = PITCH_RIGHT + 160;

export const SIDELINE_TOP = 82;
export const SIDELINE_BOT = 468;
export const MID_Y = (SIDELINE_TOP + SIDELINE_BOT) / 2;

/** Opening spot sits in the attacking red zone so one floater can finish. */
export const OPEN_X = 3000;

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function isEndZone(x: number, dir: 1 | -1): boolean {
  if (dir > 0) return x >= EZ_RIGHT_START && x <= PITCH_RIGHT;
  return x >= PITCH_LEFT && x <= EZ_LEFT_END;
}

export function inBounds(x: number, y: number): boolean {
  return x >= PITCH_LEFT && x <= PITCH_RIGHT && y >= SIDELINE_TOP && y <= SIDELINE_BOT;
}
