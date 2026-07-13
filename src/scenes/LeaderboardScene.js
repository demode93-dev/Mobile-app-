import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, STORAGE_KEYS, DEPTH } from '../utils/constants.js';
import { getDailyDungeon, getLeaderboard } from '../utils/api.js';

export default class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super('LeaderboardScene');
  }

  create() {
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'parchment_bg').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(DEPTH.BACKGROUND);
    this.add.text(GAME_WIDTH / 2, 60, 'Daily Dungeon Dive', { fontSize: '22px', color: '#3a2013', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.HUD);
    this.timeText = this.add.text(GAME_WIDTH / 2, 90, '', { fontSize: '14px', color: '#5b3a1e' }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.listContainer = this.add.container(0, 130).setDepth(DEPTH.HUD);
    this.statusText = this.add.text(GAME_WIDTH / 2, 200, 'Loading leaderboard...', { fontSize: '14px', color: '#5b3a1e' }).setOrigin(0.5).setDepth(DEPTH.HUD);

    this.backBtn = this.add.text(20, GAME_HEIGHT - 30, '< Menu', { fontSize: '16px', color: '#3a2013', fontStyle: 'bold' })
      .setInteractive({ useHandCursor: true }).setDepth(DEPTH.HUD);
    this.backBtn.on('pointerdown', () => this.scene.start('MenuScene'));

    this.startCountdown();
    this.loadData();
  }

  startCountdown() {
    const update = () => {
      const now = new Date();
      const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const diffMs = midnight - now;
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      const s = Math.floor((diffMs % 60000) / 1000);
      this.timeText.setText(`Resets in ${h}h ${m}m ${s}s`);
    };
    update();
    this.time.addEvent({ delay: 1000, loop: true, callback: update });
  }

  async loadData() {
    await getDailyDungeon();
    const result = await getLeaderboard();

    this.statusText.destroy();
    const playerName = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME) || 'You';
    const entries = (result.entries && result.entries.length > 0) ? result.entries : this.demoEntries(playerName);

    entries.slice(0, 15).forEach((entry, i) => {
      const y = i * 34;
      const isPlayer = entry.name === playerName;
      const bg = this.add.rectangle(GAME_WIDTH / 2, y + 14, GAME_WIDTH - 40, 30, isPlayer ? 0xe0a934 : 0xffffff, isPlayer ? 0.35 : 0.15);
      const rank = this.add.text(30, y, `#${entry.rank}`, { fontSize: '13px', color: '#3a2013', fontStyle: 'bold' });
      const name = this.add.text(80, y, entry.name, { fontSize: '13px', color: '#3a2013' });
      const depth = this.add.text(230, y, `Depth ${entry.depth}`, { fontSize: '12px', color: '#5b3a1e' });
      const rewardLabel = entry.reward ? `${entry.reward.insight} INS / ${entry.reward.gems} GEM` : '';
      const prize = this.add.text(GAME_WIDTH - 40, y, rewardLabel, { fontSize: '11px', color: '#8a5a0a', fontStyle: 'bold' }).setOrigin(1, 0);
      this.listContainer.add([bg, rank, name, depth, prize]);
    });

    if (!result.entries || result.entries.length === 0) {
      const note = this.add.text(GAME_WIDTH / 2, 34 * entries.length + 30, '(Offline demo data - connect a backend for live scores)', {
        fontSize: '11px', color: '#8a7050', align: 'center', wordWrap: { width: GAME_WIDTH - 60 }
      }).setOrigin(0.5);
      this.listContainer.add(note);
    }
  }

  demoEntries(playerName) {
    const names = ['Grimhold', 'Ashe', 'Tobar', 'Wren', playerName, 'Kael', 'Sable'];
    return names.map((name, i) => ({
      rank: i + 1,
      name,
      depth: 20 - i * 2,
      score: (20 - i * 2) * 100,
      reward: i === 0 ? { insight: 100, gems: 50 } : (i < 2 ? { insight: 50, gems: 25 } : null)
    }));
  }
}
