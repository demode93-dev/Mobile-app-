/* Phaser 3 bootstrap — static, CDN-only, Netlify/Pages friendly. */
const config = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#05060a",
  pixelArt: false,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  physics: {
    default: "arcade",
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [BootScene, GameScene, UIScene],
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
