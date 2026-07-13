import { GRID_OFFSET_X, GRID_OFFSET_Y, TILE_SIZE, HERO_BASE_HP, HERO_START_ROW, HERO_START_COL } from '../utils/constants.js';

// The hero's grid cell is mostly flavor for adjacency checks: after each
// ability resolves, the hero token animates to the nearest open cell next to
// whichever enemy it just targeted, representing the hero closing in on that
// foe. This is what makes "adjacent to hero" AI (Skeleton/Bat/Wraith attacks,
// Mushroom poison zones) feel dynamic turn to turn.
export default class Hero {
  constructor(scene, modifiers = {}) {
    this.scene = scene;
    this.row = HERO_START_ROW;
    this.col = HERO_START_COL;

    this.maxHp = HERO_BASE_HP + (modifiers.maxHp || 0);
    this.hp = this.maxHp;
    this.block = modifiers.startingBlock || 0;
    this.blockTurnsLeft = this.block > 0 ? (1 + (modifiers.blockDurationBonus || 0)) : 0;
    this.poisonStacks = 0;
    this.isDead = false;

    const { x, y } = this.pixelPosition();
    this.sprite = scene.add.sprite(x, y, 'hero').setDepth(20);
    this.sprite.setScale(0.8);

    scene.tweens.add({
      targets: this.sprite,
      y: y - 3,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  pixelPosition(row = this.row, col = this.col) {
    return {
      x: GRID_OFFSET_X + col * TILE_SIZE + TILE_SIZE / 2,
      y: GRID_OFFSET_Y + row * TILE_SIZE + TILE_SIZE / 2
    };
  }

  moveTo(row, col) {
    this.row = row;
    this.col = col;
    const { x, y } = this.pixelPosition();
    this.scene.tweens.add({ targets: this.sprite, x, y, duration: 250, ease: 'Quad.easeOut' });
  }

  isAdjacentTo(entity) {
    return Math.abs(this.row - entity.row) + Math.abs(this.col - entity.col) === 1;
  }

  addBlock(amount, durationTurns = 1) {
    this.block += amount;
    this.blockTurnsLeft = Math.max(this.blockTurnsLeft, durationTurns);
  }

  heal(amount) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  }

  applyDamage(amount, { ignoreBlock = false, blockAbsorbsPoison = false } = {}) {
    let remaining = amount;
    if (!ignoreBlock && this.block > 0) {
      const absorbed = Math.min(this.block, remaining);
      this.block -= absorbed;
      remaining -= absorbed;
    }
    this.hp = Math.max(0, this.hp - remaining);
    if (this.hp === 0) this.isDead = true;
    this.flashDamage();
    return remaining;
  }

  applyPoisonTick(damageReduction = 0) {
    if (this.poisonStacks <= 0) return 0;
    const dmg = Math.max(0, this.poisonStacks - damageReduction);
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp === 0) this.isDead = true;
    return dmg;
  }

  decayBlock() {
    if (this.blockTurnsLeft > 0) {
      this.blockTurnsLeft -= 1;
      if (this.blockTurnsLeft <= 0) this.block = 0;
    }
  }

  flashDamage() {
    if (!this.sprite || !this.sprite.scene) return;
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(50, () => {
      if (this.sprite && this.sprite.scene) this.sprite.clearTint();
    });
  }

  destroy() {
    if (this.sprite) this.sprite.destroy();
  }
}
