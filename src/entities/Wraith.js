import Enemy from './Enemy.js';
import { ENEMY_STATS, GRID_SIZE } from '../utils/constants.js';

export default class Wraith extends Enemy {
  constructor(scene, row, col, statOverrides = {}) {
    const base = ENEMY_STATS.wraith;
    super(scene, {
      type: 'wraith',
      row, col,
      hp: statOverrides.hp ?? base.hp,
      damage: statOverrides.damage ?? base.damage,
      texture: base.texture,
      speed: base.speed
    });
    this.magicImmune = base.magicImmune;
    this.sprite.setTint(0xaee0ff);
    this.sprite.setAlpha(0.85);
  }

  act(context) {
    const { hero, combatManager, occupied } = context;
    if (this.isAdjacentTo(hero)) {
      combatManager.dealDamageToHero(this.damage, this, 'The Wraith phases through your guard!');
      this.teleportNear(hero, occupied);
      return;
    }
    // Ignores collision: moves straight toward the hero regardless of occupied cells.
    const dRow = Math.sign(hero.row - this.row);
    const dCol = Math.sign(hero.col - this.col);
    let { row, col } = this;
    if (dRow !== 0) row += dRow;
    else if (dCol !== 0) col += dCol;
    occupied.delete(`${this.row},${this.col}`);
    occupied.add(`${row},${col}`);
    this.moveTo(row, col);
  }

  teleportNear(hero, occupied) {
    const candidates = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const dist = Math.abs(r - hero.row) + Math.abs(c - hero.col);
        if (dist === 2 && !occupied.has(`${r},${c}`)) candidates.push([r, c]);
      }
    }
    if (candidates.length === 0) return;
    const [nr, nc] = candidates[Math.floor(Math.random() * candidates.length)];
    occupied.delete(`${this.row},${this.col}`);
    occupied.add(`${nr},${nc}`);
    this.teleportFlash();
    this.moveTo(nr, nc);
  }

  // Preserve the Wraith's persistent pale-blue tint through the base class's
  // white damage-flash instead of clearing it entirely.
  flashDamage() {
    if (!this.sprite || !this.sprite.scene) return;
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(50, () => {
      if (this.sprite && this.sprite.scene) this.sprite.setTint(0xaee0ff);
    });
  }

  teleportFlash() {
    if (!this.sprite || !this.sprite.scene) return;
    this.sprite.setAlpha(0.3);
    this.scene.tweens.add({ targets: this.sprite, alpha: 0.85, duration: 220, ease: 'Quad.easeOut' });
  }
}
