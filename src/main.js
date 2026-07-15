import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './utils/constants.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import GameScene from './scenes/GameScene.js';
import LeaderboardScene from './scenes/LeaderboardScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import AdOverlayScene from './scenes/AdOverlayScene.js';

// This game's fixed internal resolution (390x844) is a tall portrait shape.
// A real phone screen's shape is naturally very close to that already, so
// covering the entire screen (ENVELOP - like CSS background-size: cover)
// crops only an imperceptible sliver there. A landscape laptop/desktop
// window is a completely different shape, so covering it the same way
// would zoom in far enough to crop away most of the game (title, HUD, most
// of the grid) - a much worse problem than letterboxing.
//
// Rather than guessing from orientation alone, compute the actual crop
// ENVELOP would introduce and only use it if that crop stays inside the
// UI's real safe margins - the topmost HUD text (HP, at y=60, ~8px tall)
// and bottommost element (the Leave Dungeon button, bottom edge at
// GAME_HEIGHT - SAFE_BOTTOM - 2, ~22px from the bottom edge) in GameScene,
// and the ~20px left/right HUD margins used across every scene. On modern
// phones (aspect ratio close to this game's own) that crop is a couple of
// pixels and ENVELOP wins outright. On an unusually-shaped phone (e.g. an
// older 4:3-ish screen) or any landscape desktop window, the crop would
// slice into real UI, so this falls back to the always-safe FIT
// letterboxing instead - where the browser's own zoom (Ctrl/Cmd "+",
// pinch/trackpad) is how you make it bigger instead.
function pickScaleMode() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const envelopScale = Math.max(W / GAME_WIDTH, H / GAME_HEIGHT);
  const cropX = Math.max(0, (GAME_WIDTH * envelopScale - W) / envelopScale / 2);
  const cropY = Math.max(0, (GAME_HEIGHT * envelopScale - H) / envelopScale / 2);
  const MAX_SAFE_CROP_X = 15;
  const MAX_SAFE_CROP_Y = 20;
  return (cropX <= MAX_SAFE_CROP_X && cropY <= MAX_SAFE_CROP_Y) ? Phaser.Scale.ENVELOP : Phaser.Scale.FIT;
}

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#1a1109',
  scale: {
    mode: pickScaleMode(),
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
