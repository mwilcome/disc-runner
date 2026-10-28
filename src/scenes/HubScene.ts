import Phaser from 'phaser';
import { drawBit, textWidth } from '../game/art';
import {
  SQUADS,
  loadCareer,
  opponentIndex,
  saveCareer,
  stageLabel,
  type Career,
} from '../game/career';
import { VIEW_W } from '../game/field';
import { addButton } from './ui';

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
    this.cameras.main.setBackgroundColor('#102418');
    const g = this.add.graphics();
    g.fillStyle(0x163222, 1);
    g.fillRoundedRect(80, 36, 800, 470, 12);
    g.lineStyle(3, 0xf4f0e0, 1);
    g.strokeRoundedRect(80, 36, 800, 470, 12);

    const squad = SQUADS[career.team]!;
    const head = `${squad.name}  S${career.season}`;
    drawBit(g, head, (VIEW_W - textWidth(head, 4)) / 2, 60, 0xf4f0e0, 4);
    const record = `RECORD ${career.wins}-${career.losses}`;
    drawBit(g, record, (VIEW_W - textWidth(record, 3)) / 2, 110, 0xffd15c, 3);

    if (career.stage === 'done') {
      drawBit(g, 'SEASON OVER', (VIEW_W - textWidth('SEASON OVER', 3)) / 2, 180, 0xf4f0e0, 3);
      addButton(this, VIEW_W / 2, 280, 'NEW SEASON', 3, 0x145c30, () => {
        const next: Career = {
          ...career,
          stage: 'reg1',
          wins: 0,
          losses: 0,
          season: career.season + 1,
        };
        saveCareer(next);
        this.scene.restart();
      });
    } else {
      const opp = SQUADS[opponentIndex(career.team, career.stage)]!;
      const line = `${stageLabel(career.stage)}  VS  ${opp.name}`;
      drawBit(g, line, (VIEW_W - textWidth(line, 3)) / 2, 180, 0xf4f0e0, 3);
      drawBit(g, 'HALF LENGTH', 140, 240, 0xffd15c, 2);
      ([60, 120, 180] as const).forEach((mins, i) => {
        const label = `${mins / 60} MIN`;
        addButton(this, 250 + i * 200, 300, label, 2, career.halves === mins ? 0x7a2020 : 0x163222, () => {
          saveCareer({ ...career, halves: mins });
          this.scene.restart();
        });
      });
      addButton(this, VIEW_W / 2 - 140, 400, 'PLAY', 4, 0x145c30, () => {
        this.scene.start('match');
      });
    }
    addButton(this, VIEW_W / 2 + 150, 400, 'UPGRADES', 3, 0x17356e, () => this.scene.start('shop'));
    const coins = `COINS ${career.coins}`;
    drawBit(g, coins, (VIEW_W - textWidth(coins, 2)) / 2, 450, 0xffd15c, 2);
  }
}
