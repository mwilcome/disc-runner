import Phaser from 'phaser';
import { COLOR } from '../game/constants';
import { FIELD } from '../game/field';

export function paintField(g: Phaser.GameObjects.Graphics): void {
  const { width, height } = FIELD;
  const stripe = 26;
  for (let y = 0; y < height; y += stripe) {
    g.fillStyle((y / stripe) % 2 === 0 ? COLOR.turf : COLOR.turfAlt, 1);
    g.fillRect(0, y, width, stripe);
  }

  g.fillStyle(COLOR.endZone, 1);
  g.fillRect(0, FIELD.endZoneTop, width, FIELD.endZoneBottom - FIELD.endZoneTop);

  g.lineStyle(4, COLOR.coral, 1);
  g.lineBetween(0, FIELD.endZoneBottom, width, FIELD.endZoneBottom);

  g.lineStyle(1.5, COLOR.line, 0.28);
  for (let y = FIELD.endZoneBottom + 64; y < height - 70; y += 64) {
    g.lineBetween(18, y, width - 18, y);
  }

  g.lineStyle(2, COLOR.line, 0.45);
  g.strokeRect(12, FIELD.endZoneTop, width - 24, height - FIELD.endZoneTop - 28);
}
