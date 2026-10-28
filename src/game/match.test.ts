import { describe, expect, it } from 'vitest';
import { createMatch, launch, receiverLeads, step, type FrameInput } from './match';
import { flightTime, flightTo } from './throw';

const idle: FrameInput = { moveX: 0, moveY: 0, flight: null, switchTo: null, lunge: false };

describe('opening floater', () => {
  it('scores when the disc meets the deep route in the end zone', () => {
    const match = createMatch({
      userSquad: 0,
      oppSquad: 1,
      halfLength: 60,
      throwLv: 0,
      speedLv: 0,
      catchLv: 0,
    });
    const leads = receiverLeads(match, 'floater');
    const lead = leads.reduce((best, next) => (next.x > best.x ? next : best));
    expect(lead.x).toBeGreaterThan(3400);
    const holder = match.players[match.disc.holder]!;
    launch(match, flightTo({ x: holder.x, y: holder.y }, lead, 'floater', 0), match.disc.holder);
    const frames = Math.ceil(flightTime('floater') / (1 / 60)) + 2;
    for (let i = 0; i < frames; i += 1) step(match, 1 / 60, idle);
    expect(match.score[0]).toBe(1);
    expect(match.message).toBe('GOAL');
  });
});
