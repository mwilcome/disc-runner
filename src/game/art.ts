import Phaser from 'phaser';
import { EZ_LEFT_END, EZ_RIGHT_START, PITCH_LEFT, PITCH_RIGHT, SIDELINE_BOT, SIDELINE_TOP, WORLD_W, YARD } from './field';
import { SQUADS } from './career';

const STAND = [
  '......hh........',
  '.....hhhh.......',
  '.....ssss.......',
  '....ssssss......',
  '..asJJJJJJJJsa..',
  '..asJJJJJJJJsa..',
  '...sJJJJJJJs....',
  '....JJJJJJJJ....',
  '....pppppp......',
  '....pp..pp......',
  '...pp....pp.....',
  '...ff....ff.....',
];

const RUN = [
  '......hh........',
  '.....hhhh.......',
  '.....ssss.......',
  '....ssssss......',
  '..asJJJJJJJJsa..',
  '...sJJJJJJJs....',
  '....JJJJJJJJ....',
  '....pppppp......',
  '...pp....pp.....',
  '..pp......pp....',
  '.ff........ff...',
  'ff..........ff..',
];

const HAIR = ['#2a1810', '#6a4324', '#1c1c1c'];

export const GLYPH: Record<string, string[]> = {
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'],
  K: ['101', '110', '100', '110', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '101', '101', '101'],
  N: ['110', '101', '101', '101', '101'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  Q: ['010', '101', '101', '011', '001'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '011'],
  V: ['101', '101', '101', '010', '010'],
  W: ['101', '101', '101', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  ':': ['000', '010', '000', '010', '000'],
  '-': ['000', '000', '111', '000', '000'],
  '+': ['010', '010', '111', '010', '010'],
  ' ': ['000', '000', '000', '000', '000'],
};

export function textWidth(text: string, scale: number): number {
  return text.length * 4 * scale;
}

export function drawBit(
  g: Phaser.GameObjects.Graphics,
  text: string,
  x: number,
  y: number,
  color: number,
  scale: number,
  alpha = 1,
): void {
  g.fillStyle(color, alpha);
  let cx = x;
  for (const ch of text) {
    const rows = GLYPH[ch] ?? GLYPH[' '];
    rows?.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx += 1) {
        if (row[rx] === '1') g.fillRect(cx + rx * scale, y + ry * scale, scale, scale);
      }
    });
    cx += 4 * scale;
  }
}

function paint(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  tex.refresh();
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function put(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function blitAthlete(
  ctx: CanvasRenderingContext2D,
  rows: string[],
  jersey: string,
  shorts: string,
  hair: string,
): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const code = row[x];
      if (code === '.' || code === undefined) continue;
      const color =
        code === 'h'
          ? hair
          : code === 's' || code === 'a'
            ? '#f0c29a'
            : code === 'J'
              ? jersey
              : code === 'p'
                ? shorts
                : '#241810';
      put(ctx, x, y, color);
    }
  });
}

export function buildTextures(scene: Phaser.Scene): void {
  SQUADS.forEach((squad) => {
    HAIR.forEach((hair, hairIndex) => {
      [STAND, RUN].forEach((rows, frame) => {
        paint(scene, `ath-${squad.id}-${frame}-${hairIndex}`, 16, 12, (ctx) => {
          blitAthlete(ctx, rows, squad.jersey, squad.shorts, hair);
        });
      });
    });
  });
  paint(scene, 'disc', 12, 7, (ctx) => {
    const rows = ['..CCCCCC..', '.CCCCCCCCC.', '.CCWWWWWWCC', 'CCCCCCCCCCCC', '.CCWWWWWWCC', '.CCCCCCCCC.', '..CCCCCC..'];
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        const code = row[x];
        if (code === 'C') put(ctx, x, y, '#ff4d45');
        if (code === 'W') put(ctx, x, y, '#fff4df');
      }
    });
  });
  paint(scene, 'star', 7, 7, (ctx) => {
    const rows = ['..#....', '.###...', '#######', '.#####.', '..###..', '.#.#.#.', '#.....#.'];
    rows.forEach((row, y) => {
      for (let x = 0; x < 7; x += 1) if (row[x] === '#') put(ctx, x, y, '#ffe14a');
    });
  });
  paint(scene, 'shadow', 10, 4, (ctx) => {
    ctx.fillStyle = 'rgba(6,24,12,0.55)';
    ctx.beginPath();
    ctx.ellipse(5, 2, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function paintPitch(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x12341e, 1);
  g.fillRect(0, 0, WORLD_W, 540);
  g.fillStyle(0x2f9a49, 1);
  g.fillRect(PITCH_LEFT, SIDELINE_TOP, PITCH_RIGHT - PITCH_LEFT, SIDELINE_BOT - SIDELINE_TOP);
  for (let x = PITCH_LEFT; x < PITCH_RIGHT; x += 80) {
    g.fillStyle(0x2a9143, 0.45);
    g.fillRect(x, SIDELINE_TOP, 40, SIDELINE_BOT - SIDELINE_TOP);
  }
  g.fillStyle(0x1d7436, 1);
  g.fillRect(PITCH_LEFT, SIDELINE_TOP, EZ_LEFT_END - PITCH_LEFT, SIDELINE_BOT - SIDELINE_TOP);
  g.fillRect(EZ_RIGHT_START, SIDELINE_TOP, PITCH_RIGHT - EZ_RIGHT_START, SIDELINE_BOT - SIDELINE_TOP);
  g.fillStyle(0x0e2416, 1);
  g.fillRect(0, 0, WORLD_W, SIDELINE_TOP - 6);
  g.fillRect(0, SIDELINE_BOT + 4, WORLD_W, 48);

  g.lineStyle(3, 0xf3f6ee, 0.9);
  g.strokeRect(PITCH_LEFT, SIDELINE_TOP, PITCH_RIGHT - PITCH_LEFT, SIDELINE_BOT - SIDELINE_TOP);
  g.lineStyle(4, 0xff5a4a, 1);
  g.lineBetween(EZ_LEFT_END, SIDELINE_TOP, EZ_LEFT_END, SIDELINE_BOT);
  g.lineBetween(EZ_RIGHT_START, SIDELINE_TOP, EZ_RIGHT_START, SIDELINE_BOT);

  for (let yards = 5; yards < 70; yards += 5) {
    const x = EZ_LEFT_END + yards * YARD;
    const major = yards % 10 === 0;
    g.lineStyle(major ? 2 : 1, 0xf3f6ee, major ? 0.45 : 0.28);
    if (major) g.lineBetween(x, SIDELINE_TOP, x, SIDELINE_BOT);
    else {
      g.lineBetween(x, SIDELINE_TOP, x, SIDELINE_TOP + 16);
      g.lineBetween(x, SIDELINE_BOT - 16, x, SIDELINE_BOT);
      g.lineBetween(x, 230, x, 246);
      g.lineBetween(x, 360, x, 376);
    }
    if (major) {
      const label = String(yards);
      drawBit(g, label, x - textWidth(label, 2) / 2, SIDELINE_TOP + 28, 0xf3f6ee, 2, 0.55);
      drawBit(g, label, x - textWidth(label, 2) / 2, SIDELINE_BOT - 48, 0xf3f6ee, 2, 0.55);
    }
  }
  const zone = 'END ZONE';
  drawBit(g, zone, PITCH_LEFT + (EZ_LEFT_END - PITCH_LEFT - textWidth(zone, 3)) / 2, SIDELINE_TOP + 24, 0xf3f6ee, 3, 0.7);
  drawBit(g, zone, EZ_RIGHT_START + (PITCH_RIGHT - EZ_RIGHT_START - textWidth(zone, 3)) / 2, SIDELINE_TOP + 24, 0xf3f6ee, 3, 0.7);
}

export function athleteKey(squad: 0 | 1 | 2, frame: number, hair: number): string {
  return `ath-${SQUADS[squad]!.id}-${frame}-${hair}`;
}
