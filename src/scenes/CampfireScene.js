import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, RARITY } from '../utils/constants.js';

const RARITY_TEXTURE = { [RARITY.COMMON]: 'card_common', [RARITY.RARE]: 'card_rare', [RARITY.LEGENDARY]: 'card_legendary' };
const RARITY_COLOR = { [RARITY.COMMON]: '#b0b0a8', [RARITY.RARE]: '#4a90d9', [RARITY.LEGENDARY]: '#e0a934' };

export default class CampfireScene extends Phaser.Scene {
  constructor() {
    super('CampfireScene');
  }

  create(data) {
    this.options = data.options;
    this.gameScene = data.gameScene;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55);
    this.add.image(GAME_WIDTH / 2, 270, 'campfire_card').setDisplaySize(300, 320);
    this.add.text(GAME_WIDTH / 2, 150, 'Rest at the Campfire', { fontSize: '22px', color: '#f5e6c8', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 230, 'Choose one upgrade', { fontSize: '16px', color: '#f5e6c8' }).setOrigin(0.5);

    const cardWidth = 110;
    const spacing = 120;
    const startX = GAME_WIDTH / 2 - spacing;
    const y = 560;

    this.options.forEach((card, i) => {
      this.buildCard(startX + i * spacing, y, card, cardWidth);
    });
  }

  buildCard(x, y, card, width) {
    const texture = RARITY_TEXTURE[card.rarity];
    const img = this.add.image(x, y, texture).setDisplaySize(width, 150).setInteractive({ useHandCursor: true });
    // card_rare reuses the campfire_card art (no dedicated rare frame yet) - a
    // blue-grey tint keeps it visually distinct from the untinted legendary/common frames.
    if (card.rarity === RARITY.RARE) img.setTint(0xccccff);
    const name = this.add.text(x, y - 55, card.name, { fontSize: '12px', color: '#1a1a1a', fontStyle: 'bold', align: 'center', wordWrap: { width: width - 10 } }).setOrigin(0.5);
    const desc = this.add.text(x, y - 5, card.desc, { fontSize: '10px', color: '#1a1a1a', align: 'center', wordWrap: { width: width - 14 } }).setOrigin(0.5);
    const rarity = this.add.text(x, y + 62, card.rarity.toUpperCase(), { fontSize: '10px', color: RARITY_COLOR[card.rarity], fontStyle: 'bold' }).setOrigin(0.5);

    const group = [img, name, desc, rarity];
    img.on('pointerover', () => this.tweens.add({ targets: group, scale: 1.06, duration: 120 }));
    img.on('pointerout', () => this.tweens.add({ targets: group, scale: 1, duration: 120 }));
    img.on('pointerdown', () => this.selectCard(card));
  }

  selectCard(card) {
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
