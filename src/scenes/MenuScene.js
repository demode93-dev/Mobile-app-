import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH, STORAGE_KEYS } from '../utils/constants.js';
import { getDailyDungeon } from '../utils/api.js';
import { computeYesterdayReward } from '../utils/rewards.js';
import { playSFX } from '../systems/SoundManager.js';

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

    this.insightText = this.add.text(GAME_WIDTH / 2 - 8, 232, '', {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#5b3a1e'
    }).setOrigin(1, 0.5).setDepth(DEPTH.HUD);
    // Diamond glyph (plain Unicode symbol, not a color emoji) - this project has
    // seen color emoji fail to render in Phaser Text before, this hasn't.
    this.gemsText = this.add.text(GAME_WIDTH / 2 + 8, 232, '', {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#2f6fb0', fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(DEPTH.HUD);
    this.refreshCurrencyDisplay();

    this.makeButton(GAME_WIDTH / 2, 380, 'Dungeon Dive', () => this.scene.start('GameScene'));
    this.buildDailyDungeonButton(GAME_WIDTH / 2, 470);
    this.makeButton(GAME_WIDTH / 2, 580, 'Expedition Journal', () => this.scene.start('JournalScene'));
    this.makeButton(GAME_WIDTH / 2, 650, 'Leaderboard', () => this.scene.start('LeaderboardScene'));

    this.buildSoundToggle();
    // Browsers block audio until a user gesture - unlock and start the loop
    // on the very first tap anywhere on the menu, not tied to any one button.
    this.input.once('pointerdown', () => this.registry.get('soundManager')?.playBGM());

    this.events.on('resume', () => this.refreshCurrencyDisplay());
    this.checkYesterdayReward();
  }

  buildSoundToggle() {
    const sm = this.registry.get('soundManager');
    const label = () => (sm && sm.muted) ? '♪ OFF' : '♪ ON';
    const x = GAME_WIDTH - 44;
    const y = 46;

    // The top strip of parchment_bg is a dark burnt-edge vignette - a dark
    // pill behind the text (GameOverScene's contrast pattern) keeps this
    // readable there instead of relying on the texture being light.
    this.soundTogglePill = this.add.rectangle(x, y, 64, 28, 0x1a0f05, 0.65).setDepth(DEPTH.HUD);
    this.soundToggleText = this.add.text(x, y, label(), {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#f5e6c8', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    const hitTargets = [this.soundTogglePill, this.soundToggleText];
    hitTargets.forEach(t => t.setInteractive({ useHandCursor: true }));
    hitTargets.forEach(t => t.on('pointerdown', () => {
      if (!sm) return;
      sm.toggleMuted();
      this.soundToggleText.setText(label());
    }));
  }

  refreshCurrencyDisplay() {
    const insight = this.registry.get('insight') || 0;
    const gems = this.registry.get('gems') || 0;
    this.insightText.setText(`Insight: ${insight}`);
    this.gemsText.setText(`◆ ${gems}`);
  }

  checkYesterdayReward() {
    const result = computeYesterdayReward();
    if (!result) return;
    this.scene.pause();
    this.scene.launch('RewardPopupScene', result);
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
      playSFX(this, 'sfx_button');
      this.tweens.add({ targets: [btn, text], scale: 0.95, duration: 80, yoyo: true, onComplete: onClick });
    });
    return btn;
  }
}
