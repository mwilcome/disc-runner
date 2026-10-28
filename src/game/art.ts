import Phaser from 'phaser';
import { SQUADS } from './career';
import {
  EZ_LEFT_END,
  EZ_RIGHT_START,
  PITCH_LEFT,
  PITCH_RIGHT,
  SIDELINE_BOT,
  SIDELINE_TOP,
  WORLD_W,
  YARD,
} from './field';

/** Original disc athletes, 24×26, feet on the last row. C cap, v visor, s skin, a arm, J jersey, T trim, p shorts, f shoes, h hair. */
const W = 24;
const H = 26;

function pose(rows: string[]): string[] {
  const drawn = rows.map((row) => {
    if (row.length !== W) throw new Error(`sprite row ${row.length}: ${row}`);
    return row;
  });
  if (drawn.length > H) throw new Error('sprite too tall');
  const out = [...drawn];
  while (out.length < H) out.unshift('.'.repeat(W));
  return out;
}

const POSES: Record<string, string[]> = {
  stand: pose([
    '........CCCCC...........',
    '.......CCCCCCC..........',
    '.......CCChCCC..........',
    '......CCCCCsss..........',
    '.......Csssss...........',
    '.......Cs.ss............',
    '......aJJJJJJa..........',
    '......JJJTTTJJ..........',
    '......JJJTTTJJ..........',
    '.......JJJJJJ...........',
    '........pppp............',
    '.......pp..pp...........',
    '.......pp..pp...........',
    '......fff..fff..........',
    '.....ff......ff.........',
  ]),
  run0: pose([
    '........CCCCC...........',
    '.......CCCCCCC..........',
    '.......CCChCCC..........',
    '......CCCCCsss..........',
    '.......Csssss...........',
    '......aCs.ss............',
    '.....aaJJJJJJ...........',
    '.......JJTTTJJ..........',
    '........JJJJJ...........',
    '........pppp............',
    '.......pp...............',
    '......ff....ppp.........',
    '.............ff.........',
    '....ff..................',
  ]),
  run1: pose([
    '........CCCCC...........',
    '.......CCCCCCC..........',
    '.......CCChCCCa.........',
    '......CCCCCssaa.........',
    '.......Csssss...........',
    '........s.ss............',
    '.....a.JJJJJJ...........',
    '........JJTTTJ..........',
    '........JJJJJ...........',
    '..........pppp..........',
    '.............pp.........',
    '.......ppp....ff........',
    '.......ff...............',
    '.................ff.....',
  ]),
  throw: pose([
    '........CCCCC......aa...',
    '.......CCCCCCC....aa....',
    '.......CCChCCC...a......',
    '......CCCCCsss..a.......',
    '.......Csssss..a........',
    '......aCs.ss..a.........',
    '.....aaJJJJJJa..........',
    '.......JJTTTJJ..........',
    '........JJJJJ...........',
    '........pppppp..........',
    '.......pp....pp.........',
    '......fff....fff........',
    '.....ff........ff.......',
  ]),
  catch: pose([
    '..aa..........CCCCC..aa.',
    '.aa..........CCCCCCC.aa.',
    'aa...........CCChCCCaa..',
    'a............CCCCCssa...',
    '.............Cssssss....',
    '.............Cs.ss......',
    '............aJJJJJJa....',
    '............JJJTTTJJ....',
    '.............JJJJJJ.....',
    '..............pppp......',
    '.............pp..pp.....',
    '............fff..fff....',
    '...........ff......ff...',
  ]),
  dive: pose([
    '......CCCCC.............',
    '.....CCCCCCC............',
    '.....CCChCCCaaa.........',
    '....CCCCCsssJJ..........',
    '.....CssssJJJJJpp.......',
    '....aJJTTTJJJJJpp.ff....',
    '.....JJJJJJJpp....ff....',
    '......pppppp............',
  ]),
};

const POSE_ORDER = ['stand', 'run0', 'run1', 'throw', 'catch', 'dive'] as const;

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

type SquadArt = (typeof SQUADS)[number];

function inkOf(code: string, squad: SquadArt, hair: string): string | null {
  if (code === 'C') return squad.cap;
  if (code === 'h') return hair;
  if (code === 'v') return '#16120e';
  if (code === 's' || code === 'a') return squad.skin;
  if (code === 'J') return squad.jersey;
  if (code === 'T') return squad.trim;
  if (code === 'p') return squad.shorts;
  if (code === 'f') return '#1a120c';
  return null;
}

function blitAthlete(ctx: CanvasRenderingContext2D, rows: string[], squad: SquadArt, hair: string): void {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const ink = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? null : inkOf(rows[y]?.[x] ?? '.', squad, hair));
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (ink(x, y)) continue;
      let edge = false;
      for (let oy = -1; oy <= 1 && !edge; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (ox === 0 && oy === 0) continue;
          if (ink(x + ox, y + oy)) edge = true;
        }
      }
      if (edge) put(ctx, x, y, '#102418');
    }
  }
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const color = ink(x, y);
      if (color) put(ctx, x, y, color);
    }
  }
}

export function buildTextures(scene: Phaser.Scene): void {
  SQUADS.forEach((squad) => {
    HAIR.forEach((hair, hairIndex) => {
      POSE_ORDER.forEach((name) => {
        paint(scene, `ath-${squad.id}-${name}-${hairIndex}`, W, H, (ctx) => {
          blitAthlete(ctx, POSES[name] ?? POSES.stand!, squad, hair);
        });
      });
    });
  });
  paint(scene, 'disc', 18, 10, (ctx) => {
    const rows = [
      '....RRRRRRRRRR....',
      '..RRRRRRRRRRRRRR..',
      '.RRRWWWWWWWWWWWRR.',
      'RRRWWWWWWWWWWWWRRR',
      'RRRRWWWWWWWWWWWRRR',
      'RRRRRWWWWWWWWWRRRR',
      '.RRRRWWWWWWWWWRRR.',
      '..RRRRRRRRRRRRRR..',
      '...RRRRRRRRRRRR...',
      '....RRRRRRRRRR....',
    ];
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        if (row[x] === 'R') put(ctx, x, y, '#ff4d3a');
        if (row[x] === 'W') put(ctx, x, y, '#fff6e4');
      }
    });
  });
  paint(scene, 'star', 21, 21, (ctx) => {
    const rows = [
      '..........#..........',
      '.........###.........',
      '........#####........',
      '.......#######.......',
      '......####.####......',
      '.....####...####.....',
      '....####.....####....',
      '..#################..',
      '.###################.',
      '#####################',
      '.###################.',
      '..#################..',
      '....####.....####....',
      '.....####...####.....',
      '......####.####......',
      '.......#######.......',
      '........#####........',
      '.........###.........',
      '..........#..........',
      '.....................',
      '.....................',
    ];
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) if (row[x] === '#') put(ctx, x, y, '#ffe14a');
    });
  });
  paint(scene, 'shadow', 12, 5, (ctx) => {
    ctx.fillStyle = 'rgba(6,24,12,0.5)';
    ctx.beginPath();
    ctx.ellipse(6, 2.5, 6, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function hash(n: number): number {
  return Math.abs((Math.imul(n, 1103515245) + 12345) % 997);
}

export function paintPitch(g: Phaser.GameObjects.Graphics): void {
  g.clear();
  g.fillStyle(0x102418, 1);
  g.fillRect(0, 0, WORLD_W, 540);
  const span = SIDELINE_BOT - SIDELINE_TOP;
  for (let x = PITCH_LEFT; x < PITCH_RIGHT; x += YARD) {
    const alt = Math.floor((x - PITCH_LEFT) / YARD) % 2 === 0;
    g.fillStyle(alt ? 0x2c9444 : 0x34aa50, 1);
    g.fillRect(x, SIDELINE_TOP, Math.min(YARD, PITCH_RIGHT - x), span);
  }
  for (let x = PITCH_LEFT + 4; x < PITCH_RIGHT; x += 14) {
    for (let y = SIDELINE_TOP + 3; y < SIDELINE_BOT; y += 16) {
      if (hash(x + y * 13) % 5 !== 0) continue;
      g.fillStyle(0x1f7034, 0.28);
      g.fillRect(x, y, 2, 2);
    }
  }
  g.fillStyle(0x1d6c38, 0.55);
  g.fillRect(PITCH_LEFT, SIDELINE_TOP, EZ_LEFT_END - PITCH_LEFT, span);
  g.fillRect(EZ_RIGHT_START, SIDELINE_TOP, PITCH_RIGHT - EZ_RIGHT_START, span);
  for (let i = 0; i < 8; i += 1) {
    g.fillStyle(0x14562c, 0.35);
    g.fillRect(PITCH_LEFT + 18 + i * 64, SIDELINE_TOP, 22, span);
    g.fillRect(EZ_RIGHT_START + 18 + i * 64, SIDELINE_TOP, 22, span);
  }

  g.fillStyle(0x163222, 1);
  g.fillRect(0, 0, WORLD_W, SIDELINE_TOP);
  g.fillRect(0, SIDELINE_BOT, WORLD_W, 540 - SIDELINE_BOT);
  paintSidelineLife(g);

  g.lineStyle(3, 0xf4f7ee, 0.95);
  g.strokeRect(PITCH_LEFT, SIDELINE_TOP, PITCH_RIGHT - PITCH_LEFT, span);
  g.lineStyle(6, 0xff4d3a, 1);
  g.lineBetween(EZ_LEFT_END, SIDELINE_TOP, EZ_LEFT_END, SIDELINE_BOT);
  g.lineBetween(EZ_RIGHT_START, SIDELINE_TOP, EZ_RIGHT_START, SIDELINE_BOT);
  paintPylon(g, EZ_LEFT_END, SIDELINE_TOP);
  paintPylon(g, EZ_LEFT_END, SIDELINE_BOT);
  paintPylon(g, EZ_RIGHT_START, SIDELINE_TOP);
  paintPylon(g, EZ_RIGHT_START, SIDELINE_BOT);

  const midY = (SIDELINE_TOP + SIDELINE_BOT) / 2;
  for (let yards = 5; yards < 70; yards += 5) {
    const x = EZ_LEFT_END + yards * YARD;
    const major = yards % 10 === 0;
    g.lineStyle(major ? 2 : 1, 0xf7f4ea, major ? 0.55 : 0.32);
    if (major) g.lineBetween(x, SIDELINE_TOP, x, SIDELINE_BOT);
    else {
      g.lineBetween(x, SIDELINE_TOP, x, SIDELINE_TOP + 18);
      g.lineBetween(x, SIDELINE_BOT - 18, x, SIDELINE_BOT);
    }
    g.lineBetween(x, midY - 78, x, midY - 64);
    g.lineBetween(x, midY + 64, x, midY + 78);
    if (major) {
      const label = String(yards);
      const nx = x - textWidth(label, 6) / 2;
      drawBit(g, label, nx + 2, SIDELINE_TOP + 28, 0x0c2414, 6, 0.4);
      drawBit(g, label, nx, SIDELINE_TOP + 26, 0xf7f4ea, 6, 0.48);
      drawBit(g, label, nx + 2, SIDELINE_BOT - 78, 0x0c2414, 6, 0.4);
      drawBit(g, label, nx, SIDELINE_BOT - 80, 0xf7f4ea, 6, 0.48);
    }
  }
  paintMidfieldMark(g, EZ_LEFT_END + 35 * YARD, midY);
  const zone = 'END ZONE';
  drawBit(g, zone, PITCH_LEFT + (EZ_LEFT_END - PITCH_LEFT - textWidth(zone, 3)) / 2, midY - 8, 0xf4f7ee, 3, 0.72);
  drawBit(g, zone, EZ_RIGHT_START + (PITCH_RIGHT - EZ_RIGHT_START - textWidth(zone, 3)) / 2, midY - 8, 0xf4f7ee, 3, 0.72);
}

function paintPylon(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  const top = y <= SIDELINE_TOP;
  const py = top ? y - 16 : y + 2;
  g.fillStyle(0xff8a2a, 1);
  g.fillRect(x - 5, py, 10, 14);
  g.fillStyle(0xfff6e4, 1);
  g.fillRect(x - 5, py + 6, 10, 3);
}

function paintMidfieldMark(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillStyle(0x0e2416, 0.35);
  g.fillCircle(x, y, 58);
  g.fillStyle(0xfff6e4, 0.82);
  g.fillCircle(x, y, 46);
  g.fillStyle(0xff4d3a, 0.95);
  g.fillCircle(x, y, 46);
  g.fillStyle(0xfff6e4, 1);
  g.fillRect(x - 46, y - 7, 92, 14);
  g.fillStyle(0xff4d3a, 1);
  g.fillCircle(x, y, 16);
  g.fillStyle(0xfff6e4, 1);
  g.fillCircle(x, y, 6);
  g.lineStyle(3, 0x14301c, 0.85);
  g.strokeCircle(x, y, 46);
}

function paintSidelineLife(g: Phaser.GameObjects.Graphics): void {
  const shirts = [0xfff4df, 0xff5a4a, 0x3c7dff, 0xffd15c, 0x9af56e, 0x1a1a1a, 0xc43732];
  for (let x = PITCH_LEFT - 8; x < PITCH_RIGHT + 8; x += 8) {
    const n = hash(x);
    const body = 6 + (n % 7);
    const top = SIDELINE_TOP - 10 - body;
    g.fillStyle(n % 3 === 0 ? 0xe7b48a : 0xf3c7a2, 1);
    g.fillRect(x, top, 4, 3);
    g.fillStyle(shirts[n % shirts.length]!, 1);
    g.fillRect(x - 1, top + 3, 6, body);
    if (n % 4 === 0) {
      g.fillStyle(0xf3c7a2, 1);
      g.fillRect(x - 2, top + 1, 2, 5);
    }
    const back = 4 + (n % 4);
    g.fillStyle(0x0e2416, 0.35);
    g.fillRect(x + 1, 40, 4, back);
    g.fillStyle(shirts[(n + 3) % shirts.length]!, 0.9);
    g.fillRect(x + 1, 40, 3, back);
  }
  g.fillStyle(0xf4f7ee, 0.85);
  g.fillRect(PITCH_LEFT, SIDELINE_TOP - 3, PITCH_RIGHT - PITCH_LEFT, 2);

  for (let x = PITCH_LEFT + 24; x < PITCH_RIGHT; x += 280) {
    const y = SIDELINE_BOT + 6;
    g.fillStyle(0xff5a4a, 1);
    g.fillRect(x, y + 8, 14, 12);
    g.fillStyle(0xfff6e4, 1);
    g.fillRect(x + 2, y + 11, 10, 3);
    g.fillStyle(0x6b4428, 1);
    g.fillRect(x + 22, y + 14, 92, 6);
    g.fillStyle(0x3a2414, 1);
    g.fillRect(x + 26, y + 20, 4, 8);
    g.fillRect(x + 106, y + 20, 4, 8);
    for (let i = 0; i < 4; i += 1) {
      const sx = x + 32 + i * 20;
      g.fillStyle(i % 2 === 0 ? 0xf3c7a2 : 0xe7b48a, 1);
      g.fillRect(sx + 2, y, 6, 5);
      g.fillStyle(i % 2 === 0 ? 0x157a38 : 0x1d4eab, 1);
      g.fillRect(sx, y + 5, 10, 9);
      g.fillStyle(0x1a120c, 1);
      g.fillRect(sx + 1, y + 14, 3, 6);
      g.fillRect(sx + 6, y + 14, 3, 6);
    }
  }
}

export function athleteKey(squad: 0 | 1 | 2, poseName: string, hair: number): string {
  return `ath-${SQUADS[squad]!.id}-${poseName}-${hair}`;
}

export function hexColor(css: string): number {
  return Number.parseInt(css.slice(1), 16);
}
