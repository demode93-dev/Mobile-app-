import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../utils/constants.js';
import JournalScene from './JournalScene.js';

const SPRITE_KEYS = ['hero', 'skeleton', 'mimic', 'cultist', 'bat', 'mushroom', 'wraith', 'tile_red', 'tile_blue', 'tile_purple', 'tile_green', 'tile_brown', 'grid'];
const UI_KEYS = ['parchment_bg', 'button_wood', 'campfire_card', 'card_common', 'card_rare', 'card_legendary', 'journal_bg'];

const FALLBACK_COLORS = {
  hero: 0xe8c07d, skeleton: 0xe5e5e0, mimic: 0x8b5a2b, cultist: 0x7b2d3e, bat: 0x4a4258, mushroom: 0xc0392b, wraith: 0x5b6ee1,
  tile_red: 0xc0392b, tile_blue: 0x2e6da4, tile_purple: 0x8e44ad, tile_green: 0x27ae60, tile_brown: 0x8b5a2b, grid: 0x3a3a3a,
  parchment_bg: 0xe8d9b5, button_wood: 0x8b5a2b, campfire_card: 0xd9a441, card_common: 0xb0b0a8, card_rare: 0x4a90d9, card_legendary: 0xe0a934, journal_bg: 0x6b3f26
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
    if (this.registry.get('insight') === undefined) {
      JournalScene.loadJournal(this);
    }
    this.scene.start('MenuScene');
  }

  generatePlaceholder(key) {
    const color = FALLBACK_COLORS[key] ?? 0x888888;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    if (key === 'grid') {
      const size = 320;
      g.fillStyle(color, 1);
      g.fillRect(0, 0, size, size);
      g.lineStyle(2, 0x555555, 1);
      for (let i = 0; i <= 5; i++) {
        g.lineBetween(i * 64, 0, i * 64, size);
        g.lineBetween(0, i * 64, size, i * 64);
      }
      g.generateTexture(key, size, size);
      g.destroy();
      return;
    }

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
