import Phaser from 'phaser';
import { drawBit, textWidth } from '../game/art';
import { buyUpgrade, loadCareer, saveCareer, upgradeCost, type Career } from '../game/career';
import { VIEW_W } from '../game/field';
import { addButton } from './ui';

const STATS = [
  ['THROW', 'throw'],
  ['SPEED', 'speed'],
  ['CATCH', 'catch'],
] as const;

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('shop');
  }

  create(): void {
    const career = loadCareer();
    if (!career) {
      this.scene.start('title');
      return;
    }
    this.draw(career);
  }

  private draw(career: Career): void {
    this.children.removeAll(true);
    this.cameras.main.setBackgroundColor('#102418');
    const g = this.add.graphics();
    g.fillStyle(0x163222, 1);
    g.fillRoundedRect(70, 30, 820, 480, 12);
    g.lineStyle(3, 0xf4f0e0, 1);
    g.strokeRoundedRect(70, 30, 820, 480, 12);
    const title = 'UPGRADES';
    drawBit(g, title, (VIEW_W - textWidth(title, 4)) / 2, 52, 0xf4f0e0, 4);
    const coins = `COINS ${career.coins}`;
    drawBit(g, coins, (VIEW_W - textWidth(coins, 3)) / 2, 100, 0xffd15c, 3);

    STATS.forEach(([label, key], i) => {
      const y = 180 + i * 80;
      const level = career[key];
      const pips = `${label}  ${'O'.repeat(level)}${'-'.repeat(3 - level)}`;
      drawBit(g, pips, 120, y, 0xf4f0e0, 3);
      if (level < 3) {
        const cost = upgradeCost(level);
        addButton(this, 760, y + 8, `+ ${cost}`, 2, career.coins >= cost ? 0x145c30 : 0x3a4038, () => {
          const next = buyUpgrade(career, key);
          if (next === career) return;
          saveCareer(next);
          this.draw(next);
        });
      }
    });
    addButton(this, VIEW_W / 2, 460, 'BACK', 3, 0x17356e, () => this.scene.start('hub'));
  }
}
