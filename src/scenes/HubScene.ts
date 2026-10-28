import Phaser from 'phaser';
import { athleteKey, buildTextures, drawBit, hexColor, textWidth } from '../game/art';
import {
  SQUADS,
  loadCareer,
  newSeason,
  opponentIndex,
  saveCareer,
  stageLabel,
  type Career,
} from '../game/career';
import { VIEW_W } from '../game/field';
import { addButton, paintBar, paintPanel } from './ui';

export class HubScene extends Phaser.Scene {
  constructor() {
    super('hub');
  }

  create(): void {
    const career = loadCareer();
    if (!career) {
      this.scene.start('title');
      return;
    }
    buildTextures(this);
    this.cameras.main.setBackgroundColor('#102418');
    const g = this.add.graphics();
    paintBar(g, VIEW_W);
    paintPanel(g, 48, 64, 864, 420);

    const squad = SQUADS[career.team]!;
    const head = `${squad.name}  S${career.season}`;
    drawBit(g, head, 28, 14, 0xf4f0e0, 3);
    const coins = `COINS ${career.coins}`;
    drawBit(g, coins, VIEW_W - 28 - textWidth(coins, 3), 14, 0xffd15c, 3);

    const record = `RECORD ${career.wins}-${career.losses}`;
    drawBit(g, record, 80, 96, 0xffd15c, 3);

    if (career.stage === 'done') {
      drawBit(g, 'SEASON OVER', 80, 160, 0xf4f0e0, 4);
      addButton(this, 230, 280, 'NEW SEASON', 3, 0x145c30, () => {
        saveCareer(newSeason(career));
        this.scene.restart();
      });
      addButton(this, 230, 380, 'UPGRADES', 3, 0x17356e, () => this.scene.start('shop'));
    } else {
      const opp = SQUADS[opponentIndex(career.team, career.stage)]!;
      const line = `${stageLabel(career.stage)}  VS  ${opp.name}`;
      drawBit(g, line, 80, 156, 0xf4f0e0, 4);
      drawBit(g, 'HALF LENGTH', 80, 230, 0xffd15c, 2);
      this.halfControl(g, career);
      addButton(this, 210, 360, 'PLAY', 4, 0x145c30, () => {
        this.scene.start('match');
      });
      addButton(this, 210, 440, 'UPGRADES', 3, 0x17356e, () => this.scene.start('shop'));
    }

    g.fillStyle(0x217a3c, 1);
    g.fillRoundedRect(560, 150, 300, 280, 8);
    g.lineStyle(3, 0xf4f0e0, 0.7);
    g.strokeRoundedRect(560, 150, 300, 280, 8);
    g.fillStyle(hexColor(squad.jersey), 1);
    g.fillRect(560, 150, 300, 8);
    const poses = ['stand', 'throw', 'catch'] as const;
    poses.forEach((pose, i) => {
      this.add.image(640 + i * 80, 400, athleteKey(career.team, pose, i)).setOrigin(0.5, 1).setScale(3.4);
    });
  }

  private halfControl(g: Phaser.GameObjects.Graphics, career: Career): void {
    const labels = ['1 MIN', '2 MIN', '3 MIN'] as const;
    const values = [60, 120, 180] as const;
    const x0 = 80;
    const y = 262;
    const w = 150;
    values.forEach((mins, i) => {
      const on = career.halves === mins;
      const x = x0 + i * (w + 8);
      g.fillStyle(on ? 0xffd15c : 0x102418, 1);
      g.fillRoundedRect(x, y, w, 42, 4);
      g.lineStyle(2, 0xf4f0e0, 1);
      g.strokeRoundedRect(x, y, w, 42, 4);
      const label = labels[i]!;
      drawBit(g, label, x + (w - textWidth(label, 2)) / 2, y + 14, on ? 0x102418 : 0xf4f0e0, 2);
      const hit = this.add.rectangle(x + w / 2, y + 21, w, 42, 0x000000, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        saveCareer({ ...career, halves: mins });
        this.scene.restart();
      });
    });
  }
}
