import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../utils/constants.js';
import { playSFX } from '../systems/SoundManager.js';

// Shared mock "watching a rewarded ad" modal for all three ad placements
// (Second Wind revive, Bonus Insight, Campfire extra redraw). Launched on
// top of the calling scene (paused, matching CampfireScene/RewardPopupScene's
// modal pattern) with { placementId, onComplete(result) }; result is
// { success: true } or { success: false, reason: 'no_fill' }.
export default class AdOverlayScene extends Phaser.Scene {
  constructor() {
    super('AdOverlayScene');
  }

  create(data) {
    this.onComplete = data.onComplete;
    this.placementId = data.placementId;
    this.resolved = false;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.9)
      .setDepth(DEPTH.MODAL_OVERLAY).setInteractive();

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.statusText = this.add.text(cx, cy - 50, 'Loading ad...', {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#f5e6c8', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_TEXT);

    this.barBg = this.add.rectangle(cx, cy + 10, 240, 18, 0x3a2013).setStrokeStyle(2, 0xf5e6c8).setDepth(DEPTH.MODAL_TEXT);
    this.barFill = this.add.rectangle(cx - 118, cy + 10, 4, 14, 0x4cff4c).setOrigin(0, 0.5).setDepth(DEPTH.MODAL_TEXT);

    this.runAd();
  }

  async runAd() {
    const adManager = this.registry.get('adManager');
    const result = await adManager.showRewardedAd(this.placementId, (progress) => {
      this.statusText.setText('Watching ad...');
      this.barFill.width = 236 * progress;
    });

    if (result.success) {
      this.statusText.setText('Reward Earned!');
      this.statusText.setColor('#4cff4c');
      this.barFill.width = 236;
      playSFX(this, 'sfx_unlock');
      this.time.delayedCall(500, () => this.finish(result));
    } else {
      this.showFailure(result);
    }
  }

  showFailure(result) {
    this.statusText.setText('Ad unavailable. Try again later.');
    this.statusText.setColor('#c0392b');
    this.barBg.setVisible(false);
    this.barFill.setVisible(false);

    const okBtn = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, 'button_wood')
      .setDisplaySize(160, 56).setInteractive({ useHandCursor: true }).setDepth(DEPTH.MODAL_TEXT);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, 'OK', {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#f5e6c8', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_TEXT);
    okBtn.on('pointerdown', () => { playSFX(this, 'sfx_button'); this.finish(result); });
  }

  finish(result) {
    if (this.resolved) return;
    this.resolved = true;
    this.scene.stop();
    if (this.onComplete) this.onComplete(result);
  }
}
