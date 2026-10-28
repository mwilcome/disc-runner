import Phaser from 'phaser';
import { drawBit, textWidth } from '../game/art';
import { SQUADS, applyResult, loadCareer, reward, saveCareer } from '../game/career';
import { VIEW_W } from '../game/field';
import { addButton } from './ui';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('result');
  }

  create(data: { user?: number; opp?: number; oppSquad?: number }): void {
    const career = loadCareer();
    if (!career) {
      this.scene.start('title');
      return;
    }
    const user = data.user ?? 0;
    const opp = data.opp ?? 0;
    const won = user > opp;
    const gained = reward(user, won);
    const next = applyResult(career, user, opp);
    saveCareer(next);
    this.cameras.main.setBackgroundColor('#102418');
    const g = this.add.graphics();
    g.fillStyle(0x163222, 1);
    g.fillRoundedRect(100, 70, 760, 400, 12);
    g.lineStyle(3, 0xf4f0e0, 1);
    g.strokeRoundedRect(100, 70, 760, 400, 12);
    const title = won ? 'WIN' : 'LOSS';
    drawBit(g, title, (VIEW_W - textWidth(title, 6)) / 2, 110, won ? 0xffd15c : 0xff5a4a, 6);
    const oppName = SQUADS[data.oppSquad ?? 1]?.name ?? 'OPP';
    const line = `${SQUADS[career.team]!.name} ${user}  ${oppName} ${opp}`;
    drawBit(g, line, (VIEW_W - textWidth(line, 3)) / 2, 200, 0xf4f0e0, 3);
    const pay = `+${gained} COINS`;
    drawBit(g, pay, (VIEW_W - textWidth(pay, 3)) / 2, 270, 0xffd15c, 3);
    addButton(this, VIEW_W / 2, 380, 'CONTINUE', 3, 0x145c30, () => this.scene.start('hub'));
  }
}
