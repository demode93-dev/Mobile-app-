import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../utils/constants.js';
import { verifyAdReward } from '../utils/api.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(data) {
    this.runData = data;
    this.secondWindUsed = false;

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'parchment_bg').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(DEPTH.BACKGROUND);
    this.add.text(GAME_WIDTH / 2, 130, 'YOU HAVE FALLEN', { fontSize: '28px', color: '#7b2d3e', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.add.text(GAME_WIDTH / 2, 220, [
      `Depth Reached: ${data.depth}`,
      `Enemies Slain: ${data.enemiesKilled}`,
      `Insight Earned: ${data.insightEarned}`
    ].join('\n'), { fontSize: '18px', color: '#3a2013', align: 'center', lineSpacing: 10 }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.secondWindBtn = this.makeButton(GAME_WIDTH / 2, 420, 'Second Wind (Watch Ad)', () => this.watchAdAndRevive());
    this.makeButton(GAME_WIDTH / 2, 500, 'Expedition Journal', () => this.scene.start('JournalScene'));
    this.makeButton(GAME_WIDTH / 2, 580, 'Main Menu', () => this.scene.start('MenuScene'));
  }

  async watchAdAndRevive() {
    if (this.secondWindUsed) return;
    this.secondWindUsed = true;
    this.secondWindBtn.disableInteractive();
    this.add.text(GAME_WIDTH / 2, 460, 'Watching ad...', { fontSize: '14px', color: '#5b3a1e' }).setOrigin(0.5).setDepth(DEPTH.HUD);

    const result = await verifyAdReward('offline-simulated-ad');
    if (result.ok) {
      // Resume the expedition from the depth reached, with a freshly stocked hero.
      this.scene.start('GameScene', { reviveDepth: this.runData.depth });
    }
  }

  makeButton(x, y, label, onClick) {
    const btn = this.add.image(x, y, 'button_wood').setDisplaySize(260, 70).setInteractive({ useHandCursor: true }).setDepth(DEPTH.HUD);
    const text = this.add.text(x, y, label, { fontFamily: 'Georgia, serif', fontSize: '16px', color: '#f5e6c8', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.HUD);
    btn.on('pointerover', () => this.tweens.add({ targets: [btn, text], scale: 1.05, duration: 120 }));
    btn.on('pointerout', () => this.tweens.add({ targets: [btn, text], scale: 1, duration: 120 }));
    btn.on('pointerdown', () => {
      this.tweens.add({ targets: [btn, text], scale: 0.95, duration: 80, yoyo: true, onComplete: onClick });
    });
    return btn;
  }
}
