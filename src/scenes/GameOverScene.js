import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH, STORAGE_KEYS } from '../utils/constants.js';
import { verifyAdReward, submitGoldRun } from '../utils/api.js';
import { playSFX } from '../systems/SoundManager.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(data) {
    this.runData = data;
    this.scoreSubmitted = false;
    this.adUsed = false;

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'parchment_bg').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(DEPTH.BACKGROUND);

    if (data.result === 'win') {
      this.buildWinResult(data);
    } else {
      this.buildLossResult(data);
    }
  }

  // -------------------------------------------------------------------
  // Win (Leave Dungeon)
  // -------------------------------------------------------------------
  buildWinResult(data) {
    this.goldBanked = data.goldBanked;

    this.add.text(GAME_WIDTH / 2, 140, 'DUNGEON ESCAPED', { fontSize: '26px', color: '#2f6f3e', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.resultsText = this.add.text(GAME_WIDTH / 2, 230, this.winLines(), {
      fontSize: '18px', color: '#3a2013', align: 'center', lineSpacing: 10
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.doubleGoldBtn = this.makeButton(GAME_WIDTH / 2, 400, 'Double Gold (Watch Ad)', () => this.watchAdForDoubleGold(), { textColor: '#4cff4c', pill: true });
    this.submitStatusText = this.add.text(GAME_WIDTH / 2, 455, '', { fontSize: '12px', color: '#5b3a1e' }).setOrigin(0.5).setDepth(DEPTH.HUD);
    this.submitBtn = this.makeButton(GAME_WIDTH / 2, 500, 'Submit Score', () => this.submitScore(), { textColor: '#ffcc44', pill: true });
    this.makeButton(GAME_WIDTH / 2, 575, 'View Leaderboard', () => this.scene.start('LeaderboardScene'));
    this.makeButton(GAME_WIDTH / 2, 650, 'Main Menu', () => this.scene.start('MenuScene'));
  }

  winLines() {
    return [
      `Gold Banked: ${this.goldBanked}`,
      `Meta-Currency Collected: ◆ ${this.runData.meta}`
    ].join('\n');
  }

  async submitScore() {
    if (this.scoreSubmitted) return;
    this.scoreSubmitted = true;
    this.submitStatusText.setText('Submitting...');

    const playerName = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME) || 'You';
    const result = await submitGoldRun({ playerName, gold: this.goldBanked });

    // submitGoldRun()'s offline fallback (see api.js) reports
    // { ok: false, offline: true, message } - "no backend configured" is not
    // the same as "rejected", so offline has to be checked before ok.
    if (result.offline) {
      this.submitStatusText.setText(result.message || 'Score saved locally (offline).');
    } else if (result.ok) {
      this.submitStatusText.setText('Score submitted!');
    } else {
      this.submitStatusText.setText(result.error || 'Submission failed.');
      this.scoreSubmitted = false;
    }
  }

  watchAdForDoubleGold() {
    if (this.adUsed) return;
    this.adUsed = true;
    this.doubleGoldBtn.disableInteractive();

    this.scene.pause();
    this.scene.launch('AdOverlayScene', {
      placementId: 'double_gold',
      onComplete: (result) => this.onDoubleGoldAdComplete(result)
    });
  }

  async onDoubleGoldAdComplete(result) {
    this.scene.resume();
    if (!result.success) {
      this.adUsed = false;
      this.doubleGoldBtn.setInteractive({ useHandCursor: true });
      return;
    }

    // Showing the ad is a client-side event - this is the server-side
    // confirmation step that actually grants the reward.
    const verify = await verifyAdReward('double_gold');
    if (!verify.ok) {
      this.adUsed = false;
      this.doubleGoldBtn.setInteractive({ useHandCursor: true });
      return;
    }

    this.goldBanked *= 2;
    this.resultsText.setText(this.winLines());
    this.doubleGoldBtn.setTint(0x4cff4c);
  }

  // -------------------------------------------------------------------
  // Loss (HP reached 0)
  // -------------------------------------------------------------------
  buildLossResult(data) {
    this.goldLost = data.goldLost;
    this.goldSalvaged = 0;

    this.add.text(GAME_WIDTH / 2, 140, 'YOU HAVE FALLEN', { fontSize: '26px', color: '#7b2d3e', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.resultsText = this.add.text(GAME_WIDTH / 2, 230, this.lossLines(), {
      fontSize: '18px', color: '#3a2013', align: 'center', lineSpacing: 10
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.salvageBtn = this.makeButton(GAME_WIDTH / 2, 400, 'Salvage Half Your Gold (Watch Ad)', () => this.watchAdForSalvage(), { textColor: '#4cff4c', pill: true });
    this.makeButton(GAME_WIDTH / 2, 500, 'Main Menu', () => this.scene.start('MenuScene'));
  }

  lossLines() {
    const goldLine = this.goldSalvaged > 0 ? `Gold Salvaged: ${this.goldSalvaged}` : `Gold Lost: ${this.goldLost}`;
    return [
      goldLine,
      `Meta-Currency Kept: ◆ ${this.runData.meta}`
    ].join('\n');
  }

  watchAdForSalvage() {
    if (this.adUsed) return;
    this.adUsed = true;
    this.salvageBtn.disableInteractive();

    this.scene.pause();
    this.scene.launch('AdOverlayScene', {
      placementId: 'salvage_gold',
      onComplete: (result) => this.onSalvageAdComplete(result)
    });
  }

  async onSalvageAdComplete(result) {
    this.scene.resume();
    if (!result.success) {
      this.adUsed = false;
      this.salvageBtn.setInteractive({ useHandCursor: true });
      return;
    }

    const verify = await verifyAdReward('salvage_gold');
    if (!verify.ok) {
      this.adUsed = false;
      this.salvageBtn.setInteractive({ useHandCursor: true });
      return;
    }

    this.goldSalvaged = Math.floor(this.goldLost / 2);
    this.resultsText.setText(this.lossLines());
    this.salvageBtn.setTint(0x4cff4c);
  }

  // -------------------------------------------------------------------
  makeButton(x, y, label, onClick, { textColor = '#f5e6c8', pill = false } = {}) {
    const btn = this.add.image(x, y, 'button_wood').setDisplaySize(260, 70).setInteractive({ useHandCursor: true }).setDepth(DEPTH.HUD);
    const targets = [btn];

    if (pill) {
      // Dark semi-transparent pill behind the label so bright text colors
      // (chosen for contrast against the wood grain) don't fight the
      // texture's own light/dark grain variation underneath.
      const pillBg = this.add.rectangle(x, y, 220, 34, 0x1a0f05, 0.65).setDepth(DEPTH.HUD);
      targets.push(pillBg);
    }

    const text = this.add.text(x, y, label, { fontFamily: 'Georgia, serif', fontSize: '16px', color: textColor, fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.HUD);
    targets.push(text);

    btn.on('pointerover', () => this.tweens.add({ targets, scale: 1.05, duration: 120 }));
    btn.on('pointerout', () => this.tweens.add({ targets, scale: 1, duration: 120 }));
    btn.on('pointerdown', () => {
      playSFX(this, 'sfx_button');
      this.tweens.add({ targets, scale: 0.95, duration: 80, yoyo: true, onComplete: onClick });
    });
    return btn;
  }
}
