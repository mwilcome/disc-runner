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
  private ghosts: Phaser.GameObjects.Image[] = [];
  private discShadow!: Phaser.GameObjects.Image;
  private feet: Phaser.GameObjects.Image[] = [];
  private ring = 0;
  private ringX = 0;
  private ringY = 0;
  private aimGfx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private drag: Drag | null = null;
  private shownArc: Flight | null = null;
  private arcUntil = 0;
  private hit = 0;
  private catchUntil = 0;
  private catchWho = -1;
  private trail: { x: number; y: number }[] = [];
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
    this.discShadow = this.add.image(0, 0, 'shadow').setDepth(4).setScale(4);
    this.feet = this.match.players.map(() => this.add.image(0, 0, 'shadow').setDepth(5).setScale(3.4, 2.2));
    this.ghosts = [
      this.add.image(0, 0, 'disc').setDepth(28).setAlpha(0.16),
      this.add.image(0, 0, 'disc').setDepth(28).setAlpha(0.28),
      this.add.image(0, 0, 'disc').setDepth(29).setAlpha(0.42),
    ];
    this.disc = this.add.image(0, 0, 'disc').setDepth(30).setScale(3.2);
    this.sprites = this.match.players.map((p) =>
      this.add.image(p.x, p.y, athleteKey(p.squad, 'stand', p.hair)).setOrigin(0.5, 1).setScale(3.15).setDepth(10),
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
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'l' || ev.key === 'L') this.lunge = true;
      if (ev.key === 't' || ev.key === 'T') this.releaseShownArc();
    };
    window.addEventListener('keydown', onKey);
    this.events.once('shutdown', () => window.removeEventListener('keydown', onKey));
  }

  update(time: number, delta: number): void {
    if (this.ended) return;
    const dt = Math.min(0.05, delta / 1000);
    if (this.ring > 0) this.ring = Math.max(0, this.ring - dt);
    if (this.hit > 0) {
      this.hit -= dt;
      this.sync(time);
      this.drawOverlay();
      this.drawHud();
      return;
    }
    const input = this.frameInput();
    const prev = this.match.message;
    const prevHolder = this.match.disc.holder;
    step(this.match, dt, input);
    this.lunge = false;
    if (this.match.disc.holder !== prevHolder && this.match.disc.mode === 'held' && this.match.disc.holder >= 0) {
      this.catchWho = this.match.disc.holder;
      this.catchUntil = time + 560;
    }
    if (prev !== this.match.message && ['GOAL', 'BLOCK', 'DROP', 'STALL', 'OUT', 'HALF', 'FULL TIME'].includes(this.match.message)) {
      this.hit = this.match.message === 'GOAL' ? 0.26 : 0.16;
      this.ring = 0.34;
      this.ringX = this.match.disc.x;
      this.ringY = this.match.disc.y;
      this.cameras.main.shake(220, this.match.message === 'GOAL' ? 0.016 : 0.01);
      this.cameras.main.flash(90, 255, 244, 210, false);
      blip(this.match.message === 'GOAL' ? 760 : 180, 0.1, 'triangle');
    } else if (this.match.message !== prev && (this.match.message === 'FLICK' || this.match.message === 'FLOATER')) {
      blip(this.match.message === 'FLICK' ? 640 : 420, 0.06, 'triangle');
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
    const bias = this.match.disc.mode === 'flight' ? 0.4 : 0.3;
    this.cameras.main.scrollX = Phaser.Math.Clamp(focus - VIEW_W * bias, 0, WORLD_W - VIEW_W);
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
    const ev = pointer.event as MouseEvent | undefined;
    const rawX = ev && typeof ev.offsetX === 'number' ? ev.offsetX : pointer.x;
    const rawY = ev && typeof ev.offsetY === 'number' ? ev.offsetY : pointer.y;
    const inGame = pointer.x > VIEW_W - 220 && pointer.y > VIEW_H - 100;
    const inDisplay = rawX > this.scale.displaySize.width - 300 && rawY > this.scale.displaySize.height - 150;
    if ((inGame || inDisplay) && lungeReady(this.match)) {
      this.lunge = true;
      const me = this.match.players[this.match.control];
      const holder = this.match.players[this.match.disc.holder];
      if (me && holder) {
        me.lunge = 0.55;
        const dx = holder.x - me.x;
        const dy = holder.y - me.y;
        const dist = Math.hypot(dx, dy) || 1;
        me.vx = (dx / dist) * 280;
        me.vy = (dy / dist) * 280;
      }
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
      const hasDisc = this.match.disc.mode === 'held' && this.match.disc.holder === i;
      let pose = 'stand';
      if (p.lunge > 0) pose = 'dive';
      else if (i === this.catchWho && time < this.catchUntil) pose = 'catch';
      else if (hasDisc) pose = 'throw';
      else if (moving(i)) pose = Math.floor(time / 90) % 2 === 0 ? 'run0' : 'run1';
      sprite.setTexture(athleteKey(p.squad, pose, p.hair));
      sprite.setPosition(Math.round(p.x), Math.round(p.y));
      sprite.setDepth(10 + p.y / 1000);
      const faceLeft = Math.abs(p.vx) > 12 ? p.vx < 0 : p.team === this.match.poss ? attackOf(this.match) < 0 : attackOf(this.match) > 0;
      sprite.setFlipX(faceLeft);
      const base = i === this.match.control ? 3.35 : 3.15;
      const pop = i === this.catchWho && time < this.catchUntil ? 1 + Math.sin((this.catchUntil - time) / 80) * 0.08 : 1;
      sprite.setScale(base * pop);
      const foot = this.feet[i];
      if (foot) {
        foot.setPosition(Math.round(p.x), Math.round(p.y) - 2);
        foot.setAlpha(p.lunge > 0 ? 0.2 : 0.55);
        foot.setScale(p.lunge > 0 ? 4.2 : 3.3, 2);
      }
    });
    const flying = this.match.disc.mode === 'flight';
    const lift = this.match.disc.z * 58;
    const rate = this.match.disc.kind === 'flick' ? 17 : 8.5;
    const wobble = flying ? Math.abs(Math.sin(this.match.disc.age * rate)) : 0.72;
    const spin = flying ? this.match.disc.age * (this.match.disc.kind === 'flick' ? 260 : 150) : attackOf(this.match) > 0 ? 16 : 164;
    this.trail.unshift({ x: this.match.disc.x, y: this.match.disc.y - lift });
    this.trail.length = 5;
    this.ghosts.forEach((ghost, i) => {
      const bit = this.trail[i + 1];
      const show = flying && bit;
      ghost.setVisible(!!show);
      if (!show || !bit) return;
      ghost.setPosition(bit.x, bit.y);
      ghost.setAngle(spin - (i + 1) * 36);
      ghost.setScale(2.6, 0.4 + wobble * 1.3);
    });
    this.disc.setPosition(this.match.disc.x, this.match.disc.y - lift);
    this.disc.setAngle(spin);
    this.disc.setScale(3.25, flying ? 0.42 + wobble * 1.75 : 1.35);
    this.discShadow.setPosition(this.match.disc.x, this.match.disc.y + 4);
    this.discShadow.setAlpha(flying ? 0.45 * (1 - Math.min(this.match.disc.z, 1.6) / 2.2) : 0.4);
    this.discShadow.setScale(3.4 + this.match.disc.z * 1.1, 1.3);
    const stars = eligible(this.match);
    const pulse = 2.85 + Math.sin(time / 140) * 0.15;
    this.stars.forEach((star, i) => {
      const id = stars[i];
      if (id == null) {
        star.setVisible(false);
        return;
      }
      const p = this.match.players[id]!;
      star.setVisible(true);
      star.setPosition(Math.round(p.x), Math.round(p.y) - 34);
      star.setScale(this.match.disc.mode === 'flight' ? pulse + 0.35 : pulse);
      star.setDepth(8);
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
        const dx = tip.x - p.x;
        const dy = tip.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const reach = Math.min(72, len);
        const ax = p.x + (dx / len) * reach;
        const ay = p.y - 40 + (dy / len) * reach;
        g.lineStyle(4, 0xfff2c4, 0.95);
        g.lineBetween(p.x, p.y - 40, ax, ay);
        g.fillStyle(0xffe14a, 1);
        g.fillTriangle(ax + dir * 9, ay, ax - dir * 8, ay - 7, ax - dir * 8, ay + 7);
      });
    }
    const me = this.match.players[this.match.control];
    if (me) {
      const pulse = 18 + Math.sin(this.time.now / 110) * 3;
      g.lineStyle(5, 0xffe14a, 1);
      g.strokeEllipse(me.x, me.y - 2, pulse, 9);
      g.lineStyle(2, 0x102418, 0.9);
      g.strokeEllipse(me.x, me.y - 2, pulse - 8, 5);
      g.fillStyle(0xffe14a, 1);
      g.fillTriangle(me.x, me.y - 78, me.x - 8, me.y - 64, me.x + 8, me.y - 64);
    }
    if (this.ring > 0) {
      const radius = (0.34 - this.ring) * 220 + 18;
      g.lineStyle(4, 0xfff6e4, this.ring / 0.34);
      g.strokeCircle(this.ringX, this.ringY, radius);
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
      g.fillCircle(sample.x, sample.y - sample.z * 56, flight.kind === 'flick' ? 4 : 5.5);
    }
  }

  private drawHud(): void {
    const g = this.hud;
    g.clear();
    g.fillStyle(0x102418, 0.94);
    g.fillRect(0, 0, VIEW_W, 40);
    g.fillStyle(0xffd15c, 1);
    g.fillRect(0, 40, VIEW_W, 3);
    g.fillStyle(0x102418, 0.94);
    g.fillRect(0, VIEW_H - 34, VIEW_W, 34);
    const us = SQUADS[this.match.userSquad]!.name;
    const them = SQUADS[this.match.oppSquad]!.name;
    const clock = formatClock(this.match.clock);
    const half = this.match.half === 1 ? 'H1' : 'H2';
    drawBit(g, `${us} ${this.match.score[0]}`, 16, 10, 0xf4f0e0, 3);
    const mid = `${half} ${clock}`;
    drawBit(g, mid, (VIEW_W - textWidth(mid, 3)) / 2, 10, 0xffd15c, 3);
    const right = `${them} ${this.match.score[1]}`;
    drawBit(g, right, VIEW_W - 16 - textWidth(right, 3), 10, 0xf4f0e0, 3);
    const hint = this.match.phase === 'celebrate' || this.match.phase === 'end' || this.match.disc.mode === 'flight'
      ? this.match.message
      : this.userHasDisc()
        ? `STALL ${Math.max(0, Math.ceil(this.match.stall))}  DRAG BACK`
        : 'DRAG TO RUN  TAP TO SWITCH';
    drawBit(g, hint, 16, VIEW_H - 24, 0xf4f0e0, 2);
    if (lungeReady(this.match)) {
      g.fillStyle(0xff5a4a, 1);
      g.fillRect(VIEW_W - 132, VIEW_H - 30, 120, 26);
      drawBit(g, 'LUNGE', VIEW_W - 118, VIEW_H - 24, 0x102418, 2);
    }
    if (this.match.phase === 'celebrate' || this.match.phase === 'end') {
      const msg = this.match.message;
      const scale = msg.length > 8 ? 4 : 6;
      const w = textWidth(msg, scale) + 36;
      g.fillStyle(0x102418, 0.88);
      g.fillRect((VIEW_W - w) / 2, VIEW_H / 2 - 36, w, 5 * scale + 28);
      g.lineStyle(3, this.match.message === 'GOAL' ? 0xffe14a : 0xff5a4a, 1);
      g.strokeRect((VIEW_W - w) / 2, VIEW_H / 2 - 36, w, 5 * scale + 28);
      drawBit(g, msg, (VIEW_W - textWidth(msg, scale)) / 2, VIEW_H / 2 - 18, 0xf4f0e0, scale);
    }
  }
}

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
