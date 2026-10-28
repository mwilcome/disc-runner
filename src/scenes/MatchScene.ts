import Phaser from 'phaser';
import { blip } from '../audio';
import { athleteKey, buildTextures, drawBit, paintPitch, textWidth } from '../game/art';
import { SQUADS, loadCareer, opponentIndex } from '../game/career';
import { VIEW_H, VIEW_W, WORLD_W } from '../game/field';
import {
  IDLE,
  attackOf,
  createMatch,
  eligible,
  leadsFor,
  lungeReady,
  receiverLeads,
  step,
  type FrameInput,
  type Match,
} from '../game/match';
import { assistFlight, dragToThrow, flightTo, releaseSpeed, sampleFlight, type DragSample, type Flight } from '../game/throw';

interface Drag {
  x0: number;
  y0: number;
  x: number;
  y: number;
  t0: number;
  samples: DragSample[];
}

export class MatchScene extends Phaser.Scene {
  private match!: Match;
  private sprites: Phaser.GameObjects.Image[] = [];
  private stars: Phaser.GameObjects.Image[] = [];
  private disc!: Phaser.GameObjects.Image;
  private discShadow!: Phaser.GameObjects.Image;
  private aimGfx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private drag: Drag | null = null;
  private shownArc: Flight | null = null;
  private arcUntil = 0;
  private moveX = 0;
  private moveY = 0;
  private lunge = false;
  private ended = false;
  private born = 0;
  private keys?: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    l: Phaser.Input.Keyboard.Key;
    t: Phaser.Input.Keyboard.Key;
  };

  constructor() {
    super('match');
  }

  create(): void {
    const career = loadCareer();
    if (!career || career.stage === 'done') {
      this.scene.start('hub');
      return;
    }
    buildTextures(this);
    const opp = opponentIndex(career.team, career.stage);
    this.match = createMatch({
      userSquad: career.team,
      oppSquad: opp,
      halfLength: career.halves,
      throwLv: career.throw,
      speedLv: career.speed,
      catchLv: career.catch,
    });
    const field = this.add.graphics().setDepth(0);
    paintPitch(field);
    this.aimGfx = this.add.graphics().setDepth(20);
    this.discShadow = this.add.image(0, 0, 'shadow').setDepth(4).setScale(3);
    this.disc = this.add.image(0, 0, 'disc').setDepth(30).setScale(4);
    this.sprites = this.match.players.map((p) =>
      this.add.image(p.x, p.y, athleteKey(p.squad, 0, p.hair)).setOrigin(0.5, 1).setScale(4).setDepth(10),
    );
    this.stars = Array.from({ length: 6 }, () => this.add.image(0, 0, 'star').setDepth(8).setScale(3).setVisible(false));
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(50);
    this.cameras.main.setBounds(0, 0, WORLD_W, VIEW_H);
    this.cameras.main.setBackgroundColor('#102418');
    const kb = this.input.keyboard;
    if (kb) {
      this.keys = {
        left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
        up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
        down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
        a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        s: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        l: kb.addKey(Phaser.Input.Keyboard.KeyCodes.L),
        t: kb.addKey(Phaser.Input.Keyboard.KeyCodes.T),
      };
    }
    this.input.mouse?.disableContextMenu();
    this.born = this.time.now;
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
  }

  update(time: number, delta: number): void {
    if (this.ended) return;
    const dt = Math.min(0.05, delta / 1000);
    const input = this.frameInput();
    const prev = this.match.message;
    step(this.match, dt, input);
    this.lunge = false;
    if (this.match.message !== prev && (this.match.message === 'GOAL' || this.match.message === 'FLICK' || this.match.message === 'FLOATER')) {
      blip(this.match.message === 'GOAL' ? 720 : 480, 0.08, 'triangle');
    }
    if (this.match.phase === 'end') {
      this.ended = true;
      this.time.delayedCall(500, () => {
        this.scene.start('result', {
          user: this.match.score[0],
          opp: this.match.score[1],
          oppSquad: this.match.oppSquad,
        });
      });
    }
    this.sync(time);
    this.drawOverlay();
    this.drawHud();
    const focus = this.match.disc.mode === 'flight' ? this.match.disc.x : this.match.players[this.match.control]?.x ?? this.match.disc.x;
    this.cameras.main.scrollX = Phaser.Math.Clamp(focus - VIEW_W * 0.42, 0, WORLD_W - VIEW_W);
  }

  private frameInput(): FrameInput {
    let moveX = this.moveX;
    let moveY = this.moveY;
    const keys = this.keys;
    if (keys) {
      const x = (keys.right.isDown || keys.d.isDown ? 1 : 0) - (keys.left.isDown || keys.a.isDown ? 1 : 0);
      const y = (keys.down.isDown || keys.s.isDown ? 1 : 0) - (keys.up.isDown || keys.w.isDown ? 1 : 0);
      if (x !== 0 || y !== 0) {
        const len = Math.hypot(x, y) || 1;
        moveX = x / len;
        moveY = y / len;
      }
      if (Phaser.Input.Keyboard.JustDown(keys.l)) this.lunge = true;
      if (keys.t && Phaser.Input.Keyboard.JustDown(keys.t)) this.releaseShownArc();
    }
    const held = this.userHasDisc();
    return {
      moveX: held ? 0 : moveX,
      moveY: held ? 0 : moveY,
      flight: null,
      switchTo: null,
      lunge: this.lunge,
    };
  }

  private userHasDisc(): boolean {
    return this.match.disc.mode === 'held' && this.match.disc.holder === this.match.control && this.match.poss === 0;
  }

  private releaseShownArc(): void {
    if (!this.userHasDisc()) return;
    const flight = this.readyArc();
    if (!flight) return;
    this.shownArc = flight;
    this.arcUntil = this.time.now + 2400;
    step(this.match, 0, { ...IDLE, flight });
  }

  private at(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    return { x: pointer.worldX, y: pointer.worldY };
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.time.now - this.born < 400) return;
    if (lungeReady(this.match) && pointer.x > VIEW_W - 150 && pointer.y > VIEW_H - 64) {
      this.lunge = true;
      return;
    }
    const now = this.time.now;
    const p = this.at(pointer);
    this.drag = { x0: p.x, y0: p.y, x: p.x, y: p.y, t0: now, samples: [{ t: now, x: p.x, y: p.y }] };
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!this.drag) return;
    const p = this.at(pointer);
    this.drag.x = p.x;
    this.drag.y = p.y;
    this.drag.samples.push({ t: this.time.now, x: p.x, y: p.y });
    const cutoff = this.time.now - 140;
    while (this.drag.samples.length > 2 && this.drag.samples[0]!.t < cutoff) this.drag.samples.shift();
    if (!this.userHasDisc()) {
      const dx = this.drag.x - this.drag.x0;
      const dy = this.drag.y - this.drag.y0;
      const len = Math.hypot(dx, dy);
      if (len > 14) {
        this.moveX = dx / len;
        this.moveY = dy / len;
      }
    }
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (!this.drag) return;
    const drag = this.drag;
    this.drag = null;
    const up = this.at(pointer);
    const dx = up.x - drag.x0;
    const dy = up.y - drag.y0;
    const len = Math.hypot(dx, dy);
    this.moveX = 0;
    this.moveY = 0;
    if (this.userHasDisc() && len >= 24) {
      const plan = dragToThrow({
        dx,
        dy,
        durationMs: Math.max(0, this.time.now - drag.t0),
        releaseSpeed: releaseSpeed(drag.samples),
      });
      if (!plan) return;
      const holder = this.match.players[this.match.disc.holder];
      if (!holder) return;
      const flight = assistFlight(
        { x: holder.x, y: holder.y },
        plan,
        leadsFor(this.match, plan.kind),
        this.match.userCatch,
      );
      this.shownArc = flight;
      this.arcUntil = this.time.now + 2400;
      step(this.match, 0, { ...IDLE, flight });
      return;
    }
    if (len < 20) {
      const hit = this.nearestUser(up.x, up.y);
      if (hit >= 0) step(this.match, 0, { ...IDLE, switchTo: hit });
    }
  }

  private nearestUser(x: number, y: number): number {
    let best = -1;
    let dist = 42;
    this.match.players.forEach((p, i) => {
      if (p.team !== 0) return;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    return best;
  }

  private sync(time: number): void {
    const moving = (i: number) => {
      const p = this.match.players[i]!;
      return Math.hypot(p.vx, p.vy) > 10 || (p.team === this.match.poss && p.route !== 'thrower' && this.match.phase === 'live' && this.match.disc.holder !== i);
    };
    this.sprites.forEach((sprite, i) => {
      const p = this.match.players[i]!;
      const frame = moving(i) && Math.floor(time / 140) % 2 === 1 ? 1 : 0;
      sprite.setTexture(athleteKey(p.squad, frame, p.hair));
      sprite.setPosition(p.x, p.y);
      sprite.setDepth(10 + p.y / 1000);
      const faceLeft = Math.abs(p.vx) > 12 ? p.vx < 0 : p.team === this.match.poss ? attackOf(this.match) < 0 : attackOf(this.match) > 0;
      sprite.setFlipX(faceLeft);
      if (i === this.match.control) sprite.setScale(4.2);
      else sprite.setScale(4);
    });
    const lift = this.match.disc.z * 46;
    this.disc.setPosition(this.match.disc.x, this.match.disc.y - lift);
    this.disc.setAngle(this.match.disc.age * (this.match.disc.kind === 'flick' ? 540 : 180));
    const flat = this.match.disc.kind === 'flick' ? 1.5 : 2.3;
    this.disc.setScale(3, flat + this.match.disc.z * 0.4);
    this.discShadow.setPosition(this.match.disc.x, this.match.disc.y + 4);
    this.discShadow.setAlpha(0.45 * (1 - Math.min(this.match.disc.z, 1.4) / 2));
    const stars = eligible(this.match);
    this.stars.forEach((star, i) => {
      const id = stars[i];
      if (id == null) {
        star.setVisible(false);
        return;
      }
      const p = this.match.players[id]!;
      star.setVisible(true);
      star.setPosition(p.x, p.y + 4);
    });
  }

  private readyArc(): Flight | null {
    if (!this.userHasDisc() || this.drag) return null;
    const holder = this.match.players[this.match.disc.holder];
    const leads = leadsFor(this.match, 'floater');
    if (!holder || leads.length === 0) return null;
    const dir = attackOf(this.match);
    let best = leads[0]!;
    for (const lead of leads) if (lead.x * dir > best.x * dir) best = lead;
    return flightTo({ x: holder.x, y: holder.y }, best, 'floater', this.match.userCatch);
  }

  private preview(): Flight | null {
    if (!this.drag || !this.userHasDisc()) return null;
    const plan = dragToThrow({
      dx: this.drag.x - this.drag.x0,
      dy: this.drag.y - this.drag.y0,
      durationMs: Math.max(0, this.time.now - this.drag.t0),
      releaseSpeed: releaseSpeed(this.drag.samples),
    });
    if (!plan) return null;
    const holder = this.match.players[this.match.disc.holder];
    if (!holder) return null;
    return assistFlight({ x: holder.x, y: holder.y }, plan, leadsFor(this.match, plan.kind), this.match.userCatch);
  }

  private drawOverlay(): void {
    const g = this.aimGfx;
    g.clear();
    const dir = attackOf(this.match);
    if (this.match.disc.mode === 'held') {
      const tips = receiverLeads(this.match, 'floater');
      let n = 0;
      this.match.players.forEach((p, i) => {
        if (p.team !== this.match.poss || i === this.match.disc.holder) return;
        const tip = tips[n++]!;
        g.lineStyle(3, 0xfff2c4, 0.9);
        g.lineBetween(p.x, p.y - 28, tip.x, tip.y - 28);
        g.fillStyle(0xffe14a, 1);
        g.fillTriangle(tip.x + dir * 8, tip.y - 28, tip.x - dir * 10, tip.y - 36, tip.x - dir * 10, tip.y - 20);
      });
    }
    const me = this.match.players[this.match.control];
    if (me) {
      g.lineStyle(2, 0xf4f0e0, 0.9);
      g.strokeEllipse(me.x, me.y - 2, 18, 8);
    }
    const flight = this.preview() ?? (this.time.now < this.arcUntil ? this.shownArc : null) ?? this.readyArc();
    if (!flight) return;
    if (this.drag) {
      const dx = this.drag.x - this.drag.x0;
      const dy = this.drag.y - this.drag.y0;
      const len = Math.hypot(dx, dy) || 1;
      const pull = Math.min(len, 90);
      g.fillStyle(flight.kind === 'flick' ? 0xff5a4a : 0xf4f0e0, 0.9);
      const band = flight.kind === 'flick' ? 4 : 7;
      g.fillCircle(this.drag.x, this.drag.y, 6);
      g.lineStyle(band, flight.kind === 'flick' ? 0xff5a4a : 0xffd15c, 0.95);
      g.lineBetween(
        flight.origin.x,
        flight.origin.y - 20,
        flight.origin.x + (dx / len) * pull * 0.55,
        flight.origin.y - 20 + (dy / len) * pull * 0.55,
      );
    }
    for (let i = 1; i <= 16; i += 1) {
      const age = (flight.hang * i) / 16;
      const sample = sampleFlight(flight, age);
      g.fillStyle(0xfff8ea, 1);
      g.fillCircle(sample.x, sample.y - sample.z * 48, flight.kind === 'flick' ? 3.5 : 5);
    }
  }

  private drawHud(): void {
    const g = this.hud;
    g.clear();
    g.fillStyle(0x102418, 0.92);
    g.fillRect(0, 0, VIEW_W, 36);
    g.fillRect(0, VIEW_H - 32, VIEW_W, 32);
    const us = SQUADS[this.match.userSquad]!.name;
    const them = SQUADS[this.match.oppSquad]!.name;
    const clock = formatClock(this.match.clock);
    const half = this.match.half === 1 ? 'H1' : 'H2';
    drawBit(g, `${us} ${this.match.score[0]}`, 12, 8, 0xf4f0e0, 3);
    const mid = `${half} ${clock}`;
    drawBit(g, mid, (VIEW_W - textWidth(mid, 3)) / 2, 8, 0xffd15c, 3);
    const right = `${them} ${this.match.score[1]}`;
    drawBit(g, right, VIEW_W - 12 - textWidth(right, 3), 8, 0xf4f0e0, 3);
    const hint = this.match.phase === 'celebrate' || this.match.phase === 'end'
      ? this.match.message
      : this.userHasDisc()
        ? `STALL ${Math.max(0, Math.ceil(this.match.stall))}  DRAG BACK`
        : 'DRAG TO RUN  TAP TO SWITCH';
    drawBit(g, hint, 12, VIEW_H - 24, 0xf4f0e0, 2);
    if (lungeReady(this.match)) {
      g.fillStyle(0xff5a4a, 1);
      g.fillRect(VIEW_W - 132, VIEW_H - 30, 120, 26);
      drawBit(g, 'LUNGE', VIEW_W - 118, VIEW_H - 24, 0x102418, 2);
    }
  }
}

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
