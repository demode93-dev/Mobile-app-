import Enemy from './Enemy.js';
import { ENEMY_STATS, MIMIC_TILE_COLOR, TILE_TEXTURE_KEY } from '../utils/constants.js';
import { playSFX } from '../systems/SoundManager.js';

export const MIMIC_STATE = { DISGUISED: 'disguised', REVEALED: 'revealed' };

// Mimics start disguised as a plain brown tile. The very first time the hero
// is adjacent to a disguised Mimic (checked at spawn, and after any hero
// re-position) it lands a free ambush hit. Taking damage while disguised
// (e.g. a Magic line sweeping over its cell) reveals it without the ambush.
export default class Mimic extends Enemy {
  constructor(scene, row, col, statOverrides = {}, startRevealed = false) {
    const base = ENEMY_STATS.mimic;
    super(scene, {
      type: 'mimic',
      row, col,
      hp: statOverrides.hp ?? base.hp,
      damage: 0,
      texture: startRevealed ? base.texture : TILE_TEXTURE_KEY[MIMIC_TILE_COLOR],
      speed: 0
    });
    this.ambushDamage = statOverrides.ambushDamage ?? base.ambushDamage;
    this.revealedDamage = statOverrides.revealedDamage ?? base.revealedDamage;
    this.state = startRevealed ? MIMIC_STATE.REVEALED : MIMIC_STATE.DISGUISED;
    this.hasAmbushed = false;
    if (!startRevealed) {
      // Disguised mimics hide their HP bar - they look like a plain tile.
      this.hpBar.setVisible(false);
      this.hpBarBg.setVisible(false);
      this.sprite.setScale(1); // match tile art scale
    }
  }

  reveal() {
    if (this.state === MIMIC_STATE.REVEALED) return;
    this.state = MIMIC_STATE.REVEALED;
    this.sprite.setTexture(ENEMY_STATS.mimic.texture);
    this.sprite.setScale(0.7);
    this.hpBar.setVisible(true);
    this.hpBarBg.setVisible(true);
  }

  onTakeDamage() {
    // Any damage reveals it, ambush or not.
    this.reveal();
  }

  checkAmbush(hero, combatManager) {
    if (this.state === MIMIC_STATE.DISGUISED && !this.hasAmbushed && this.isAdjacentTo(hero)) {
      this.hasAmbushed = true;
      this.reveal();
      playSFX(this.scene, 'sfx_mimic_ambush');
      combatManager.dealDamageToHero(this.ambushDamage, this, 'A Mimic Chest springs its ambush!');
    }
  }

  act(context) {
    const { hero, combatManager } = context;
    if (this.state === MIMIC_STATE.DISGUISED) {
      this.checkAmbush(hero, combatManager);
      return;
    }
    if (this.isAdjacentTo(hero)) {
      combatManager.dealDamageToHero(this.revealedDamage, this, 'The Mimic Chest bites!');
    }
  }
}
