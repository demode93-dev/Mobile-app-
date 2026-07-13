import Phaser from 'phaser';
import {
  GRID_SIZE, TILE_SIZE, ISO_TILE_WIDTH, ISO_TILE_HEIGHT, ISO_OFFSET_X, ISO_OFFSET_Y, gridToScreen,
  BOARD_TILE_COLORS, MIMIC_TILE_COLOR, TILE_TEXTURE_KEY, TILE_ABILITY
} from '../utils/constants.js';

// Diamond hit-test polygon for a tile's interactive area, in the container's
// own local space (its origin is the tile's on-screen center). Sized to the
// isometric grid spacing itself (not the larger rotated-sprite bounding box)
// so adjacent diamonds tile edge-to-edge with no overlap or dead zones.
const TILE_HIT_POLYGON = new Phaser.Geom.Polygon([
  0, -ISO_TILE_HEIGHT / 2,
  ISO_TILE_WIDTH / 2, 0,
  0, ISO_TILE_HEIGHT / 2,
  -ISO_TILE_WIDTH / 2, 0
]);

// Owns the 5x5 grid of colored tiles: layout, swapping, match detection,
// removal, and gravity/cascade refill. Cells that hold a disguised Mimic are
// permanently 'brown' and treated as fixed obstacles - gravity flows around
// them like a blocker tile in a typical match-3 game.
//
// The board renders isometrically: each tile is a Container (so the diamond
// hit area stays fixed regardless of the visual rotation applied to the
// sprite inside it) positioned via gridToScreen() and holding a single child
// sprite rotated 45deg for the diamond look.
export default class BoardManager {
  constructor(scene) {
    this.scene = scene;
    this.grid = [];
    this.sprites = [];
    this.blockedCells = new Set(); // "row,col" strings currently held by a disguised Mimic
    this.buildInitialGrid();
    this.renderGridBackdrop();
    this.render();
  }

  renderGridBackdrop() {
    const boardSize = GRID_SIZE * TILE_SIZE;
    const centerX = ISO_OFFSET_X;
    const centerY = ISO_OFFSET_Y + (GRID_SIZE - 1) * (ISO_TILE_HEIGHT / 2);
    this.gridBackdrop = this.scene.add.image(centerX, centerY, 'grid').setDisplaySize(boardSize, boardSize).setDepth(1);
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
    return gridToScreen(row, col);
  }

  // Builds one tile: a Container (the interactive, positioned object) wrapping
  // a child sprite rotated 45deg for the visual diamond. `spawnPos` lets a
  // cascade-refill tile appear further up the isometric column axis and tween
  // in from there, instead of always starting at its own resting position.
  createTileContainer(row, col, color, spawnPos = null) {
    const restPos = gridToScreen(row, col);
    const startPos = spawnPos || restPos;

    const container = this.scene.add.container(startPos.x, startPos.y).setDepth(2);
    const inner = this.scene.add.sprite(0, 0, TILE_TEXTURE_KEY[color]).setAngle(45);
    container.add(inner);
    container.setInteractive(TILE_HIT_POLYGON, Phaser.Geom.Polygon.Contains, { useHandCursor: true });
    container.row = row;
    container.col = col;
    container.tileSprite = inner;
    container.restX = restPos.x;
    container.restY = restPos.y;
    return container;
  }

  render() {
    for (let r = 0; r < GRID_SIZE; r++) {
      this.sprites[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        const color = this.grid[r][c];
        this.sprites[r][c] = this.createTileContainer(r, c, color);
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
    if (this.sprites[row]) this.sprites[row][col].tileSprite.setTexture(TILE_TEXTURE_KEY[MIMIC_TILE_COLOR]);
  }

  revealMimicCell(row, col) {
    this.blockedCells.delete(this.key(row, col));
    const color = this.randomColor();
    this.grid[row][col] = color;
    this.sprites[row][col].tileSprite.setTexture(TILE_TEXTURE_KEY[color]);
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
        const container = newSprites[i];
        tweens.push(new Promise((resolve) => {
          this.scene.tweens.add({ targets: container, x, y, duration: 220, ease: 'Bounce.easeOut', onComplete: resolve });
        }));
        container.row = destRow;
        container.col = col;
        this.sprites[destRow][col] = container;
      } else {
        // Spawn further up the same isometric column axis (not straight above
        // in screen space) so the fall-in tween travels along the diamond
        // grid's diagonal, matching how settled tiles shift when they cascade.
        const spawnRow = top - (emptyCount - i);
        const spawnPos = this.pixelFor(spawnRow, col);
        const container = this.createTileContainer(destRow, col, newGrid[i], spawnPos);
        this.sprites[destRow][col] = container;
        tweens.push(new Promise((resolve) => {
          this.scene.tweens.add({ targets: container, x, y, duration: 260, ease: 'Bounce.easeOut', onComplete: resolve });
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
    if (this.gridBackdrop) this.gridBackdrop.destroy();
  }
}
