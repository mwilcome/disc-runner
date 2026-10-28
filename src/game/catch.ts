import type { Vec } from './field';
import type { Disc, DiscSample, ThrowKind } from './throw';

/** Ground radius of the mark. A flick has to miss it; a floater can sail over. */
export const MARK_RADIUS = {
  floater: 28,
  flick: 26,
} as const;

const CONTEST_MAX_Z = {
  floater: 0.82,
  flick: 1.35,
} as const;

export function scoreValue(kind: ThrowKind): number {
  return kind === 'flick' ? 2 : 1;
}

export function inCatchWindow(sample: DiscSample, receiver: Vec, disc: Disc): boolean {
  if (disc.age < 0.04) return false;
  if (sample.z < disc.zMin || sample.z > disc.zMax) return false;
  const dx = sample.x - receiver.x;
  const dy = sample.y - receiver.y;
  return dx * dx + dy * dy <= disc.catchRadius * disc.catchRadius;
}

export function isContested(sample: DiscSample, mark: Vec, kind: ThrowKind): boolean {
  if (sample.z <= 0.05 || sample.z > CONTEST_MAX_Z[kind]) return false;
  const dx = sample.x - mark.x;
  const dy = sample.y - mark.y;
  const radius = MARK_RADIUS[kind];
  return dx * dx + dy * dy <= radius * radius;
}
