import Phaser from 'phaser';
import { BODY, COLOR, DISPLAY } from '../game/constants';
import { FIELD } from '../game/field';
import { paintStripes } from './paintField';

const TEXT_RES = Math.min(2, window.devicePixelRatio || 1);

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create(): void {
    paintStripes(this.add.graphics());

    this.add
      .text(FIELD.width / 2, 280, 'Disc Runner', {
        fontFamily: DISPLAY,
        fontSize: '58px',
        color: '#fff6e8',
        align: 'center',
        resolution: TEXT_RES,
      })
      .setOrigin(0.5)
      .setShadow(0, 3, '#082214', 8, true, true);

    const disc = this.add.container(FIELD.width / 2, 400);
    const body = this.add.ellipse(0, 0, 96, 58, COLOR.coral);
    body.setStrokeStyle(4, COLOR.cream);
    const stripe = this.add.ellipse(0, 0, 62, 12, COLOR.cream);
    disc.add([body, stripe]);
    disc.setAngle(-16);
    this.tweens.add({
      targets: disc,
      angle: 18,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add
      .text(
        FIELD.width / 2,
        520,
        'Drag back. The disc flies the other way.\nQuick release flicks. A slow pull floats.',
        {
          fontFamily: BODY,
          fontSize: '18px',
          fontStyle: '600',
          color: '#fff6e8',
          align: 'center',
          lineSpacing: 8,
          wordWrap: { width: 320 },
          resolution: TEXT_RES,
        },
      )
      .setOrigin(0.5)
      .setShadow(0, 2, '#082214', 4, true, true);

    const tap = this.add
      .text(FIELD.width / 2, 680, 'Tap to play', {
        fontFamily: DISPLAY,
        fontSize: '28px',
        color: '#ff4d4a',
        resolution: TEXT_RES,
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: tap,
      alpha: 0.35,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    const start = () => {
      this.scene.start('play');
    };
    this.input.once('pointerup', start);
    this.input.keyboard?.once('keydown-ENTER', start);
    this.input.keyboard?.once('keydown-SPACE', start);
  }
}
