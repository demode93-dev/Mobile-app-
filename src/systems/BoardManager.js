import {
  GRID_SIZE, TILE_SIZE, GRID_OFFSET_X, GRID_OFFSET_Y,
  BOARD_TILE_COLORS, MIMIC_TILE_COLOR, TILE_TEXTURE_KEY, TILE_ABILITY
} from '../utils/constants.js';

// Owns the 5x5 grid of colored tiles: layout, swapping, match detection,
// removal, and gravity/cascade refill. Cells that hold a disguised Mimic are
// permanently 'brown' and treated as fixed obstacles - gravity flows around
// them like a blocker tile in a typical match-3 game.
export default class BoardManager {
  constructor(scene) {
    this.scene = scene;
    this.grid = [];
    this.sprites = [];
    this.blockedCells = new Set(); // "row,col" strings currently held by a disguised Mimic
    this.buildInitialGrid();
    this.render();
  }

  key(row, col) {
    return `${row},${col}`;
  }

  randomColor() {
    return BOARD_TILE_COLORS[Math.floor(Math.random() * BOARD_TILE_COLORS.length)];
  }

  buildInitialGrid() {
    for (let r = 0; r < GRID_SIZE; r++) {
      this.grid[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        let color;
        do {
          color = this.randomColor();
        } while (this.wouldMatchAt(r, c, color));
        this.grid[r][c] = color;
      }
    }
  }

  wouldMatchAt(row, col, color) {
    if (col >= 2 && this.grid[row][col - 1] === color && this.grid[row][col - 2] === color) return true;
    if (row >= 2 && this.grid[row - 1] && this.grid[row - 1][col] === color && this.grid[row - 2][col] === color) return true;
    return false;
  }

  pixelFor(row, col) {
    return {
      x: GRID_OFFSET_X + col * TILE_SIZE + TILE_SIZE / 2,
      y: GRID_OFFSET_Y + row * TILE_SIZE + TILE_SIZE / 2
    };
  }

  render() {
    for (let r = 0; r < GRID_SIZE; r++) {
      this.sprites[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        const { x, y } = this.pixelFor(r, c);
        const color = this.grid[r][c];
        const sprite = this.scene.add.sprite(x, y, TILE_TEXTURE_KEY[color]).setDepth(2);
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

  colorAt(row, col) {
    return this.grid[row][col];
  }

  isBlocked(row, col) {
    return this.blockedCells.has(this.key(row, col));
  }

  markMimicCell(row, col) {
    this.blockedCells.add(this.key(row, col));
    this.grid[row][col] = MIMIC_TILE_COLOR;
    if (this.sprites[row]) this.sprites[row][col].setTexture(TILE_TEXTURE_KEY[MIMIC_TILE_COLOR]);
  }

  revealMimicCell(row, col) {
    this.blockedCells.delete(this.key(row, col));
    const color = this.randomColor();
    this.grid[row][col] = color;
    this.sprites[row][col].setTexture(TILE_TEXTURE_KEY[color]);
  }

  areAdjacent(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
  }

  // Attempts a swap. Returns { matched: [[cells...], ...] } describing every
  // group matched (initial swap + all cascades), or null if the swap was invalid/no-match.
  trySwap(a, b) {
    if (!this.areAdjacent(a, b)) return null;
    if (this.isBlocked(a.row, a.col) || this.isBlocked(b.row, b.col)) return null;

    this.swapValues(a, b);
    const matches = this.findMatches();
    if (matches.length === 0) {
      this.swapValues(a, b); // revert
      return { success: false };
    }
    return { success: true, firstMatches: matches };
  }

  swapValues(a, b) {
    const tmp = this.grid[a.row][a.col];
    this.grid[a.row][a.col] = this.grid[b.row][b.col];
    this.grid[b.row][b.col] = tmp;
  }

  animateSwap(a, b, revert = false) {
    const spriteA = this.sprites[a.row][a.col];
    const spriteB = this.sprites[b.row][b.col];
    const posA = this.pixelFor(a.row, a.col);
    const posB = this.pixelFor(b.row, b.col);
    return new Promise((resolve) => {
      this.scene.tweens.add({ targets: spriteA, x: posB.x, y: posB.y, duration: 180, ease: 'Quad.easeInOut' });
      this.scene.tweens.add({
        targets: spriteB, x: posA.x, y: posA.y, duration: 180, ease: 'Quad.easeInOut',
        onComplete: () => {
          if (!revert) {
            // Swap sprite/grid bookkeeping to match new logical layout.
            this.sprites[a.row][a.col] = spriteB;
            this.sprites[b.row][b.col] = spriteA;
            spriteA.row = b.row; spriteA.col = b.col;
            spriteB.row = a.row; spriteB.col = a.col;
          } else {
            spriteA.x = posA.x; spriteA.y = posA.y;
            spriteB.x = posB.x; spriteB.y = posB.y;
          }
          resolve();
        }
      });
    });
  }

  findMatches() {
    const groups = [];
    const visited = new Set();

    // Horizontal runs
    for (let r = 0; r < GRID_SIZE; r++) {
      let runStart = 0;
      for (let c = 1; c <= GRID_SIZE; c++) {
        const prevColor = this.grid[r][c - 1];
        const curColor = c < GRID_SIZE ? this.grid[r][c] : null;
        if (curColor !== prevColor || c === GRID_SIZE) {
          const runLen = c - runStart;
          if (runLen >= 3 && prevColor !== MIMIC_TILE_COLOR) {
            const cells = [];
            for (let k = runStart; k < c; k++) cells.push({ row: r, col: k });
            groups.push({ color: prevColor, cells });
          }
          runStart = c;
        }
      }
    }

    // Vertical runs
    for (let c = 0; c < GRID_SIZE; c++) {
      let runStart = 0;
      for (let r = 1; r <= GRID_SIZE; r++) {
        const prevColor = this.grid[r - 1][c];
        const curColor = r < GRID_SIZE ? this.grid[r][c] : null;
        if (curColor !== prevColor || r === GRID_SIZE) {
          const runLen = r - runStart;
          if (runLen >= 3 && prevColor !== MIMIC_TILE_COLOR) {
            const cells = [];
            for (let k = runStart; k < r; k++) cells.push({ row: k, col: c });
            groups.push({ color: prevColor, cells });
          }
          runStart = r;
        }
      }
    }

    return groups;
  }

  // Removes matched groups with a shrink animation, applies gravity per column,
  // and refills empties. Returns a promise resolving with any NEW matches
  // created by the cascade (caller loops until empty for chain reactions).
  async resolveMatches(groups) {
    const allCells = [];
    for (const g of groups) allCells.push(...g.cells);

    await this.shrinkAndClear(allCells);
    await this.applyGravityAndRefill();

    return this.findMatches();
  }

  shrinkAndClear(cells) {
    return new Promise((resolve) => {
      if (cells.length === 0) return resolve();
      let remaining = cells.length;
      for (const { row, col } of cells) {
        const sprite = this.sprites[row][col];
        this.grid[row][col] = null;
        this.scene.tweens.add({
          targets: sprite,
          scale: 0,
          duration: 200,
          ease: 'Back.easeIn',
          onComplete: () => {
            sprite.destroy();
            remaining -= 1;
            if (remaining === 0) resolve();
          }
        });
      }
    });
  }

  applyGravityAndRefill() {
    const tweens = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      // Split the column into segments separated by blocked (Mimic) cells.
      let segStart = 0;
      for (let r = 0; r <= GRID_SIZE; r++) {
        const blocked = r === GRID_SIZE || this.isBlocked(r, c);
        if (blocked) {
          this.collapseSegment(c, segStart, r - 1, tweens);
          segStart = r + 1;
        }
      }
    }
    return Promise.all(tweens);
  }

  collapseSegment(col, top, bottom, tweens) {
    if (top > bottom) return;
    const values = [];
    for (let r = top; r <= bottom; r++) {
      if (this.grid[r][col] !== null && this.grid[r][col] !== undefined) values.push({ color: this.grid[r][col], sprite: this.sprites[r][col] });
    }
    const emptyCount = (bottom - top + 1) - values.length;

    // Place existing tiles at the bottom of the segment, in order.
    const newSprites = new Array(bottom - top + 1).fill(null);
    const newGrid = new Array(bottom - top + 1).fill(null);
    for (let i = 0; i < values.length; i++) {
      const destIndex = emptyCount + i;
      newGrid[destIndex] = values[i].color;
      newSprites[destIndex] = values[i].sprite;
    }
    for (let i = 0; i < emptyCount; i++) {
      newGrid[i] = this.randomColor();
    }

    for (let i = 0; i < newSprites.length; i++) {
      const destRow = top + i;
      const { x, y } = this.pixelFor(destRow, col);
      if (newSprites[i]) {
        const sprite = newSprites[i];
        tweens.push(new Promise((resolve) => {
          this.scene.tweens.add({ targets: sprite, x, y, duration: 220, ease: 'Bounce.easeOut', onComplete: resolve });
        }));
        sprite.row = destRow;
        sprite.col = col;
        this.sprites[destRow][col] = sprite;
      } else {
        const spawnY = this.pixelFor(top, col).y - (emptyCount) * TILE_SIZE;
        const sprite = this.scene.add.sprite(x, spawnY, TILE_TEXTURE_KEY[newGrid[i]]).setDepth(2);
        sprite.setInteractive({ useHandCursor: true });
        sprite.row = destRow;
        sprite.col = col;
        this.sprites[destRow][col] = sprite;
        tweens.push(new Promise((resolve) => {
          this.scene.tweens.add({ targets: sprite, y, duration: 260, ease: 'Bounce.easeOut', onComplete: resolve });
        }));
      }
      this.grid[destRow][col] = newGrid[i];
    }
  }

  abilityForColor(color) {
    return TILE_ABILITY[color];
  }

  destroy() {
    for (const row of this.sprites) {
      for (const sprite of row) {
        if (sprite) sprite.destroy();
      }
    }
  }
}
