import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, JOURNAL_NODES, JOURNAL_BRANCHES } from '../utils/constants.js';

const TABS = ['blade', 'aegis', 'arcanum'];

export default class JournalScene extends Phaser.Scene {
  constructor() {
    super('JournalScene');
  }

  create() {
    this.journal = this.registry.get('journal');
    this.activeTab = 'blade';
    this.nodeSprites = [];

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'journal_bg').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.add.text(GAME_WIDTH / 2, 60, 'EXPEDITION JOURNAL', { fontSize: '22px', color: '#f5e6c8', fontStyle: 'bold' }).setOrigin(0.5);
    this.insightText = this.add.text(GAME_WIDTH / 2, 92, '', { fontSize: '15px', color: '#e0a934' }).setOrigin(0.5);

    this.buildTabs();
    this.detailText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 90, '', {
      fontSize: '13px', color: '#f5e6c8', align: 'center', wordWrap: { width: GAME_WIDTH - 60 }
    }).setOrigin(0.5);

    this.backBtn = this.add.text(20, GAME_HEIGHT - 30, '< Menu', { fontSize: '16px', color: '#f5e6c8', fontStyle: 'bold' })
      .setInteractive({ useHandCursor: true });
    this.backBtn.on('pointerdown', () => this.scene.start('MenuScene'));

    this.renderBranch(this.activeTab);
    this.refreshInsight();

    // Hybrid nodes shown on every tab in a shared row since they cross branches.
  }

  buildTabs() {
    const colors = { blade: 0xc0392b, aegis: 0x2e6da4, arcanum: 0x8e44ad };
    this.tabButtons = {};
    const startX = 70;
    TABS.forEach((tab, i) => {
      const x = startX + i * 110;
      const y = 130;
      const bg = this.add.rectangle(x, y, 100, 34, colors[tab], this.activeTab === tab ? 0.9 : 0.4).setStrokeStyle(2, 0xf5e6c8).setInteractive({ useHandCursor: true });
      const label = this.add.text(x, y, JOURNAL_BRANCHES[tab].name, { fontSize: '14px', color: '#f5e6c8', fontStyle: 'bold' }).setOrigin(0.5);
      bg.on('pointerdown', () => this.switchTab(tab));
      this.tabButtons[tab] = bg;
    });
  }

  switchTab(tab) {
    this.activeTab = tab;
    Object.entries(this.tabButtons).forEach(([key, bg]) => bg.setFillStyle(bg.fillColor, key === tab ? 0.9 : 0.4));
    this.renderBranch(tab);
  }

  renderBranch(branch) {
    this.nodeSprites.forEach(s => s.destroy());
    this.nodeSprites = [];

    const nodes = JOURNAL_NODES.filter(n => n.branch === branch);
    const hybrid = JOURNAL_NODES.filter(n => n.branch === 'hybrid');

    nodes.forEach((node, i) => this.renderNode(node, 90 + (i % 2) * 210, 200 + Math.floor(i / 2) * 90));

    this.add.rectangle(GAME_WIDTH / 2, 470, GAME_WIDTH - 40, 1, 0xf5e6c8, 0.3);
    const hybridLabel = this.add.text(GAME_WIDTH / 2, 490, 'Hybrid Nodes', { fontSize: '13px', color: '#d9a441', fontStyle: 'bold' }).setOrigin(0.5);
    this.nodeSprites.push(hybridLabel);
    hybrid.forEach((node, i) => this.renderNode(node, 90 + (i % 2) * 210, 530 + Math.floor(i / 2) * 90));
  }

  renderNode(node, x, y) {
    const unlocked = this.journal.isUnlocked(node.id);
    const available = this.journal.isAvailable(node.id);
    const color = unlocked ? 0xe0a934 : (available ? 0x8fd19e : 0x555555);

    const circle = this.add.circle(x, y, 26, color, unlocked ? 0.95 : (available ? 0.6 : 0.3)).setStrokeStyle(2, 0xf5e6c8).setInteractive({ useHandCursor: true });
    const label = this.add.text(x, y, node.cost, { fontSize: '13px', color: '#1a1a1a', fontStyle: 'bold' }).setOrigin(0.5);
    const name = this.add.text(x, y + 34, node.name, { fontSize: '10px', color: '#f5e6c8', align: 'center', wordWrap: { width: 100 } }).setOrigin(0.5, 0);

    if (available) {
      this.tweens.add({ targets: circle, alpha: { from: 0.5, to: 0.9 }, duration: 700, yoyo: true, repeat: -1 });
    }

    circle.on('pointerover', () => this.showDetail(node, unlocked, available));
    circle.on('pointerdown', () => {
      this.showDetail(node, unlocked, available);
      if (available && this.journal.canAfford(node.id)) {
        this.journal.unlock(node.id);
        this.refreshInsight();
        this.renderBranch(this.activeTab);
      }
    });

    this.nodeSprites.push(circle, label, name);
  }

  showDetail(node, unlocked, available) {
    let status = unlocked ? 'UNLOCKED' : (available ? `Available - costs ${node.cost} Insight` : 'Locked (missing prerequisites)');
    this.detailText.setText(`${node.name}\n${node.desc}\n${status}`);
  }

  refreshInsight() {
    this.insightText.setText(`Insight: ${this.journal.insight}`);
  }
}
