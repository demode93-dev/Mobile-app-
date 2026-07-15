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
    autoCenter: Phaser.Scale.CENTER_BOTH,
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
