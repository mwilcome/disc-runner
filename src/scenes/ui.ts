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
  const w = Math.max(textWidth(label, scale) + 40, 88);
  const h = 5 * scale + 28;
  const left = cx - w / 2;
  const top = cy - h / 2;
  const g = scene.add.graphics();
  g.fillStyle(0x06140c, 0.45);
  g.fillRoundedRect(left + 3, top + 4, w, h, 4);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(left, top, w, h, 4);
  g.fillStyle(0xffffff, 0.2);
  g.fillRect(left + 4, top + 3, w - 8, 3);
  g.fillStyle(0x000000, 0.28);
  g.fillRect(left + 4, top + h - 6, w - 8, 3);
  g.lineStyle(3, 0xf4f0e0, 1);
  g.strokeRoundedRect(left, top, w, h, 4);
  const rect = scene.add.rectangle(cx, cy, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
  drawBit(g, label, cx - textWidth(label, scale) / 2, cy - (5 * scale) / 2, 0xf4f0e0, scale);
  rect.on('pointerup', onClick);
  return rect;
}

export function paintPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number): void {
  g.fillStyle(0x06140c, 0.4);
  g.fillRoundedRect(x + 5, y + 7, w, h, 12);
  g.fillStyle(0x173526, 1);
  g.fillRoundedRect(x, y, w, h, 12);
  g.fillStyle(0xffd15c, 1);
  g.fillRect(x + 22, y + 10, w - 44, 4);
  g.lineStyle(3, 0xf4f0e0, 1);
  g.strokeRoundedRect(x, y, w, h, 12);
}

export function paintBar(g: Phaser.GameObjects.Graphics, width: number): void {
  g.fillStyle(0x102418, 1);
  g.fillRect(0, 0, width, 44);
  g.fillStyle(0xffd15c, 1);
  g.fillRect(0, 44, width, 3);
}
