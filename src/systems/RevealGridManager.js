import {
  GRID_SIZE, TILE_SIZE, GRID_OFFSET_X, GRID_OFFSET_Y, DEPTH,
  REVEAL, REVEAL_TABLE, REVEAL_TEXTURE_KEY, GOLD_MIN, GOLD_MAX,
  META_DROP_AMOUNT, ENEMY_NO_WEAPON_DAMAGE
} from '../utils/constants.js';

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function weightedPick(table) {
  const entries = Object.entries(table);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [outcome, weight] of entries) {
    if (roll < weight) return outcome;
    roll -= weight;
  }
  return entries[entries.length - 1][0];
}

// Owns the 7x7 grid of face-down reveal tiles: cell state, texture swapping,
// and the tap-resolution state machine. Every cell's outcome is pre-assigned
// at grid-build time (weighted random, no seeded RNG - each run is unique),
// then only revealed to the player as they tap it.
export default class RevealGridManager {
  constructor(scene) {
    this.scene = scene;
    this.cells = [];
    this.sprites = [];
    this.buildGrid();
    this.render();
  }

  pixelFor(row, col) {
    return {
      x: GRID_OFFSET_X + col * TILE_SIZE + TILE_SIZE / 2,
      y: GRID_OFFSET_Y + row * TILE_SIZE + TILE_SIZE / 2
    };
  }

  buildGrid() {
    for (let r = 0; r < GRID_SIZE; r++) {
      this.cells[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        const outcome = weightedPick(REVEAL_TABLE);
        this.cells[r][c] = {
          outcome,
          revealed: false,
          awaitingWeapon: false,
          resolved: false,
          goldAmount: outcome === REVEAL.GOLD ? randInt(GOLD_MIN, GOLD_MAX) : 0
        };
      }
    }
  }

  render() {
    for (let r = 0; r < GRID_SIZE; r++) {
      this.sprites[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        const { x, y } = this.pixelFor(r, c);
        const sprite = this.scene.add.sprite(x, y, 'tile_facedown').setDisplaySize(TILE_SIZE - 4, TILE_SIZE - 4).setDepth(DEPTH.TILE);
        sprite.setInteractive({ useHandCursor: true });
        sprite.row = r;
        sprite.col = c;
        this.sprites[r][c] = sprite;
      }
    }
  }

  spriteAt(row, col) {
    return this.sprites[row][col];
  }

  // Single entry point the scene calls on tap. Mutates cell state, swaps the
  // tile's texture, and returns a plain result descriptor for the scene to
  // apply to run state (gold/weapon/meta credit, HP damage) - this class
  // never touches HP/gold/weapon counters itself.
  tapCell(row, col, currentWeapons) {
    const cell = this.cells[row][col];
    const sprite = this.sprites[row][col];

    if (!cell.revealed) {
      cell.revealed = true;

      if (cell.outcome === REVEAL.ENEMY) {
        if (currentWeapons > 0) {
          cell.resolved = true;
          sprite.setTexture(REVEAL_TEXTURE_KEY.enemyCleared);
          return { kind: 'enemy_cleared' };
        }
        cell.awaitingWeapon = true;
        sprite.setTexture(REVEAL_TEXTURE_KEY.enemyBlocked);
        return { kind: 'enemy_damage', damage: ENEMY_NO_WEAPON_DAMAGE };
      }

      cell.resolved = true;
      sprite.setTexture(REVEAL_TEXTURE_KEY[cell.outcome]);
      if (cell.outcome === REVEAL.GOLD) return { kind: 'gold', gold: cell.goldAmount };
      if (cell.outcome === REVEAL.WEAPON) return { kind: 'weapon' };
      if (cell.outcome === REVEAL.META) return { kind: 'meta', meta: META_DROP_AMOUNT };
      return { kind: 'empty' };
    }

    // Already revealed: only a still-blocked enemy tile does anything on a re-tap.
    if (cell.awaitingWeapon && !cell.resolved) {
      if (currentWeapons > 0) {
        cell.resolved = true;
        cell.awaitingWeapon = false;
        sprite.setTexture(REVEAL_TEXTURE_KEY.enemyCleared);
        return { kind: 'enemy_cleared' };
      }
      return { kind: 'noop' };
    }

    return { kind: 'noop' };
  }

  destroy() {
    for (const row of this.sprites) {
      for (const sprite of row) {
        if (sprite) sprite.destroy();
      }
    }
  }
}
