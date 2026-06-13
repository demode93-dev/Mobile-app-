/* ============================================================
   BLACKOUT // Containment Breach
   Vanilla JS + HTML5 Canvas top-down survival-horror.

   Implements:
   - Tiered (1-3 star) victory system
   - Dynamic threat scaling: Zombies / Swarms / Mutants + Nemesis
   - Near-miss torch battery flicker (<20%)
   - "Juice": screen shake, red damage vignette, floaty pickup text
   - Cone-shaped line-of-sight flashlight lighting (pitch-black beyond)
   - Environmental storytelling via collectible PDA log files
   ============================================================ */
(() => {
  'use strict';

  // ---------- Constants ----------
  const TILE = 48;                  // logical tile size in world units
  const MAZE_W = 21;                // odd numbers required for maze gen
  const MAZE_H = 15;
  const KEYCARDS_NEEDED = 3;
  const SPEEDRUN_SEC = 90;          // 3-star time threshold
  const PLAYER_SPEED = 165;         // world units / sec
  const SPRINT_MULT = 1.85;
  const TORCH_DRAIN = 1.55;         // %/sec while lit
  const TORCH_LOW = 20;             // flicker threshold

  // ---------- Canvas setup ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  // Offscreen canvas used to build the darkness + flashlight mask.
  const lightCanvas = document.createElement('canvas');
  const lctx = lightCanvas.getContext('2d');

  let viewW = 0, viewH = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    viewW = window.innerWidth;
    viewH = window.innerHeight;
    canvas.width = viewW * dpr;
    canvas.height = viewH * dpr;
    lightCanvas.width = viewW * dpr;
    lightCanvas.height = viewH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- Lore (environmental storytelling) ----------
  const LORE_LOGS = [
    'Dr. Vance: Section 4 containment has breached. Lock down the sectors — now.',
    'Audio Log: They’re mutating… the flashlights startle them, but the batteries won’t hold.',
    'Security: Keycards are the only way through the blast doors. Find three. Don’t stop moving.',
    'Dr. Vance: The fast ones — the swarms — they track your scent around corners. Stay in the dark.',
    'Note: The big stationary ones block the halls. A hard sprint is the only way past them.',
    'FINAL LOG: Patient Zero is awake. It is not like the others. God help whoever is still down here.',
  ];

  // Persist recovered lore across runs (retention / collection meta).
  function getLoreCount() {
    return parseInt(localStorage.getItem('blackout_lore') || '0', 10) || 0;
  }
  function addLore(idx) {
    const mask = parseInt(localStorage.getItem('blackout_lore_mask') || '0', 10);
    const bit = 1 << idx;
    if (!(mask & bit)) {
      localStorage.setItem('blackout_lore_mask', String(mask | bit));
      const count = (mask | bit).toString(2).split('').filter(c => c === '1').length;
      localStorage.setItem('blackout_lore', String(count));
    }
    document.getElementById('lore-meter').textContent = getLoreCount();
  }

  // ============================================================
  //  MAZE GENERATION (recursive backtracker — guarantees solvable)
  // ============================================================
  function generateMaze(w, h) {
    // grid: 1 = wall, 0 = floor
    const grid = Array.from({ length: h }, () => new Array(w).fill(1));
    function carve(cx, cy) {
      grid[cy][cx] = 0;
      const dirs = [[0, -2], [0, 2], [-2, 0], [2, 0]];
      for (let i = dirs.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
      }
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1 && grid[ny][nx] === 1) {
          grid[cy + dy / 2][cx + dx / 2] = 0;
          carve(nx, ny);
        }
      }
    }
    carve(1, 1);
    // Knock out a few extra walls so it plays open (loops, escape routes).
    let extra = Math.floor(w * h * 0.04);
    while (extra > 0) {
      const x = 1 + ((Math.random() * (w - 2)) | 0);
      const y = 1 + ((Math.random() * (h - 2)) | 0);
      if (grid[y][x] === 1) { grid[y][x] = 0; extra--; }
    }
    return grid;
  }

  // ============================================================
  //  GAME STATE
  // ============================================================
  const game = {
    state: 'menu',          // menu | playing | victory | defeat
    grid: null,
    player: null,
    enemies: [],
    keycards: [],
    logs: [],
    exit: null,
    keysHeld: 0,
    elapsed: 0,
    torch: 100,
    shake: 0,
    damageFlash: 0,
    floaters: [],
    camX: 0, camY: 0,
    transmissionTimer: 0,
    spawnedNemesis: false,
  };

  function tileFree(tx, ty) {
    return game.grid[ty] && game.grid[ty][tx] === 0;
  }
  function isWallAt(wx, wy) {
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    return !tileFree(tx, ty);
  }
  function tileCenter(tx, ty) {
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  }

  // Collect all floor tiles, shuffled, for placing entities.
  function floorTiles() {
    const out = [];
    for (let y = 1; y < MAZE_H - 1; y++)
      for (let x = 1; x < MAZE_W - 1; x++)
        if (game.grid[y][x] === 0) out.push({ x, y });
    for (let i = out.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function dist2Tiles(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  // ---------- Level setup ----------
  function startLevel() {
    game.grid = generateMaze(MAZE_W, MAZE_H);
    game.enemies = [];
    game.keycards = [];
    game.logs = [];
    game.floaters = [];
    game.keysHeld = 0;
    game.elapsed = 0;
    game.torch = 100;
    game.shake = 0;
    game.damageFlash = 0;
    game.transmissionTimer = 0;
    game.spawnedNemesis = false;

    // Player starts top-left.
    const startC = tileCenter(1, 1);
    game.player = {
      x: startC.x, y: startC.y, r: TILE * 0.30,
      hp: 100, facing: 0, sprint: false, stamina: 100,
    };

    // Exit at far corner.
    game.exit = { tx: MAZE_W - 2, ty: MAZE_H - 2 };

    const tiles = floorTiles().filter(t =>
      // keep clear of spawn + exit
      dist2Tiles(t, { x: 1, y: 1 }) > 9 &&
      dist2Tiles(t, { x: game.exit.tx, y: game.exit.ty }) > 4
    );
    let ti = 0;
    const take = () => tiles[ti++];

    // Keycards
    for (let i = 0; i < KEYCARDS_NEEDED; i++) {
      const t = take();
      game.keycards.push({ ...tileCenter(t.x, t.y), got: false });
    }
    // Lore logs (PDA drops)
    for (let i = 0; i < LORE_LOGS.length; i++) {
      const t = take();
      game.logs.push({ ...tileCenter(t.x, t.y), idx: i, read: false });
    }
    // Enemies — dynamic threat mix
    spawnEnemy('zombie', take());
    spawnEnemy('zombie', take());
    spawnEnemy('zombie', take());
    spawnEnemy('swarm', take());
    spawnEnemy('swarm', take());
    spawnEnemy('mutant', take());
    spawnEnemy('mutant', take());

    document.getElementById('keycard-total').textContent = KEYCARDS_NEEDED;
    updateHUD();
  }

  function spawnEnemy(type, tile) {
    if (!tile) return;
    const c = tileCenter(tile.x, tile.y);
    const base = { x: c.x, y: c.y, type, alert: false, scent: 0, cooldown: 0 };
    if (type === 'zombie') Object.assign(base, { r: TILE * 0.32, speed: 58, dmg: 34, color: '#6fae6f' });
    if (type === 'swarm')  Object.assign(base, { r: TILE * 0.20, speed: 132, dmg: 9, color: '#d98cff' });
    if (type === 'mutant') Object.assign(base, { r: TILE * 0.40, speed: 0, dmg: 50, color: '#ff7a59' });
    if (type === 'nemesis') Object.assign(base, { r: TILE * 0.36, speed: 95, dmg: 60, color: '#ff2e2e' });
    game.enemies.push(base);
  }

  // ============================================================
  //  INPUT
  // ============================================================
  const input = { up: false, down: false, left: false, right: false, sprint: false };
  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  };
  window.addEventListener('keydown', (e) => {
    if (KEYMAP[e.code]) { input[KEYMAP[e.code]] = true; e.preventDefault(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sprint = true;
  });
  window.addEventListener('keyup', (e) => {
    if (KEYMAP[e.code]) input[KEYMAP[e.code]] = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sprint = false;
  });

  // Virtual joystick
  const joy = { active: false, dx: 0, dy: 0, id: null };
  const joystick = document.getElementById('joystick');
  const thumb = document.getElementById('joystick-thumb');
  const sprintBtn = document.getElementById('sprint-btn');

  function joyStart(e) {
    const t = e.changedTouches ? e.changedTouches[0] : e;
    joy.active = true;
    joy.id = t.identifier ?? 'mouse';
    joyMove(e);
    e.preventDefault();
  }
  function joyMove(e) {
    if (!joy.active) return;
    const touches = e.changedTouches ? Array.from(e.changedTouches) : [e];
    const t = touches.find(tc => (tc.identifier ?? 'mouse') === joy.id) || touches[0];
    const rect = joystick.getBoundingClientRect();
    let dx = t.clientX - (rect.left + rect.width / 2);
    let dy = t.clientY - (rect.top + rect.height / 2);
    const max = rect.width / 2;
    const len = Math.hypot(dx, dy) || 1;
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    joy.dx = dx / max;
    joy.dy = dy / max;
    thumb.style.transform = `translate(${dx}px, ${dy}px)`;
    e.preventDefault();
  }
  function joyEnd(e) {
    joy.active = false; joy.dx = 0; joy.dy = 0;
    thumb.style.transform = 'translate(0,0)';
  }
  joystick.addEventListener('touchstart', joyStart, { passive: false });
  joystick.addEventListener('touchmove', joyMove, { passive: false });
  joystick.addEventListener('touchend', joyEnd);
  joystick.addEventListener('touchcancel', joyEnd);

  sprintBtn.addEventListener('touchstart', (e) => { input.sprint = true; e.preventDefault(); }, { passive: false });
  sprintBtn.addEventListener('touchend', (e) => { input.sprint = false; e.preventDefault(); });

  // Show touch controls only on touch devices.
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.getElementById('touch-controls').classList.remove('hidden');
  }

  // ============================================================
  //  MOVEMENT + COLLISION
  // ============================================================
  function moveCircle(ent, dx, dy) {
    // Axis-separated collision so we slide along walls.
    if (dx !== 0) {
      const nx = ent.x + dx;
      const edge = nx + Math.sign(dx) * ent.r;
      if (!isWallAt(edge, ent.y - ent.r + 2) && !isWallAt(edge, ent.y + ent.r - 2)) ent.x = nx;
    }
    if (dy !== 0) {
      const ny = ent.y + dy;
      const edge = ny + Math.sign(dy) * ent.r;
      if (!isWallAt(ent.x - ent.r + 2, edge) && !isWallAt(ent.x + ent.r - 2, edge)) ent.y = ny;
    }
  }

  // BFS over the grid → next step direction toward target (for swarms / nemesis
  // "follow you around corners" behaviour).
  function bfsStep(fromTx, fromTy, toTx, toTy) {
    if (fromTx === toTx && fromTy === toTy) return null;
    const key = (x, y) => y * MAZE_W + x;
    const came = new Map();
    const q = [[fromTx, fromTy]];
    came.set(key(fromTx, fromTy), null);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let found = false;
    let head = 0;
    while (head < q.length) {
      const [cx, cy] = q[head++];
      if (cx === toTx && cy === toTy) { found = true; break; }
      for (const [dx, dy] of dirs) {
        const nx = cx + dx, ny = cy + dy;
        if (tileFree(nx, ny) && !came.has(key(nx, ny))) {
          came.set(key(nx, ny), [cx, cy]);
          q.push([nx, ny]);
        }
      }
    }
    if (!found) return null;
    // Walk back from target to the first step after origin.
    let cur = [toTx, toTy];
    let prev = came.get(key(cur[0], cur[1]));
    while (prev && !(prev[0] === fromTx && prev[1] === fromTy)) {
      cur = prev;
      prev = came.get(key(cur[0], cur[1]));
    }
    return { tx: cur[0], ty: cur[1] };
  }

  // ============================================================
  //  ENEMY AI — three distinct behaviours
  // ============================================================
  function updateEnemy(en, dt) {
    const p = game.player;
    const toP = Math.hypot(p.x - en.x, p.y - en.y);
    const enTx = Math.floor(en.x / TILE), enTy = Math.floor(en.y / TILE);
    const pTx = Math.floor(p.x / TILE), pTy = Math.floor(p.y / TILE);

    if (en.type === 'mutant') {
      // Stationary hazard. Pulses; only dangerous on contact unless player sprints.
      en.cooldown = (en.cooldown || 0) + dt;
      if (toP < en.r + p.r) {
        if (p.sprint) {
          // Sprint lets you zip past — small knock to torch as you slam through.
          // no damage
        } else {
          damagePlayer(en.dmg * dt * 2.0, 'mutant'); // continuous if you loiter
        }
      }
      return;
    }

    if (en.type === 'zombie') {
      // Slow, predictable: greedy step toward player when within sense range,
      // otherwise shuffles. High damage on touch.
      const sense = TILE * 4.2;
      if (toP < sense) {
        const ang = Math.atan2(p.y - en.y, p.x - en.x);
        moveCircle(en, Math.cos(ang) * en.speed * dt, Math.sin(ang) * en.speed * dt);
      } else {
        // idle drift
        en.wander = (en.wander || Math.random() * Math.PI * 2) + (Math.random() - 0.5) * dt;
        moveCircle(en, Math.cos(en.wander) * en.speed * 0.4 * dt, Math.sin(en.wander) * en.speed * 0.4 * dt);
      }
      if (toP < en.r + p.r) damagePlayer(en.dmg, 'zombie', true);
      return;
    }

    // SWARM + NEMESIS — scent tracking, path around corners via BFS.
    const inLight = isInFlashlight(en.x, en.y);
    const scentRange = TILE * 5.5;
    if (toP < scentRange || inLight) {
      en.scent = 2.2;               // remembers the player's scent
    } else {
      en.scent = Math.max(0, en.scent - dt);
    }
    if (en.scent > 0) {
      const step = bfsStep(enTx, enTy, pTx, pTy);
      let ang;
      if (step && (step.tx !== enTx || step.ty !== enTy)) {
        const c = tileCenter(step.tx, step.ty);
        ang = Math.atan2(c.y - en.y, c.x - en.x);
      } else {
        ang = Math.atan2(p.y - en.y, p.x - en.x); // in same tile — beeline
      }
      moveCircle(en, Math.cos(ang) * en.speed * dt, Math.sin(ang) * en.speed * dt);
    }
    if (toP < en.r + p.r) {
      damagePlayer(en.dmg * (en.type === 'nemesis' ? 1 : dt * 3.2),
        en.type, en.type === 'nemesis');
    }
  }

  // ============================================================
  //  FLASHLIGHT / LINE-OF-SIGHT
  // ============================================================
  const CONE_LEN = TILE * 5.4;
  const CONE_HALF = 0.52;           // radians half-angle

  function torchActive() { return game.torch > 0; }

  function isInFlashlight(wx, wy) {
    if (!torchActive()) return false;
    const p = game.player;
    const dx = wx - p.x, dy = wy - p.y;
    const d = Math.hypot(dx, dy);
    if (d < TILE * 0.9) return true;          // small ambient bubble around player
    if (d > CONE_LEN) return false;
    let a = Math.atan2(dy, dx) - p.facing;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return Math.abs(a) < CONE_HALF;
  }

  // ============================================================
  //  DAMAGE / JUICE
  // ============================================================
  let invuln = 0;
  function damagePlayer(amount, source, burst) {
    if (game.state !== 'playing') return;
    if (burst && invuln > 0) return;
    if (burst) invuln = 0.6;
    game.player.hp -= amount;
    game.shake = Math.min(18, game.shake + (burst ? 12 : amount * 0.4));
    game.damageFlash = Math.min(1, game.damageFlash + (burst ? 0.7 : amount * 0.05));
    if (game.player.hp <= 0) {
      game.player.hp = 0;
      defeat(source);
    }
  }

  function addFloater(x, y, text, color) {
    game.floaters.push({ x, y, text, color, life: 1.2, vy: -34 });
  }

  function showTransmission(text) {
    const el = document.getElementById('transmission');
    document.getElementById('transmission-text').textContent = text;
    el.classList.remove('hidden');
    game.transmissionTimer = 4.5;
  }

  function showNemesis(text) {
    const el = document.getElementById('nemesis-banner');
    document.getElementById('nemesis-text').textContent = text;
    el.classList.remove('hidden');
    // restart CSS animation
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    setTimeout(() => el.classList.add('hidden'), 2600);
  }

  // ============================================================
  //  UPDATE LOOP
  // ============================================================
  function update(dt) {
    if (game.state !== 'playing') return;
    const p = game.player;
    game.elapsed += dt;

    // ----- Player movement -----
    let mx = 0, my = 0;
    if (input.up) my -= 1;
    if (input.down) my += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    if (joy.active) { mx += joy.dx; my += joy.dy; }
    const mlen = Math.hypot(mx, my);

    p.sprint = input.sprint && p.stamina > 1 && mlen > 0.1;
    if (p.sprint) {
      p.stamina = Math.max(0, p.stamina - 38 * dt);
    } else {
      p.stamina = Math.min(100, p.stamina + 18 * dt);
    }
    const speed = PLAYER_SPEED * (p.sprint ? SPRINT_MULT : 1);

    if (mlen > 0.1) {
      const nx = mx / mlen, ny = my / mlen;
      p.facing = Math.atan2(ny, nx);
      moveCircle(p, nx * speed * dt, ny * speed * dt);
    }

    // ----- Torch drain + near-miss flicker -----
    if (game.torch > 0) {
      game.torch = Math.max(0, game.torch - TORCH_DRAIN * dt);
    }

    // ----- Invuln timer -----
    if (invuln > 0) invuln -= dt;

    // ----- Enemies -----
    for (const en of game.enemies) updateEnemy(en, dt);

    // ----- Nemesis tease: appears once half the keycards are found -----
    if (!game.spawnedNemesis && game.keysHeld >= 2) {
      game.spawnedNemesis = true;
      // spawn far from player
      const tiles = floorTiles().filter(t =>
        dist2Tiles(t, { x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) }) > 40);
      spawnEnemy('nemesis', tiles[0] || { x: game.exit.tx, y: game.exit.ty });
      showNemesis('PATIENT ZERO IS AWAKE');
    }

    // ----- Keycard pickup -----
    for (const k of game.keycards) {
      if (!k.got && Math.hypot(k.x - p.x, k.y - p.y) < p.r + 14) {
        k.got = true;
        game.keysHeld++;
        addFloater(p.x, p.y - 18, '+1 KEYCARD', '#ffcf5c');
        const chip = document.getElementById('keycard-chip');
        chip.classList.remove('flash'); void chip.offsetWidth; chip.classList.add('flash');
        game.shake = Math.min(game.shake + 4, 18);
      }
    }

    // ----- Lore log pickup -----
    for (const l of game.logs) {
      if (!l.read && Math.hypot(l.x - p.x, l.y - p.y) < p.r + 16) {
        l.read = true;
        addLore(l.idx);
        showTransmission(LORE_LOGS[l.idx]);
        addFloater(p.x, p.y - 18, 'LOG RECOVERED', '#39ff8b');
      }
    }

    // ----- Exit / win condition -----
    const exC = tileCenter(game.exit.tx, game.exit.ty);
    if (Math.hypot(exC.x - p.x, exC.y - p.y) < p.r + 16) {
      if (game.keysHeld >= KEYCARDS_NEEDED) {
        victory();
      } else if (!game.exitHintShown) {
        game.exitHintShown = true;
        addFloater(p.x, p.y - 18,
          `NEED ${KEYCARDS_NEEDED - game.keysHeld} MORE`, '#ff3b54');
      }
    } else {
      game.exitHintShown = false;
    }

    // ----- Floaters / fx decay -----
    for (const f of game.floaters) { f.y += f.vy * dt; f.life -= dt; }
    game.floaters = game.floaters.filter(f => f.life > 0);
    game.shake *= Math.pow(0.0015, dt);
    if (game.shake < 0.15) game.shake = 0;
    game.damageFlash = Math.max(0, game.damageFlash - dt * 1.6);

    if (game.transmissionTimer > 0) {
      game.transmissionTimer -= dt;
      if (game.transmissionTimer <= 0) {
        document.getElementById('transmission').classList.add('hidden');
      }
    }

    // ----- Camera follows player (clamped) -----
    const worldW = MAZE_W * TILE, worldH = MAZE_H * TILE;
    game.camX = clamp(p.x - viewW / 2, 0, Math.max(0, worldW - viewW));
    game.camY = clamp(p.y - viewH / 2, 0, Math.max(0, worldH - viewH));

    updateHUD();
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // ============================================================
  //  RENDER
  // ============================================================
  function render(time) {
    ctx.clearRect(0, 0, viewW, viewH);
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, viewW, viewH);
    if (game.state !== 'playing') return;

    // Screen shake offset.
    let sx = 0, sy = 0;
    if (game.shake > 0) {
      sx = (Math.random() - 0.5) * game.shake;
      sy = (Math.random() - 0.5) * game.shake;
    }
    const ox = -game.camX + sx, oy = -game.camY + sy;

    ctx.save();
    ctx.translate(ox, oy);

    drawWorld(time);

    ctx.restore();

    // ----- Lighting overlay (cone-shaped LoS flashlight) -----
    drawLighting(ox, oy, time);

    // ----- Floaty pickup text (drawn above darkness) -----
    ctx.save();
    ctx.translate(ox, oy);
    for (const f of game.floaters) {
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.fillStyle = f.color;
      ctx.font = '700 16px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = f.color; ctx.shadowBlur = 10;
      ctx.fillText(f.text, f.x, f.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // ----- Red damage vignette flash -----
    if (game.damageFlash > 0) {
      const g = ctx.createRadialGradient(
        viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.3,
        viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.7);
      g.addColorStop(0, 'rgba(255,0,30,0)');
      g.addColorStop(1, `rgba(255,0,30,${game.damageFlash * 0.7})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, viewW, viewH);
    }
  }

  function drawWorld(time) {
    const grid = game.grid;
    // Only draw tiles in view for performance.
    const minTx = Math.max(0, Math.floor(game.camX / TILE) - 1);
    const maxTx = Math.min(MAZE_W - 1, Math.ceil((game.camX + viewW) / TILE));
    const minTy = Math.max(0, Math.floor(game.camY / TILE) - 1);
    const maxTy = Math.min(MAZE_H - 1, Math.ceil((game.camY + viewH) / TILE));

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const x = tx * TILE, y = ty * TILE;
        if (grid[ty][tx] === 1) {
          ctx.fillStyle = '#11202b';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#1b3340';
          ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
          ctx.strokeStyle = 'rgba(54,209,255,0.06)';
          ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
        } else {
          ctx.fillStyle = '#0a1016';
          ctx.fillRect(x, y, TILE, TILE);
          // subtle grid floor
          ctx.strokeStyle = 'rgba(54,209,255,0.04)';
          ctx.strokeRect(x, y, TILE, TILE);
        }
      }
    }

    // Exit door
    const ex = tileCenter(game.exit.tx, game.exit.ty);
    const ready = game.keysHeld >= KEYCARDS_NEEDED;
    const pulse = 0.5 + 0.5 * Math.sin(time * 0.005);
    ctx.fillStyle = ready ? `rgba(57,255,139,${0.45 + pulse * 0.4})` : 'rgba(255,59,84,0.4)';
    ctx.shadowColor = ready ? '#39ff8b' : '#ff3b54';
    ctx.shadowBlur = 24 * pulse + 8;
    ctx.fillRect(ex.x - TILE * 0.32, ex.y - TILE * 0.4, TILE * 0.64, TILE * 0.8);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#04121a';
    ctx.font = '700 10px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText('EXIT', ex.x, ex.y + 3);

    // Keycards
    for (const k of game.keycards) {
      if (k.got) continue;
      const bob = Math.sin(time * 0.006 + k.x) * 3;
      ctx.save();
      ctx.translate(k.x, k.y + bob);
      ctx.shadowColor = '#ffcf5c'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#ffcf5c';
      ctx.fillRect(-7, -5, 14, 10);
      ctx.fillStyle = '#04121a';
      ctx.fillRect(3, -2, 3, 4);
      ctx.restore();
    }
    ctx.shadowBlur = 0;

    // Lore logs (PDA nodes)
    for (const l of game.logs) {
      if (l.read) continue;
      const pulse2 = 0.5 + 0.5 * Math.sin(time * 0.004 + l.idx);
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.shadowColor = '#39ff8b'; ctx.shadowBlur = 10 + pulse2 * 14;
      ctx.fillStyle = `rgba(57,255,139,${0.5 + pulse2 * 0.5})`;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur = 0;

    // Enemies (only meaningfully visible inside the light, but draw always —
    // darkness overlay hides those outside the cone).
    for (const en of game.enemies) drawEnemy(en, time);

    // Player
    drawPlayer(time);
  }

  function drawEnemy(en, time) {
    ctx.save();
    ctx.translate(en.x, en.y);
    if (en.type === 'mutant') {
      // bulky stationary hazard
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.004);
      ctx.shadowColor = en.color; ctx.shadowBlur = 14 + pulse * 10;
      ctx.fillStyle = en.color;
      ctx.beginPath();
      const spikes = 7, R = en.r;
      for (let i = 0; i < spikes * 2; i++) {
        const a = (i / (spikes * 2)) * Math.PI * 2;
        const r = i % 2 === 0 ? R : R * 0.6;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
    } else if (en.type === 'swarm') {
      ctx.shadowColor = en.color; ctx.shadowBlur = 10;
      ctx.fillStyle = en.color;
      ctx.beginPath(); ctx.arc(0, 0, en.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a0a25';
      ctx.fillRect(-3, -2, 2, 2); ctx.fillRect(1, -2, 2, 2);
    } else {
      // zombie / nemesis
      ctx.shadowColor = en.color;
      ctx.shadowBlur = en.type === 'nemesis' ? 22 : 8;
      ctx.fillStyle = en.color;
      ctx.beginPath(); ctx.arc(0, 0, en.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = en.type === 'nemesis' ? '#ffd1d1' : '#0a160a';
      ctx.fillRect(-4, -3, 3, 3); ctx.fillRect(2, -3, 3, 3);
      if (en.type === 'nemesis') {
        ctx.strokeStyle = 'rgba(255,46,46,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, en.r + 4 + Math.sin(time*0.01)*2, 0, Math.PI*2); ctx.stroke();
      }
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  function drawPlayer(time) {
    const p = game.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.facing);
    // body
    ctx.shadowColor = '#36d1ff'; ctx.shadowBlur = 10;
    ctx.fillStyle = p.sprint ? '#b78bff' : '#cdeaff';
    ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
    // facing indicator
    ctx.fillStyle = '#04121a';
    ctx.fillRect(p.r * 0.3, -3, p.r * 0.7, 6);
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  // ----- Lighting: build darkness then punch out the flashlight cone -----
  function drawLighting(ox, oy, time) {
    const p = game.player;
    const px = p.x + ox, py = p.y + oy;

    // Near-miss flicker: torch unstable below threshold.
    let intensity = 1;
    let dark = 0.985;
    if (game.torch <= 0) {
      dark = 0.985; intensity = 0;          // torch dead — only faint ambient
    } else if (game.torch < TORCH_LOW) {
      // flickering chaos near death
      const flick = Math.sin(time * 0.05) * Math.sin(time * 0.017);
      intensity = 0.55 + 0.45 * Math.max(0, flick) - (Math.random() < 0.12 ? 0.5 : 0);
      intensity = clamp(intensity, 0.08, 1);
    }

    lctx.clearRect(0, 0, viewW, viewH);
    lctx.fillStyle = `rgba(2,4,7,${dark})`;
    lctx.fillRect(0, 0, viewW, viewH);

    lctx.globalCompositeOperation = 'destination-out';

    // Ambient bubble around player (always, even with dead torch).
    const amb = lctx.createRadialGradient(px, py, 4, px, py, TILE * 1.5);
    amb.addColorStop(0, 'rgba(255,255,255,0.9)');
    amb.addColorStop(1, 'rgba(255,255,255,0)');
    lctx.fillStyle = amb;
    lctx.beginPath(); lctx.arc(px, py, TILE * 1.5, 0, Math.PI * 2); lctx.fill();

    // Flashlight cone.
    if (intensity > 0.05) {
      lctx.save();
      lctx.translate(px, py);
      lctx.rotate(p.facing);
      const len = CONE_LEN * (0.85 + intensity * 0.15);
      const grad = lctx.createRadialGradient(0, 0, 8, 0, 0, len);
      grad.addColorStop(0, `rgba(255,255,255,${0.95 * intensity})`);
      grad.addColorStop(0.6, `rgba(255,255,255,${0.6 * intensity})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      lctx.fillStyle = grad;
      lctx.beginPath();
      lctx.moveTo(0, 0);
      lctx.arc(0, 0, len, -CONE_HALF, CONE_HALF);
      lctx.closePath();
      lctx.fill();
      lctx.restore();
    }

    lctx.globalCompositeOperation = 'source-over';

    // Warm tint inside the beam for a "real flashlight" feel.
    if (intensity > 0.05) {
      lctx.save();
      lctx.globalCompositeOperation = 'lighter';
      lctx.translate(px, py);
      lctx.rotate(p.facing);
      const len = CONE_LEN;
      const tint = lctx.createRadialGradient(0, 0, 8, 0, 0, len);
      tint.addColorStop(0, `rgba(120,180,255,${0.10 * intensity})`);
      tint.addColorStop(1, 'rgba(120,180,255,0)');
      lctx.fillStyle = tint;
      lctx.beginPath();
      lctx.moveTo(0, 0);
      lctx.arc(0, 0, len, -CONE_HALF, CONE_HALF);
      lctx.closePath(); lctx.fill();
      lctx.restore();
    }

    // Blit lighting onto main canvas.
    ctx.drawImage(lightCanvas, 0, 0, lightCanvas.width, lightCanvas.height, 0, 0, viewW, viewH);
  }

  // ============================================================
  //  HUD
  // ============================================================
  function updateHUD() {
    const p = game.player;
    document.getElementById('vitals-fill').style.width = Math.max(0, p.hp) + '%';
    document.getElementById('torch-fill').style.width = Math.max(0, game.torch) + '%';
    document.getElementById('stamina-fill').style.width = Math.max(0, p.stamina) + '%';
    document.getElementById('keycard-count').textContent = game.keysHeld;
    document.getElementById('timer').textContent = game.elapsed.toFixed(1) + 's';
    document.getElementById('torch-fill').parentElement
      .classList.toggle('low', game.torch < TORCH_LOW);
  }

  // ============================================================
  //  WIN / LOSE — Tiered star rating
  // ============================================================
  function victory() {
    game.state = 'victory';
    const stars = computeStars();
    const breakdown = document.getElementById('score-breakdown');
    breakdown.innerHTML = '';
    const rows = [
      { label: 'Escaped alive', ok: true },
      { label: 'Torch > 50% remaining', ok: game.torch > 50, detail: `${game.torch.toFixed(0)}%` },
      { label: `Escaped under ${SPEEDRUN_SEC}s`, ok: game.elapsed < SPEEDRUN_SEC, detail: `${game.elapsed.toFixed(1)}s` },
    ];
    for (const r of rows) {
      const li = document.createElement('li');
      li.innerHTML = `<span>${r.label}${r.detail ? ` (${r.detail})` : ''}</span>` +
        `<span class="${r.ok ? 'ok' : 'no'}">${r.ok ? '✓' : '✗'}</span>`;
      breakdown.appendChild(li);
    }
    // Save best star rating.
    const best = Math.max(stars, parseInt(localStorage.getItem('blackout_best') || '0', 10));
    localStorage.setItem('blackout_best', String(best));

    const starEls = document.querySelectorAll('#stars .star');
    starEls.forEach(el => el.classList.remove('earned'));
    showScreen('victory');
    // animate stars in sequence
    starEls.forEach((el, i) => {
      setTimeout(() => { if (i < stars) el.classList.add('earned'); }, 300 + i * 320);
    });
  }

  function computeStars() {
    let s = 1;                                   // 1★ escaped alive
    if (game.torch > 50) s++;                    // 2★ torch > 50%
    if (game.elapsed < SPEEDRUN_SEC) s++;        // 3★ speedrun
    return s;
  }

  const DEFEAT_TEXT = {
    zombie: 'A specimen got its hands on you. The corridors fall silent.',
    swarm: 'The swarm caught your scent and overwhelmed you in the dark.',
    mutant: 'You lingered too close to the hazard. It tore through you.',
    nemesis: 'Patient Zero found you first. It always does.',
  };
  function defeat(source) {
    game.state = 'defeat';
    document.getElementById('defeat-title').textContent =
      source === 'nemesis' ? 'PATIENT ZERO WINS' : 'CONSUMED';
    document.getElementById('defeat-text').textContent =
      DEFEAT_TEXT[source] || 'The facility claimed another.';
    showScreen('defeat');
  }

  // ============================================================
  //  SCREEN MANAGEMENT
  // ============================================================
  function showScreen(name) {
    for (const id of ['menu', 'victory', 'defeat']) {
      document.getElementById(id).classList.toggle('hidden', id !== name);
    }
    document.getElementById('hud').classList.toggle('hidden', name !== null && name !== 'playing');
  }

  function beginGame() {
    startLevel();
    game.state = 'playing';
    for (const id of ['menu', 'victory', 'defeat']) document.getElementById(id).classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
  }

  // Buttons
  document.getElementById('play-btn').addEventListener('click', beginGame);
  document.getElementById('replay-btn').addEventListener('click', beginGame);
  document.getElementById('retry-btn').addEventListener('click', beginGame);
  document.getElementById('menu-btn').addEventListener('click', () => { game.state = 'menu'; showScreen('menu'); });
  document.getElementById('defeat-menu-btn').addEventListener('click', () => { game.state = 'menu'; showScreen('menu'); });

  document.getElementById('lore-meter').textContent = getLoreCount();

  // ============================================================
  //  MAIN LOOP
  // ============================================================
  let last = performance.now();
  function loop(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;        // clamp big frame gaps
    update(dt);
    render(now);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
