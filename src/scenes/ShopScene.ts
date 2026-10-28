import Phaser from 'phaser';
import { drawBit, textWidth } from '../game/art';
import { buyUpgrade, loadCareer, saveCareer, upgradeCost, type Career } from '../game/career';
import { VIEW_W } from '../game/field';
import { addButton, paintBar, paintPanel } from './ui';

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
    paintBar(g, VIEW_W);
    paintPanel(g, 70, 64, 820, 420);
    const title = 'UPGRADES';
    drawBit(g, title, 28, 14, 0xf4f0e0, 3);
    const coins = `COINS ${career.coins}`;
    drawBit(g, coins, VIEW_W - 28 - textWidth(coins, 3), 14, 0xffd15c, 3);

    STATS.forEach(([label, key], i) => {
      const y = 110 + i * 100;
      const level = career[key];
      g.fillStyle(0x102418, 1);
      g.fillRoundedRect(100, y, 760, 82, 8);
      g.lineStyle(2, 0xf4f0e0, 0.85);
      g.strokeRoundedRect(100, y, 760, 82, 8);
      drawBit(g, label, 124, y + 28, 0xf4f0e0, 3);
      for (let n = 0; n < 3; n += 1) {
        const px = 330 + n * 52;
        g.fillStyle(n < level ? 0xffd15c : 0x102418, 1);
        g.fillRoundedRect(px, y + 26, 44, 28, 3);
        g.lineStyle(3, n < level ? 0xfff6e4 : 0xf4f0e0, 1);
        g.strokeRoundedRect(px, y + 26, 44, 28, 3);
      }
      if (level < 3) {
        const cost = upgradeCost(level);
        addButton(this, 760, y + 42, `+ ${cost}`, 2, career.coins >= cost ? 0x145c30 : 0x3a4038, () => {
          const next = buyUpgrade(career, key);
          if (next === career) return;
          saveCareer(next);
          this.draw(next);
        });
      } else {
        drawBit(g, 'MAX', 730, y + 30, 0xffd15c, 3);
      }
    });
    addButton(this, VIEW_W / 2, 440, 'BACK', 3, 0x17356e, () => this.scene.start('hub'));
  }
}
