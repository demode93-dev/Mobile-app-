import Enemy from './Enemy.js';
import { ENEMY_STATS, DEPTH } from '../utils/constants.js';

export default class Skeleton extends Enemy {
  constructor(scene, row, col, statOverrides = {}) {
    const base = ENEMY_STATS.skeleton;
    super(scene, {
      type: 'skeleton',
      row, col,
      hp: statOverrides.hp ?? base.hp,
      damage: statOverrides.damage ?? base.damage,
      texture: base.texture,
      speed: base.speed
    });
  }

  act(context) {
    const { hero, enemies, combatManager, occupied } = context;
    if (this.isAdjacentTo(hero)) {
      this.telegraph();
      combatManager.dealDamageToHero(this.damage, this, 'Skeleton Knight swings its blade!');
      return;
    }
    // Prefer a step that ends adjacent to hero AND another living enemy, else just move toward hero.
    const candidates = this.candidateSteps(hero, occupied);
    const preferred = candidates.find(([r, c]) =>
      enemies.some(e => e !== this && !e.isDead && Math.abs(e.row - r) + Math.abs(e.col - c) === 1)
    );
    const [tr, tc] = preferred || candidates[0] || [this.row, this.col];
    if (tr !== this.row || tc !== this.col) {
      occupied.delete(`${this.row},${this.col}`);
      occupied.add(`${tr},${tc}`);
      this.moveTo(tr, tc);
    }
  }

  candidateSteps(hero, occupied) {
    const { row, col } = this;
    const dRow = hero.row - row;
    const dCol = hero.col - col;
    const options = [];
    if (dRow !== 0) options.push([row + Math.sign(dRow), col]);
    if (dCol !== 0) options.push([row, col + Math.sign(dCol)]);
    return options.filter(([r, c]) => r >= 0 && r < 5 && c >= 0 && c < 5 && !occupied.has(`${r},${c}`));
  }

  telegraph() {
    const { x, y } = this.pixelPosition();
    const text = this.scene.add.text(x, y - 40, '!', { fontSize: '22px', color: '#ffcc00', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.FLOATING_TEXT);
    this.scene.tweens.add({ targets: text, y: y - 55, alpha: 0, duration: 500, onComplete: () => text.destroy() });
  }
}
