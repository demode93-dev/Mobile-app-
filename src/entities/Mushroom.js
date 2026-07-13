import Enemy from './Enemy.js';
import { ENEMY_STATS } from '../utils/constants.js';

// Stationary. Its own tile is poisoned; the hero takes poison damage at the
// end of the enemy phase for as long as the hero remains adjacent to (i.e.
// "standing in the cloud of") this mushroom's cell.
export default class Mushroom extends Enemy {
  constructor(scene, row, col, statOverrides = {}) {
    const base = ENEMY_STATS.mushroom;
    super(scene, {
      type: 'mushroom',
      row, col,
      hp: statOverrides.hp ?? base.hp,
      damage: 0,
      texture: base.texture,
      speed: 0
    });
    this.poisonDamage = statOverrides.poisonDamage ?? base.poisonDamage;
    this.poisonSourceTile = true;
    this.poisonRing = scene.add.circle(this.pixelPosition().x, this.pixelPosition().y, 30, 0x27ae60, 0.15).setDepth(4);
  }

  act(context) {
    const { hero, poisonImmune, log } = context;
    if (poisonImmune) return;
    if (this.isAdjacentTo(hero) || (this.row === hero.row && this.col === hero.col)) {
      hero.poisonStacks = this.poisonDamage;
      if (log) log('Spores cling to you. Poison lingers while you stay near the Mushroom.');
    }
  }

  destroy() {
    if (this.poisonRing) this.poisonRing.destroy();
    super.destroy();
  }
}
