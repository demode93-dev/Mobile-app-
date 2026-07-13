import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, SAFE_BOTTOM, DEPTH, RARITY } from '../utils/constants.js';

const RARITY_TEXTURE = { [RARITY.COMMON]: 'card_common', [RARITY.RARE]: 'card_rare', [RARITY.LEGENDARY]: 'card_legendary' };
const RARITY_COLOR = { [RARITY.COMMON]: '#8a7050', [RARITY.RARE]: '#2f4468', [RARITY.LEGENDARY]: '#8a5a0a' };
// All three card frames are light parchment tones, so every rarity reads fine
// with dark ink text.
const NAME_COLOR = { [RARITY.COMMON]: '#1a1a1a', [RARITY.RARE]: '#1a1a1a', [RARITY.LEGENDARY]: '#1a1a1a' };
const DESC_COLOR = { [RARITY.COMMON]: '#1a1a1a', [RARITY.RARE]: '#1a1a1a', [RARITY.LEGENDARY]: '#1a1a1a' };

export default class CampfireScene extends Phaser.Scene {
  constructor() {
    super('CampfireScene');
  }

  create(data) {
    this.options = data.options;
    this.gameScene = data.gameScene;
    this.cardObjects = [];

    // Dark overlay fully separates the campfire modal from the board/tiles
    // rendering underneath in the paused GameScene.
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78).setDepth(DEPTH.MODAL_OVERLAY);
    this.add.image(GAME_WIDTH / 2, 270, 'campfire_card').setDisplaySize(300, 320).setDepth(DEPTH.MODAL_BG);
    this.add.text(GAME_WIDTH / 2, 150, 'Rest at the Campfire', { fontSize: '22px', color: '#f5e6c8', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.MODAL_TEXT);
    this.add.text(GAME_WIDTH / 2, 230, 'Choose one upgrade', { fontSize: '16px', color: '#f5e6c8' }).setOrigin(0.5).setDepth(DEPTH.MODAL_TEXT);

    // Own dedicated flavor-text strip, instead of relying on the (mostly
    // hidden, underneath the overlay) GameScene log text.
    const safeBottom = GAME_HEIGHT - SAFE_BOTTOM;
    this.flavorBg = this.add.rectangle(GAME_WIDTH / 2, safeBottom - 20, GAME_WIDTH, 40, 0x1a0f05, 0.85).setDepth(DEPTH.MODAL_TEXT);
    this.flavorText = this.add.text(GAME_WIDTH / 2, safeBottom - 20, '', {
      fontSize: '13px', color: '#f5e6d3', fontStyle: 'italic', align: 'center', wordWrap: { width: GAME_WIDTH - 40 }
    }).setOrigin(0.5).setDepth(DEPTH.MODAL_TEXT);

    const um = this.gameScene.upgradeManager;
    if (um.modifiers.campfireRedraw && !um.campfireRedrawUsed) {
      this.redrawBtn = this.add.text(GAME_WIDTH / 2, 455, '🔄 Redraw (once per run)', {
        fontSize: '13px', color: '#f5e6c8', fontStyle: 'bold', backgroundColor: '#3a2013', padding: { x: 8, y: 4 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(DEPTH.MODAL_TEXT);
      this.redrawBtn.on('pointerdown', () => this.redrawCards());
    }

    this.renderCards();
  }

  setFlavor(msg) {
    this.flavorText.setText(msg);
  }

  renderCards() {
    this.cardObjects.forEach(obj => obj.destroy());
    this.cardObjects = [];

    const count = this.options.length;
    const margin = 40;
    const usableWidth = GAME_WIDTH - margin;
    const spacing = usableWidth / count;
    const cardWidth = Math.min(110, spacing - 10);
    const startX = GAME_WIDTH / 2 - (spacing * (count - 1)) / 2;
    const y = 560;

    this.options.forEach((card, i) => {
      this.buildCard(startX + i * spacing, y, card, cardWidth);
    });
  }

  redrawCards() {
    const um = this.gameScene.upgradeManager;
    if (um.campfireRedrawUsed) return;
    um.campfireRedrawUsed = true;
    this.options = um.drawOptions(this.options.length);
    this.renderCards();
    this.redrawBtn.destroy();
    this.redrawBtn = null;
    this.setFlavor('You sift through the embers for new fortunes.');
  }

  buildCard(x, y, card, width) {
    const texture = RARITY_TEXTURE[card.rarity];
    const img = this.add.image(x, y, texture).setDisplaySize(width, 150).setInteractive({ useHandCursor: true }).setDepth(DEPTH.MODAL_CARD);
    const name = this.add.text(x, y - 55, card.name, { fontSize: '12px', color: NAME_COLOR[card.rarity], fontStyle: 'bold', align: 'center', wordWrap: { width: width - 10 } }).setOrigin(0.5).setDepth(DEPTH.MODAL_TEXT);
    const desc = this.add.text(x, y - 5, card.desc, { fontSize: '10px', color: DESC_COLOR[card.rarity], align: 'center', wordWrap: { width: width - 14 } }).setOrigin(0.5).setDepth(DEPTH.MODAL_TEXT);
    const rarity = this.add.text(x, y + 62, card.rarity.toUpperCase(), { fontSize: '10px', color: RARITY_COLOR[card.rarity], fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.MODAL_TEXT);

    const group = [img, name, desc, rarity];
    this.cardObjects.push(...group);
    img.on('pointerover', () => this.tweens.add({ targets: group, scale: 1.06, duration: 120 }));
    img.on('pointerout', () => this.tweens.add({ targets: group, scale: 1, duration: 120 }));
    img.on('pointerdown', () => this.selectCard(card));
  }

  selectCard(card) {
    if (this.gameScene.isTournamentRun) {
      this.gameScene.moveHistory.push({ type: 'upgrade', cardId: card.id, depth: this.gameScene.depth });
    }
    this.upgradeManagerApply(card);
    this.scene.stop();
    this.gameScene.scene.resume();
    this.gameScene.advanceDepth();
  }

  upgradeManagerApply(card) {
    const um = this.gameScene.upgradeManager;
    um.applyCard(card, { onInstantHeal: (amount) => this.gameScene.hero.heal(amount) });
    this.gameScene.setLog(`You take up the ${card.name}.`);
  }
}
