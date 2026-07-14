import { GRID_OFFSET_X, GRID_OFFSET_Y, TILE_SIZE, GRID_SIZE, DEPTH } from '../utils/constants.js';
import { playSFX } from '../systems/SoundManager.js';

// Base class for all enemy types. Subclasses implement act(context) for their
// enemy-phase AI and may override onTakeDamage for special reactions (Mimic).
export default class Enemy {
  constructor(scene, { type, row, col, hp, damage = 0, texture, speed = 0, dodgeChance = 0 }) {
    this.scene = scene;
    this.type = type;
    this.row = row;
    this.col = col;
    this.maxHp = hp;
    this.hp = hp;
    this.damage = damage;
    this.speed = speed;
    this.dodgeChance = dodgeChance;
    this.isDead = false;
    this.poisonSourceTile = false;

    const { x, y } = this.pixelPosition();
    this.sprite = scene.add.sprite(x, y, texture).setDepth(DEPTH.ENEMY);
    this.sprite.setScale(0.7);
    this.sprite.setInteractive({ useHandCursor: true });

    this.hpBarBg = scene.add.rectangle(x, y - 34, 44, 6, 0x1a1a1a).setDepth(DEPTH.ENEMY_HP_BG);
    this.hpBar = scene.add.rectangle(x, y - 34, 44, 6, 0xc0392b).setDepth(DEPTH.ENEMY_HP_FILL);
  }

  pixelPosition(row = this.row, col = this.col) {
    return {
      x: GRID_OFFSET_X + col * TILE_SIZE + TILE_SIZE / 2,
      y: GRID_OFFSET_Y + row * TILE_SIZE + TILE_SIZE / 2
    };
  }

  distanceTo(entity) {
    return Math.abs(this.row - entity.row) + Math.abs(this.col - entity.col);
  }

  isAdjacentTo(entity) {
    return this.distanceTo(entity) === 1;
  }

  updateHpBar() {
    const pct = Math.max(0, this.hp / this.maxHp);
    this.hpBar.width = 44 * pct;
    this.hpBar.x = this.hpBarBg.x - (44 - this.hpBar.width) / 2;
  }

  // Returns actual damage dealt (0 if dodged or already dead).
  takeDamage(amount, source = null) {
    if (this.isDead) return 0;
    if (this.dodgeChance && Math.random() < this.dodgeChance) {
      this.showDodge();
      return 0;
    }
    this.hp = Math.max(0, this.hp - amount);
    this.updateHpBar();
    this.flashDamage();
    playSFX(this.scene, 'sfx_enemy_hit');
    this.onTakeDamage(amount, source);
    if (this.hp <= 0) {
      this.die();
    }
    return amount;
  }

  onTakeDamage() {
    // Hook for subclasses (e.g. Mimic reveals on any damage).
  }

  heal(amount) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.updateHpBar();
    return this.hp - before;
  }

  showDodge() {
    const { x, y } = this.pixelPosition();
    const text = this.scene.add.text(x, y - 20, 'MISS', { fontSize: '14px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(DEPTH.FLOATING_TEXT);
    this.scene.tweens.add({ targets: text, y: y - 45, alpha: 0, duration: 600, onComplete: () => text.destroy() });
  }

  flashDamage() {
    if (!this.sprite || !this.sprite.scene) return;
    this.sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(50, () => {
      if (this.sprite && this.sprite.scene) this.sprite.clearTint();
    });
  }

  die() {
    if (this.isDead) return;
    this.isDead = true;
    playSFX(this.scene, 'sfx_enemy_die');
    if (this.sprite) {
      this.scene.tweens.add({
        targets: [this.sprite, this.hpBar, this.hpBarBg],
        alpha: 0,
        duration: 300,
        onComplete: () => this.destroy()
      });
    }
  }

  destroy() {
    if (this.sprite) this.sprite.destroy();
    if (this.hpBar) this.hpBar.destroy();
    if (this.hpBarBg) this.hpBarBg.destroy();
  }

  moveTo(row, col) {
    this.row = row;
    this.col = col;
    const { x, y } = this.pixelPosition();
    this.scene.tweens.add({ targets: [this.sprite], x, y, duration: 250, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: [this.hpBar, this.hpBarBg], x: this.hpBarBg.x, y: y - 34, duration: 250, ease: 'Quad.easeOut' });
  }

  // Greedy single/multi-step move toward a target cell, avoiding occupied cells.
  stepToward(targetRow, targetCol, steps, occupied) {
    let { row, col } = this;
    for (let i = 0; i < steps; i++) {
      const candidates = [];
      const dRow = targetRow - row;
      const dCol = targetCol - col;
      if (Math.abs(dRow) >= Math.abs(dCol) && dRow !== 0) {
        candidates.push([row + Math.sign(dRow), col]);
        if (dCol !== 0) candidates.push([row, col + Math.sign(dCol)]);
      } else if (dCol !== 0) {
        candidates.push([row, col + Math.sign(dCol)]);
        if (dRow !== 0) candidates.push([row + Math.sign(dRow), col]);
      }
      const valid = candidates.find(([r, c]) =>
        r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && !occupied.has(`${r},${c}`)
      );
      if (!valid) break;
      occupied.delete(`${row},${col}`);
      [row, col] = valid;
      occupied.add(`${row},${col}`);
    }
    if (row !== this.row || col !== this.col) this.moveTo(row, col);
  }
}
