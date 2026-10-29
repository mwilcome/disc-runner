import Phaser from 'phaser';
import './style.css';
import { VIEW_H, VIEW_W } from './game/field';
import { HubScene } from './scenes/HubScene';
import { MatchScene } from './scenes/MatchScene';
import { ResultScene } from './scenes/ResultScene';
import { ShopScene } from './scenes/ShopScene';
import { TitleScene } from './scenes/TitleScene';
import { installViewport } from './shell/viewport';

installViewport();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#102418',
  width: VIEW_W,
  height: VIEW_H,
  banner: false,
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 3,
    mouse: {
      preventDefaultWheel: true,
    },
    touch: { capture: true },
  },
  render: { antialias: false, pixelArt: true, roundPixels: true },
  scene: [TitleScene, HubScene, ShopScene, MatchScene, ResultScene],
});

const parent = document.getElementById('app');
if (parent && 'ResizeObserver' in window) {
  let queued = false;
  const observer = new ResizeObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      game.scale.refresh();
    });
  });
  observer.observe(parent);
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy(true);
  });
}
