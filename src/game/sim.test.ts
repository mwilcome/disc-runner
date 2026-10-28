import { describe, expect, it } from 'vitest';
import { FIELD, cutterSpot, isEndZone } from './field';
import { createMatch, releaseDisc, throwDisc, tick, type Match } from './sim';
import { discToTarget } from './throw';

const FRAME = 1 / 60;

function tickFor(match: Match, seconds: number, laneStep: -1 | 0 | 1 = 0): Match {
  const steps = Math.max(1, Math.round(seconds / FRAME));
  let step: -1 | 0 | 1 = laneStep;
  for (let i = 0; i < steps; i += 1) {
    match = tick(match, { dt: FRAME, laneStep: step });
    step = 0;
  }
  return match;
}

describe('match', () => {
  it('starts planted with the disc', () => {
    const match = createMatch();
    expect(match.phase).toBe('throw');
    expect(match.disc).toBeNull();
    expect(match.score).toBe(0);
    expect(match.player.y).toBe(FIELD.plantY);
  });

  it('moves the cutter upfield while you hold the disc', () => {
    const start = createMatch();
    const later = tickFor(start, 0.8);
    expect(later.phase).toBe('throw');
    expect(later.cutter.y).toBeLessThan(start.cutter.y);
  });

  it('throws upfield on a downward drag and ignores a tap', () => {
    let match = createMatch();
    match = throwDisc(match, { dx: 4, dy: 6, durationMs: 80, releaseSpeed: 1 });
    expect(match.phase).toBe('throw');
    match = throwDisc(match, { dx: 0, dy: 130, durationMs: 420, releaseSpeed: 0.15 });
    expect(match.phase).toBe('flight');
    expect(match.disc?.kind).toBe('floater');
    expect(match.disc?.aim.y).toBeLessThan(0);
  });

  it('completes a floater to the cutter and sends you on the run', () => {
    let match = createMatch();
    const flight = 0.55;
    const future = cutterSpot(match.routeAnchor, match.cutterElapsed + flight, match.cutterCutLane);
    expect(isEndZone(future.y)).toBe(false);
    match = releaseDisc(match, discToTarget(match.player, future, 'floater', flight, 'player'));
    match = tickFor(match, flight + 0.05);
    expect(match.phase).toBe('run');
    expect(match.score).toBe(0);
    expect(match.returnLane).not.toBe(match.player.lane);
    expect(match.message).toBe('Slide to the mark');
  });

  it('plants you when the return arrives in your lane', () => {
    let match = createMatch();
    const flight = 0.55;
    const future = cutterSpot(match.routeAnchor, flight, match.cutterCutLane);
    match = releaseDisc(match, discToTarget(match.player, future, 'floater', flight, 'player'));
    match = tickFor(match, flight + 0.05);
    expect(match.phase).toBe('run');
    const step: -1 | 0 | 1 = match.returnLane! > match.player.lane ? 1 : -1;
    match = tickFor(match, 1.4, step);
    expect(match.phase).toBe('throw');
    expect(match.submessage).toBe('Planted');
    expect(match.player.y).toBeLessThan(FIELD.plantY);
    expect(match.score).toBe(0);
  });

  it('drops the return if you stay in the wrong lane, then resets the drive', () => {
    let match = createMatch();
    const flight = 0.55;
    const future = cutterSpot(match.routeAnchor, flight, match.cutterCutLane);
    match = releaseDisc(match, discToTarget(match.player, future, 'floater', flight, 'player'));
    match = tickFor(match, flight + 0.05);
    let guard = 0;
    while (match.phase === 'run' && guard < 200) {
      match = tick(match, { dt: FRAME });
      guard += 1;
    }
    expect(match.celebrate).toBe('drop');
    expect(match.score).toBe(0);
    match = tickFor(match, 1);
    expect(match.phase).toBe('throw');
    expect(match.player.y).toBe(FIELD.plantY);
  });

  it('scores two for a flick caught in the end zone and keeps the score', () => {
    let match = tickFor(createMatch(), 4);
    expect(isEndZone(match.cutter.y)).toBe(true);
    const flight = 0.42;
    match = releaseDisc(
      match,
      discToTarget(match.player, { x: match.cutter.x, y: match.cutter.y }, 'flick', flight, 'player'),
    );
    match = tickFor(match, flight + 0.08);
    expect(match.celebrate).toBe('score');
    expect(match.score).toBe(2);
    expect(match.submessage).toBe('+2 flick');
    match = tickFor(match, 1.3);
    expect(match.phase).toBe('throw');
    expect(match.score).toBe(2);
    expect(match.player.y).toBe(FIELD.plantY);
  });

  it('knocks down a flick through the mark and lets a floater sail over', () => {
    const flick = releaseDisc(
      createMatch(),
      discToTarget(createMatch().player, createMatch().defender, 'flick', 0.4, 'player'),
    );
    expect(tickFor(flick, 0.45).celebrate).toBe('drop');

    let floater = createMatch();
    floater = releaseDisc(floater, discToTarget(floater.player, floater.defender, 'floater', 0.45, 'player'));
    const floated = tickFor(floater, 0.45);
    expect(floated.celebrate).not.toBe('drop');
  });

  it('does not change lanes past the sideline', () => {
    let match = createMatch();
    const flight = 0.55;
    const future = cutterSpot(match.routeAnchor, flight, match.cutterCutLane);
    match = releaseDisc(match, discToTarget(match.player, future, 'floater', flight, 'player'));
    match = tickFor(match, flight + 0.05);
    match = tick(match, { dt: FRAME, laneStep: -1 });
    expect(match.player.lane).toBe(0);
    match = tick(match, { dt: FRAME, laneStep: -1 });
    expect(match.player.lane).toBe(0);
  });
});
