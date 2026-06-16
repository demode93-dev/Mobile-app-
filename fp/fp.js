/* ============================================================
   LAB ESCAPE — First-Person (raycaster, no libraries).
   Textured DDA walls + drawn billboard creatures/props, ceiling-lamp
   lighting w/ flicker, head-bob, weapon viewmodel, layered audio.
   ============================================================ */
(() => {
  "use strict";

  const canvas = document.getElementById("view");
  const ctx = canvas.getContext("2d");
  const buf = document.createElement("canvas");
  const bctx = buf.getContext("2d");
  let BW = 0, BH = 0, viewW = 0, viewH = 0;

  function resize() {
    viewW = window.innerWidth; viewH = window.innerHeight;
    canvas.width = viewW; canvas.height = viewH;
    BW = Math.min(560, viewW);
    BH = Math.round(BW * (viewH / viewW));
    buf.width = BW; buf.height = BH;
  }
  window.addEventListener("resize", resize);
  resize();

  const el = (id) => document.getElementById(id);
  const zbuf = new Float32Array(4096);
  const TEX = {};                                  // procedural textures

  // ---------- Game state ----------
  const G = {
    state: "menu", floor: 1,
    map: null, cols: 0, rows: 0,
    posX: 1.5, posY: 1.5, dirX: 1, dirY: 0, planeX: 0, planeY: 0.8,
    vx: 0, vy: 0,                                  // smoothed movement velocity
    hp: 140, maxHp: 140, stamina: 100,
    evidence: 0, exit: null,                        // 3 hard drives → unlock exit
    h1: 0, h2: 0,                                   // zone row boundaries
    enemies: [], items: [], lamps: [], props: [],
    invuln: 0, swing: 0, swingCd: 0,
    hurt: 0, msgT: 0, shake: 0, hitMark: 0,
    bobPhase: 0, bobAmt: 0, pitch: 0,
    creatureT: 2, ambientT: 3,
  };

  // ============================================================
  //  PROCEDURAL TEXTURES
  // ============================================================
  function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }

  function buildWall(variant) {
    const c = mkCanvas(64, 64), x = c.getContext("2d");
    const grd = x.createLinearGradient(0, 0, 0, 64);
    grd.addColorStop(0, "#2a3d54"); grd.addColorStop(0.5, "#1d2c3e"); grd.addColorStop(1, "#13202d");
    x.fillStyle = grd; x.fillRect(0, 0, 64, 64);
    x.strokeStyle = "rgba(0,0,0,0.55)"; x.lineWidth = 2;
    x.strokeRect(1, 1, 62, 62); x.beginPath(); x.moveTo(32, 1); x.lineTo(32, 63); x.stroke();
    x.fillStyle = "rgba(190,210,230,0.35)";
    for (const p of [[7, 7], [57, 7], [7, 57], [57, 57], [25, 32], [39, 32]]) { x.beginPath(); x.arc(p[0], p[1], 1.7, 0, 7); x.fill(); }
    if (variant) { x.strokeStyle = "rgba(120,150,180,0.45)"; x.lineWidth = 5; x.beginPath(); x.moveTo(48, 0); x.lineTo(48, 64); x.stroke(); x.strokeStyle = "rgba(0,0,0,0.3)"; x.lineWidth = 1; x.beginPath(); x.moveTo(48, 0); x.lineTo(48, 64); x.stroke(); }
    else { x.fillStyle = "rgba(255,200,0,0.13)"; x.fillRect(0, 45, 64, 6); x.fillStyle = "rgba(0,0,0,0.25)"; for (let i = 0; i < 8; i++) x.fillRect(4 + i * 8, 45, 4, 6); }
    x.fillStyle = "rgba(0,0,0,0.16)"; for (let i = 0; i < 12; i++) x.fillRect(Math.random() * 64, Math.random() * 64, Math.random() * 7, Math.random() * 3);
    return c;
  }

  function buildZombie() {
    const c = mkCanvas(80, 120), x = c.getContext("2d");
    x.fillStyle = "#244a20"; x.fillRect(28, 92, 10, 28); x.fillRect(44, 92, 10, 28);     // legs
    x.fillStyle = "#4f9f33"; x.fillRect(12, 58, 13, 44); x.fillRect(55, 58, 13, 44);     // reaching arms
    x.fillStyle = "#9be86a"; x.fillRect(10, 96, 16, 8); x.fillRect(54, 96, 16, 8);       // pale hands
    x.fillStyle = "#5fbf3f"; x.beginPath(); x.ellipse(40, 72, 23, 27, 0, 0, 7); x.fill(); // torso
    x.fillStyle = "#3f6b2f"; x.beginPath(); x.arc(30, 80, 8, 0, 7); x.fill(); x.beginPath(); x.arc(50, 64, 6, 0, 7); x.fill();
    x.fillStyle = "#6fcf4a"; x.beginPath(); x.arc(40, 40, 16, 0, 7); x.fill();           // head
    x.fillStyle = "#ff1f3d"; x.shadowColor = "#ff1f3d"; x.shadowBlur = 8;
    x.beginPath(); x.arc(34, 38, 3.2, 0, 7); x.arc(46, 38, 3.2, 0, 7); x.fill(); x.shadowBlur = 0;
    x.strokeStyle = "#140000"; x.lineWidth = 2; x.beginPath(); x.moveTo(33, 49); x.lineTo(38, 47); x.lineTo(43, 50); x.lineTo(47, 48); x.stroke();
    return c;
  }
  function buildInsect() {
    const c = mkCanvas(80, 120), x = c.getContext("2d");
    x.strokeStyle = "#2a1500"; x.lineWidth = 3; x.lineCap = "round";
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(40, 72); x.lineTo(40 + s * (26 + i * 4), 60 + i * 18); x.stroke(); }
    x.fillStyle = "#ff7a00"; x.beginPath(); x.ellipse(40, 76, 19, 24, 0, 0, 7); x.fill();   // abdomen
    x.fillStyle = "#b85600"; x.beginPath(); x.ellipse(40, 52, 14, 13, 0, 0, 7); x.fill();    // thorax/head
    x.strokeStyle = "#7a3a00"; x.lineWidth = 2; x.beginPath(); x.moveTo(34, 44); x.lineTo(28, 32); x.moveTo(46, 44); x.lineTo(52, 32); x.stroke();
    x.fillStyle = "#ffe600"; x.shadowColor = "#ffe600"; x.shadowBlur = 6;
    x.beginPath(); x.arc(35, 50, 2.6, 0, 7); x.arc(45, 50, 2.6, 0, 7); x.fill(); x.shadowBlur = 0;
    return c;
  }
  function buildMonster() {
    const c = mkCanvas(96, 128), x = c.getContext("2d");
    x.fillStyle = "#7a0010"; x.fillRect(10, 56, 18, 50); x.fillRect(68, 56, 18, 50);        // arms
    x.fillStyle = "#5a0c12"; x.fillRect(34, 96, 12, 30); x.fillRect(50, 96, 12, 30);        // legs
    x.fillStyle = "#b3122a"; x.beginPath(); x.ellipse(48, 74, 30, 34, 0, 0, 7); x.fill();   // body
    x.fillStyle = "#d11f3d"; x.beginPath(); x.arc(48, 38, 22, 0, 7); x.fill();              // head
    x.fillStyle = "#3a0008"; x.beginPath(); x.moveTo(30, 24); x.lineTo(22, 4); x.lineTo(38, 20); x.fill(); x.beginPath(); x.moveTo(66, 24); x.lineTo(74, 4); x.lineTo(58, 20); x.fill(); // horns
    x.fillStyle = "#ffd000"; x.shadowColor = "#ffd000"; x.shadowBlur = 10;
    x.beginPath(); x.arc(40, 36, 4, 0, 7); x.arc(56, 36, 4, 0, 7); x.fill(); x.shadowBlur = 0;
    x.fillStyle = "#160000"; x.beginPath(); x.ellipse(48, 50, 12, 7, 0, 0, 7); x.fill();    // maw
    x.fillStyle = "#fff"; for (let i = -2; i <= 2; i++) { x.beginPath(); x.moveTo(48 + i * 4, 46); x.lineTo(48 + i * 4 + 2, 54); x.lineTo(48 + i * 4 - 2, 54); x.fill(); }
    return c;
  }
  function buildBarrel() {
    const c = mkCanvas(48, 64), x = c.getContext("2d");
    x.fillStyle = "#c79a16"; x.fillRect(8, 8, 32, 54);
    x.fillStyle = "#9c7a10"; x.fillRect(8, 8, 4, 54); x.fillRect(36, 8, 4, 54);
    x.fillStyle = "#1a1a1a"; x.fillRect(8, 22, 32, 6); x.fillRect(8, 42, 32, 6);
    x.fillStyle = "#111"; x.font = "bold 18px sans-serif"; x.textAlign = "center"; x.fillText("☢", 24, 40);
    return c;
  }
  function buildTerminal() {
    const c = mkCanvas(48, 64), x = c.getContext("2d");
    x.fillStyle = "#2b2f3a"; x.fillRect(6, 6, 36, 26); x.fillStyle = "#0a3a2a"; x.fillRect(9, 9, 30, 20);
    x.fillStyle = "#39ff8b"; x.font = "8px monospace"; x.fillText(">_RUN", 11, 18); x.fillText("ALERT", 11, 27);
    x.fillStyle = "#3a3f4a"; x.fillRect(20, 32, 8, 18); x.fillRect(10, 50, 28, 6);
    return c;
  }
  function buildCrate() {
    const c = mkCanvas(48, 48), x = c.getContext("2d");
    x.fillStyle = "#3a4250"; x.fillRect(4, 4, 40, 40); x.strokeStyle = "#222"; x.lineWidth = 3; x.strokeRect(4, 4, 40, 40);
    x.beginPath(); x.moveTo(4, 4); x.lineTo(44, 44); x.moveTo(44, 4); x.lineTo(4, 44); x.stroke();
    x.fillStyle = "rgba(255,200,0,0.5)"; x.fillRect(4, 21, 40, 6);
    return c;
  }
  function buildKey() {
    const c = mkCanvas(40, 40), x = c.getContext("2d");
    x.shadowColor = "#7CFF00"; x.shadowBlur = 10; x.fillStyle = "#7CFF00"; x.fillRect(8, 14, 24, 12);
    x.fillStyle = "#0c1218"; x.fillRect(12, 17, 8, 6); x.fillRect(24, 18, 4, 2);
    return c;
  }
  function buildDrive() {
    // encrypted hard drive — the Phase-1 evidence pickup
    const c = mkCanvas(44, 34), x = c.getContext("2d");
    x.fillStyle = "#10151f"; x.fillRect(4, 5, 36, 24);
    x.strokeStyle = "#3a4658"; x.lineWidth = 2; x.strokeRect(4, 5, 36, 24);
    x.fillStyle = "#5a6678"; x.fillRect(8, 10, 20, 2); x.fillRect(8, 14, 16, 2); x.fillRect(8, 18, 22, 2);
    x.shadowColor = "#39ff8b"; x.shadowBlur = 9; x.fillStyle = "#39ff8b";
    x.fillRect(32, 10, 4, 4);                          // status LED
    x.shadowBlur = 0; x.fillStyle = "#1b6b46"; x.fillRect(8, 23, 28, 3);
    return c;
  }
  function buildDoor() {
    const c = mkCanvas(64, 96), x = c.getContext("2d");
    x.shadowColor = "#7CFF00"; x.shadowBlur = 16; x.fillStyle = "rgba(124,255,0,0.5)"; x.fillRect(6, 4, 52, 92);
    x.shadowBlur = 0; x.fillStyle = "#02110a"; x.fillRect(14, 12, 36, 84);
    x.fillStyle = "#7CFF00"; x.font = "bold 12px sans-serif"; x.textAlign = "center"; x.fillText("EXIT", 32, 54);
    return c;
  }

  function buildTextures() {
    TEX.wall0 = buildWall(0); TEX.wall1 = buildWall(1);
    TEX.zombie = buildZombie(); TEX.insect = buildInsect(); TEX.monster = buildMonster();
    TEX.barrel = buildBarrel(); TEX.terminal = buildTerminal(); TEX.crate = buildCrate();
    TEX.key = buildKey(); TEX.door = buildDoor(); TEX.drive = buildDrive();
  }
  buildTextures();

  // Which zone a tile row belongs to (1 Admin · 2 Specimen Labs · 3 Sub-Basement)
  function zoneOf(ty) { return ty < G.h1 ? 1 : ty < G.h2 ? 2 : 3; }

  // ============================================================
  //  MAP GENERATION
  // ============================================================
  function gen(floor) {
    // Tall facility split into 3 stacked zones joined by single bottleneck
    // corridors:  Zone 1 Admin (top) → Zone 2 Specimen Labs → Zone 3 Sub-Basement.
    const cols = Math.min(30, 20 + floor);
    const rows = Math.min(54, 34 + floor * 2);
    const m = [];
    for (let y = 0; y < rows; y++) m.push(new Array(cols).fill(1));
    const h1 = Math.floor(rows * 0.34), h2 = Math.floor(rows * 0.67);
    G.h1 = h1; G.h2 = h2; G.map = m; G.cols = cols; G.rows = rows;

    const cH = (x1, x2, y) => { for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) if (m[y]) m[y][x] = 0; };
    const cV = (y1, y2, x) => { for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) if (m[y]) m[y][x] = 0; };

    // carve `want` rooms inside a row band [r0,r1) and chain-connect them
    function roomsIn(r0, r1, want) {
      const rooms = [];
      let tries = 0;
      while (rooms.length < want && tries++ < want * 10) {
        const rw = 3 + (Math.random() * 4 | 0), rh = 3 + (Math.random() * 3 | 0);
        if (r1 - r0 < rh + 2) break;
        const rx = 1 + (Math.random() * (cols - rw - 2) | 0);
        const ry = r0 + 1 + (Math.random() * ((r1 - r0) - rh - 1) | 0);
        for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) m[y][x] = 0;
        rooms.push({ cx: rx + (rw >> 1), cy: ry + (rh >> 1) });
      }
      if (!rooms.length) { const cy = (r0 + r1) >> 1, cx = cols >> 1; m[cy][cx] = 0; rooms.push({ cx, cy }); }
      for (let i = 1; i < rooms.length; i++) { cH(rooms[i - 1].cx, rooms[i].cx, rooms[i - 1].cy); cV(rooms[i - 1].cy, rooms[i].cy, rooms[i].cx); }
      return rooms;
    }
    const z1 = roomsIn(1, h1, 4), z2 = roomsIn(h1 + 1, h2, 4), z3 = roomsIn(h2 + 1, rows - 1, 5);

    // bottleneck corridors between zones (L-shaped, crossing the wall band)
    const link = (a, b) => { cV(a.cy, b.cy, a.cx); cH(a.cx, b.cx, b.cy); };
    link(z1[z1.length - 1], z2[0]);
    link(z2[z2.length - 1], z3[0]);

    // spawn in Zone 1; exit deep in Zone 3
    G.posX = z1[0].cx + 0.5; G.posY = z1[0].cy + 0.5;
    G.dirX = 0; G.dirY = 1; G.planeX = -0.8; G.planeY = 0; G.vx = 0; G.vy = 0;   // face into the facility
    let far = z3[0], best = -1;
    for (const r of z3) { const d = Math.hypot(r.cx - z3[0].cx, r.cy - z3[0].cy); if (d > best) { best = d; far = r; } }
    G.exit = { x: far.cx + 0.5, y: far.cy + 0.5 };

    // one encrypted hard drive per zone (the Evidence objective)
    const driveRoom = (z, avoid) => { for (const r of z) if (r !== avoid) return r; return z[0]; };
    G.items = [
      { ...cell(driveRoom(z1, z1[0])), taken: false, zone: 1 },
      { ...cell(z2[(z2.length / 2) | 0]), taken: false, zone: 2 },
      { ...cell(driveRoom(z3, far)), taken: false, zone: 3 },
    ];

    // open cells per zone (for lamps / props / enemies)
    const byZone = { 1: [], 2: [], 3: [] };
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++)
      if (m[y][x] === 0) byZone[zoneOf(y)].push({ x: x + 0.5, y: y + 0.5 });
    const grab = (z) => byZone[z].splice(Math.random() * byZone[z].length | 0, 1)[0] || { x: G.posX, y: G.posY };

    // lamps: Zone 1 bright & reliable → Zone 3 sparse & failing
    G.lamps = [];
    const lampCfg = { 1: { rooms: z1, broken: 0.12, extra: 4 }, 2: { rooms: z2, broken: 0.4, extra: 2 }, 3: { rooms: z3, broken: 0.7, extra: 0 } };
    for (const z of [1, 2, 3]) {
      const cfg = lampCfg[z];
      for (const r of cfg.rooms) G.lamps.push({ x: r.cx + 0.5, y: r.cy + 0.5, ph: Math.random() * 7, broken: Math.random() < cfg.broken });
      for (let i = 0; i < cfg.extra; i++) { const t = grab(z); G.lamps.push({ x: t.x, y: t.y, ph: Math.random() * 7, broken: Math.random() < cfg.broken }); }
    }

    // props themed per zone: Admin terminals · Labs crates · Basement barrels
    G.props = [];
    const propByZone = { 1: "terminal", 2: "crate", 3: "barrel" };
    for (const z of [1, 2, 3]) for (let i = 0; i < 3; i++) { const t = grab(z); G.props.push({ x: t.x, y: t.y, tex: propByZone[z] }); }

    // enemies spread per zone, more & heavier the deeper you go
    G.enemies = [];
    const sc = 1 + (floor - 1) * 0.08;
    const spawnZone = (z, n, types) => { for (let i = 0; i < n; i++) { const t = grab(z); spawnEnemy(types[i % types.length], t.x, t.y, sc); } };
    spawnZone(1, 2 + floor, ["zombie"]);
    spawnZone(2, 3 + floor, ["zombie", "insect"]);
    spawnZone(3, 4 + floor, ["monster", "insect", "zombie"]);
  }
  function cell(r) { return { x: r.cx + 0.5, y: r.cy + 0.5 }; }
  function spawnEnemy(type, x, y, sc) {
    const e = { x, y, type, ph: Math.random() * 7, flash: 0 };
    if (type === "zombie") { e.hp = 60; e.spd = 0.9 * sc; e.dmg = 16; }
    else if (type === "insect") { e.hp = 16; e.spd = 1.9 * sc; e.dmg = 4; }
    else { e.hp = 100; e.spd = 1.3 * sc; e.dmg = 22; }
    e.maxHp = e.hp; G.enemies.push(e);
  }
  function spawnEnemy(type, x, y, sc) {
    const e = { x, y, type, ph: Math.random() * 7, flash: 0 };
    if (type === "zombie") { e.hp = 60; e.spd = 0.9 * sc; e.dmg = 16; }
    else if (type === "insect") { e.hp = 16; e.spd = 1.9 * sc; e.dmg = 4; }
    else { e.hp = 100; e.spd = 1.3 * sc; e.dmg = 22; }
    e.maxHp = e.hp; G.enemies.push(e);
  }

  function isWall(x, y) { const tx = x | 0, ty = y | 0; if (tx < 0 || ty < 0 || tx >= G.cols || ty >= G.rows) return true; return G.map[ty][tx] === 1; }
  function moveBy(dx, dy) { const r = 0.22; if (!isWall(G.posX + dx + Math.sign(dx) * r, G.posY)) G.posX += dx; if (!isWall(G.posX, G.posY + dy + Math.sign(dy) * r)) G.posY += dy; }
  function lampFlicker(l) {
    const t = performance.now() / 1000;
    if (l.broken) { const f = Math.sin(t * 13 + l.ph) * Math.sin(t * 7.3 + l.ph * 2); let v = 0.55 + 0.45 * Math.max(0, f); if (Math.random() < 0.03) v *= 0.45; return v; }
    return 0.92 + 0.08 * Math.sin(t * 2 + l.ph);
  }
  function lightAt(x, y) {
    // ambient floor brightness drops zone by zone (Admin → Sub-Basement)
    const z = zoneOf(y | 0);
    let b = z === 1 ? 0.42 : z === 2 ? 0.26 : 0.12;
    const carry = Math.hypot(x - G.posX, y - G.posY);
    b += Math.max(0, 0.45 * (1 - carry / 3.6));     // small glow you carry
    for (const l of G.lamps) { const d = Math.hypot(x - l.x, y - l.y); if (d < 6.5) b += lampFlicker(l) * Math.max(0, 1 - d / 6.5) * 1.05; }
    return Math.min(1.5, b);
  }

  // ============================================================
  //  INPUT
  // ============================================================
  const keys = {};
  let sprintKey = false;
  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === "Shift") sprintKey = true;
    if (e.key === " " || e.key.toLowerCase() === "j") { swing(); e.preventDefault(); }
  });
  window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; if (e.key === "Shift") sprintKey = false; });

  canvas.addEventListener("click", () => { if (G.state === "playing" && canvas.requestPointerLock) canvas.requestPointerLock(); });
  window.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement === canvas && G.state === "playing") { rotate(-e.movementX * 0.0025); G.pitch = Math.max(-BH * 0.28, Math.min(BH * 0.28, G.pitch - e.movementY * 0.6)); }
  });

  let moveTouch = null, lookTouch = null, touchSprint = false;
  function tStart(e) {
    for (const t of e.changedTouches) {
      if (t.target.classList && t.target.classList.contains("tbtn")) continue;
      if (t.clientX < window.innerWidth / 2 && moveTouch === null) moveTouch = { id: t.identifier, ox: t.clientX, oy: t.clientY, dx: 0, dy: 0 };
      else if (lookTouch === null) lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
    }
  }
  function tMove(e) {
    for (const t of e.changedTouches) {
      if (moveTouch && t.identifier === moveTouch.id) { moveTouch.dx = (t.clientX - moveTouch.ox) / 55; moveTouch.dy = (t.clientY - moveTouch.oy) / 55; }
      if (lookTouch && t.identifier === lookTouch.id) { rotate(-(t.clientX - lookTouch.x) * 0.006); G.pitch = Math.max(-BH * 0.28, Math.min(BH * 0.28, G.pitch - (t.clientY - lookTouch.y) * 0.8)); lookTouch.x = t.clientX; lookTouch.y = t.clientY; }
    }
    e.preventDefault();
  }
  function tEnd(e) { for (const t of e.changedTouches) { if (moveTouch && t.identifier === moveTouch.id) moveTouch = null; if (lookTouch && t.identifier === lookTouch.id) lookTouch = null; } }
  canvas.addEventListener("touchstart", tStart, { passive: false });
  canvas.addEventListener("touchmove", tMove, { passive: false });
  canvas.addEventListener("touchend", tEnd);
  canvas.addEventListener("touchcancel", tEnd);
  el("bAxe").addEventListener("touchstart", (e) => { e.preventDefault(); swing(); }, { passive: false });
  el("bAxe").addEventListener("mousedown", swing);
  el("bSprint").addEventListener("touchstart", (e) => { e.preventDefault(); touchSprint = true; }, { passive: false });
  el("bSprint").addEventListener("touchend", () => { touchSprint = false; });

  function rotate(a) {
    const c = Math.cos(a), s = Math.sin(a);
    const ndx = G.dirX * c - G.dirY * s; G.dirY = G.dirX * s + G.dirY * c; G.dirX = ndx;
    const npx = G.planeX * c - G.planeY * s; G.planeY = G.planeX * s + G.planeY * c; G.planeX = npx;
  }

  // ============================================================
  //  COMBAT
  // ============================================================
  function swing() {
    if (G.state !== "playing" || G.swingCd > 0) return;
    G.swingCd = 0.4; G.swing = 0.22; Sound.sfx.swing();
    let hit = false;
    for (let i = G.enemies.length - 1; i >= 0; i--) {
      const e = G.enemies[i];
      const dx = e.x - G.posX, dy = e.y - G.posY, d = Math.hypot(dx, dy) || 1;
      if (d > 1.7) continue;
      if ((dx / d) * G.dirX + (dy / d) * G.dirY < 0.5) continue;
      hit = true; e.hp -= 50; e.flash = 0.12; e.x += (dx / d) * 0.45; e.y += (dy / d) * 0.45;
      if (e.hp <= 0) { G.enemies.splice(i, 1); Sound.sfx.kill(); }
    }
    if (hit) { Sound.sfx.axeHit(); G.shake = Math.max(G.shake, 5); G.hitMark = 0.16; }
  }
  function hurt(amount) {
    if (G.invuln > 0) return;
    G.hp -= amount; G.hurt = 0.4; G.invuln = 0.5; G.shake = Math.max(G.shake, 7); Sound.sfx.hurt();
    if (G.hp <= 0) { G.hp = 0; gameOver(); }
  }

  // ============================================================
  //  UPDATE
  // ============================================================
  function update(dt) {
    if (G.state !== "playing") return;
    if (G.swingCd > 0) G.swingCd -= dt;
    if (G.swing > 0) G.swing -= dt;
    if (G.invuln > 0) G.invuln -= dt;
    if (G.hurt > 0) G.hurt -= dt;
    if (G.hitMark > 0) G.hitMark -= dt;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
    G.pitch *= Math.pow(0.0001, dt);                // ease pitch back to centre

    // desired movement
    let fwd = 0, str = 0;
    if (keys["w"] || keys["arrowup"]) fwd += 1;
    if (keys["s"] || keys["arrowdown"]) fwd -= 1;
    if (keys["a"]) str -= 1;
    if (keys["d"]) str += 1;
    if (keys["arrowleft"]) rotate(1.9 * dt);
    if (keys["arrowright"]) rotate(-1.9 * dt);
    if (moveTouch) { fwd += -moveTouch.dy; str += moveTouch.dx; }
    fwd = Math.max(-1, Math.min(1, fwd)); str = Math.max(-1, Math.min(1, str));

    const wanting = Math.abs(fwd) + Math.abs(str) > 0.05;
    const sprint = (sprintKey || touchSprint) && G.stamina > 0 && wanting;
    G.stamina = Math.max(0, Math.min(100, G.stamina + (sprint ? -32 : 22) * dt));
    const maxSpd = sprint ? 3.6 : 2.2;
    // smoothed velocity (acceleration + damping) → no more clunky stop/start
    const desX = (G.dirX * fwd + G.planeX * str) * maxSpd;
    const desY = (G.dirY * fwd + G.planeY * str) * maxSpd;
    const k = Math.min(1, 12 * dt);
    G.vx += (desX - G.vx) * k; G.vy += (desY - G.vy) * k;
    moveBy(G.vx * dt, G.vy * dt);

    const spdNow = Math.hypot(G.vx, G.vy);
    if (spdNow > 0.2) {
      G.bobPhase += dt * (sprint ? 13 : 9);
      G.bobAmt = Math.min(1, G.bobAmt + dt * 4);
      if (!swing._st || performance.now() - swing._st > (sprint ? 300 : 440)) { Sound.sfx.step(); swing._st = performance.now(); }
    } else G.bobAmt = Math.max(0, G.bobAmt - dt * 4);

    // enemies seek player + contact
    let nearest = 99, nearType = null;
    for (const e of G.enemies) {
      e.ph += dt * 6; if (e.flash > 0) e.flash -= dt;
      let dx = G.posX - e.x, dy = G.posY - e.y; const d = Math.hypot(dx, dy) || 1;
      if (d < nearest) { nearest = d; nearType = e.type; }
      dx /= d; dy /= d;
      if (e.type === "insect") { const w = Math.sin(e.ph) * 0.5, c = Math.cos(w), s = Math.sin(w), ndx = dx * c - dy * s; dy = dx * s + dy * c; dx = ndx; }
      const step = e.spd * dt;
      if (!isWall(e.x + dx * step, e.y)) e.x += dx * step;
      if (!isWall(e.x, e.y + dy * step)) e.y += dy * step;
      if (d < 0.55) hurt(e.dmg * dt * 2.4);
    }
    Sound.setDanger(Math.max(0, 1 - nearest / 6));

    // creature vocalisations (by nearest type) + ambient lab noises
    G.creatureT -= dt;
    if (G.creatureT <= 0) { G.creatureT = 1.6 + Math.random() * 3; if (nearType && nearest < 11 && Sound.sfx[nearType]) Sound.sfx[nearType](); }
    G.ambientT -= dt;
    if (G.ambientT <= 0) { G.ambientT = 2 + Math.random() * 4; (Math.random() < 0.5 ? Sound.sfx.drip : Sound.sfx.clank)(); }

    // evidence pickups + gated exit
    for (const it of G.items) if (!it.taken && Math.hypot(it.x - G.posX, it.y - G.posY) < 0.6) {
      it.taken = true; G.evidence++; Sound.sfx.keycard();
      flash(`HARD DRIVE RECOVERED — ${G.evidence}/3`, 1.4);
    }
    if (Math.hypot(G.exit.x - G.posX, G.exit.y - G.posY) < 0.7) {
      if (G.evidence >= 3) nextFloor();
      else if (G.msgT <= 0) flash(`EXIT LOCKED — ${3 - G.evidence} MORE HARD DRIVE${3 - G.evidence > 1 ? "S" : ""}`, 1);
    }

    if (G.msgT > 0) { G.msgT -= dt; if (G.msgT <= 0) el("msg").classList.remove("show"); }
    updateHUD();
  }
  function nextFloor() { G.floor++; G.evidence = 0; G.stamina = 100; gen(G.floor); flash(`SECTOR ${G.floor} — DEEPER IN`, 2); Sound.sfx.clank(); }

  // ============================================================
  //  RENDER
  // ============================================================
  function render() {
    const horizon = (BH / 2 + G.pitch + Math.sin(G.bobPhase) * 6 * G.bobAmt) | 0;
    // ceiling gradient
    let cg = bctx.createLinearGradient(0, 0, 0, horizon);
    cg.addColorStop(0, "#04060a"); cg.addColorStop(1, "#0c131d");
    bctx.fillStyle = cg; bctx.fillRect(0, 0, BW, Math.max(0, horizon));
    // floor gradient
    let fg = bctx.createLinearGradient(0, horizon, 0, BH);
    fg.addColorStop(0, "#0e1620"); fg.addColorStop(1, "#070b11");
    bctx.fillStyle = fg; bctx.fillRect(0, Math.max(0, horizon), BW, BH);
    if (G.state !== "playing" && G.state !== "over") { blit(); return; }

    // textured walls
    for (let x = 0; x < BW; x++) {
      const camX = 2 * x / BW - 1;
      const rdx = G.dirX + G.planeX * camX, rdy = G.dirY + G.planeY * camX;
      let mapX = G.posX | 0, mapY = G.posY | 0;
      const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
      let stepX, stepY, sdx, sdy, side = 0, hitW = false, guard = 0;
      if (rdx < 0) { stepX = -1; sdx = (G.posX - mapX) * ddx; } else { stepX = 1; sdx = (mapX + 1 - G.posX) * ddx; }
      if (rdy < 0) { stepY = -1; sdy = (G.posY - mapY) * ddy; } else { stepY = 1; sdy = (mapY + 1 - G.posY) * ddy; }
      while (!hitW && guard++ < 80) {
        if (sdx < sdy) { sdx += ddx; mapX += stepX; side = 0; } else { sdy += ddy; mapY += stepY; side = 1; }
        if (mapX < 0 || mapY < 0 || mapX >= G.cols || mapY >= G.rows || G.map[mapY][mapX] === 1) hitW = true;
      }
      const perp = Math.max(0.05, side === 0 ? (sdx - ddx) : (sdy - ddy));
      zbuf[x] = perp;
      const lh = (BH / perp) | 0;
      const y0 = horizon - (lh >> 1);
      // texture sample column
      let wallX = side === 0 ? G.posY + perp * rdy : G.posX + perp * rdx; wallX -= Math.floor(wallX);
      const tex = ((mapX + mapY) & 1) ? TEX.wall1 : TEX.wall0;
      let texX = (wallX * 64) | 0; if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) texX = 63 - texX;
      bctx.drawImage(tex, texX, 0, 1, 64, x, y0, 1, lh);
      // lighting + fog as a dark overlay
      const hx = G.posX + rdx * perp, hy = G.posY + rdy * perp;
      let lum = lightAt(hx, hy) * (side === 1 ? 0.78 : 1) * Math.max(0.16, 1 - perp / 16);
      const shade = 1 - Math.min(1, lum);
      if (shade > 0.01) { bctx.fillStyle = `rgba(2,4,8,${shade})`; bctx.fillRect(x, y0, 1, lh); }
      // zone colour grade: Specimen Labs sickly green · Sub-Basement cold blue
      const z = zoneOf(mapY);
      if (z === 2) { bctx.fillStyle = `rgba(60,120,40,${0.12 * lum})`; bctx.fillRect(x, y0, 1, lh); }
      else if (z === 3) { bctx.fillStyle = `rgba(20,40,80,${0.16 * lum})`; bctx.fillRect(x, y0, 1, lh); }
    }

    // sprites (lamps glow + props + items + exit + enemies)
    const sprites = [];
    for (const l of G.lamps) sprites.push({ x: l.x, y: l.y, glow: lampFlicker(l) });
    for (const p of G.props) sprites.push({ x: p.x, y: p.y, tex: TEX[p.tex], scale: 0.8, ground: true });
    for (const it of G.items) if (!it.taken) sprites.push({ x: it.x, y: it.y, tex: TEX.drive, scale: 0.45, bob: true });
    sprites.push({ x: G.exit.x, y: G.exit.y, tex: TEX.door, scale: 1.1, ground: true });
    for (const e of G.enemies) sprites.push({ x: e.x, y: e.y, tex: TEX[e.type], scale: e.type === "monster" ? 1.15 : e.type === "insect" ? 0.7 : 0.95, ground: true, flash: e.flash > 0, hp: e.hp, maxHp: e.maxHp });
    sprites.sort((a, b) => Math.hypot(b.x - G.posX, b.y - G.posY) - Math.hypot(a.x - G.posX, a.y - G.posY));

    for (const s of sprites) {
      const sx = s.x - G.posX, sy = s.y - G.posY;
      const inv = 1 / (G.planeX * G.dirY - G.dirX * G.planeY);
      const tX = inv * (G.dirY * sx - G.dirX * sy);
      const tY = inv * (-G.planeY * sx + G.planeX * sy);
      if (tY <= 0.25) continue;
      const screenX = (BW / 2) * (1 + tX / tY);
      const col = screenX | 0;
      if (col < 0 || col >= BW || tY >= zbuf[col]) continue;
      const lum = Math.min(1, lightAt(s.x, s.y)) * Math.max(0.25, 1.25 - tY / 12);

      if (s.glow !== undefined) {                    // ceiling lamp halo
        const r = Math.max(6, (BH / tY) * 0.32);
        const gy = horizon - (BH / tY) * 0.42;
        const gr = bctx.createRadialGradient(screenX, gy, 1, screenX, gy, r);
        gr.addColorStop(0, `rgba(200,225,255,${0.5 * s.glow})`); gr.addColorStop(1, "rgba(200,225,255,0)");
        bctx.fillStyle = gr; bctx.beginPath(); bctx.arc(screenX, gy, r, 0, 7); bctx.fill();
        bctx.fillStyle = `rgba(235,245,255,${0.7 * s.glow})`; bctx.fillRect(screenX - r * 0.18, gy - 2, r * 0.36, 3);
        continue;
      }
      const h = (BH / tY) * s.scale, w = h * (s.tex.width / s.tex.height);
      const py = s.ground ? horizon + (BH / tY) * 0.5 - h : horizon + (s.bob ? Math.sin(performance.now() / 300 + s.x) * 4 : 0) - h / 2;
      bctx.save();
      bctx.globalAlpha = Math.max(0.2, lum);
      bctx.drawImage(s.tex, screenX - w / 2, py, w, h);
      if (s.flash) { bctx.globalCompositeOperation = "lighter"; bctx.globalAlpha = 0.6; bctx.drawImage(s.tex, screenX - w / 2, py, w, h); }
      bctx.restore();
      if (s.hp !== undefined && s.hp < s.maxHp) {
        const bw = w * 0.7; bctx.fillStyle = "rgba(0,0,0,0.6)"; bctx.fillRect(screenX - bw / 2, py - 5, bw, 3);
        bctx.fillStyle = "#7CFF00"; bctx.fillRect(screenX - bw / 2, py - 5, bw * (s.hp / s.maxHp), 3);
      }
    }

    blit();
    drawViewmodel();
    if (G.hurt > 0) { ctx.fillStyle = `rgba(255,0,30,${G.hurt * 0.5})`; ctx.fillRect(0, 0, viewW, viewH); }
    if (G.hitMark > 0) drawHitMarker();
  }

  function blit() {
    let ox = 0, oy = 0;
    if (G.shake > 0) { ox = (Math.random() - 0.5) * G.shake * 2; oy = (Math.random() - 0.5) * G.shake * 2; }
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, viewW, viewH);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, BW, BH, ox, oy, viewW, viewH);
  }

  // First-person fire-axe viewmodel (screen space)
  function drawViewmodel() {
    const sway = Math.sin(G.bobPhase) * 10 * G.bobAmt;
    const swayY = Math.abs(Math.cos(G.bobPhase)) * 8 * G.bobAmt;
    let rot = 0, lift = 0;
    if (G.swing > 0) { const t = 1 - G.swing / 0.22; rot = -1.3 + t * 1.7; lift = -Math.sin(t * Math.PI) * viewH * 0.12; }
    const s = viewH / 620;                            // scale to screen
    ctx.save();
    ctx.translate(viewW * 0.74 + sway, viewH + swayY + lift);
    ctx.rotate(rot);
    ctx.scale(s, s);
    // handle
    ctx.fillStyle = "#6b4326"; ctx.fillRect(-16, -300, 30, 320);
    ctx.fillStyle = "#ff3b30"; ctx.fillRect(-16, -70, 30, 22);  // grip stripe
    // steel head
    ctx.fillStyle = "#c2c8d0";
    ctx.beginPath(); ctx.moveTo(-16, -300); ctx.lineTo(-96, -330); ctx.lineTo(-80, -250); ctx.lineTo(14, -262); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#8b929c"; ctx.fillRect(-16, -304, 30, 16);
    ctx.restore();
  }

  function drawHitMarker() {
    const a = G.hitMark / 0.16, cx = viewW / 2, cy = viewH / 2, r = 14;
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = "#ff4d4d"; ctx.lineWidth = 3;
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { ctx.beginPath(); ctx.moveTo(cx + dx * 6, cy + dy * 6); ctx.lineTo(cx + dx * r, cy + dy * r); ctx.stroke(); }
    ctx.restore();
  }

  // ============================================================
  //  HUD / SCREENS / LOOP
  // ============================================================
  function updateHUD() {
    el("hpBar").style.width = Math.max(0, (G.hp / G.maxHp) * 100) + "%";
    el("staBar").firstElementChild.style.width = Math.max(0, G.stamina) + "%";
    const ZN = { 1: "ADMIN", 2: "SPECIMEN LABS", 3: "SUB-BASEMENT" };
    el("floorChip").textContent = "S" + G.floor + " · " + ZN[zoneOf(G.posY | 0)];
    el("keyChip").textContent = "💾 " + G.evidence + "/3";
  }
  function flash(text, dur) { const m = el("msg"); m.textContent = text; m.classList.add("show"); G.msgT = dur; }
  function show(id, on) { el(id).classList.toggle("hidden", !on); }

  function startGame() {
    Sound.unlock();
    G.floor = 1; G.hp = G.maxHp; G.stamina = 100; G.evidence = 0; G.pitch = 0; G.shake = 0;
    gen(1); G.state = "playing";
    show("menu", false); show("over", false); show("hud", true); show("hudRight", true); show("touch", true);
    Sound.startAmbient(); flash("RECOVER 3 HARD DRIVES — REACH THE EXIT", 2.6);
  }
  function gameOver() {
    G.state = "over"; Sound.stopAmbient(); Sound.sfx.dead();
    el("overTitle").textContent = "CONSUMED";
    el("overText").innerHTML = `You recovered <b>${G.evidence}/3</b> drives in Sector <b>${G.floor}</b>.`;
    show("over", true); show("hud", false); show("hudRight", false); show("touch", false);
  }
  el("bPlay").addEventListener("click", startGame);
  el("bAgain").addEventListener("click", startGame);

  let last = performance.now();
  function loop(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;
    update(dt); render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
