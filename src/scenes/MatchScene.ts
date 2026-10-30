import Phaser from 'phaser';
import { blip } from '../audio';
import { athleteKey, buildTextures, drawBit, paintPitch, textWidth } from '../game/art';
import { SQUADS, loadCareer, opponentIndex } from '../game/career';
import { EZ_LEFT_END, EZ_RIGHT_START, VIEW_H, VIEW_W, WORLD_W } from '../game/field';
import {
  IDLE,
  attackOf,
  createMatch,
  eligible,
  lungeReady,
  receiverLeads,
  step,
  type FrameInput,
  type Match,
} from '../game/match';
import { MIN_PULL, dragToThrow, flightFromPlan, landingOf, releaseSpeed, sampleFlight, type DragSample, type Flight } from '../game/throw';
import { clientToGame } from '../shell/touch';
import { shouldDropThrowForChrome } from '../shell/viewport';

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
  private hit = 0;
  private catchUntil = 0;
  private catchWho = -1;
  private trail: { x: number; y: number }[] = [];
  private moveX = 0;
  private moveY = 0;
  private lunge = false;
  private ended = false;
  private born = 0;
  private finger: number | null = null;
  private fingerX = 0;
  private fingerY = 0;
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
      };
    }
    this.input.addPointer(2);
    this.input.mouse?.disableContextMenu();
    this.born = this.time.now;
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.bindFieldTouch();
  }

  private bindFieldTouch(): void {
    const doc = this.game.canvas.ownerDocument;
    const onStart = (event: TouchEvent) => this.onFieldStart(event);
    const onMove = (event: TouchEvent) => this.onFieldMove(event);
    const onEnd = (event: TouchEvent) => this.onFieldEnd(event);
    doc.addEventListener('touchstart', onStart, { passive: false });
    doc.addEventListener('touchmove', onMove, { passive: false });
    doc.addEventListener('touchend', onEnd, { passive: false });
    doc.addEventListener('touchcancel', onEnd, { passive: false });
    this.events.once('shutdown', () => {
      doc.removeEventListener('touchstart', onStart);
      doc.removeEventListener('touchmove', onMove);
      doc.removeEventListener('touchend', onEnd);
      doc.removeEventListener('touchcancel', onEnd);
      this.finger = null;
      this.drag = null;
    });
  }

  private onGameSurface(event: TouchEvent): boolean {
    const app = this.game.canvas.parentElement;
    const target = event.target;
    return target instanceof Node && !!app && app.contains(target);
  }

  private pointFromClient(clientX: number, clientY: number): { x: number; y: number } {
    const cam = this.cameras.main;
    return clientToGame(clientX, clientY, this.game.canvas.getBoundingClientRect(), VIEW_W, VIEW_H, cam.scrollX, cam.scrollY);
  }

  private onFieldStart(event: TouchEvent): void {
    if (this.finger != null || !this.onGameSurface(event)) return;
    if (this.time.now - this.born < 400) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    this.finger = touch.identifier;
    this.fingerX = touch.clientX;
    this.fingerY = touch.clientY;
    this.beginDrag(this.pointFromClient(touch.clientX, touch.clientY));
  }

  private onFieldMove(event: TouchEvent): void {
    if (this.finger == null) return;
    const touch = Array.from(event.touches).find((item) => item.identifier === this.finger);
    if (!touch) return;
    this.trackDrag(this.pointFromClient(touch.clientX, touch.clientY));
  }

  private onFieldEnd(event: TouchEvent): void {
    if (this.finger == null) return;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === this.finger);
    if (!touch) return;
    const dx = touch.clientX - this.fingerX;
    const dy = touch.clientY - this.fingerY;
    const root = this.game.canvas.ownerDocument.documentElement;
    const chromeGesture = root.classList.contains('chrome-open') || root.classList.contains('chrome-gesture');
    this.finger = null;
    if (shouldDropThrowForChrome({ chromeGesture, dx, dy })) {
      this.drag = null;
      this.moveX = 0;
      this.moveY = 0;
      return;
    }
    const at = this.pointFromClient(touch.clientX, touch.clientY);
    this.trackDrag(at);
    this.releaseDrag(at);
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
    if (prev !== this.match.message && ['GOAL', 'CATCH', 'TIP', 'INCOMPLETE', 'BLOCK', 'STALL', 'OUT', 'HALF', 'FULL TIME'].includes(this.match.message)) {
      this.hit = this.match.message === 'GOAL' ? 0.18 : 0.08;
      this.ring = 0.28;
      this.ringX = this.match.disc.x;
      this.ringY = this.match.disc.y;
      if (this.match.message === 'GOAL') this.cameras.main.shake(160, 0.008);
      blip(this.match.message === 'GOAL' || this.match.message === 'CATCH' ? 760 : 180, 0.1, 'triangle');
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
    this.cameras.main.scrollX = this.frameCamera();
  }

  private frameCamera(): number {
    const disc = this.match.disc.x;
    const dir = attackOf(this.match);
    const goal = dir > 0 ? EZ_RIGHT_START : EZ_LEFT_END;
    const nearGoal = dir > 0 ? disc >= goal - 560 : disc <= goal + 560;
    const showGoal = this.match.message === 'GOAL' || nearGoal;
    let target: number;
    if (showGoal) {
      const lineAt = dir > 0 ? 0.68 : 0.32;
      target = goal - VIEW_W * lineAt;
    } else {
      let sum = disc;
      let n = 1;
      for (const p of this.match.players) {
        if (Math.abs(p.x - disc) < 520) {
          sum += p.x;
          n += 1;
        }
      }
      const focus = disc * 0.72 + sum / n * 0.28;
      const bias = dir > 0 ? 0.4 : 0.6;
      target = focus - VIEW_W * bias;
    }
    target = Phaser.Math.Clamp(target, 0, WORLD_W - VIEW_W);
    const gap = target - this.cameras.main.scrollX;
    return this.cameras.main.scrollX + (Math.abs(gap) > 640 ? gap : gap * 0.2);
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
      if (Phaser.Input.Keyboard.JustDown(keys.l) && this.match.poss === 1) this.lunge = true;
    }
    const offense = this.match.poss === 0;
    return {
      moveX: offense ? 0 : moveX,
      moveY: offense ? 0 : moveY,
      flight: null,
      switchTo: null,
      lunge: offense ? false : this.lunge,
      aiming: offense && this.drag !== null,
    };
  }

  private userHasDisc(): boolean {
    return this.match.disc.mode === 'held' && this.match.poss === 0;
  }

  private at(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    return { x: pointer.worldX, y: pointer.worldY };
  }

  private beginDrag(p: { x: number; y: number }): void {
    const now = this.time.now;
    this.drag = { x0: p.x, y0: p.y, x: p.x, y: p.y, t0: now, samples: [{ t: now, x: p.x, y: p.y }] };
  }

  private trackDrag(p: { x: number; y: number }): void {
    if (!this.drag) return;
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

  private releaseDrag(at: { x: number; y: number }): void {
    if (!this.drag) return;
    const drag = this.drag;
    this.drag = null;
    const dx = at.x - drag.x0;
    const dy = at.y - drag.y0;
    const len = Math.hypot(dx, dy);
    this.moveX = 0;
    this.moveY = 0;
    if (this.userHasDisc() && len >= MIN_PULL) {
      const plan = dragToThrow({
        dx,
        dy,
        durationMs: Math.max(0, this.time.now - drag.t0),
        releaseSpeed: releaseSpeed(drag.samples),
      });
      if (!plan) return;
      const holder = this.match.players[this.match.disc.holder];
      if (!holder) return;
      const flight = flightFromPlan({ x: holder.x, y: holder.y }, plan, this.match.userCatch);
      step(this.match, 0, { ...IDLE, flight });
      return;
    }
    if (this.match.poss !== 1 || len > 48) return;
    const hit = this.nearestUser(at.x, at.y);
    if (hit < 0) return;
    if (hit === this.match.control && lungeReady(this.match)) {
      this.lunge = true;
      step(this.match, 0, { ...IDLE, lunge: true });
      return;
    }
    if (hit !== this.match.control) step(this.match, 0, { ...IDLE, switchTo: hit });
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.wasTouch || this.time.now - this.born < 400) return;
    this.beginDrag(this.at(pointer));
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.wasTouch) return;
    this.trackDrag(this.at(pointer));
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.wasTouch) return;
    const at = this.at(pointer);
    this.trackDrag(at);
    this.releaseDrag(at);
  }

  private nearestUser(x: number, y: number): number {
    let best = -1;
    let dist = 110;
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
      else if (moving(i)) pose = Math.floor(time / 140) % 2 === 0 ? 'run0' : 'run1';
      sprite.setTexture(athleteKey(p.squad, pose, p.hair));
      sprite.setPosition(p.x, p.y);
      sprite.setDepth(10 + p.y / 1000);
      const faceLeft = i === this.match.control && Math.abs(p.vx) > 20
        ? p.vx < 0
        : attackOf(this.match) < 0;
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
    const lift = this.match.disc.z * 64;
    const spin = this.match.disc.age * (this.match.disc.kind === 'flick' ? 520 : 280);
    this.trail.unshift({ x: this.match.disc.x, y: this.match.disc.y - lift });
    this.trail.length = 6;
    this.ghosts.forEach((ghost, i) => {
      const bit = this.trail[i + 1];
      const show = flying && bit;
      ghost.setVisible(!!show);
      if (!show || !bit) return;
      ghost.setPosition(bit.x, bit.y);
      ghost.setAngle(spin);
      ghost.setScale(3.2, 1.45);
      ghost.setAlpha(0.22 - i * 0.03);
    });
    this.disc.setPosition(this.match.disc.x, this.match.disc.y - lift);
    this.disc.setAngle(flying ? spin : attackOf(this.match) > 0 ? 12 : 168);
    this.disc.setScale(3.5, 1.5);
    this.discShadow.setPosition(this.match.disc.x, this.match.disc.y + 4);
    this.discShadow.setAlpha(flying ? 0.45 * (1 - Math.min(this.match.disc.z, 1.6) / 2.2) : 0.4);
    this.discShadow.setScale(3.4 + this.match.disc.z * 1.1, 1.3);
    const stars = eligible(this.match);
    const pulse = 2.15 + Math.sin(time / 140) * 0.08;
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
    return flightFromPlan({ x: holder.x, y: holder.y }, plan, this.match.userCatch);
  }

  private drawOverlay(): void {
    const g = this.aimGfx;
    g.clear();
    if (this.match.disc.mode === 'held' && !this.drag) {
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
        g.lineStyle(2, 0xfff2c4, 0.35);
        g.lineBetween(p.x, p.y - 36, ax, ay);
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
    if (this.drag && this.userHasDisc()) {
      const dx = this.drag.x - this.drag.x0;
      const dy = this.drag.y - this.drag.y0;
      const len = Math.hypot(dx, dy);
      g.lineStyle(7, 0xffd15c, 1);
      g.lineBetween(this.drag.x0, this.drag.y0, this.drag.x, this.drag.y);
      g.fillStyle(0xfff6e4, 1);
      g.fillCircle(this.drag.x, this.drag.y, 8);
      if (len < MIN_PULL) drawBit(g, 'PULL MORE', this.drag.x + 14, this.drag.y - 18, 0xfff6e4, 2);
    }
    const flight = this.preview() ?? this.liveFlight();
    if (!flight) return;
    if (this.drag) {
      for (let i = 1; i <= 18; i += 1) {
        const age = (flight.hang * i) / 18;
        const sample = sampleFlight(flight, age);
        g.fillStyle(0xfff8ea, 1);
        g.fillCircle(sample.x, sample.y - sample.z * 56, i === 18 ? 7 : 5);
      }
    }
    const land = landingOf(flight);
    g.lineStyle(5, 0xffe14a, 1);
    g.strokeCircle(land.x, land.y, flight.catchRadius);
    g.fillStyle(0xffe14a, 1);
    g.fillCircle(land.x, land.y, 6);
    g.lineBetween(land.x - 14, land.y, land.x + 14, land.y);
    g.lineBetween(land.x, land.y - 14, land.x, land.y + 14);
  }

  private liveFlight(): Flight | null {
    if (this.match.disc.mode !== 'flight') return null;
    const d = this.match.disc;
    return {
      origin: { x: d.originX, y: d.originY },
      aim: { x: d.aimX, y: d.aimY },
      speed: d.speed,
      hang: d.hang,
      maxZ: d.maxZ,
      kind: d.kind,
      catchRadius: d.catchRadius,
    };
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
    const pull = this.drag && this.userHasDisc()
      ? Math.hypot(this.drag.x - this.drag.x0, this.drag.y - this.drag.y0)
      : 0;
    const hint = this.match.phase === 'celebrate' || this.match.phase === 'end' || this.match.disc.mode === 'flight'
      ? this.match.message
      : pull > 0 && pull < MIN_PULL
        ? 'PULL MORE'
        : this.match.message === 'SNAP' || this.match.message === 'DEFEND'
          ? this.match.message
          : this.userHasDisc()
            ? this.match.phase === 'live'
              ? `STALL ${Math.max(0, Math.ceil(this.match.stall))}  DRAG TO AIM`
              : 'DRAG TO AIM'
            : lungeReady(this.match)
              ? 'TAP RUNNER TO LUNGE'
              : 'DRAG TO RUN  TAP TO SWITCH';
    drawBit(g, hint, 16, VIEW_H - 24, 0xf4f0e0, 2);
    if (this.match.phase === 'celebrate' || this.match.phase === 'end') {
      const msg = this.match.message;
      const scale = msg.length > 8 ? 5 : 7;
      const w = textWidth(msg, scale) + 48;
      const h = 5 * scale + 36;
      const left = (VIEW_W - w) / 2;
      const top = VIEW_H / 2 - h / 2;
      g.fillStyle(0x07140c, 1);
      g.fillRect(left, top, w, h);
      const gold = this.match.message === 'GOAL' || this.match.message === 'CATCH';
      g.lineStyle(5, gold ? 0xffe14a : 0xff5a4a, 1);
      g.strokeRect(left, top, w, h);
      drawBit(g, msg, (VIEW_W - textWidth(msg, scale)) / 2, top + 16, 0xfff6e4, scale);
    }
  }
}

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
