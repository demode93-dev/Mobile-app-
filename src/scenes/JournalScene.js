import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, JOURNAL_TREE, DEPTH } from '../utils/constants.js';
import { saveJournal, loadJournalLocal } from '../utils/api.js';

const TAB_TEXT_COLOR = { blade: '#ff8888', aegis: '#8888ff', arcanum: '#cc88ff' };

export default class JournalScene extends Phaser.Scene {
  constructor() {
    super('JournalScene');
  }

  // Loads persisted journal state into the shared game registry. Called once
  // from BootScene before any scene needs it.
  static loadJournal(scene) {
    const { insight, unlocked } = loadJournalLocal();
    scene.registry.set('insight', insight || 0);
    const journalNodes = {};
    for (const id of unlocked || []) journalNodes[id] = true;
    scene.registry.set('journalNodes', journalNodes);
  }

  create() {
    // Background
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'journal_bg').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(DEPTH.BACKGROUND);

    // Title
    this.add.text(GAME_WIDTH / 2, 60, 'EXPEDITION JOURNAL', {
      fontFamily: 'serif',
      fontSize: '22px',
      color: '#f5e6c8',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    // Insight display
    this.insightText = this.add.text(GAME_WIDTH / 2, 95, '', {
      fontFamily: 'serif',
      fontSize: '16px',
      color: '#e0a934'
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    // Create all three branch containers ONCE - tab switches just toggle
    // visibility instead of destroying/rebuilding node sprites.
    this.bladeContainer = this.createBranchTab(JOURNAL_TREE.blade, '#cc3333');
    this.aegisContainer = this.createBranchTab(JOURNAL_TREE.aegis, '#3333cc');
    this.arcanumContainer = this.createBranchTab(JOURNAL_TREE.arcanum, '#9933cc');

    this.bladeContainer.setVisible(true);
    this.aegisContainer.setVisible(false);
    this.arcanumContainer.setVisible(false);

    this.createTabButtons();

    const backBtn = this.add.image(60, 790, 'button_wood')
      .setDisplaySize(100, 50)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTH.HUD);

    this.add.text(60, 790, 'BACK', {
      fontFamily: 'serif',
      fontSize: '14px',
      color: '#f5e6d3'
    }).setOrigin(0.5).setDepth(DEPTH.HUD);

    backBtn.on('pointerup', () => this.scene.start('MenuScene'));
    backBtn.on('pointerover', () => backBtn.setTint(0xcccccc));
    backBtn.on('pointerout', () => backBtn.clearTint());

    this.updateInsightDisplay();
  }

  // ─── TAB BUTTONS ─────────────────────────────────

  createTabButtons() {
    const tabY = 140;
    this.tabActiveBg = this.add.rectangle(80, tabY, 100, 30, 0x443322, 0.6).setDepth(DEPTH.HUD);

    const bladeBtn = this.add.image(80, tabY, 'button_wood')
      .setDisplaySize(110, 45)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTH.HUD);
    this.bladeTabText = this.add.text(80, tabY, 'BLADE', {
      fontFamily: 'serif', fontSize: '14px', color: TAB_TEXT_COLOR.blade, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.HUD);
    bladeBtn.on('pointerup', () => this.switchTab('blade'));
    bladeBtn.on('pointerover', () => bladeBtn.setTint(0xffcccc));
    bladeBtn.on('pointerout', () => bladeBtn.clearTint());

    const aegisBtn = this.add.image(GAME_WIDTH / 2, tabY, 'button_wood')
      .setDisplaySize(110, 45)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTH.HUD);
    this.aegisTabText = this.add.text(GAME_WIDTH / 2, tabY, 'AEGIS', {
      fontFamily: 'serif', fontSize: '14px', color: TAB_TEXT_COLOR.aegis, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.HUD);
    aegisBtn.on('pointerup', () => this.switchTab('aegis'));
    aegisBtn.on('pointerover', () => aegisBtn.setTint(0xccccff));
    aegisBtn.on('pointerout', () => aegisBtn.clearTint());

    const arcanumBtn = this.add.image(310, tabY, 'button_wood')
      .setDisplaySize(110, 45)
      .setInteractive({ useHandCursor: true })
      .setDepth(DEPTH.HUD);
    this.arcanumTabText = this.add.text(310, tabY, 'ARCANUM', {
      fontFamily: 'serif', fontSize: '14px', color: TAB_TEXT_COLOR.arcanum, fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(DEPTH.HUD);
    arcanumBtn.on('pointerup', () => this.switchTab('arcanum'));
    arcanumBtn.on('pointerover', () => arcanumBtn.setTint(0xecccff));
    arcanumBtn.on('pointerout', () => arcanumBtn.clearTint());

    this.tabButtonX = { blade: 80, aegis: GAME_WIDTH / 2, arcanum: 310 };
  }

  switchTab(tab) {
    this.bladeContainer.setVisible(false);
    this.aegisContainer.setVisible(false);
    this.arcanumContainer.setVisible(false);

    switch (tab) {
      case 'blade': this.bladeContainer.setVisible(true); break;
      case 'aegis': this.aegisContainer.setVisible(true); break;
      case 'arcanum': this.arcanumContainer.setVisible(true); break;
    }

    this.tabActiveBg.x = this.tabButtonX[tab];
    this.refreshAllNodeVisuals();
  }

  // ─── BRANCH CONTAINERS ───────────────────────────

  createBranchTab(nodes, lineColor) {
    const container = this.add.container(0, 0);
    this.renderNodeTree(container, nodes, 200, lineColor);
    return container;
  }

  // ─── NODE RENDERING ──────────────────────────────

  renderNodeTree(container, nodes, startY, lineColor) {
    const journalNodes = this.registry.get('journalNodes') || {};
    const centerX = GAME_WIDTH / 2;
    const nodeSpacingY = 95;
    const leftX = 100;
    const rightX = 290;

    const xFor = (column) => (column === 'left' ? leftX : column === 'right' ? rightX : centerX);

    nodes.forEach((node) => {
      const isUnlocked = journalNodes[node.id] || false;
      const canUnlock = this.canUnlockNode(node);

      const x = xFor(node.column);
      const y = startY + (node.row * nodeSpacingY);

      // Draw connection line to prerequisite (if any)
      if (node.prerequisite) {
        const prereq = nodes.find(n => n.id === node.prerequisite);
        if (prereq) {
          const prereqX = xFor(prereq.column);
          const prereqY = startY + (prereq.row * nodeSpacingY);

          const line = this.add.graphics();
          line.lineStyle(2, Phaser.Display.Color.HexStringToColor(lineColor).color, 0.6);
          line.lineBetween(prereqX, prereqY + 20, x, y - 20);
          container.add(line);
        }
      }

      // Node circle
      let circleColor;
      if (isUnlocked) circleColor = 0x4a8c3f; // Green = unlocked
      else if (canUnlock) circleColor = 0xd4a017; // Gold = available
      else circleColor = 0x666666; // Grey = locked

      const circle = this.add.circle(x, y, 22, circleColor);
      circle.setStrokeStyle(2, 0x3a1a0a);
      container.add(circle);

      const icon = this.add.text(x, y - 4, node.icon, {
        fontFamily: 'serif', fontSize: '14px', color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5);
      container.add(icon);

      const name = this.add.text(x, y + 28, node.name, {
        fontFamily: 'serif', fontSize: '10px', color: '#f5e6c8', align: 'center',
        stroke: '#1a0f05', strokeThickness: 3
      }).setOrigin(0.5, 0);
      container.add(name);

      let costLabel = null;
      if (!isUnlocked) {
        costLabel = this.add.text(x, y + 40, `${node.cost} INS`, {
          fontFamily: 'serif', fontSize: '9px', color: '#d9b88a',
          stroke: '#1a0f05', strokeThickness: 3
        }).setOrigin(0.5, 0);
        container.add(costLabel);
      }

      if (canUnlock && !isUnlocked) {
        circle.setInteractive({ useHandCursor: true });
        circle.on('pointerup', () => this.unlockNode(node.id));
        circle.on('pointerover', () => circle.setFillStyle(0xe5b818));
        circle.on('pointerout', () => circle.setFillStyle(0xd4a017));
      }

      // Node data objects come from the shared JOURNAL_TREE constant (stable
      // references), so these attachments persist across tab switches/unlocks.
      node._circle = circle;
      node._icon = icon;
      node._name = name;
      node._costLabel = costLabel;
      node._container = container;
    });
  }

  // ─── UNLOCK LOGIC ────────────────────────────────

  canUnlockNode(node) {
    const journalNodes = this.registry.get('journalNodes') || {};
    if (journalNodes[node.id]) return false;
    if (node.prerequisite && !journalNodes[node.prerequisite]) return false;
    const insight = this.registry.get('insight') || 0;
    return insight >= node.cost;
  }

  findNode(nodeId) {
    return [...JOURNAL_TREE.blade, ...JOURNAL_TREE.aegis, ...JOURNAL_TREE.arcanum].find(n => n.id === nodeId);
  }

  unlockNode(nodeId) {
    const node = this.findNode(nodeId);
    if (!node || !this.canUnlockNode(node)) return;

    const insight = this.registry.get('insight') || 0;
    this.registry.set('insight', insight - node.cost);

    const journalNodes = this.registry.get('journalNodes') || {};
    journalNodes[node.id] = true;
    this.registry.set('journalNodes', journalNodes);

    this.persistJournal();
    this.updateNodeVisual(node);
    this.updateInsightDisplay();
    this.refreshAllNodeVisuals();

    this.cameras.main.flash(300, 74, 140, 63, false); // Green flash
  }

  updateNodeVisual(node) {
    if (node._circle) {
      node._circle.setFillStyle(0x4a8c3f); // Green
      node._circle.disableInteractive();
      node._circle.off('pointerover');
      node._circle.off('pointerout');
    }
    if (node._costLabel) {
      node._costLabel.destroy();
      node._costLabel = null;
    }
  }

  refreshAllNodeVisuals() {
    const journalNodes = this.registry.get('journalNodes') || {};
    const allNodes = [...JOURNAL_TREE.blade, ...JOURNAL_TREE.aegis, ...JOURNAL_TREE.arcanum];

    allNodes.forEach(node => {
      if (journalNodes[node.id]) {
        this.updateNodeVisual(node);
      } else if (node._circle) {
        const canUnlock = this.canUnlockNode(node);
        node._circle.setFillStyle(canUnlock ? 0xd4a017 : 0x666666);
        if (canUnlock && !node._circle.input) {
          node._circle.setInteractive({ useHandCursor: true });
          node._circle.on('pointerup', () => this.unlockNode(node.id));
          node._circle.on('pointerover', () => node._circle.setFillStyle(0xe5b818));
          node._circle.on('pointerout', () => node._circle.setFillStyle(0xd4a017));
        } else if (!canUnlock && node._circle.input) {
          node._circle.disableInteractive();
        }
      }
    });
  }

  // ─── INSIGHT DISPLAY ─────────────────────────────

  updateInsightDisplay() {
    const insight = this.registry.get('insight') || 0;
    this.insightText.setText(`Insight: ${insight}`);
  }

  // ─── PERSISTENCE ─────────────────────────────────

  persistJournal() {
    const journalNodes = this.registry.get('journalNodes') || {};
    const insight = this.registry.get('insight') || 0;
    saveJournal({ insight, unlocked: Object.keys(journalNodes).filter(id => journalNodes[id]) });
  }
}
