import Phaser from 'phaser';
import { athleteKey, buildTextures, drawBit, textWidth } from '../game/art';
import { loadCareer, newCareer, saveCareer, type SquadId } from '../game/career';
import { VIEW_H, VIEW_W } from '../game/field';
import { addButton } from './ui';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#102418');
    this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x102418);
    buildTextures(this);
    const g = this.add.graphics();
    g.fillStyle(0x1f7a3c, 1);
    g.fillRect(0, 400, VIEW_W, 140);
    g.lineStyle(4, 0xf4f0e0, 0.9);
    g.lineBetween(0, 400, VIEW_W, 400);
    g.fillStyle(0xffd15c, 1);
    g.fillRect(0, 400, VIEW_W, 4);
    ([0, 1, 2] as const).forEach((squad, i) => {
      this.add.image(220 + i * 260, 520, athleteKey(squad, 'run0', i)).setOrigin(0.5, 1).setScale(3.2);
    });

    const title = 'DISC RUNNER';
    drawBit(g, title, (VIEW_W - textWidth(title, 6)) / 2, 90, 0xf4f0e0, 6);
    drawBit(g, 'LANDSCAPE DISC', (VIEW_W - textWidth('LANDSCAPE DISC', 2)) / 2, 150, 0xff5a4a, 2);

    const saved = loadCareer();
    if (saved && saved.stage !== 'done') {
      addButton(this, VIEW_W / 2, 230, 'CONTINUE', 3, 0x163222, () => this.scene.start('hub'));
    }
    drawBit(g, 'PICK A SQUAD', (VIEW_W - textWidth('PICK A SQUAD', 2)) / 2, 280, 0xf4f0e0, 2);
    const picks: { id: SquadId; label: string; fill: number }[] = [
      { id: 0, label: 'GROVE', fill: 0x145c30 },
      { id: 1, label: 'TIDE', fill: 0x17356e },
      { id: 2, label: 'EMBER', fill: 0x7a2020 },
    ];
    picks.forEach((pick, i) => {
      addButton(this, 250 + i * 230, 340, pick.label, 3, pick.fill, () => {
        saveCareer(newCareer(pick.id));
        this.scene.start('hub');
      });
    });
    drawBit(g, '7 ASIDE  -  SCORE IN THE END ZONE', (VIEW_W - textWidth('7 ASIDE  -  SCORE IN THE END ZONE', 2)) / 2, 372, 0xf4f0e0, 2);
  }
}
