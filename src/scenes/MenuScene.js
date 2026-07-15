import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, DEPTH } from '../utils/constants.js';
import { playSFX } from '../systems/SoundManager.js';

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

    // Diamond glyph (plain Unicode symbol, not a color emoji) - this project has
    // seen color emoji fail to render in Phaser Text before, this hasn't.
    this.metaText = this.add.text(GAME_WIDTH / 2, 232, '', {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#2f6fb0', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.HUD);
    this.refreshCurrencyDisplay();

    this.makeButton(GAME_WIDTH / 2, 420, 'Enter Dungeon', () => this.scene.start('GameScene'));
    this.makeButton(GAME_WIDTH / 2, 510, 'Leaderboard', () => this.scene.start('LeaderboardScene'));

    this.buildSoundToggle();
    // Browsers block audio until a user gesture - unlock and start the loop
    // on the very first tap anywhere on the menu, not tied to any one button.
    this.input.once('pointerdown', () => this.registry.get('soundManager')?.playBGM());

    this.events.on('resume', () => this.refreshCurrencyDisplay());
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
    const meta = this.registry.get('metaCurrency') || 0;
    this.metaText.setText(`◆ ${meta}`);
  }

  makeButton(x, y, label, onClick) {
    const btn = this.add.image(x, y, 'button_wood').setDisplaySize(260, 70).setInteractive({ useHandCursor: true }).setDepth(DEPTH.HUD);
    const text = this.add.text(x, y, label, { fontFamily: 'Georgia, serif', fontSize: '20px', color: '#f5e6c8', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.HUD);

    btn.on('pointerover', () => this.tweens.add({ targets: [btn, text], scale: 1.05, duration: 120 }));
    btn.on('pointerout', () => this.tweens.add({ targets: [btn, text], scale: 1, duration: 120 }));
    btn.on('pointerdown', () => {
      playSFX(this, 'sfx_button');
      this.tweens.add({ targets: [btn, text], scale: 0.95, duration: 80, yoyo: true, onComplete: onClick });
    });
    return btn;
  }
}
