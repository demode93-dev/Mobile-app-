import { DUNGEON_HP } from '../utils/constants.js';

// Plain HP tracker - no grid position, no sprite. The push-your-luck loop has
// no hero token moving around the board; a static portrait icon (if any) is
// owned by GameScene's HUD, not by this class.
export default class Hero {
  constructor() {
    this.maxHp = DUNGEON_HP;
    this.hp = this.maxHp;
    this.isDead = false;
  }

  applyDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) this.isDead = true;
    return amount;
  }

  heal(amount) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  }
}
