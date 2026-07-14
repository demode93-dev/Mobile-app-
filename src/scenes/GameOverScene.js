import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH, STORAGE_KEYS } from '../utils/constants.js';
import { verifyAdReward, submitTournamentScore, saveJournal } from '../utils/api.js';
import { playSFX } from '../systems/SoundManager.js';

// +50% of the run's earned Insight, minimum 5 - keeps the reward meaningful
// even on a very short/early-death run.
function bonusInsightFor(earned) {
  return Math.max(5, Math.round(earned * 0.5));
}

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(data) {
    this.runData = data;
    this.secondWindUsed = false;
    this.scoreSubmitted = false;

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'parchment_bg').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(DEPTH.BACKGROUND);

    if (data.isTournamentRun && data.tournamentScore) {
      this.buildTournamentResult(data);
    } else {
      this.buildStandardResult(data);
    }
  }

  buildStandardResult(data) {
    this.add.text(GAME_WIDTH / 2, 130, 'YOU HAVE FALLEN', { fontSize: '28px', color: '#7b2d3e', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.insightEarned = data.insightEarned;
    this.resultsText = this.add.text(GAME_WIDTH / 2, 220, this.resultsLines(data), {
      fontSize: '18px', color: '#3a2013', align: 'center', lineSpacing: 10
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.secondWindBtn = this.makeButton(GAME_WIDTH / 2, 400, 'Second Wind (Watch Ad)', () => this.watchAdAndRevive());
    this.bonusInsightBtn = this.makeButton(GAME_WIDTH / 2, 475, 'Double Insight (Watch Ad)', () => this.watchAdForBonusInsight(data));
    this.makeButton(GAME_WIDTH / 2, 555, 'Expedition Journal', () => this.scene.start('JournalScene'));
    this.makeButton(GAME_WIDTH / 2, 630, 'Main Menu', () => this.scene.start('MenuScene'));
  }

  resultsLines(data) {
    return [
      `Depth Reached: ${data.depth}`,
      `Enemies Slain: ${data.enemiesKilled}`,
      `Insight Earned: ${this.insightEarned}`
    ].join('\n');
  }

  // Tournament runs get a score breakdown instead of the Second Wind ad-revive
  // path - a free unlimited-retry loop via ads would undermine the "one free
  // entry per day" fairness the whole Daily Dungeon system is built on.
  buildTournamentResult(data) {
    const s = data.tournamentScore;

    this.add.text(GAME_WIDTH / 2, 90, 'DAILY DUNGEON', { fontSize: '22px', color: '#7b2d3e', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.HUD);
    this.add.text(GAME_WIDTH / 2, 118, 'Run Complete', { fontSize: '16px', color: '#5b3a1e' }).setOrigin(0.5).setDepth(DEPTH.HUD);

    const rows = [
      ['Depth Reached', s.finalDepth, s.depthScore],
      ['Enemies Killed', s.totalEnemiesKilled, s.killScore],
      ['Full Clears', s.fullClears, s.clearBonus],
      ['Cards Left', s.unusedUpgrades, s.upgradeScore]
    ];

    const startY = 175;
    const rowSpacing = 30;
    rows.forEach(([label, count, points], i) => {
      const y = startY + i * rowSpacing;
      this.add.text(40, y, label, { fontSize: '14px', color: '#3a2013' }).setDepth(DEPTH.HUD);
      this.add.text(GAME_WIDTH - 40, y, `${count}  ->  ${points}`, { fontSize: '14px', color: '#3a2013', fontStyle: 'bold' }).setOrigin(1, 0).setDepth(DEPTH.HUD);
    });

    const dividerY = startY + rows.length * rowSpacing + 6;
    this.add.rectangle(GAME_WIDTH / 2, dividerY, GAME_WIDTH - 80, 2, 0x3a2013).setDepth(DEPTH.HUD);

    this.add.text(40, dividerY + 14, 'Final Score', { fontSize: '16px', color: '#7b2d3e', fontStyle: 'bold' }).setDepth(DEPTH.HUD);
    this.add.text(GAME_WIDTH - 40, dividerY + 14, `${s.finalScore}`, { fontSize: '18px', color: '#7b2d3e', fontStyle: 'bold' }).setOrigin(1, 0).setDepth(DEPTH.HUD);

    this.submitStatusText = this.add.text(GAME_WIDTH / 2, dividerY + 60, '', { fontSize: '12px', color: '#5b3a1e' }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.submitBtn = this.makeButton(GAME_WIDTH / 2, dividerY + 110, 'Submit Score', () => this.submitScore(data), { textColor: '#4cff4c', pill: true });
    this.makeButton(GAME_WIDTH / 2, dividerY + 190, 'View Leaderboard', () => this.scene.start('LeaderboardScene'), { textColor: '#ffcc44', pill: true });
    this.makeButton(GAME_WIDTH / 2, dividerY + 270, 'Main Menu', () => this.scene.start('MenuScene'), { textColor: '#ffffff', pill: true });
  }

  async submitScore(data) {
    if (this.scoreSubmitted) return;
    this.scoreSubmitted = true;
    this.submitStatusText.setText('Submitting...');

    const playerName = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME) || 'You';
    const result = await submitTournamentScore({
      playerName,
      seed: data.dailyDungeonSeed,
      depthReached: data.tournamentScore.finalDepth,
      score: data.tournamentScore.finalScore,
      moveHistory: data.moveHistory
    });

    // submitTournamentScore()'s offline fallback (see api.js) reports
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

  watchAdAndRevive() {
    if (this.secondWindUsed) return;
    this.secondWindUsed = true;
    this.secondWindBtn.disableInteractive();

    this.scene.pause();
    this.scene.launch('AdOverlayScene', {
      placementId: 'second_wind',
      onComplete: (result) => this.onSecondWindAdComplete(result)
    });
  }

  async onSecondWindAdComplete(result) {
    this.scene.resume();
    if (!result.success) {
      this.secondWindUsed = false;
      this.secondWindBtn.setInteractive({ useHandCursor: true });
      return;
    }

    // Showing the ad is a client-side event - this is the server-side
    // confirmation step that actually grants the reward.
    const verify = await verifyAdReward('second_wind');
    if (verify.ok) {
      // Resume the expedition from the depth reached, with a freshly stocked hero.
      this.scene.start('GameScene', { reviveDepth: this.runData.depth });
    } else {
      this.secondWindUsed = false;
      this.secondWindBtn.setInteractive({ useHandCursor: true });
    }
  }

  watchAdForBonusInsight(data) {
    if (this.bonusInsightUsed) return;
    this.bonusInsightUsed = true;
    this.bonusInsightBtn.disableInteractive();

    this.scene.pause();
    this.scene.launch('AdOverlayScene', {
      placementId: 'bonus_insight',
      onComplete: (result) => this.onBonusInsightAdComplete(result, data)
    });
  }

  async onBonusInsightAdComplete(result, data) {
    this.scene.resume();
    if (!result.success) {
      this.bonusInsightUsed = false;
      this.bonusInsightBtn.setInteractive({ useHandCursor: true });
      return;
    }

    const verify = await verifyAdReward('bonus_insight');
    if (!verify.ok) {
      this.bonusInsightUsed = false;
      this.bonusInsightBtn.setInteractive({ useHandCursor: true });
      return;
    }

    // Bonus is granted on top of the insight GameScene already credited on
    // death - not re-earned, just topped up.
    const bonus = bonusInsightFor(data.insightEarned);
    this.insightEarned += bonus;
    const insight = (this.registry.get('insight') || 0) + bonus;
    this.registry.set('insight', insight);
    const unlocked = Object.keys(this.registry.get('journalNodes') || {});
    saveJournal({ insight, unlocked });

    this.resultsText.setText(this.resultsLines(data));
    this.bonusInsightBtn.setTint(0x4cff4c);
  }

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
