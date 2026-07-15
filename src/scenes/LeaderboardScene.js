import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SAFE_BOTTOM, STORAGE_KEYS, DEPTH } from '../utils/constants.js';
import { getDailyDungeon, getLeaderboard, rankEntries } from '../utils/api.js';
import { playSFX } from '../systems/SoundManager.js';

const MAX_VISIBLE_ROWS = 20;
const ROW_HEIGHT = 36;
const LIST_TOP = 168;

const MEDAL_COLOR = { 1: 0xffd700, 2: 0xc7c7c7, 3: 0xcd7f32 };
const MEDAL_TEXT_COLOR = { 1: '#4a3400', 2: '#333333', 3: '#3a1f00' };

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

export default class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super('LeaderboardScene');
  }

  create() {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'parchment_bg').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(DEPTH.BACKGROUND);

    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    this.add.text(GAME_WIDTH / 2, 44, `Daily Dungeon — ${dateStr}`, {
      fontFamily: 'Georgia, serif', fontSize: '17px', color: '#3a2013', fontStyle: 'bold', align: 'center', wordWrap: { width: GAME_WIDTH - 40 }
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.timeText = this.add.text(GAME_WIDTH / 2, 78, '', { fontSize: '13px', color: '#5b3a1e' }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.dynamicNodes = [];
    this.listContainer = this.add.container(0, 0).setDepth(DEPTH.HUD);
    this.statusText = this.add.text(GAME_WIDTH / 2, 220, 'Loading leaderboard...', { fontSize: '14px', color: '#5b3a1e' }).setOrigin(0.5).setDepth(DEPTH.HUD);

    const safeBottom = GAME_HEIGHT - SAFE_BOTTOM;
    this.backBtn = this.makeButton(GAME_WIDTH / 2, safeBottom - 40, 'BACK', () => this.scene.start('MenuScene'), { textColor: '#ffffff', pill: true });

    this.startCountdown();
    this.ensurePlayerName();
    this.loadData();
  }

  // ---------------------------------------------------------------------
  // Player identity
  // ---------------------------------------------------------------------
  ensurePlayerName() {
    let name = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
    if (!name) {
      const entered = window.prompt('Enter your name, adventurer:', '');
      name = (entered || '').trim().slice(0, 20) || 'Adventurer';
      localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, name);
    }
    this.playerName = name;
  }

  // ---------------------------------------------------------------------
  // Countdown to the UTC-midnight reset
  // ---------------------------------------------------------------------
  startCountdown() {
    const update = () => {
      const now = new Date();
      const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const diffMs = midnight - now;
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      this.timeText.setText(`Time Remaining: ${pad2(h)}:${pad2(m)} until reset`);
    };
    update();
    this.time.addEvent({ delay: 30000, loop: true, callback: update });
  }

  // ---------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------
  async loadData() {
    const result = await getLeaderboard();
    this.statusText.destroy();

    const ranked = rankEntries(result.entries || []);
    this.renderBoard(ranked);
  }

  clearDynamic() {
    this.dynamicNodes.forEach(n => n.destroy());
    this.dynamicNodes = [];
    this.listContainer.removeAll(true);
  }

  renderBoard(ranked) {
    this.clearDynamic();

    if (ranked.length === 0) {
      this.renderEmptyState();
      return;
    }

    const playerHasEntry = ranked.some(e => e.name === this.playerName);
    let y = LIST_TOP;

    if (!playerHasEntry) {
      y = this.renderNotEnteredNote(y);
    }

    const visible = ranked.slice(0, MAX_VISIBLE_ROWS);
    visible.forEach((entry, i) => {
      this.renderRow(entry, y + i * ROW_HEIGHT, entry.name === this.playerName);
    });

    let listBottom = y + visible.length * ROW_HEIGHT;

    // If the player placed outside the visible slice, pin their real row
    // below the list so "on the board" always means visible, per spec.
    if (playerHasEntry) {
      const playerEntry = ranked.find(e => e.name === this.playerName);
      const isVisible = visible.some(e => e.name === this.playerName);
      if (!isVisible) {
        listBottom += 10;
        const divider = this.add.rectangle(GAME_WIDTH / 2, listBottom, GAME_WIDTH - 40, 1, 0x3a2013, 0.6).setDepth(DEPTH.HUD);
        this.dynamicNodes.push(divider);
        listBottom += 16;
        this.renderRow(playerEntry, listBottom, true);
        listBottom += ROW_HEIGHT;
      }
    }
  }

  renderNotEnteredNote(y) {
    const note = this.add.text(GAME_WIDTH / 2, y, "You haven't entered today's dungeon yet.", {
      fontSize: '13px', color: '#7b2d3e', fontStyle: 'bold', align: 'center', wordWrap: { width: GAME_WIDTH - 60 }
    }).setOrigin(0.5).setDepth(DEPTH.HUD);
    this.dynamicNodes.push(note);

    let nextY = y + 30;
    if (this.hasFreeEntryToday()) {
      const cta = this.makeButton(GAME_WIDTH / 2, nextY + 20, 'Enter Daily Dungeon', () => this.enterDailyDungeon(), { textColor: '#4cff4c', pill: true, small: true });
      this.dynamicNodes.push(...cta);
      nextY += 56;
    } else {
      nextY += 12;
    }
    return nextY + 6;
  }

  renderEmptyState() {
    const msg = this.add.text(GAME_WIDTH / 2, 280, 'No adventurers have entered\ntoday\'s dungeon.\nBe the first!', {
      fontSize: '16px', color: '#3a2013', fontStyle: 'bold', align: 'center', lineSpacing: 8, wordWrap: { width: GAME_WIDTH - 60 }
    }).setOrigin(0.5).setDepth(DEPTH.HUD);
    this.dynamicNodes.push(msg);

    const cta = this.makeButton(GAME_WIDTH / 2, 400, 'Enter Daily Dungeon', () => this.enterDailyDungeon(), { textColor: '#4cff4c', pill: true });
    this.dynamicNodes.push(...cta);

    if (!this.hasFreeEntryToday()) {
      const usedNote = this.add.text(GAME_WIDTH / 2, 450, "Today's free entry is already used.", {
        fontSize: '12px', color: '#8a5a0a', align: 'center', wordWrap: { width: GAME_WIDTH - 60 }
      }).setOrigin(0.5).setDepth(DEPTH.HUD);
      this.dynamicNodes.push(usedNote);
    }
  }

  renderRow(entry, y, isPlayer) {
    const cx = GAME_WIDTH / 2;
    const rowWidth = GAME_WIDTH - 36;

    const zebraColor = entry.rank % 2 === 0 ? 0xffffff : 0x000000;
    const zebraAlpha = entry.rank % 2 === 0 ? 0.07 : 0.05;
    const bg = this.add.rectangle(cx, y, rowWidth, 30, isPlayer ? 0xffd700 : zebraColor, isPlayer ? 0.35 : zebraAlpha).setDepth(DEPTH.HUD);
    if (isPlayer) bg.setStrokeStyle(1, 0xe0a934, 0.9);
    this.listContainer.add(bg);

    // Rank badge: top-3 get a colored medal circle (explicit fallback for
    // medal emoji, which have a history of not rendering reliably in this
    // project's Phaser text pipeline), everyone else gets a plain "#N".
    if (entry.rank <= 3) {
      const badge = this.add.circle(30, y, 13, MEDAL_COLOR[entry.rank]).setDepth(DEPTH.HUD);
      badge.setStrokeStyle(1, 0x3a2013, 0.6);
      const badgeText = this.add.text(30, y, `${entry.rank}`, { fontSize: '12px', color: MEDAL_TEXT_COLOR[entry.rank], fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.HUD);
      this.listContainer.add([badge, badgeText]);
    } else {
      const rankText = this.add.text(30, y, `#${entry.rank}`, { fontSize: '12px', color: '#3a2013', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.HUD);
      this.listContainer.add(rankText);
    }

    const displayName = isPlayer ? `${entry.name} (You)` : entry.name;
    const name = this.add.text(54, y, displayName, {
      fontSize: '13px', color: isPlayer ? '#7b2d3e' : '#3a2013', fontStyle: isPlayer ? 'bold' : 'normal', wordWrap: { width: 150 }
    }).setOrigin(0, 0.5).setDepth(DEPTH.HUD);
    this.listContainer.add(name);

    const depth = this.add.text(220, y, `Depth ${entry.depth}`, { fontSize: '11px', color: '#5b3a1e' }).setOrigin(0, 0.5).setDepth(DEPTH.HUD);
    this.listContainer.add(depth);

    // Dark pill + bright text (GameOverScene's contrast pattern) so the score
    // - the single most important number on this screen - stays legible
    // against the busy parchment/wood texture underneath.
    const scoreX = GAME_WIDTH - 30;
    const scorePill = this.add.rectangle(scoreX - 26, y, 68, 22, 0x1a0f05, 0.65).setDepth(DEPTH.HUD);
    const score = this.add.text(scoreX, y, `${entry.score}`, { fontSize: '13px', color: '#ffe066', fontStyle: 'bold' }).setOrigin(1, 0.5).setDepth(DEPTH.HUD);
    this.listContainer.add([scorePill, score]);

    if (entry.reward) {
      const rewardLabel = `${entry.reward.insight} INS / ${entry.reward.gems} GEM`;
      const reward = this.add.text(scoreX, y + 14, rewardLabel, { fontSize: '9px', color: '#8a5a0a', fontStyle: 'bold' }).setOrigin(1, 0.5).setDepth(DEPTH.HUD);
      this.listContainer.add(reward);
    }
  }

  // ---------------------------------------------------------------------
  // Daily dungeon entry (mirrors MenuScene.startDailyDungeon())
  // ---------------------------------------------------------------------
  hasFreeEntryToday() {
    return localStorage.getItem(STORAGE_KEYS.LAST_DAILY_ENTRY) !== todayKey();
  }

  async enterDailyDungeon() {
    if (!this.hasFreeEntryToday()) return;
    const dungeon = await getDailyDungeon();
    localStorage.setItem(STORAGE_KEYS.LAST_DAILY_ENTRY, todayKey());
    this.scene.start('GameScene', { isTournamentRun: true, dailyDungeonSeed: dungeon.seed });
  }

  // ---------------------------------------------------------------------
  // Buttons - same dark-pill-behind-bright-text pattern as GameOverScene.
  // ---------------------------------------------------------------------
  makeButton(x, y, label, onClick, { textColor = '#f5e6c8', pill = false, small = false } = {}) {
    const size = small ? { w: 200, h: 52 } : { w: 260, h: 70 };
    const btn = this.add.image(x, y, 'button_wood').setDisplaySize(size.w, size.h).setInteractive({ useHandCursor: true }).setDepth(DEPTH.HUD);
    const targets = [btn];

    if (pill) {
      const pillBg = this.add.rectangle(x, y, size.w - 40, small ? 26 : 34, 0x1a0f05, 0.65).setDepth(DEPTH.HUD);
      targets.push(pillBg);
    }

    const text = this.add.text(x, y, label, { fontFamily: 'Georgia, serif', fontSize: small ? '13px' : '16px', color: textColor, fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.HUD);
    targets.push(text);

    btn.on('pointerover', () => this.tweens.add({ targets, scale: 1.05, duration: 120 }));
    btn.on('pointerout', () => this.tweens.add({ targets, scale: 1, duration: 120 }));
    btn.on('pointerdown', () => {
      playSFX(this, 'sfx_button');
      this.tweens.add({ targets, scale: 0.95, duration: 80, yoyo: true, onComplete: onClick });
    });
    return targets;
  }
}
