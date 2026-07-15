import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SAFE_BOTTOM, DEPTH, GRID_SIZE } from '../utils/constants.js';
import { saveMetaCurrencyLocal } from '../utils/api.js';
import { playSFX } from '../systems/SoundManager.js';
import RevealGridManager from '../systems/RevealGridManager.js';
import Hero from '../entities/Hero.js';

// Sound-key remapping note: the 12 loaded SFX files were originally recorded
// for match-3 events (sword/shield/magic/potion/etc). Reused here by flavor
// fit rather than literal name - e.g. sfx_unlock's bright chime for a rare
// Meta-Currency find, sfx_depth_clear's victory chime for escaping with loot.
// sfx_shield/sfx_potion/sfx_campfire are unused by the new loop (harmless -
// SoundManager just never calls them).
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init() {
    this.hero = new Hero();
    this.gold = 0;
    this.weapons = 0;
    this.metaThisRun = 0;
    this.isRunOver = false;
  }

  create() {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'parchment_bg').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(DEPTH.BACKGROUND);

    this.grid = new RevealGridManager(this);
    this.buildHud();
    this.wireGridInput();

    this.events.once('shutdown', () => this.cleanup());
  }

  // -------------------------------------------------------------------
  // HUD
  // -------------------------------------------------------------------
  buildHud() {
    this.hpBarBg = this.add.rectangle(GAME_WIDTH / 2, 60, 300, 22, 0x1a1a1a).setStrokeStyle(2, 0x3a2013).setDepth(DEPTH.HUD);
    this.hpBarFill = this.add.rectangle(GAME_WIDTH / 2 - 148, 60, 296, 18, 0xc0392b).setOrigin(0, 0.5).setDepth(DEPTH.HUD);
    this.hpText = this.add.text(GAME_WIDTH / 2, 60, '', { fontSize: '13px', color: '#f5e6c8', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.goldText = this.add.text(20, 90, '', { fontSize: '13px', color: '#8a5a0a', fontStyle: 'bold' }).setDepth(DEPTH.HUD);
    this.weaponText = this.add.text(GAME_WIDTH / 2, 90, '', { fontSize: '13px', color: '#3a2013', fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(DEPTH.HUD);
    this.metaText = this.add.text(GAME_WIDTH - 20, 90, '', { fontSize: '13px', color: '#2f6fb0', fontStyle: 'bold' }).setOrigin(1, 0).setDepth(DEPTH.HUD);

    const safeBottom = GAME_HEIGHT - SAFE_BOTTOM;
    this.logBg = this.add.rectangle(GAME_WIDTH / 2, safeBottom - 90, GAME_WIDTH, 40, 0x1a0f05, 0.8).setDepth(DEPTH.HUD);
    this.logText = this.add.text(GAME_WIDTH / 2, safeBottom - 90, '', {
      fontSize: '13px', color: '#f5e6d3', fontStyle: 'italic', align: 'center', wordWrap: { width: GAME_WIDTH - 40 }
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.leaveBtn = this.makeButton(GAME_WIDTH / 2, safeBottom - 30, 'Leave Dungeon', () => this.onLeaveDungeon());

    this.refreshHud();
    this.setLog('The dungeon awaits. Tap a tile to explore.');
  }

  makeButton(x, y, label, onClick) {
    const btn = this.add.image(x, y, 'button_wood').setDisplaySize(220, 56).setInteractive({ useHandCursor: true }).setDepth(DEPTH.HUD);
    const text = this.add.text(x, y, label, { fontFamily: 'Georgia, serif', fontSize: '15px', color: '#f5e6c8', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.HUD);
    const targets = [btn, text];
    btn.on('pointerover', () => this.tweens.add({ targets, scale: 1.05, duration: 120 }));
    btn.on('pointerout', () => this.tweens.add({ targets, scale: 1, duration: 120 }));
    btn.on('pointerdown', () => {
      playSFX(this, 'sfx_button');
      this.tweens.add({ targets, scale: 0.95, duration: 80, yoyo: true, onComplete: onClick });
    });
    return btn;
  }

  refreshHud() {
    const pct = Math.max(0, this.hero.hp / this.hero.maxHp);
    this.hpBarFill.width = 296 * pct;
    this.hpText.setText(`${this.hero.hp} / ${this.hero.maxHp} HP`);
    this.goldText.setText(`Gold: ${this.gold}`);
    this.weaponText.setText(`Weapons: ${this.weapons}`);
    this.metaText.setText(`◆ ${this.metaThisRun}`);
  }

  setLog(msg) {
    this.logText.setText(msg);
  }

  // -------------------------------------------------------------------
  // Reveal grid input / resolution
  // -------------------------------------------------------------------
  wireGridInput() {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const sprite = this.grid.spriteAt(r, c);
        sprite.on('pointerdown', () => this.onTileTap(r, c));
      }
    }
  }

  onTileTap(row, col) {
    if (this.isRunOver) return;
    const result = this.grid.tapCell(row, col, this.weapons);

    switch (result.kind) {
      case 'gold':
        this.gold += result.gold;
        playSFX(this, 'sfx_magic');
        this.setLog(`You find ${result.gold} gold.`);
        break;
      case 'weapon':
        this.weapons += 1;
        playSFX(this, 'sfx_sword');
        this.setLog('You pick up a weapon.');
        break;
      case 'meta':
        this.metaThisRun += result.meta;
        playSFX(this, 'sfx_unlock');
        this.setLog('A rare glimmer catches your eye - Meta-Currency found!');
        break;
      case 'enemy_cleared':
        this.weapons -= 1;
        playSFX(this, 'sfx_enemy_die');
        this.setLog('You defeat the enemy with your weapon.');
        break;
      case 'enemy_damage':
        playSFX(this, 'sfx_enemy_hit');
        this.applyDamage(result.damage);
        this.setLog(`An enemy strikes you for ${result.damage} damage! Find a weapon to clear it.`);
        break;
      case 'empty':
        playSFX(this, 'sfx_match');
        this.setLog('Empty. Nothing here.');
        break;
      case 'noop':
        if (this.weapons === 0) this.setLog('You need a weapon to clear this enemy.');
        break;
    }

    this.refreshHud();
  }

  applyDamage(amount) {
    this.hero.applyDamage(amount);
    this.refreshHud();
    if (this.hero.isDead) this.onRunFailed();
  }

  // -------------------------------------------------------------------
  // Run end
  // -------------------------------------------------------------------
  onLeaveDungeon() {
    if (this.isRunOver) return;
    this.isRunOver = true;
    playSFX(this, 'sfx_depth_clear');
    this.creditMetaCurrency();
    this.scene.start('GameOverScene', { result: 'win', goldBanked: this.gold, meta: this.metaThisRun });
  }

  onRunFailed() {
    if (this.isRunOver) return;
    this.isRunOver = true;
    this.creditMetaCurrency();
    this.scene.start('GameOverScene', { result: 'loss', goldLost: this.gold, meta: this.metaThisRun });
  }

  // Credited here (not deferred to GameOverScene) so "always keep Meta-Currency"
  // holds even if the player never touches another button after this.
  creditMetaCurrency() {
    if (this.metaThisRun <= 0) return;
    const total = (this.registry.get('metaCurrency') || 0) + this.metaThisRun;
    this.registry.set('metaCurrency', total);
    saveMetaCurrencyLocal(total);
  }

  cleanup() {
    this.events.removeAllListeners();
    if (this.grid) this.grid.destroy();
  }
}
