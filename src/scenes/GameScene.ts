import Phaser from 'phaser';
import { blip, vibrate } from '../audio';
import { MARK_RADIUS } from '../game/catch';
import { BODY, COLOR, DISPLAY } from '../game/constants';
import { FIELD, cutterSpot } from '../game/field';
import { createMatch, throwDisc, tick, type Match, type Phase } from '../game/sim';
import { paintField } from './paintField';
import {
  DISC_LIFT,
  discSample,
  dragToThrow,
  releaseSpeed,
  sweetSpot,
  trajectoryPoints,
  type DragSample,
  type ThrowPlan,
} from '../game/throw';

const TEXT_RES = Math.min(2, window.devicePixelRatio || 1);

interface AimDrag {
  x0: number;
  y0: number;
  x: number;
  y: number;
  t0: number;
  samples: DragSample[];
}

export class GameScene extends Phaser.Scene {
  private match!: Match;
  private aim: AimDrag | null = null;
  private slideX: number | null = null;
  private laneStep: -1 | 0 | 1 = 0;
  private skip = false;

  private guides!: Phaser.GameObjects.Graphics;
  private aimGfx!: Phaser.GameObjects.Graphics;
  private player!: Phaser.GameObjects.Container;
  private cutter!: Phaser.GameObjects.Container;
  private cutterRing!: Phaser.GameObjects.Arc;
  private defender!: Phaser.GameObjects.Arc;
  private shadow!: Phaser.GameObjects.Ellipse;
  private discWrap!: Phaser.GameObjects.Container;
  private scoreText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private sub!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private bannerSub!: Phaser.GameObjects.Text;
  private veil!: Phaser.GameObjects.Rectangle;
  private leftHint!: Phaser.GameObjects.Text;
  private rightHint!: Phaser.GameObjects.Text;

  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA?: Phaser.Input.Keyboard.Key;
  private keyD?: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'play', active: false });
  }

  create(): void {
    this.match = createMatch();
    paintField(this.add.graphics().setDepth(0));
    const endZoneMid = (FIELD.endZoneTop + FIELD.endZoneBottom) / 2;
    this.add
      .text(FIELD.width / 2, endZoneMid, 'END ZONE', {
        fontFamily: DISPLAY,
        fontSize: '28px',
        color: '#fff6e8',
        resolution: TEXT_RES,
      })
      .setOrigin(0.5)
      .setAlpha(0.45)
      .setDepth(1);

    this.guides = this.add.graphics().setDepth(2);
    this.aimGfx = this.add.graphics().setDepth(6);

    this.defender = this.add.circle(0, 0, 15, COLOR.mark).setDepth(3);
    this.defender.setStrokeStyle(2, 0x9aa6b8, 0.9);

    this.player = this.token(COLOR.cream, COLOR.coral, 'YOU');
    this.cutter = this.token(COLOR.gold, COLOR.ink, 'CUT');
    this.cutterRing = this.add.circle(0, 0, 26).setDepth(3);
    this.cutterRing.setStrokeStyle(2, COLOR.gold, 0.9);
    this.cutterRing.setFillStyle(COLOR.gold, 0);

    this.shadow = this.add.ellipse(0, 0, 22, 10, 0x04150c, 0.35).setDepth(4);
    this.discWrap = this.add.container(0, 0).setDepth(5);
    const discBody = this.add.ellipse(0, 0, 28, 16, COLOR.coral);
    discBody.setStrokeStyle(2, COLOR.cream);
    const discStripe = this.add.ellipse(0, 0, 16, 4, COLOR.cream);
    this.discWrap.add([discBody, discStripe]);

    this.scoreText = this.label(20, 18, '0', DISPLAY, '32px', '#fff6e8').setOrigin(0, 0);
    this.add
      .text(20, 52, 'SCORE', {
        fontFamily: BODY,
        fontSize: '12px',
        fontStyle: '700',
        color: '#fff6e8',
        resolution: TEXT_RES,
      })
      .setOrigin(0, 0)
      .setAlpha(0.8)
      .setDepth(10);
    this.phaseText = this.label(FIELD.width - 20, 24, 'THROW', DISPLAY, '22px', '#fff6e8').setOrigin(1, 0);

    this.sub = this.label(FIELD.width / 2, 760, '', BODY, '16px', '#fff6e8').setOrigin(0.5);
    this.hint = this.label(FIELD.width / 2, 802, '', BODY, '16px', '#fff6e8').setOrigin(0.5);
    this.hint.setFontStyle('700');

    this.leftHint = this.label(28, 520, '‹', DISPLAY, '54px', '#fff6e8').setOrigin(0.5).setAlpha(0.7);
    this.rightHint = this
      .label(FIELD.width - 28, 520, '›', DISPLAY, '54px', '#fff6e8')
      .setOrigin(0.5)
      .setAlpha(0.7);

    this.veil = this.add
      .rectangle(FIELD.width / 2, FIELD.height / 2, FIELD.width, FIELD.height, COLOR.ink, 0.35)
      .setDepth(14)
      .setVisible(false);
    this.banner = this.label(FIELD.width / 2, 390, '', DISPLAY, '72px', '#fff6e8').setOrigin(0.5).setDepth(16);
    this.bannerSub = this.label(FIELD.width / 2, 460, '', BODY, '22px', '#ff4d4a').setOrigin(0.5).setDepth(16);

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.keyA = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    const prevPhase = this.match.phase;
    const prevScore = this.match.score;
    const prevCelebrate = this.match.celebrate;
    this.match = tick(this.match, {
      dt,
      laneStep: this.consumeLane(),
      skip: this.consumeSkip(),
    });
    this.playSounds(prevPhase, prevScore, prevCelebrate);
    if (this.match.phase !== 'throw') this.aim = null;
    this.draw();
  }

  private teardown(): void {
    this.input.off('pointerdown', this.onDown, this);
    this.input.off('pointermove', this.onMove, this);
    this.input.off('pointerup', this.onUp, this);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.button !== 0 && !pointer.wasTouch) return;
    const { x, y } = this.world(pointer);
    if (this.match.phase === 'celebrate') {
      this.skip = true;
      return;
    }
    if (this.match.phase === 'throw') {
      const now = this.time.now;
      this.aim = { x0: x, y0: y, x, y, t0: now, samples: [{ t: now, x, y }] };
      return;
    }
    if (this.match.phase === 'run') this.slideX = x;
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!this.aim || !pointer.isDown) return;
    const { x, y } = this.world(pointer);
    const now = this.time.now;
    this.aim.x = x;
    this.aim.y = y;
    this.aim.samples.push({ t: now, x, y });
    const cutoff = now - 140;
    while (this.aim.samples.length > 2 && this.aim.samples[0]!.t < cutoff) this.aim.samples.shift();
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    const { x, y } = this.world(pointer);
    if (this.aim) {
      const drag = this.aim;
      this.aim = null;
      drag.x = x;
      drag.y = y;
      this.match = throwDisc(this.match, {
        dx: drag.x - drag.x0,
        dy: drag.y - drag.y0,
        durationMs: Math.max(0, this.time.now - drag.t0),
        releaseSpeed: releaseSpeed(drag.samples),
      });
      return;
    }
    if (this.slideX == null || this.match.phase !== 'run') return;
    const dx = x - this.slideX;
    this.slideX = null;
    if (dx > 28) this.laneStep = 1;
    else if (dx < -28) this.laneStep = -1;
    else if (x < FIELD.width / 3) this.laneStep = -1;
    else if (x > (FIELD.width * 2) / 3) this.laneStep = 1;
  }

  private consumeLane(): -1 | 0 | 1 {
    let step = this.laneStep;
    this.laneStep = 0;
    if (step === 0 && this.match.phase === 'run') {
      const left =
        (this.cursors?.left && Phaser.Input.Keyboard.JustDown(this.cursors.left)) ||
        (this.keyA && Phaser.Input.Keyboard.JustDown(this.keyA));
      const right =
        (this.cursors?.right && Phaser.Input.Keyboard.JustDown(this.cursors.right)) ||
        (this.keyD && Phaser.Input.Keyboard.JustDown(this.keyD));
      if (left) step = -1;
      else if (right) step = 1;
    }
    return step;
  }

  private consumeSkip(): boolean {
    const skip = this.skip;
    this.skip = false;
    return skip;
  }

  private playSounds(prevPhase: Phase, prevScore: number, prevCelebrate: Match['celebrate']): void {
    if (prevPhase !== 'flight' && this.match.phase === 'flight') {
      blip(this.match.disc?.kind === 'flick' ? 740 : 420, 0.07, 'triangle');
      vibrate(10);
    }
    if (this.match.score > prevScore) {
      blip(620, 0.08);
      blip(860, 0.14);
      vibrate(20);
    } else if (prevPhase === 'run' && this.match.phase === 'throw') {
      blip(500, 0.06, 'triangle');
    }
    if (this.match.celebrate === 'drop' && prevCelebrate !== 'drop') blip(160, 0.12, 'sine');
  }

  private draw(): void {
    const m = this.match;
    this.player.setPosition(m.player.x, m.player.y);
    this.cutter.setPosition(m.cutter.x, m.cutter.y);
    this.defender.setPosition(m.defender.x, m.defender.y);
    const pulse = 26 + Math.sin(this.time.now / 160) * 3;
    const showCutter = m.phase === 'throw' || m.phase === 'flight';
    this.cutterRing.setVisible(showCutter);
    this.cutterRing.setPosition(m.cutter.x, m.cutter.y);
    this.cutterRing.setRadius(pulse);

    this.drawGuides();
    this.drawAim();
    this.placeDisc();

    this.scoreText.setText(String(m.score));
    this.phaseText.setText(phaseLabel(m.phase));
    const plan = this.planFromAim();
    this.hint.setText(this.hintCopy(plan));
    this.hint.setColor(plan?.kind === 'flick' ? '#ff4d4a' : '#fff6e8');
    this.sub.setText(m.phase === 'celebrate' ? '' : m.submessage);
    this.sub.setVisible(m.phase !== 'celebrate');

    const showRun = m.phase === 'run';
    this.leftHint.setVisible(showRun);
    this.rightHint.setVisible(showRun);

    const celebrating = m.phase === 'celebrate';
    this.veil.setVisible(celebrating);
    this.banner.setVisible(celebrating);
    this.bannerSub.setVisible(celebrating);
    if (celebrating) {
      this.banner.setText(m.message.toUpperCase());
      this.bannerSub.setText(m.submessage);
    }
  }

  private drawGuides(): void {
    const g = this.guides;
    const m = this.match;
    g.clear();
    if (m.phase === 'throw' || m.phase === 'flight') {
      g.fillStyle(COLOR.cream, 0.32);
      for (let t = 0.2; t <= 3; t += 0.4) {
        const spot = cutterSpot(m.routeAnchor, m.cutterElapsed + t, m.cutterCutLane);
        g.fillCircle(spot.x, spot.y, 3);
      }
      g.lineStyle(2, COLOR.cream, 0.4);
      g.strokeCircle(m.defender.x, m.defender.y, MARK_RADIUS.flick);
    }
    if (m.phase === 'run') {
      g.lineStyle(1, COLOR.cream, 0.14);
      for (const x of FIELD.lanes) g.lineBetween(x, FIELD.endZoneBottom + 8, x, FIELD.plantY + 30);
      if (m.returnMark) {
        const radius = 20 + Math.sin(this.time.now / 140) * 4;
        g.lineStyle(3, COLOR.coral, 0.95);
        g.strokeCircle(m.returnMark.x, m.returnMark.y, radius);
        g.fillStyle(COLOR.coral, 0.18);
        g.fillCircle(m.returnMark.x, m.returnMark.y, radius - 4);
      }
    }
  }

  private drawAim(): void {
    const g = this.aimGfx;
    g.clear();
    if (!this.aim || this.match.phase !== 'throw') return;
    const dx = this.aim.x - this.aim.x0;
    const dy = this.aim.y - this.aim.y0;
    const len = Math.hypot(dx, dy);
    g.fillStyle(COLOR.cream, 0.95);
    g.fillCircle(this.aim.x, this.aim.y, 7);
    if (len < 8) return;
    const pull = Math.min(len, 110);
    g.lineStyle(2, 0xffffff, 0.4);
    g.lineBetween(
      this.match.player.x,
      this.match.player.y,
      this.match.player.x + (dx / len) * pull * 0.45,
      this.match.player.y + (dy / len) * pull * 0.45,
    );
    const plan = this.planFromAim();
    if (!plan) return;
    const pts = trajectoryPoints(this.match.player, plan, 14);
    const color = plan.kind === 'flick' ? COLOR.coral : COLOR.cream;
    g.lineStyle(2, color, 0.35);
    g.beginPath();
    g.moveTo(pts[0]!.x, pts[0]!.y - pts[0]!.z * DISC_LIFT);
    for (let i = 1; i < pts.length; i += 1) {
      const lifted = pts[i]!;
      g.lineTo(lifted.x, lifted.y - lifted.z * DISC_LIFT);
    }
    g.strokePath();
    g.lineStyle(3, color, 0.95);
    g.beginPath();
    g.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i]!.x, pts[i]!.y);
    g.strokePath();
    const sweet = sweetSpot(this.match.player, plan);
    g.lineStyle(3, color, 1);
    g.strokeCircle(sweet.x, sweet.y, plan.kind === 'flick' ? 10 : 18);
  }

  private placeDisc(): void {
    const m = this.match;
    if (m.phase === 'celebrate') {
      this.discWrap.setVisible(false);
      this.shadow.setVisible(false);
      return;
    }
    this.discWrap.setVisible(true);
    this.shadow.setVisible(true);
    if (m.disc) {
      const sample = discSample(m.disc);
      this.moveDisc(sample.x, sample.y, sample.z, m.disc.age * (m.disc.kind === 'flick' ? 16 : 7));
      return;
    }
    if (m.phase === 'run') {
      this.moveDisc(m.cutter.x + 18, m.cutter.y - 10, 0.22, -16);
      return;
    }
    this.moveDisc(m.player.x + 16, m.player.y - 8, 0.28, -16);
  }

  private moveDisc(x: number, y: number, z: number, angle: number): void {
    this.shadow.setPosition(x, y + 8);
    this.shadow.setScale(1.05 - Math.min(z, 1.4) * 0.35, 1);
    this.shadow.setAlpha(0.33 * (1 - Math.min(z, 1.6) / 2.2));
    this.discWrap.setPosition(x, y - z * DISC_LIFT);
    this.discWrap.setScale(1 + z * 0.16);
    this.discWrap.setAngle(angle);
  }

  private planFromAim(): ThrowPlan | null {
    if (!this.aim) return null;
    return dragToThrow({
      dx: this.aim.x - this.aim.x0,
      dy: this.aim.y - this.aim.y0,
      durationMs: Math.max(0, this.time.now - this.aim.t0),
      releaseSpeed: releaseSpeed(this.aim.samples),
    });
  }

  private hintCopy(plan: ThrowPlan | null): string {
    if (plan) return plan.kind === 'flick' ? 'Flick — fast and tight' : 'Floater — hangs up';
    return this.match.message;
  }

  private token(fill: number, stroke: number, name: string): Phaser.GameObjects.Container {
    const group = this.add.container(0, 0).setDepth(4);
    const body = this.add.circle(0, 0, 18, fill);
    body.setStrokeStyle(3, stroke);
    const tag = this.add
      .text(0, -30, name, {
        fontFamily: BODY,
        fontSize: '11px',
        fontStyle: '800',
        color: '#fff6e8',
        resolution: TEXT_RES,
      })
      .setOrigin(0.5)
      .setShadow(0, 1, '#082214', 3, true, true);
    group.add([body, tag]);
    return group;
  }

  private label(
    x: number,
    y: number,
    text: string,
    family: string,
    size: string,
    color: string,
  ): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, text, {
        fontFamily: family,
        fontSize: size,
        color,
        resolution: TEXT_RES,
      })
      .setDepth(12)
      .setShadow(0, 2, '#082214', 4, true, true);
  }

  private world(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    return { x: pointer.worldX, y: pointer.worldY };
  }
}

function phaseLabel(phase: Phase): string {
  if (phase === 'run') return 'RUN';
  if (phase === 'flight') return 'DISC';
  if (phase === 'celebrate') return '';
  return 'THROW';
}
