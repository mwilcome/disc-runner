import Phaser from 'phaser';
import './style.css';
import { FIELD } from './game/field';
import { GameScene } from './scenes/GameScene';
import { TitleScene } from './scenes/TitleScene';

const blockGesture = (event: Event) => {
  event.preventDefault();
};
document.addEventListener('gesturestart', blockGesture, { passive: false });
document.addEventListener('gesturechange', blockGesture, { passive: false });
document.addEventListener('contextmenu', blockGesture);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0c3d22',
  width: FIELD.width,
  height: FIELD.height,
  banner: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    mouse: {
      preventDefaultDown: true,
      preventDefaultUp: true,
      preventDefaultMove: true,
      preventDefaultWheel: true,
    },
    touch: { capture: true },
  },
  scene: [TitleScene, GameScene],
  render: { antialias: true },
});

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy(true);
  });
}
