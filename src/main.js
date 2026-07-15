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
  // Mobile Safari's address bar/toolbar are visible right at page load,
  // which temporarily shrinks window.innerHeight well below the device's
  // true height - judged against that snapshot alone, a device whose real
  // shape is a great match for this game (e.g. an iPhone 13/14, whose
  // 390x844 viewport is identical to the game's own resolution) looks like
  // a bad one and incorrectly falls back to letterboxing. window.screen
  // .height reflects the device's actual full height regardless of that
  // transient browser-chrome state, so use whichever of the two is larger
  // for this decision. Phaser's ScaleManager already listens for window
  // resize and recalculates the real crop/scale amount live as the
  // toolbar shows or hides, so locking in the right mode against the
  // device's true shape - and letting that resize handling take it from
  // there - gives genuine edge-to-edge fill once the chrome settles,
  // instead of getting stuck on the address-bar-visible snapshot.
  const H = Math.max(window.innerHeight, window.screen.height || 0);
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
    activePointers: 2,
    // Phaser calls event.preventDefault() on every touch event over the
    // canvas by default (TouchManager's `capture` option, on by default) -
    // that's a JS-level veto that suppresses the browser's own gesture
    // handling regardless of the touch-action CSS, and it's what was
    // blocking pinch-zoom specifically over the game area (letting it
    // through only in the letterbox margins, which aren't part of the
    // canvas). Turning it off lets native pinch-zoom work anywhere,
    // including directly over gameplay - Phaser still receives and
    // processes every touch for game input either way; this only affects
    // whether the browser's own default handling also runs alongside it.
    touch: {
      capture: false
    }
  },
  fps: {
    target: 60
  },
  scene: [BootScene, MenuScene, GameScene, LeaderboardScene, GameOverScene, AdOverlayScene]
};

const game = new Phaser.Game(config);

// Exposed for debugging/QA in the browser console (harmless for a client-side game).
window.dungeonSweeperGame = game;
