// Game controller: state machine, level setup, camera, lighting/fog-of-war,
// HUD, particles, and win/lose handling.
const Game = (() => {
  let canvas, ctx, W, H, dpr;
  let state = "menu"; // menu | playing | dead | win
  let map, player, enemies, particles, floaters;
  let level = 1, score = 0, timeLeft, elapsed;
  let cam = { x: 0, y: 0 };
  let lightCanvas, lightCtx;
  let msgTimer = 0;
  let shake = 0;
  let nemesisSpawned = false;   // Patient Zero tease — fires once per level

  function boot(c) {
    canvas = c;
    ctx = canvas.getContext("2d");
    lightCanvas = document.createElement("canvas");
    lightCtx = lightCanvas.getContext("2d");
    resize();
    window.addEventListener("resize", resize);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lightCanvas.width = W; lightCanvas.height = H;
  }

  function start(lvl) {
    level = lvl;
    map = GameMap.make(level);
    player = new Player(map.spawn.x, map.spawn.y);
    enemies = [];
    particles = [];
    floaters = [];
    nemesisSpawned = false;
    elapsed = 0;
    timeLeft = Math.max(90, 150 - level * 8); // soft pressure: alarm countdown

    // Populate enemies from spawn rooms, more & nastier each level.
    const spots = map.enemySpots.slice();
    const zCount = 4 + level;
    const mCount = Math.min(1 + Math.floor(level / 2), 6);
    const swarms = 1 + Math.floor(level / 2);
    for (let i = 0; i < zCount; i++) spawnFrom(spots, "zombie");
    for (let i = 0; i < mCount; i++) spawnFrom(spots, "mutant");
    for (let s = 0; s < swarms; s++) {
      const base = Utils.choice(map.enemySpots);
      for (let i = 0; i < 5; i++)
        enemies.push(new Enemy("insect", base.x + Utils.rand(-30, 30), base.y + Utils.rand(-30, 30), level));
    }

    state = "playing";
    flashMsg(level === 1 ? "FIND 3 KEYCARDS — REACH THE EXIT" : `LEVEL ${level} — IT'S WORSE DOWN HERE`, 2.6);
    Sound.startAmbient();
  }

  function spawnFrom(spots, type) {
    if (!spots.length) spots = map.enemySpots.slice();
    const s = Utils.choice(spots);
    enemies.push(new Enemy(type, s.x + Utils.rand(-20, 20), s.y + Utils.rand(-20, 20), level));
  }

  function update(dt) {
    if (state !== "playing") return;
    elapsed += dt;
    timeLeft -= dt;
    if (msgTimer > 0) msgTimer -= dt;

    player.update(dt, map);

    // Enemies + danger metering for audio/heartbeat.
    let nearest = 9999;
    for (const e of enemies) {
      const d = e.update(dt, map, player);
      if (d < nearest) nearest = d;
    }
    const danger = Utils.clamp(1 - nearest / 320, 0, 1);
    Sound.setDanger(danger);
    if (player.hurtFlash > 0.3) shake = Math.max(shake, 6);

    // Resolve a melee swing this frame (player flags it, controller applies it).
    if (player.pendingHit) { player.pendingHit = false; resolveAttack(); }

    // Item pickups
    for (const it of map.items) {
      if (it.taken) continue;
      it.bob += dt * 3;
      if (Utils.dist(player.x, player.y, it.x, it.y) < player.r + 16) {
        collect(it);
      }
    }

    // Lore drops — step on a PDA node to trigger a one-line transmission.
    for (const lg of map.logs) {
      if (lg.read) continue;
      lg.bob += dt * 3;
      if (Utils.dist(player.x, player.y, lg.x, lg.y) < player.r + 16) {
        lg.read = true;
        Sound.sfx.pickup();
        UI.transmission(Lore.LOGS[lg.idx]);
        UI.updateLore(Lore.recover(lg.idx));
        floaty(lg.x, lg.y, "LOG RECOVERED", "#7CFF00");
        burst(lg.x, lg.y, "#7CFF00", 8);
      }
    }

    // Nemesis tease — Patient Zero wakes once you're halfway to the keycards.
    if (!nemesisSpawned && player.keys >= 2) {
      nemesisSpawned = true;
      let far = map.enemySpots[0], best = -1;
      for (const s of map.enemySpots) {
        const dd = Utils.dist(s.x, s.y, player.x, player.y);
        if (dd > best) { best = dd; far = s; }
      }
      enemies.push(new Enemy("nemesis", far.x, far.y, level));
      Sound.sfx.alarm();
      UI.nemesis("PATIENT ZERO IS AWAKE");
      shake = Math.max(shake, 10);
    }

    // Exit
    if (Utils.dist(player.x, player.y, map.exit.x, map.exit.y) < player.r + 22) {
      if (player.keys >= 3) winLevel();
      else if (msgTimer <= 0) flashMsg(`NEED ${3 - player.keys} MORE KEYCARD${3 - player.keys > 1 ? "S" : ""}`, 1.3);
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      p.vx *= 0.92; p.vy *= 0.92;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Floaty pickup text ("+1 KEYCARD!" etc.) — rises and fades.
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.y += f.vy * dt; f.vy *= 0.9; f.life -= dt;
      if (f.life <= 0) floaters.splice(i, 1);
    }

    if (player.health <= 0) return die();
    if (timeLeft <= 0) { flashMsg("CONTAINMENT BREACH — they're everywhere", 2); enrage(); timeLeft = 25; }

    // Camera follows player, clamped to map, with shake.
    const tx = player.x - W / 2, ty = player.y - H / 2;
    cam.x = Utils.lerp(cam.x, tx, 0.12);
    cam.y = Utils.lerp(cam.y, ty, 0.12);
    cam.x = Utils.clamp(cam.x, -40, Math.max(-40, map.pixW - W + 40));
    cam.y = Utils.clamp(cam.y, -40, Math.max(-40, map.pixH - H + 40));
    if (shake > 0) shake -= dt * 30;

    UI.updateHUD(player);
  }

  function collect(it) {
    it.taken = true;
    if (it.type === "keycard") {
      player.keys++; score += 500;
      Sound.sfx.keycard();
      flashMsg(`KEYCARD ${player.keys}/3 SECURED`, 1.4);
      floaty(it.x, it.y, "+1 KEYCARD!", "#7CFF00");
      burst(it.x, it.y, "#7CFF00", 18);
      shake = Math.max(shake, 3);
    } else if (it.type === "battery") {
      player.battery = Utils.clamp(player.battery + 45, 0, 100);
      if (!player.torchOn) player.torchOn = true;
      Sound.sfx.pickup(); score += 60;
      floaty(it.x, it.y, "+45% TORCH", "#00e5ff");
      burst(it.x, it.y, "#00e5ff", 10);
    } else if (it.type === "medkit") {
      player.health = Utils.clamp(player.health + 35, 0, player.maxHealth);
      Sound.sfx.pickup(); score += 80;
      floaty(it.x, it.y, "+35 HEALTH", "#ff5577");
      burst(it.x, it.y, "#ff5577", 10);
    }
  }

  // Floaty world-space text that drifts up and fades — pure "juice".
  function floaty(x, y, text, color) {
    floaters.push({ x, y: y - 14, text, color, life: 1.1, vy: -36 });
  }

  // Player melee: damage every enemy within the swing arc, knock them back,
  // and destroy any whose health hits zero.
  function resolveAttack() {
    const reach = player.attackRange;
    let hitAny = false;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      const d = Utils.dist(player.x, player.y, e.x, e.y);
      if (d > reach + e.r) continue;
      const toE = Math.atan2(e.y - player.y, e.x - player.x);
      let rel = toE - player.facing;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel)); // normalize to [-PI, PI]
      if (Math.abs(rel) > player.attackArc) continue;

      hitAny = true;
      const dead = e.hit(player.attackDmg, toE);
      burst(e.x, e.y, e.color, 6);
      if (dead) killEnemy(e, i);
    }
    Sound.sfx.swing();
    if (hitAny) { Sound.sfx.splat(); shake = Math.max(shake, 5); }
  }

  function killEnemy(e, i) {
    const pts = e.type === "nemesis" ? 2500 : e.type === "mutant" ? 400
              : e.type === "zombie" ? 150 : 40;
    score += pts;
    burst(e.x, e.y, e.color, e.type === "nemesis" ? 40 : 16);
    floaty(e.x, e.y, e.type === "nemesis" ? "PATIENT ZERO DOWN!" : "+" + pts,
           e.type === "nemesis" ? "#ff1f3d" : "#7CFF00");
    Sound.sfx.kill();
    if (e.type === "nemesis") { shake = Math.max(shake, 14); UI.nemesis("PATIENT ZERO ELIMINATED"); }
    enemies.splice(i, 1);
  }

  function enrage() {
    Sound.sfx.alarm();
    for (const e of enemies) { e.alerted = true; e.speed *= 1.15; }
    // spill in a fresh swarm
    const s = Utils.choice(map.enemySpots);
    for (let i = 0; i < 6; i++)
      enemies.push(new Enemy("insect", s.x + Utils.rand(-30, 30), s.y + Utils.rand(-30, 30), level));
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Utils.rand(0, 7), s = Utils.rand(40, 180);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: Utils.rand(0.4, 0.9), color, r: Utils.rand(2, 5) });
    }
  }

  function die() {
    state = "dead";
    shake = 14;
    Sound.sfx.dead();
    Sound.stopAmbient();
    UI.showGameOver(level, Math.floor(score), Math.floor(elapsed));
  }

  function winLevel() {
    state = "win";
    // ---- Tiered (1-3 star) victory rating ----
    //   ★    Escaped alive
    //   ★★   Escaped with > 50% torch battery
    //   ★★★  Escaped in under 90 seconds (speedrun)
    const torchPct = Math.round(player.battery);
    const secs = elapsed;
    let stars = 1;
    if (torchPct > 50) stars++;
    if (secs < 90) stars++;
    score += 1000 + Math.max(0, Math.floor(timeLeft) * 10) + player.health * 5 + stars * 500;

    // Persist the player's best rating for this level (replay incentive).
    let best = stars;
    try {
      const k = "labescape.stars." + level;
      best = Math.max(stars, parseInt(localStorage.getItem(k) || "0", 10));
      localStorage.setItem(k, String(best));
    } catch {}

    Sound.sfx.win();
    Sound.stopAmbient();
    UI.showWin(level, Math.floor(score), secs, stars, best, {
      torchOk: torchPct > 50, torch: torchPct,
      timeOk: secs < 90, time: secs.toFixed(1),
    });
  }

  function flashMsg(text, dur) {
    UI.flash(text);
    msgTimer = dur;
    setTimeout(() => UI.clearFlash(), dur * 1000);
  }

  // ---------------- RENDER ----------------
  function render() {
    ctx.save();
    let ox = 0, oy = 0;
    if (shake > 0) { ox = Utils.rand(-shake, shake); oy = Utils.rand(-shake, shake); }
    ctx.clearRect(0, 0, W, H);

    if (state === "menu") { ctx.restore(); return; }

    ctx.translate(-cam.x + ox, -cam.y + oy);

    drawFloor();
    drawItems();
    drawLogs();
    drawExit();
    for (const e of enemies) cullDraw(e);
    drawParticles();
    drawFloaters();
    player.draw(ctx);

    ctx.restore();

    // Lighting overlay (multiply darkness, torch cone reveals).
    drawLighting(ox, oy);

    // hurt vignette
    if (player && player.hurtFlash > 0) {
      ctx.fillStyle = `rgba(255,0,40,${player.hurtFlash * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function cullDraw(e) {
    if (e.x < cam.x - 60 || e.x > cam.x + W + 60 || e.y < cam.y - 60 || e.y > cam.y + H + 60) return;
    e.draw(ctx);
  }

  function drawFloor() {
    const startX = Math.max(0, Math.floor(cam.x / TILE));
    const startY = Math.max(0, Math.floor(cam.y / TILE));
    const endX = Math.min(map.cols, Math.ceil((cam.x + W) / TILE));
    const endY = Math.min(map.rows, Math.ceil((cam.y + H) / TILE));
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const t = map.grid[y][x];
        const px = x * TILE, py = y * TILE;
        if (t === 1) {
          // wall
          ctx.fillStyle = "#10151f";
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = "#1b2740";
          ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 6);
          ctx.fillStyle = "rgba(0,229,255,0.10)";
          ctx.fillRect(px + 2, py + 2, TILE - 4, 3);
        } else {
          // floor tiles, checker with toxic grime
          const dark = (x + y) % 2 === 0;
          ctx.fillStyle = dark ? "#0c1218" : "#0e1620";
          ctx.fillRect(px, py, TILE, TILE);
          ctx.strokeStyle = "rgba(57,255,20,0.05)";
          ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
          if ((x * 7 + y * 13) % 11 === 0) {
            ctx.fillStyle = "rgba(124,255,0,0.06)";
            ctx.beginPath(); ctx.arc(px + TILE / 2, py + TILE / 2, 10, 0, 7); ctx.fill();
          }
        }
      }
    }
  }

  function drawItems() {
    for (const it of map.items) {
      if (it.taken) continue;
      const by = Math.sin(it.bob) * 4;
      ctx.save();
      ctx.translate(it.x, it.y + by);
      ctx.shadowBlur = 16;
      if (it.type === "keycard") {
        ctx.shadowColor = "#7CFF00"; ctx.fillStyle = "#7CFF00";
        ctx.fillRect(-11, -7, 22, 14);
        ctx.fillStyle = "#0c1218"; ctx.fillRect(-7, -3, 8, 6);
        ctx.fillStyle = "#0c1218"; ctx.fillRect(3, -4, 5, 2);
      } else if (it.type === "battery") {
        ctx.shadowColor = "#00e5ff"; ctx.fillStyle = "#00e5ff";
        ctx.fillRect(-7, -10, 14, 20); ctx.fillStyle = "#06303a"; ctx.fillRect(-4, -6, 8, 5);
      } else {
        ctx.shadowColor = "#ff3366"; ctx.fillStyle = "#fff";
        ctx.fillRect(-10, -10, 20, 20);
        ctx.fillStyle = "#ff1f3d"; ctx.fillRect(-2, -7, 4, 14); ctx.fillRect(-7, -2, 14, 4);
      }
      ctx.restore();
    }
  }

  function drawLogs() {
    const now = performance.now();
    for (const lg of map.logs) {
      if (lg.read) continue;
      const by = Math.sin(lg.bob) * 3;
      const pulse = 0.55 + Math.sin(now / 280 + lg.idx) * 0.45;
      ctx.save();
      ctx.translate(lg.x, lg.y + by);
      ctx.shadowColor = "#7CFF00"; ctx.shadowBlur = 10 + pulse * 14;
      // little terminal / PDA glyph
      ctx.fillStyle = `rgba(124,255,0,${0.55 + pulse * 0.45})`;
      ctx.fillRect(-8, -10, 16, 20);
      ctx.fillStyle = "#04140a";
      ctx.fillRect(-5, -7, 10, 9);
      ctx.fillStyle = "#7CFF00";
      ctx.fillRect(-4, -1, 8, 1.5);
      ctx.fillRect(-4, 4, 6, 1.5);
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  function drawFloaters() {
    for (const f of floaters) {
      ctx.globalAlpha = Utils.clamp(f.life, 0, 1);
      ctx.fillStyle = f.color;
      ctx.font = "bold 15px 'Trebuchet MS', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = f.color; ctx.shadowBlur = 8;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
  }

  function drawExit() {
    const e = map.exit;
    const pulse = 0.5 + Math.sin(performance.now() / 300) * 0.5;
    ctx.save();
    ctx.translate(e.x, e.y);
    const open = player.keys >= 3;
    ctx.shadowBlur = 24; ctx.shadowColor = open ? "#7CFF00" : "#ff1f3d";
    ctx.fillStyle = open ? `rgba(124,255,0,${0.6 + pulse * 0.4})` : `rgba(255,31,61,${0.4 + pulse * 0.3})`;
    ctx.fillRect(-TILE / 2 + 4, -TILE / 2 + 2, TILE - 8, TILE - 4);
    ctx.fillStyle = "#02110a";
    ctx.fillRect(-TILE / 2 + 11, -TILE / 2 + 8, TILE - 22, TILE - 12);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff"; ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
    ctx.fillText(open ? "EXIT" : "LOCK", 0, TILE / 2 + 12);
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Utils.clamp(p.life, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Darkness + torch cone via a separate light buffer punched out of black.
  function drawLighting(ox, oy) {
    lightCtx.clearRect(0, 0, W, H);
    lightCtx.fillStyle = "rgba(2,4,8,0.93)";
    lightCtx.fillRect(0, 0, W, H);

    lightCtx.globalCompositeOperation = "destination-out";
    const px = player.x - cam.x + ox, py = player.y - cam.y + oy;

    // soft ambient glow around player
    let g = lightCtx.createRadialGradient(px, py, 8, px, py, 95);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    lightCtx.fillStyle = g;
    lightCtx.beginPath(); lightCtx.arc(px, py, 95, 0, 7); lightCtx.fill();

    // torch cone — with a "near-miss" flicker once the battery drops under 20%.
    // The dying light creates urgency and makes a narrow escape feel earned.
    if (player.torchOn) {
      let flicker = 1;
      if (player.battery < 20) {
        const t = performance.now();
        const wave = Math.sin(t * 0.05) * Math.sin(t * 0.013);
        flicker = 0.5 + 0.5 * Math.max(0, wave);
        if (Math.random() < 0.10) flicker *= 0.3;     // brief dropouts
        flicker = Utils.clamp(flicker, 0.12, 1);
      }
      const reach = 320 * (0.6 + 0.4 * flicker), half = 0.55;
      const a = player.facing;
      const cg = lightCtx.createRadialGradient(px, py, 20, px, py, reach);
      cg.addColorStop(0, `rgba(0,0,0,${flicker})`);
      cg.addColorStop(0.7, `rgba(0,0,0,${0.85 * flicker})`);
      cg.addColorStop(1, "rgba(0,0,0,0)");
      lightCtx.fillStyle = cg;
      lightCtx.beginPath();
      lightCtx.moveTo(px, py);
      lightCtx.arc(px, py, reach, a - half, a + half);
      lightCtx.closePath(); lightCtx.fill();
    }
    lightCtx.globalCompositeOperation = "source-over";

    // toxic color tint on the lit areas
    ctx.drawImage(lightCanvas, 0, 0);

    // torch warm tint
    if (player.torchOn) {
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      const a = player.facing;
      const tg = ctx.createRadialGradient(px, py, 20, px, py, 300);
      tg.addColorStop(0, "rgba(124,255,0,0.12)");
      tg.addColorStop(1, "rgba(124,255,0,0)");
      ctx.fillStyle = tg;
      ctx.beginPath(); ctx.moveTo(px, py);
      ctx.arc(px, py, 300, a - 0.55, a + 0.55); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  return {
    boot, start, update, render,
    get state() { return state; },
    setState: (s) => { state = s; },
    get level() { return level; },
    get score() { return score; },
    resetScore: () => { score = 0; },
  };
})();
