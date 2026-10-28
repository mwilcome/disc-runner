import { describe, expect, it } from 'vitest';
import { applyResult, buyUpgrade, newCareer, opponentIndex, reward, upgradeCost } from './career';

describe('season', () => {
  it('plays three weeks, a playoff, and a final', () => {
    let career = newCareer(0);
    const stages = ['reg1', 'reg2', 'reg3', 'semi', 'final', 'done'];
    expect(career.stage).toBe(stages[0]);
    for (let i = 0; i < 5; i += 1) {
      expect(opponentIndex(career.team, career.stage)).not.toBe(career.team);
      career = applyResult(career, 2, i === 4 ? 3 : 1);
      expect(career.stage).toBe(stages[i + 1]);
    }
    expect(career.wins).toBe(4);
    expect(career.losses).toBe(1);
  });

  it('pays for goals and spends coins on throw, speed, and catch', () => {
    let career = newCareer(1);
    career = { ...career, coins: reward(2, true) };
    expect(career.coins).toBe(56);
    expect(upgradeCost(0)).toBe(30);
    career = buyUpgrade(career, 'throw');
    career = buyUpgrade(career, 'speed');
    expect(career.throw).toBe(1);
    expect(career.speed).toBe(0);
    expect(career.coins).toBe(26);
    career = { ...career, coins: 300 };
    career = buyUpgrade(career, 'catch');
    career = buyUpgrade(career, 'catch');
    career = buyUpgrade(career, 'catch');
    career = buyUpgrade(career, 'catch');
    expect(career.catch).toBe(3);
  });
});
