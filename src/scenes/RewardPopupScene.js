import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../utils/constants.js';
import { claimYesterdayReward } from '../utils/rewards.js';

// Launched on top of MenuScene (which it pauses, matching CampfireScene's
// modal-over-a-paused-scene pattern) when the player has an unclaimed reward
// from yesterday's Daily Dungeon.
export default class RewardPopupScene extends Phaser.Scene {
  constructor() {
    super('RewardPopupScene');
  }

  create(data) {
    this.rewardData = data;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78)
      .setDepth(DEPTH.MODAL_OVERLAY).setInteractive();

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const panelW = 300;
    const panelH = 320;

    const panel = this.add.graphics().setDepth(DEPTH.MODAL_BG);
    panel.fillStyle(0xe8d9b5, 1);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 16);
    panel.lineStyle(4, 0x3a2013, 1);
    panel.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 16);

    this.add.text(cx, cy - panelH / 2 + 36, "Yesterday's Results", {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: '#3a2013', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_TEXT);

    const isTopTier = !data.participantOnly;
    const message = isTopTier
      ? `You placed #${data.rank} of ${data.total} in the Daily Dungeon!\nHere's your reward:`
      : "Thanks for playing!";
    this.add.text(cx, cy - 60, message, {
      fontSize: '14px', color: '#3a2013', align: 'center', lineSpacing: 8, wordWrap: { width: panelW - 40 }
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_TEXT);

    const rewardLine = isTopTier
      ? `+${data.tier.insight} Insight   +${data.tier.gems} Gems`
      : `+${data.tier.insight} Insight for participating.`;
    this.add.text(cx, cy + 6, rewardLine, {
      fontSize: '16px', color: '#8a5a0a', fontStyle: 'bold', align: 'center', wordWrap: { width: panelW - 40 }
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_TEXT);

    this.claimBtn = this.add.image(cx, cy + panelH / 2 - 50, 'button_wood')
      .setDisplaySize(200, 60).setInteractive({ useHandCursor: true }).setDepth(DEPTH.MODAL_TEXT);
    this.claimText = this.add.text(cx, cy + panelH / 2 - 50, 'Claim', {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#4cff4c', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_TEXT);

    this.claimBtn.on('pointerover', () => this.tweens.add({ targets: [this.claimBtn, this.claimText], scale: 1.05, duration: 120 }));
    this.claimBtn.on('pointerout', () => this.tweens.add({ targets: [this.claimBtn, this.claimText], scale: 1, duration: 120 }));
    this.claimBtn.on('pointerdown', () => this.claim());
  }

  claim() {
    if (this.claimed) return;
    this.claimed = true;
    claimYesterdayReward(this.scene.get('MenuScene'), this.rewardData.tier);
    this.scene.stop();
    this.scene.resume('MenuScene', { rewardClaimed: true });
  }
}
