import Enemy from './Enemy.js';
import { ENEMY_STATS } from '../utils/constants.js';

export default class Bat extends Enemy {
  constructor(scene, row, col, statOverrides = {}) {
    const base = ENEMY_STATS.bat;
    super(scene, {
      type: 'bat',
      row, col,
      hp: statOverrides.hp ?? base.hp,
      damage: statOverrides.damage ?? base.damage,
      texture: base.texture,
      speed: base.speed,
      dodgeChance: base.dodgeChance
    });
  }

  act(context) {
    const { hero, combatManager, occupied } = context;
    if (this.isAdjacentTo(hero)) {
      combatManager.dealDamageToHero(this.damage, this, 'The Rattling Bat nips at you!');
      return;
    }
    this.stepToward(hero.row, hero.col, this.speed, occupied);
  }
}
