import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH, STORAGE_KEYS } from '../utils/constants.js';
import { getDailyDungeon } from '../utils/api.js';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'parchment_bg').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(DEPTH.BACKGROUND);

    this.add.text(GAME_WIDTH / 2, 130, 'DUNGEON', {
      fontFamily: 'Georgia, serif', fontSize: '42px', color: '#3a2013', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.HUD);
    this.add.text(GAME_WIDTH / 2, 176, 'SWEEPER', {
      fontFamily: 'Georgia, serif', fontSize: '42px', color: '#3a2013', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    const insight = this.registry.get('insight') || 0;
    this.add.text(GAME_WIDTH / 2, 232, `Insight: ${insight}`, {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#5b3a1e'
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.makeButton(GAME_WIDTH / 2, 380, 'Dungeon Dive', () => this.scene.start('GameScene'));
    this.buildDailyDungeonButton(GAME_WIDTH / 2, 470);
    this.makeButton(GAME_WIDTH / 2, 580, 'Expedition Journal', () => this.scene.start('JournalScene'));
    this.makeButton(GAME_WIDTH / 2, 650, 'Leaderboard', () => this.scene.start('LeaderboardScene'));
  }

  hasFreeEntryToday() {
    return localStorage.getItem(STORAGE_KEYS.LAST_DAILY_ENTRY) !== todayKey();
  }

  buildDailyDungeonButton(x, y) {
    const available = this.hasFreeEntryToday();
    const btn = this.makeButton(x, y, 'Daily Dungeon', () => this.startDailyDungeon(), !available);

    this.dailyStatusText = this.add.text(x, y + 45, '', {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#8a5a0a'
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    if (available) {
      this.dailyStatusText.setText('1 free entry remaining');
    } else {
      this.startResetCountdown();
    }

    return btn;
  }

  startResetCountdown() {
    const update = () => {
      if (this.hasFreeEntryToday()) {
        this.dailyStatusText.setText('1 free entry remaining');
        if (this.resetCountdownEvent) this.resetCountdownEvent.remove();
        return;
      }
      const now = new Date();
      const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const diffMs = midnight - now;
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      this.dailyStatusText.setText(`Entry used - resets in ${h}h ${m}m`);
    };
    update();
    this.resetCountdownEvent = this.time.addEvent({ delay: 30000, loop: true, callback: update });
  }

  async startDailyDungeon() {
    if (!this.hasFreeEntryToday()) return;
    const dungeon = await getDailyDungeon();
    localStorage.setItem(STORAGE_KEYS.LAST_DAILY_ENTRY, todayKey());
    this.scene.start('GameScene', { isTournamentRun: true, dailyDungeonSeed: dungeon.seed });
  }

  makeButton(x, y, label, onClick, disabled = false) {
    const btn = this.add.image(x, y, 'button_wood').setDisplaySize(260, 70).setDepth(DEPTH.HUD);
    const text = this.add.text(x, y, label, { fontFamily: 'Georgia, serif', fontSize: '20px', color: '#f5e6c8', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.HUD);

    if (disabled) {
      btn.setTint(0x777777);
      text.setAlpha(0.6);
      return btn;
    }

    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => this.tweens.add({ targets: [btn, text], scale: 1.05, duration: 120 }));
    btn.on('pointerout', () => this.tweens.add({ targets: [btn, text], scale: 1, duration: 120 }));
    btn.on('pointerdown', () => {
      this.tweens.add({ targets: [btn, text], scale: 0.95, duration: 80, yoyo: true, onComplete: onClick });
    });
    return btn;
  }
}
