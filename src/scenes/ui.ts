import Phaser from 'phaser';
import { drawBit, textWidth } from '../game/art';

export function addButton(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  label: string,
  scale: number,
  fill: number,
  onClick: () => void,
): Phaser.GameObjects.Rectangle {
  const w = textWidth(label, scale) + 28;
  const h = 5 * scale + 22;
  const rect = scene.add
    .rectangle(cx, cy, w, h, fill)
    .setStrokeStyle(3, 0xf4f0e0)
    .setInteractive({ useHandCursor: true });
  const g = scene.add.graphics();
  drawBit(g, label, cx - textWidth(label, scale) / 2, cy - (5 * scale) / 2, 0xf4f0e0, scale);
  rect.on('pointerup', onClick);
  return rect;
}
