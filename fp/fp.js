/* ============================================================
   LAB ESCAPE — First-Person (raycaster, no libraries).
   Lodev-style DDA walls + billboard sprites. Lit only by the lab's
   own flickering ceiling lamps (no flashlight) + a faint carry glow.
   ============================================================ */
(() => {
  "use strict";

  const canvas = document.getElementById("view");
  const ctx = canvas.getContext("2d");
  // Low-res render buffer (scaled up) for performance on phones.
  const buf = document.createElement("canvas");
  const bctx = buf.getContext("2d");
  let BW = 0, BH = 0, viewW = 0, viewH = 0;

  function resize() {
    viewW = window.innerWidth; viewH = window.innerHeight;
    canvas.width = viewW; canvas.height = viewH;
    BW = Math.min(520, viewW);              // render width
    BH = Math.round(BW * (viewH / viewW));
    buf.width = BW; buf.height = BH;
  }
  window.addEventListener("resize", resize);
  resize();

  const el = (id) => document.getElementById(id);
  const zbuf = new Float32Array(4096);      // per-column wall depth

  // ---------- Game state ----------
  const G = {
    state: "menu",
    floor: 1,
    map: null, cols: 0, rows: 0,
    posX: 1.5, posY: 1.5,
    dirX: 1, dirY: 0, planeX: 0, planeY: 0.66,
    hp: 140, maxHp: 140, stamina: 100,
    keys: 0, exit: null,
    enemies: [], items: [], lamps: [],
    invuln: 0, swing: 0, swingCd: 0,
    hurt: 0, msgT: 0,
  };

  const EMOJI = { zombie: "🧟", insect: "🕷️", monster: "👹", key: "🗝️", exit: "🚪", lamp: "💡" };

  // ---------- Map generation (rooms + corridors) ----------
  function gen(floor) {
    const cols = Math.min(34, 20 + floor * 2);
    const rows = Math.min(28, 16 + floor * 2);
    const m = [];
    for (let y = 0; y < rows; y++) m.push(new Array(cols).fill(1));
    const rooms = [];
    const n = 6 + Math.min(floor, 6);
    for (let i = 0; i < n; i++) {
      const rw = 3 + (Math.random() * 4 | 0), rh = 3 + (Math.random() * 4 | 0);
      const rx = 1 + (Math.random() * (cols - rw - 2) | 0), ry = 1 + (Math.random() * (rows - rh - 2) | 0);
      for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) m[y][x] = 0;
      rooms.push({ cx: rx + (rw >> 1), cy: ry + (rh >> 1) });
    }
    const cH = (x1, x2, y) => { for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) m[y][x] = 0; };
    const cV = (y1, y2, x) => { for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) m[y][x] = 0; };
    for (let i = 1; i < rooms.length; i++) { cH(rooms[i - 1].cx, rooms[i].cx, rooms[i - 1].cy); cV(rooms[i - 1].cy, rooms[i].cy, rooms[i].cx); }

    G.map = m; G.cols = cols; G.rows = rows;
    G.posX = rooms[0].cx + 0.5; G.posY = rooms[0].cy + 0.5;
    G.dirX = 1; G.dirY = 0; G.planeX = 0; G.planeY = 0.66;

    // exit = farthest room
    let far = rooms[1] || rooms[0], best = -1;
    for (const r of rooms) { const d = Math.hypot(r.cx - rooms[0].cx, r.cy - rooms[0].cy); if (d > best) { best = d; far = r; } }
    G.exit = { x: far.cx + 0.5, y: far.cy + 0.5 };

    // open floor cells away from spawn
    const open = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++)
      if (m[y][x] === 0 && Math.hypot(x - rooms[0].cx, y - rooms[0].cy) > 4) open.push({ x: x + 0.5, y: y + 0.5 });
    const take = () => open.splice(Math.random() * open.length | 0, 1)[0] || { x: G.exit.x, y: G.exit.y };

    // keycards
    G.items = [];
    for (let i = 0; i < 3; i++) { const t = take(); G.items.push({ x: t.x, y: t.y, type: "key", taken: false }); }

    // ceiling lamps (the only light) — one per room + a few extra; some broken
    G.lamps = [];
    for (const r of rooms) G.lamps.push({ x: r.cx + 0.5, y: r.cy + 0.5, ph: Math.random() * 7, broken: Math.random() < 0.3 });
    for (let i = 0; i < Math.min(5, open.length); i++) { const t = take(); G.lamps.push({ x: t.x, y: t.y, ph: Math.random() * 7, broken: Math.random() < 0.35 }); }

    // enemies — more & nastier each floor
    G.enemies = [];
    const types = ["zombie", "insect", "monster"];
    const count = Math.min(22, 3 + floor * 2);
    const sc = 1 + (floor - 1) * 0.08;
    for (let i = 0; i < count; i++) {
      const t = take(); spawnEnemy(types[i % 3], t.x, t.y, sc);
    }
  }

  function spawnEnemy(type, x, y, sc) {
    const e = { x, y, type, ph: Math.random() * 7, hp: 0, spd: 0, dmg: 0 };
    if (type === "zombie") { e.hp = 60; e.spd = 0.9 * sc; e.dmg = 18; }
    else if (type === "insect") { e.hp = 16; e.spd = 1.9 * sc; e.dmg = 5; }
    else { e.hp = 100; e.spd = 1.3 * sc; e.dmg = 26; } // monster
    e.maxHp = e.hp;
    G.enemies.push(e);
  }

  function isWall(x, y) {
    const tx = x | 0, ty = y | 0;
    if (tx < 0 || ty < 0 || tx >= G.cols || ty >= G.rows) return true;
    return G.map[ty][tx] === 1;
  }
  function moveBy(dx, dy) {
    const r = 0.22;
    if (!isWall(G.posX + dx + Math.sign(dx) * r, G.posY)) G.posX += dx;
    if (!isWall(G.posX, G.posY + dy + Math.sign(dy) * r)) G.posY += dy;
  }
  function lampFlicker(l) {
    const t = performance.now() / 1000;
    if (l.broken) { const f = Math.sin(t * 13 + l.ph) * Math.sin(t * 7.3 + l.ph * 2); let v = 0.55 + 0.45 * Math.max(0, f); if (Math.random() < 0.03) v *= 0.4; return v; }
    return 0.9 + 0.1 * Math.sin(t * 2 + l.ph);
  }
  // brightness at a world point from nearby flickering lamps + faint carry glow
  function lightAt(x, y) {
    let b = 0.16;                                    // ambient floor
    const carry = Math.hypot(x - G.posX, y - G.posY);
    b += Math.max(0, 0.4 * (1 - carry / 3.2));       // small glow you carry
    for (const l of G.lamps) {
      const d = Math.hypot(x - l.x, y - l.y);
      if (d < 6) b += lampFlicker(l) * Math.max(0, 1 - d / 6) * 0.9;
    }
    return Math.min(1.25, b);
  }

  // ---------- Input ----------
  const keys = {};
  let sprintKey = false;
  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === "Shift") sprintKey = true;
    if (e.key === " " || e.key.toLowerCase() === "j") { swing(); e.preventDefault(); }
  });
  window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; if (e.key === "Shift") sprintKey = false; });

  // Mouse look (pointer lock on desktop)
  canvas.addEventListener("click", () => { if (G.state === "playing" && canvas.requestPointerLock) canvas.requestPointerLock(); });
  window.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement === canvas && G.state === "playing") rotate(-e.movementX * 0.0025);
  });

  // Touch: left half = move, right half = look
  let moveTouch = null, lookTouch = null, touchSprint = false;
  function tStart(e) {
    for (const t of e.changedTouches) {
      if (t.target.classList && t.target.classList.contains("tbtn")) continue;
      if (t.clientX < window.innerWidth / 2 && moveTouch === null) moveTouch = { id: t.identifier, ox: t.clientX, oy: t.clientY, dx: 0, dy: 0 };
      else if (lookTouch === null) lookTouch = { id: t.identifier, x: t.clientX };
    }
  }
  function tMove(e) {
    for (const t of e.changedTouches) {
      if (moveTouch && t.identifier === moveTouch.id) { moveTouch.dx = (t.clientX - moveTouch.ox) / 50; moveTouch.dy = (t.clientY - moveTouch.oy) / 50; }
      if (lookTouch && t.identifier === lookTouch.id) { rotate(-(t.clientX - lookTouch.x) * 0.006); lookTouch.x = t.clientX; }
    }
    e.preventDefault();
  }
  function tEnd(e) {
    for (const t of e.changedTouches) {
      if (moveTouch && t.identifier === moveTouch.id) moveTouch = null;
      if (lookTouch && t.identifier === lookTouch.id) lookTouch = null;
    }
  }
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

  // ---------- Combat ----------
  function swing() {
    if (G.state !== "playing" || G.swingCd > 0) return;
    G.swingCd = 0.42; G.swing = 0.2;
    Sound.sfx.swing();
    let hit = false;
    for (let i = G.enemies.length - 1; i >= 0; i--) {
      const e = G.enemies[i];
      const dx = e.x - G.posX, dy = e.y - G.posY;
      const d = Math.hypot(dx, dy);
      if (d > 1.5) continue;
      const dot = (dx / d) * G.dirX + (dy / d) * G.dirY;   // in front?
      if (dot < 0.55) continue;
      hit = true; e.hp -= 50; e.flash = 0.12;
      e.x += (dx / d) * 0.4; e.y += (dy / d) * 0.4;         // knockback
      if (e.hp <= 0) { G.enemies.splice(i, 1); Sound.sfx.kill(); }
    }
    if (hit) Sound.sfx.splat();
  }

  function hurt(amount) {
    if (G.invuln > 0) return;
    G.hp -= amount; G.hurt = 0.4; G.invuln = 0.5; Sound.sfx.hurt();
    if (G.hp <= 0) { G.hp = 0; gameOver(); }
  }

  // ---------- Update ----------
  function update(dt) {
    if (G.state !== "playing") return;
    if (G.swingCd > 0) G.swingCd -= dt;
    if (G.swing > 0) G.swing -= dt;
    if (G.invuln > 0) G.invuln -= dt;
    if (G.hurt > 0) G.hurt -= dt;

    // movement
    let fwd = 0, str = 0;
    if (keys["w"] || keys["arrowup"]) fwd += 1;
    if (keys["s"] || keys["arrowdown"]) fwd -= 1;
    if (keys["a"]) str -= 1;
    if (keys["d"]) str += 1;
    if (keys["arrowleft"]) rotate(1.8 * dt);
    if (keys["arrowright"]) rotate(-1.8 * dt);
    if (moveTouch) { fwd += -moveTouch.dy; str += moveTouch.dx; }
    fwd = Math.max(-1, Math.min(1, fwd)); str = Math.max(-1, Math.min(1, str));

    const moving = Math.abs(fwd) + Math.abs(str) > 0.05;
    const sprint = (sprintKey || touchSprint) && G.stamina > 0 && moving;
    if (sprint) G.stamina = Math.max(0, G.stamina - 32 * dt);
    else G.stamina = Math.min(100, G.stamina + 22 * dt);
    const spd = (sprint ? 3.4 : 2.0) * dt;
    if (moving) {
      moveBy((G.dirX * fwd + G.planeX * str) * spd, (G.dirY * fwd + G.planeY * str) * spd);
      if (!swing._st || performance.now() - swing._st > (sprint ? 300 : 450)) { Sound.sfx.step(); swing._st = performance.now(); }
    }

    // enemies seek the player (basic pathing) + contact damage
    let nearest = 99;
    for (const e of G.enemies) {
      e.ph += dt * 6; if (e.flash > 0) e.flash -= dt;
      let dx = G.posX - e.x, dy = G.posY - e.y;
      const d = Math.hypot(dx, dy) || 1; if (d < nearest) nearest = d;
      dx /= d; dy /= d;
      if (e.type === "insect") { const w = Math.sin(e.ph) * 0.5; const c = Math.cos(w), s = Math.sin(w); const ndx = dx * c - dy * s; dy = dx * s + dy * c; dx = ndx; }
      const step = e.spd * dt;
      if (!isWall(e.x + dx * step, e.y)) e.x += dx * step;
      if (!isWall(e.x, e.y + dy * step)) e.y += dy * step;
      if (d < 0.55) hurt(e.dmg * dt * 2.4);
    }
    Sound.setDanger(Math.max(0, 1 - nearest / 6));

    // keycard pickups
    for (const it of G.items) {
      if (it.taken) continue;
      if (Math.hypot(it.x - G.posX, it.y - G.posY) < 0.6) {
        it.taken = true; G.keys++; Sound.sfx.keycard(); flash(`KEYCARD ${G.keys}/3`, 1.2);
      }
    }
    // exit
    if (Math.hypot(G.exit.x - G.posX, G.exit.y - G.posY) < 0.7) {
      if (G.keys >= 3) nextFloor();
      else if (G.msgT <= 0) flash(`NEED ${3 - G.keys} MORE KEYCARDS`, 1);
    }

    if (G.msgT > 0) { G.msgT -= dt; if (G.msgT <= 0) el("msg").classList.remove("show"); }
    updateHUD();
  }

  function nextFloor() {
    G.floor++; G.keys = 0; G.stamina = 100;
    gen(G.floor);
    flash(`FLOOR ${G.floor} — DEEPER IN`, 2);
  }

  // ---------- Render ----------
  function render() {
    // ceiling + floor
    bctx.fillStyle = "#070b12"; bctx.fillRect(0, 0, BW, BH / 2);
    bctx.fillStyle = "#0a0f16"; bctx.fillRect(0, BH / 2, BW, BH / 2);
    if (G.state !== "playing" && G.state !== "over") return;

    // walls (DDA)
    for (let x = 0; x < BW; x++) {
      const camX = 2 * x / BW - 1;
      const rdx = G.dirX + G.planeX * camX, rdy = G.dirY + G.planeY * camX;
      let mapX = G.posX | 0, mapY = G.posY | 0;
      const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
      let stepX, stepY, sdx, sdy;
      if (rdx < 0) { stepX = -1; sdx = (G.posX - mapX) * ddx; } else { stepX = 1; sdx = (mapX + 1 - G.posX) * ddx; }
      if (rdy < 0) { stepY = -1; sdy = (G.posY - mapY) * ddy; } else { stepY = 1; sdy = (mapY + 1 - G.posY) * ddy; }
      let side = 0, hitW = false, guard = 0;
      while (!hitW && guard++ < 64) {
        if (sdx < sdy) { sdx += ddx; mapX += stepX; side = 0; } else { sdy += ddy; mapY += stepY; side = 1; }
        if (mapX < 0 || mapY < 0 || mapX >= G.cols || mapY >= G.rows || G.map[mapY][mapX] === 1) hitW = true;
      }
      const perp = side === 0 ? (sdx - ddx) : (sdy - ddy);
      zbuf[x] = perp;
      const lh = Math.min(BH * 4, (BH / perp) | 0);
      const y0 = Math.max(0, (BH - lh) >> 1), y1 = Math.min(BH, (BH + lh) >> 1);
      // light sampled at the wall hit point
      const hx = G.posX + rdx * perp, hy = G.posY + rdy * perp;
      let lum = lightAt(hx, hy) * (side === 1 ? 0.7 : 1);
      lum *= Math.max(0.12, 1 - perp / 14);            // distance fog
      const base = side === 1 ? [22, 34, 52] : [30, 44, 66];
      const r = base[0] * lum | 0, g = base[1] * lum | 0, b = base[2] * lum | 0;
      bctx.fillStyle = `rgb(${r},${g},${b})`;
      bctx.fillRect(x, y0, 1, y1 - y0);
    }

    // sprites: enemies + items + lamps, back-to-front, depth-tested
    const sprites = [];
    for (const l of G.lamps) sprites.push({ x: l.x, y: l.y, emoji: EMOJI.lamp, scale: 0.5, glow: lampFlicker(l), vy: -0.35 });
    for (const it of G.items) if (!it.taken) sprites.push({ x: it.x, y: it.y, emoji: EMOJI.key, scale: 0.55, vy: 0.05 });
    sprites.push({ x: G.exit.x, y: G.exit.y, emoji: EMOJI.exit, scale: 1.0, vy: 0 });
    for (const e of G.enemies) sprites.push({ x: e.x, y: e.y, emoji: EMOJI[e.type], scale: e.type === "insect" ? 0.6 : e.type === "monster" ? 1.1 : 0.9, flash: e.flash > 0, vy: 0.02, hp: e.hp, maxHp: e.maxHp });
    sprites.sort((a, b) => Math.hypot(b.x - G.posX, b.y - G.posY) - Math.hypot(a.x - G.posX, a.y - G.posY));

    for (const s of sprites) {
      const sx = s.x - G.posX, sy = s.y - G.posY;
      const inv = 1 / (G.planeX * G.dirY - G.dirX * G.planeY);
      const tx = inv * (G.dirY * sx - G.dirX * sy);
      const ty = inv * (-G.planeY * sx + G.planeX * sy);   // depth
      if (ty <= 0.2) continue;
      const screenX = (BW / 2) * (1 + tx / ty);
      const col = screenX | 0;
      if (col < 0 || col >= BW || ty >= zbuf[col]) continue;  // behind a wall
      const size = Math.min(BH * 2.2, (BH / ty) * s.scale);
      const py = BH / 2 + (s.vy * BH / ty);
      bctx.save();
      bctx.globalAlpha = Math.max(0.25, Math.min(1, 1.2 - ty / 12));
      bctx.font = size + "px serif";
      bctx.textAlign = "center"; bctx.textBaseline = "middle";
      if (s.glow !== undefined) { bctx.globalAlpha *= 0.4 + s.glow * 0.6; bctx.shadowColor = "#cfe4ff"; bctx.shadowBlur = 18 * s.glow; }
      if (s.flash) { bctx.shadowColor = "#fff"; bctx.shadowBlur = 16; }
      bctx.fillText(s.emoji, screenX, py);
      bctx.restore();
      // enemy health pip
      if (s.hp !== undefined && s.hp < s.maxHp) {
        const w = size * 0.5;
        bctx.fillStyle = "rgba(0,0,0,0.6)"; bctx.fillRect(screenX - w / 2, py - size * 0.55, w, 3);
        bctx.fillStyle = "#7CFF00"; bctx.fillRect(screenX - w / 2, py - size * 0.55, w * (s.hp / s.maxHp), 3);
      }
    }

    // blit buffer to screen
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, BW, BH, 0, 0, viewW, viewH);

    // fire-axe swing overlay (screen-space)
    if (G.swing > 0) {
      const t = 1 - G.swing / 0.2;
      ctx.save();
      ctx.strokeStyle = `rgba(200,235,255,${0.8 * (1 - t)})`; ctx.lineWidth = 6; ctx.shadowColor = "#aef"; ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(viewW / 2, viewH * 1.05, viewH * 0.5, -Math.PI * 0.75 + t * 0.7, -Math.PI * 0.25 + t * 0.7);
      ctx.stroke(); ctx.restore();
    }
    // hurt vignette
    if (G.hurt > 0) { ctx.fillStyle = `rgba(255,0,30,${G.hurt * 0.5})`; ctx.fillRect(0, 0, viewW, viewH); }
  }

  // ---------- HUD / screens ----------
  function updateHUD() {
    el("hpBar").style.width = Math.max(0, (G.hp / G.maxHp) * 100) + "%";
    el("staBar").firstElementChild.style.width = Math.max(0, G.stamina) + "%";
    el("floorChip").textContent = "FLOOR " + G.floor;
    el("keyChip").textContent = "🗝 " + G.keys + "/3";
  }
  function flash(text, dur) { const m = el("msg"); m.textContent = text; m.classList.add("show"); G.msgT = dur; }
  function show(id, on) { el(id).classList.toggle("hidden", !on); }

  function startGame() {
    Sound.unlock();
    G.floor = 1; G.hp = G.maxHp; G.stamina = 100; G.keys = 0;
    gen(1);
    G.state = "playing";
    show("menu", false); show("over", false);
    show("hud", true); show("hudRight", true); show("touch", true);
    Sound.startAmbient();
    flash("FIND 3 KEYCARDS — REACH THE EXIT", 2.4);
  }
  function gameOver() {
    G.state = "over"; Sound.stopAmbient(); Sound.sfx.dead();
    el("overTitle").textContent = "CONSUMED";
    el("overText").innerHTML = `You reached <b>Floor ${G.floor}</b>.`;
    show("over", true); show("hud", false); show("hudRight", false); show("touch", false);
  }

  el("bPlay").addEventListener("click", startGame);
  el("bAgain").addEventListener("click", startGame);

  // ---------- Loop ----------
  let last = performance.now();
  function loop(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;
    update(dt); render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
