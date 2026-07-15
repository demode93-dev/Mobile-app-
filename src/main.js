import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './utils/constants.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import LeaderboardScene from './scenes/LeaderboardScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import AdOverlayScene from './scenes/AdOverlayScene.js';

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#1a1109',
  scale: {
    mode: Phaser.Scale.FIT,
    // NO_CENTER, not CENTER_BOTH: #game-container already centers the
    // canvas via CSS flexbox. Letting Phaser *also* apply its own
    // centering margin on top of that stacks two centering mechanisms and
    // produces an off-center canvas (visible as an asymmetric gap on one
    // side instead of even letterboxing on both).
    autoCenter: Phaser.Scale.NO_CENTER,
    width: GAME_WIDTH,
    height: GAME_HEIGHT
  },
  input: {
    activePointers: 2
  },
  fps: {
    target: 60
  },
  scene: [BootScene, MenuScene, GameScene, LeaderboardScene, GameOverScene, AdOverlayScene]
};

const game = new Phaser.Game(config);

// Exposed for debugging/QA in the browser console (harmless for a client-side game).
window.dungeonSweeperGame = game;
