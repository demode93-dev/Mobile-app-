import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants.js';
import { loadMetaCurrencyLocal } from '../utils/api.js';
import SoundManager, { BGM_KEY, SFX_KEYS } from '../systems/SoundManager.js';
import AdManager, { MockAdProvider } from '../systems/AdManager.js';
import AdSenseProvider from '../systems/AdSenseProvider.js';

// 'skeleton' is reused as the generic enemy tile icon, 'hero' as a static
// HUD portrait - no need for new art there.
const SPRITE_KEYS = ['hero', 'skeleton', 'icon_gold', 'icon_weapon', 'icon_meta'];
const UI_KEYS = ['parchment_bg', 'button_wood', 'tile_facedown', 'tile_empty'];

const FALLBACK_COLORS = {
  hero: 0xe8c07d, skeleton: 0xe5e5e0,
  icon_gold: 0xd9a441, icon_weapon: 0x8899aa, icon_meta: 0x2fbfae,
  parchment_bg: 0xe8d9b5, button_wood: 0x8b5a2b,
  tile_facedown: 0x2a2a2a, tile_empty: 0x4a4a4a
};

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    const barBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 240, 20, 0x3a2013).setStrokeStyle(2, 0xe8d9b5);
    const bar = this.add.rectangle(GAME_WIDTH / 2 - 118, GAME_HEIGHT / 2, 4, 14, 0xe8d9b5).setOrigin(0, 0.5);
    const label = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, 'Loading the dungeon...', { fontSize: '16px', color: '#e8d9b5' }).setOrigin(0.5);

    this.load.on('progress', (value) => {
      bar.width = 236 * value;
    });

    // If a real asset file is missing/corrupt, keep going - we'll synthesize
    // a flat-color placeholder texture for that key in create().
    this.missingKeys = new Set();
    this.load.on('loaderror', (file) => {
      this.missingKeys.add(file.key);
    });

    for (const key of SPRITE_KEYS) this.load.image(key, `assets/sprites/${key}.png`);
    for (const key of UI_KEYS) this.load.image(key, `assets/ui/${key}.png`);

    // Audio is optional - a missing file just triggers the same 'loaderror'
    // above and is left out of the audio cache. SoundManager checks the
    // cache before every play, so the game runs identically with or without
    // these files present.
    this.load.audio(BGM_KEY, `assets/audio/${BGM_KEY}.mp3`);
    for (const key of SFX_KEYS) this.load.audio(key, `assets/audio/${key}.mp3`);

    this.load.once('complete', () => {
      barBg.destroy();
      bar.destroy();
      label.destroy();
    });
  }

  create() {
    // Synthesize placeholders for anything that failed to load so gameplay never breaks.
    for (const key of [...SPRITE_KEYS, ...UI_KEYS]) {
      if (!this.textures.exists(key) || this.missingKeys.has(key)) {
        this.generatePlaceholder(key);
      }
    }
    if (this.registry.get('metaCurrency') === undefined) {
      this.registry.set('metaCurrency', loadMetaCurrencyLocal());
    }
    if (this.registry.get('soundManager') === undefined) {
      this.registry.set('soundManager', new SoundManager(this));
    }
    if (this.registry.get('adManager') === undefined) {
      // Real Google AdSense for Games provider if a publisher client ID is
      // configured (see .env.example), otherwise the mock - keeps the ad
      // flow fully testable without real credentials.
      const adSense = new AdSenseProvider();
      const provider = adSense.configured ? adSense : new MockAdProvider();
      this.registry.set('adManager', new AdManager(provider));
    }
    this.scene.start('MenuScene');
  }

  generatePlaceholder(key) {
    const color = FALLBACK_COLORS[key] ?? 0x888888;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    const isTile = key.startsWith('tile_');
    const isSprite = SPRITE_KEYS.includes(key) && !isTile;
    const size = isTile ? 64 : (isSprite ? 96 : 200);
    g.fillStyle(color, 1);
    g.lineStyle(4, 0x1a1a1a, 1);
    if (isSprite) {
      g.fillCircle(size / 2, size / 2, size / 2 - 4);
      g.strokeCircle(size / 2, size / 2, size / 2 - 4);
    } else {
      g.fillRoundedRect(2, 2, size - 4, size - 4, 8);
      g.strokeRoundedRect(2, 2, size - 4, size - 4, 8);
    }
    g.generateTexture(key, size, size);
    g.destroy();
  }
}
