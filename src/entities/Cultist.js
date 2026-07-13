import Enemy from './Enemy.js';
import { ENEMY_STATS } from '../utils/constants.js';

export default class Cultist extends Enemy {
  constructor(scene, row, col, statOverrides = {}) {
    const base = ENEMY_STATS.cultist;
    super(scene, {
      type: 'cultist',
      row, col,
      hp: statOverrides.hp ?? base.hp,
      damage: 0,
      texture: base.texture,
      speed: 0
    });
    this.healAmount = statOverrides.healAmount ?? base.healAmount;
    this.blockedFromHealing = false; // set by Cultist's Bane upgrade when damaged this turn
  }

  act(context) {
    const { enemies, log, cultistsBaneActive } = context;
    if (this.blockedFromHealing) {
      this.blockedFromHealing = false;
      return;
    }
    const damaged = enemies.filter(e => !e.isDead && e.hp < e.maxHp);
    if (damaged.length === 0) return;

    const others = damaged.filter(e => e !== this);
    let target;
    if (others.length > 0) {
      target = others.reduce((lowest, e) => (e.hp < lowest.hp ? e : lowest), others[0]);
    } else if (damaged.includes(this)) {
      target = this; // only heal self if self is the only damaged enemy
    } else {
      return;
    }

    const healed = target.heal(this.healAmount);
    if (healed > 0 && log) log(`Cultist Acolyte channels dark energy, healing ${target.type} for ${healed}.`);
    this.showHealFx(target);
    void cultistsBaneActive;
  }

  showHealFx(target) {
    const { x, y } = target.pixelPosition();
    const text = this.scene.add.text(x, y - 30, `+${this.healAmount}`, { fontSize: '16px', color: '#33ff77', fontStyle: 'bold' }).setOrigin(0.5).setDepth(30);
    this.scene.tweens.add({ targets: text, y: y - 55, alpha: 0, duration: 700, onComplete: () => text.destroy() });
  }
}
