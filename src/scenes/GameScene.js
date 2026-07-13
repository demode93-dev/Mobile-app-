import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT, GRID_SIZE, GRID_OFFSET_X, GRID_OFFSET_Y, TILE_SIZE, SAFE_BOTTOM, DEPTH,
  HERO_START_ROW, HERO_START_COL, ENEMY_STATS, ENEMY_HP_SCALE_PER_DEPTHS, ENEMY_DMG_SCALE_PER_DEPTHS,
  getSpawnTableForDepth, computeJournalModifiers, computeInsightEarned
} from '../utils/constants.js';
import { saveJournal } from '../utils/api.js';
import BoardManager from '../systems/BoardManager.js';
import CombatManager from '../systems/CombatManager.js';
import TurnManager from '../systems/TurnManager.js';
import UpgradeManager from '../systems/UpgradeManager.js';
import Hero from '../entities/Hero.js';
import Skeleton from '../entities/Skeleton.js';
import Mimic from '../entities/Mimic.js';
import Cultist from '../entities/Cultist.js';
import Bat from '../entities/Bat.js';
import Mushroom from '../entities/Mushroom.js';
import Wraith from '../entities/Wraith.js';

const ENEMY_CLASSES = { skeleton: Skeleton, mimic: Mimic, cultist: Cultist, bat: Bat, mushroom: Mushroom, wraith: Wraith };

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data = {}) {
    this.depth = data.reviveDepth || 1;
    this.enemiesKilled = 0;
    this.enemies = [];
  }

  create() {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'parchment_bg').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);

    const unlockedNodes = Object.keys(this.registry.get('journalNodes') || {});
    const baseModifiers = computeJournalModifiers(unlockedNodes);
    this.upgradeManager = new UpgradeManager(baseModifiers);
    this.hero = new Hero(this, this.upgradeManager.modifiers);
    this.phoenixDownAvailable = !!this.upgradeManager.modifiers.phoenixDown;

    this.buildHud();
    this.startDepth(this.depth);

    this.events.on('log', (msg) => this.setLog(msg));
    this.events.on('heroDied', () => this.onHeroDied());
    this.events.on('depthCleared', () => this.onDepthCleared());
    this.events.on('heroDamaged', () => this.refreshHud());
    this.events.on('enemyKilled', () => this.onEnemyKilled());
    this.events.on('tileSelected', (pos) => this.highlightTile(pos));
    this.events.on('tileDeselected', () => this.clearHighlight());

    this.events.once('shutdown', () => this.cleanup());
  }

  // -------------------------------------------------------------------
  // HUD
  // -------------------------------------------------------------------
  buildHud() {
    this.hpBarBg = this.add.rectangle(GAME_WIDTH / 2, 70, 300, 24, 0x1a1a1a).setStrokeStyle(2, 0x3a2013).setDepth(DEPTH.HUD);
    this.hpBarFill = this.add.rectangle(GAME_WIDTH / 2 - 148, 70, 296, 20, 0xc0392b).setOrigin(0, 0.5).setDepth(DEPTH.HUD);
    this.hpText = this.add.text(GAME_WIDTH / 2, 70, '', { fontSize: '14px', color: '#f5e6c8', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.blockText = this.add.text(20, 100, '', { fontSize: '14px', color: '#2e6da4', fontStyle: 'bold' }).setDepth(DEPTH.HUD);
    this.depthText = this.add.text(GAME_WIDTH - 20, 100, '', { fontSize: '14px', color: '#3a2013', fontStyle: 'bold' }).setOrigin(1, 0).setDepth(DEPTH.HUD);
    this.upgradeIconsText = this.add.text(20, 122, '', { fontSize: '11px', color: '#5b3a1e', wordWrap: { width: GAME_WIDTH - 40 } }).setDepth(DEPTH.HUD);

    // Bottom flavor/log text: dark backing strip + light parchment text so it
    // stays legible regardless of what's showing through the parchment behind it.
    const safeBottom = GAME_HEIGHT - SAFE_BOTTOM;
    this.logBg = this.add.rectangle(GAME_WIDTH / 2, safeBottom - 20, GAME_WIDTH, 40, 0x1a0f05, 0.8).setDepth(DEPTH.HUD);
    this.logText = this.add.text(GAME_WIDTH / 2, safeBottom - 20, '', {
      fontSize: '13px', color: '#f5e6d3', fontStyle: 'italic', align: 'center', wordWrap: { width: GAME_WIDTH - 40 }
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.fireballBtn = this.add.text(GAME_WIDTH - 20, 122, '🔥 Fireball', { fontSize: '13px', color: '#c0392b', fontStyle: 'bold', backgroundColor: '#f5e6c8', padding: { x: 6, y: 3 } })
      .setOrigin(1, 0).setInteractive({ useHandCursor: true }).setVisible(false).setDepth(DEPTH.HUD);
    this.fireballBtn.on('pointerdown', () => {
      if (this.combatManager.castFireball()) {
        this.turnManager.checkDepthCleared();
        this.refreshHud();
      }
    });

    this.refreshHud();
  }

  refreshHud() {
    const pct = Math.max(0, this.hero.hp / this.hero.maxHp);
    this.hpBarFill.width = 296 * pct;
    this.hpText.setText(`${this.hero.hp} / ${this.hero.maxHp} HP`);
    this.blockText.setText(this.hero.block > 0 ? `🛡 Block: ${this.hero.block}` : '');
    this.depthText.setText(`Depth ${this.depth}`);
    const names = this.upgradeManager.runCards.map(c => c.name).join(', ');
    this.upgradeIconsText.setText(names ? `Upgrades: ${names}` : '');
    const canFireball = this.upgradeManager.modifiers.fireball && !this.combatManager.fireballUsedThisDepth;
    this.fireballBtn.setVisible(!!canFireball);
  }

  setLog(msg) {
    this.logText.setText(msg);
    this.refreshHud();
  }

  highlightTile(pos) {
    this.clearHighlight();
    const x = GRID_OFFSET_X + pos.col * TILE_SIZE + TILE_SIZE / 2;
    const y = GRID_OFFSET_Y + pos.row * TILE_SIZE + TILE_SIZE / 2;
    this.selectionBox = this.add.rectangle(x, y, TILE_SIZE - 4, TILE_SIZE - 4).setStrokeStyle(4, 0xffcc00).setDepth(DEPTH.TILE_HIGHLIGHT);
  }

  clearHighlight() {
    if (this.selectionBox) {
      this.selectionBox.destroy();
      this.selectionBox = null;
    }
  }

  // -------------------------------------------------------------------
  // Depth lifecycle
  // -------------------------------------------------------------------
  startDepth(depth) {
    this.depthTransitioning = false;
    this.clearHighlight();
    if (this.board) this.board.destroy();
    this.enemies.forEach(e => e.destroy());
    this.enemies = [];
    (this.scoutMarkers || []).forEach(m => m.destroy());
    this.scoutMarkers = [];

    this.board = new BoardManager(this);
    this.combatManager = new CombatManager(this, this.hero, () => this.enemies, this.upgradeManager.modifiers);
    this.turnManager = new TurnManager(this, {
      board: this.board,
      hero: this.hero,
      combatManager: this.combatManager,
      upgradeManager: this.upgradeManager,
      getEnemies: () => this.enemies
    });

    this.hero.moveTo(HERO_START_ROW, HERO_START_COL);
    this.hero.block = this.upgradeManager.modifiers.startingBlock || 0;
    this.hero.blockTurnsLeft = this.hero.block > 0 ? 1 : 0;

    this.spawnEnemiesForDepth(depth);
    this.applyScoutTraining();
    this.wireBoardInput();
    this.turnManager.resetDepthFlags();
    this.refreshHud();
    this.setLog(`Depth ${depth} - ${this.enemies.length} foes lurk ahead.`);
  }

  // Journal node 3D: reveal one randomly-chosen enemy type actually present
  // this depth with a small marker above each of them, and a log callout.
  // Distinct from the Torchlight camp card, which only ever reveals Mimics.
  applyScoutTraining() {
    if (!this.upgradeManager.modifiers.scoutTraining || this.enemies.length === 0) return;
    const types = [...new Set(this.enemies.map(e => e.type))];
    const scoutedType = Phaser.Utils.Array.GetRandom(types);
    const scoutedEnemies = this.enemies.filter(e => e.type === scoutedType);
    for (const enemy of scoutedEnemies) {
      const { x, y } = enemy.pixelPosition();
      const marker = this.add.text(x, y - 40, '\u{1F441}', { fontSize: '16px' }).setOrigin(0.5).setDepth(DEPTH.FLOATING_TEXT);
      this.scoutMarkers.push(marker);
    }
    this.time.delayedCall(50, () => {
      this.setLog(`Scout Training: ${ENEMY_STATS[scoutedType].name} detected ahead.`);
    });
  }

  spawnEnemiesForDepth(depth) {
    const table = getSpawnTableForDepth(depth);
    const hpBonus = Math.floor(depth / ENEMY_HP_SCALE_PER_DEPTHS);
    const dmgBonus = Math.floor(depth / ENEMY_DMG_SCALE_PER_DEPTHS);
    const count = Math.min(table.maxEnemies, 1 + Math.floor((depth - 1) / 2));

    const cells = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (r === HERO_START_ROW && c === HERO_START_COL) continue;
        cells.push([r, c]);
      }
    }
    Phaser.Utils.Array.Shuffle(cells);

    const torchlight = !!this.upgradeManager.modifiers.torchlight;

    for (let i = 0; i < count && i < cells.length; i++) {
      const type = Phaser.Utils.Array.GetRandom(table.types);
      const [row, col] = cells[i];
      const base = ENEMY_STATS[type];
      const overrides = { hp: base.hp + hpBonus };
      if (base.damage !== undefined) overrides.damage = base.damage + dmgBonus;
      if (type === 'mimic') {
        overrides.ambushDamage = base.ambushDamage + dmgBonus;
        overrides.revealedDamage = base.revealedDamage + dmgBonus;
      }
      if (type === 'mushroom') overrides.poisonDamage = base.poisonDamage;
      if (type === 'cultist') overrides.healAmount = base.healAmount;

      let enemy;
      if (type === 'mimic') {
        enemy = new Mimic(this, row, col, overrides, torchlight);
        if (!torchlight) this.board.markMimicCell(row, col);
      } else {
        enemy = new ENEMY_CLASSES[type](this, row, col, overrides);
      }
      this.enemies.push(enemy);
    }
  }

  wireBoardInput() {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const sprite = this.board.spriteAt(r, c);
        sprite.on('pointerdown', () => this.turnManager.handleTileTap(sprite.row, sprite.col));
      }
    }
  }

  onDepthCleared() {
    if (this.depthTransitioning) return;
    this.depthTransitioning = true;
    this.input.enabled = false;
    const cardCount = this.upgradeManager.modifiers.campfireCardCount || 3;
    const options = this.upgradeManager.drawOptions(cardCount);
    this.scene.launch('CampfireScene', { options, gameScene: this });
    this.scene.pause();
  }

  advanceDepth() {
    this.depthTransitioning = false;
    this.input.enabled = true;
    this.depth += 1;
    this.startDepth(this.depth);
  }

  onEnemyKilled() {
    this.enemiesKilled += 1;
  }

  onHeroDied() {
    if (this.phoenixDownAvailable) {
      this.phoenixDownAvailable = false;
      this.hero.hp = this.hero.maxHp;
      this.hero.isDead = false;
      this.hero.deathEmitted = false;
      this.setLog('Phoenix Down flares to life - you rise anew!');
      this.refreshHud();
      return;
    }
    this.input.enabled = false;
    const earned = computeInsightEarned({ depthReached: this.depth, enemiesKilled: this.enemiesKilled });
    const insight = (this.registry.get('insight') || 0) + earned;
    this.registry.set('insight', insight);
    const unlocked = Object.keys(this.registry.get('journalNodes') || {});
    saveJournal({ insight, unlocked });
    this.scene.start('GameOverScene', { depth: this.depth, enemiesKilled: this.enemiesKilled, insightEarned: earned });
  }

  cleanup() {
    this.events.removeAllListeners();
  }
}
