// Procedural laboratory generator. Carves rooms + corridors into a wall grid,
// then places keycards, pickups, the exit, and enemy/player spawn points.
const TILE = 48;

const GameMap = (() => {
  // tile codes
  const WALL = 1, FLOOR = 0, EXIT = 2;

  function make(level) {
    const cols = 22 + Math.min(level * 2, 10);
    const rows = 16 + Math.min(level * 2, 8);
    const grid = [];
    for (let y = 0; y < rows; y++) {
      grid.push(new Array(cols).fill(WALL));
    }

    // Carve rooms
    const rooms = [];
    const roomCount = 6 + Math.min(level, 6);
    for (let i = 0; i < roomCount; i++) {
      const rw = Utils.randInt(4, 7);
      const rh = Utils.randInt(3, 6);
      const rx = Utils.randInt(1, cols - rw - 2);
      const ry = Utils.randInt(1, rows - rh - 2);
      for (let y = ry; y < ry + rh; y++)
        for (let x = rx; x < rx + rw; x++) grid[y][x] = FLOOR;
      rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + (rw >> 1), cy: ry + (rh >> 1) });
    }

    // Connect rooms with L-shaped corridors
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1], b = rooms[i];
      carveH(grid, a.cx, b.cx, a.cy);
      carveV(grid, a.cy, b.cy, b.cx);
    }
    // a few extra loops so it's not a pure tree
    for (let i = 0; i < 3; i++) {
      const a = Utils.choice(rooms), b = Utils.choice(rooms);
      carveH(grid, a.cx, b.cx, a.cy);
      carveV(grid, a.cy, b.cy, b.cx);
    }

    // Player spawn = first room center; exit = farthest room.
    const spawn = { x: (rooms[0].cx + 0.5) * TILE, y: (rooms[0].cy + 0.5) * TILE };
    let far = rooms[1], best = -1;
    for (const r of rooms) {
      const d = Utils.dist(r.cx, r.cy, rooms[0].cx, rooms[0].cy);
      if (d > best) { best = d; far = r; }
    }
    grid[far.cy][far.cx] = EXIT;
    const exit = { x: (far.cx + 0.5) * TILE, y: (far.cy + 0.5) * TILE, tx: far.cx, ty: far.cy };

    // Item placement on random floor tiles away from spawn.
    const floors = [];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        if (grid[y][x] === FLOOR &&
            Utils.dist(x, y, rooms[0].cx, rooms[0].cy) > 4)
          floors.push({ x, y });

    function takeSpot() {
      const idx = Utils.randInt(0, floors.length - 1);
      const f = floors.splice(idx, 1)[0];
      return { x: (f.x + 0.5) * TILE, y: (f.y + 0.5) * TILE };
    }

    const items = [];
    for (let i = 0; i < 3; i++) items.push({ type: "keycard", ...takeSpot(), taken: false, bob: Math.random() * 6 });
    for (let i = 0; i < 2 + level; i++) items.push({ type: "battery", ...takeSpot(), taken: false, bob: Math.random() * 6 });
    for (let i = 0; i < 2; i++) items.push({ type: "medkit", ...takeSpot(), taken: false, bob: Math.random() * 6 });

    // Lore drops (PDA / terminal nodes) — environmental storytelling. Each
    // carries an index into Lore.LOGS so collecting it fires a transmission.
    const logs = [];
    const logCount = Math.min(4, floors.length);
    for (let i = 0; i < logCount; i++) {
      logs.push({ ...takeSpot(), idx: ((level - 1) * 2 + i) % Lore.LOGS.length,
                  read: false, bob: Math.random() * 6 });
    }

    // Enemy spawn points (rooms other than the first).
    const enemySpots = [];
    for (let i = 1; i < rooms.length; i++) {
      const r = rooms[i];
      enemySpots.push({ x: (r.cx + 0.5) * TILE, y: (r.cy + 0.5) * TILE });
    }

    return { grid, cols, rows, spawn, exit, items, logs, enemySpots, rooms,
             pixW: cols * TILE, pixH: rows * TILE };
  }

  function carveH(grid, x1, x2, y) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      if (grid[y] && grid[y][x] === 1) grid[y][x] = 0;
    }
  }
  function carveV(grid, y1, y2, x) {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
      if (grid[y] && grid[y][x] === 1) grid[y][x] = 0;
    }
  }

  function isWall(map, px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= map.cols || ty >= map.rows) return true;
    return map.grid[ty][tx] === 1;
  }

  // Resolve a circle move against the wall grid, axis-separated for sliding.
  function moveCircle(map, x, y, r, dx, dy) {
    let nx = x + dx;
    if (collides(map, nx, y, r)) nx = x;
    let ny = y + dy;
    if (collides(map, nx, ny, r)) ny = y;
    return { x: nx, y: ny };
  }
  function collides(map, x, y, r) {
    const minTx = Math.floor((x - r) / TILE), maxTx = Math.floor((x + r) / TILE);
    const minTy = Math.floor((y - r) / TILE), maxTy = Math.floor((y + r) / TILE);
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (tx < 0 || ty < 0 || tx >= map.cols || ty >= map.rows) return true;
        if (map.grid[ty][tx] === 1 &&
            Utils.circleRect(x, y, r, tx * TILE, ty * TILE, TILE, TILE)) return true;
      }
    }
    return false;
  }

  // Bresenham line-of-sight between two pixel points (for enemy awareness).
  function hasLOS(map, x1, y1, x2, y2) {
    let tx1 = Math.floor(x1 / TILE), ty1 = Math.floor(y1 / TILE);
    const tx2 = Math.floor(x2 / TILE), ty2 = Math.floor(y2 / TILE);
    let dx = Math.abs(tx2 - tx1), dy = Math.abs(ty2 - ty1);
    let sx = tx1 < tx2 ? 1 : -1, sy = ty1 < ty2 ? 1 : -1;
    let err = dx - dy, guard = 0;
    while (guard++ < 200) {
      if (map.grid[ty1] && map.grid[ty1][tx1] === 1) return false;
      if (tx1 === tx2 && ty1 === ty2) return true;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; tx1 += sx; }
      if (e2 < dx) { err += dx; ty1 += sy; }
    }
    return false;
  }

  // Breadth-first next-step toward a target tile. Lets swarms hunt the player
  // "around corners" by scent even when there's no direct line of sight.
  // Returns a unit-ish direction {x, y} in world space, or null if unreachable
  // / already there. Capped node count keeps it cheap on big maps.
  function nextStepToward(map, fromPx, fromPy, toPx, toPy, maxNodes = 600) {
    const sx = Math.floor(fromPx / TILE), sy = Math.floor(fromPy / TILE);
    const gx = Math.floor(toPx / TILE), gy = Math.floor(toPy / TILE);
    if (sx === gx && sy === gy) return null;
    const walk = (tx, ty) =>
      tx >= 0 && ty >= 0 && tx < map.cols && ty < map.rows && map.grid[ty][tx] !== 1;
    const key = (x, y) => y * map.cols + x;
    const came = new Map();
    const q = [[sx, sy]];
    came.set(key(sx, sy), null);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let head = 0, found = false, nodes = 0;
    while (head < q.length && nodes++ < maxNodes) {
      const [cx, cy] = q[head++];
      if (cx === gx && cy === gy) { found = true; break; }
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (walk(nx, ny) && !came.has(key(nx, ny))) {
          came.set(key(nx, ny), [cx, cy]);
          q.push([nx, ny]);
        }
      }
    }
    if (!found) return null;
    // Backtrack to the first tile after the start.
    let cur = [gx, gy], prev = came.get(key(gx, gy));
    while (prev && !(prev[0] === sx && prev[1] === sy)) {
      cur = prev; prev = came.get(key(cur[0], cur[1]));
    }
    // Aim at that tile's centre.
    const tcx = (cur[0] + 0.5) * TILE, tcy = (cur[1] + 0.5) * TILE;
    const a = Math.atan2(tcy - fromPy, tcx - fromPx);
    return { x: Math.cos(a), y: Math.sin(a) };
  }

  return { make, isWall, moveCircle, hasLOS, nextStepToward, WALL, FLOOR, EXIT };
})();
