import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../utils/constants.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'parchment_bg').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(DEPTH.BACKGROUND);

    this.add.text(GAME_WIDTH / 2, 150, 'DUNGEON', {
      fontFamily: 'Georgia, serif', fontSize: '46px', color: '#3a2013', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.HUD);
    this.add.text(GAME_WIDTH / 2, 200, 'SWEEPER', {
      fontFamily: 'Georgia, serif', fontSize: '46px', color: '#3a2013', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    const insight = this.registry.get('insight') || 0;
    this.add.text(GAME_WIDTH / 2, 260, `Insight: ${insight}`, {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#5b3a1e'
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.makeButton(GAME_WIDTH / 2, 420, 'Dungeon Dive', () => this.scene.start('GameScene'));
    this.makeButton(GAME_WIDTH / 2, 500, 'Expedition Journal', () => this.scene.start('JournalScene'));
    this.makeButton(GAME_WIDTH / 2, 580, 'Leaderboard', () => this.scene.start('LeaderboardScene'));
  }

  makeButton(x, y, label, onClick) {
    const btn = this.add.image(x, y, 'button_wood').setDisplaySize(260, 70).setInteractive({ useHandCursor: true }).setDepth(DEPTH.HUD);
    const text = this.add.text(x, y, label, { fontFamily: 'Georgia, serif', fontSize: '20px', color: '#f5e6c8', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.HUD);

    btn.on('pointerover', () => this.tweens.add({ targets: [btn, text], scale: 1.05, duration: 120 }));
    btn.on('pointerout', () => this.tweens.add({ targets: [btn, text], scale: 1, duration: 120 }));
    btn.on('pointerdown', () => {
      this.tweens.add({ targets: [btn, text], scale: 0.95, duration: 80, yoyo: true, onComplete: onClick });
    });
    return btn;
  }
}
