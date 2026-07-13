import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './utils/constants.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import CampfireScene from './scenes/CampfireScene.js';
import JournalScene from './scenes/JournalScene.js';
import LeaderboardScene from './scenes/LeaderboardScene.js';
import GameOverScene from './scenes/GameOverScene.js';

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
  scene: [BootScene, MenuScene, GameScene, CampfireScene, JournalScene, LeaderboardScene, GameOverScene]
};

const game = new Phaser.Game(config);

// Exposed for debugging/QA in the browser console (harmless for a client-side game).
window.dungeonSweeperGame = game;
