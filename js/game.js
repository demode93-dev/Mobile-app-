// Game controller: state machine, level setup, camera, lighting/fog-of-war,
// HUD, particles, and win/lose handling.
const Game = (() => {
  let canvas, ctx, W, H, dpr;
  let state = "menu"; // menu | playing | dead | win
  let map, player, enemies, particles, floaters, drips, bolts;
  let dog = null, rescued = 0, reviveUsed = false;
  let level = 1, score = 0, timeLeft, elapsed;
  let cam = { x: 0, y: 0 };
  let lightCanvas, lightCtx;
  let msgTimer = 0;
  let shake = 0;
  let nemesisSpawned = false;   // Patient Zero tease — fires once per level
  let dripTimer = 0;            // ambient water-drip cadence
  let sprinklerTimer = 0;       // sprinkler hiss cadence while in the wet zone

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

  function ownsDog() {
    try { return localStorage.getItem("labescape.dog") === "1"; } catch { return false; }
  }

  // ---- Weapon progression ----
  // Scrap is a permanent currency: every 4 pieces buys +6 damage / +4 reach.
  function scrapTotal() {
    try { return parseInt(localStorage.getItem("labescape.scrap") || "0", 10) || 0; } catch { return 0; }
  }
  function upgradeLevel() { return Math.floor(scrapTotal() / 4); }
  function applyUpgrades(p) {
    const u = upgradeLevel();
    p.attackDmg = 44 + u * 6;
    p.attackRange = 60 + u * 4;
  }
  // Ranged stun bolt unlocks by rank (level). Tier 3 bolts pierce + hit harder.
  function weaponTier(lvl) { return lvl >= 4 ? 3 : lvl >= 2 ? 2 : 1; }

  function start(lvl) {
    level = lvl;
    map = GameMap.make(level, ownsDog());
    player = new Player(map.spawn.x, map.spawn.y);
    // A previously rescued dog tags along from the start of every later level.
    dog = ownsDog() ? new Dog(map.spawn.x - 30, map.spawn.y) : null;
    rescued = 0;
    reviveUsed = false;
    bolts = [];
    applyUpgrades(player);
    player.weaponTier = weaponTier(level);
    enemies = [];
    particles = [];
    floaters = [];
    drips = [];
    nemesisSpawned = false;
    dripTimer = Utils.rand(1, 3);
    sprinklerTimer = 0;
    elapsed = 0;
    timeLeft = Math.max(90, 150 - level * 8); // soft pressure: alarm countdown

    // Populate enemies from spawn rooms, more & nastier each level.
    const spots = map.enemySpots.slice();
    const zCount = 3 + level;
    const mCount = Math.min(1 + Math.floor(level / 2), 6);
    const swarms = 1 + Math.floor(level / 2);
    for (let i = 0; i < zCount; i++) spawnFrom(spots, "zombie");
    for (let i = 0; i < mCount; i++) spawnFrom(spots, "mutant");
    for (let s = 0; s < swarms; s++) {
      const base = Utils.choice(map.enemySpots);
      for (let i = 0; i < 4; i++)
        enemies.push(new Enemy("insect", base.x + Utils.rand(-30, 30), base.y + Utils.rand(-30, 30), level));
    }

    state = "playing";
    flashMsg(level === 1 ? "FIND 3 KEYCARDS — REACH THE EXIT" : `LEVEL ${level} — IT'S WORSE DOWN HERE`, 2.6);
    // Announce a newly unlocked weapon tier on the level it becomes available.
    if (level === 2) setTimeout(() => { if (state === "playing") flashMsg("⚡ STUN BOLT ONLINE — fire with attack", 2); }, 2700);
    if (level === 4) setTimeout(() => { if (state === "playing") flashMsg("⚡ HIGH-VOLTAGE BOLT — pierces enemies", 2); }, 2700);
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

    // Rescue caged lab animals (the dog cage grants the companion).
    for (const a of map.animals) {
      if (a.freed) continue;
      if (Utils.dist(player.x, player.y, a.x, a.y) < player.r + 22) {
        a.freed = true;
        rescued++;
        score += 300;
        Sound.sfx.rescue();
        if (a.kind === "dog") {
          try { localStorage.setItem("labescape.dog", "1"); } catch {}
          dog = new Dog(a.x, a.y);
          flashMsg("RESCUED A DOG — IT'S WITH YOU NOW", 2);
          floaty(a.x, a.y, "GOOD BOY!", "#ffcf5c");
        } else {
          floaty(a.x, a.y, `RESCUED ${a.kind.toUpperCase()}!`, "#7CFF00");
        }
        burst(a.x, a.y, "#ffcf5c", 14);
      }
    }

    // Companion dog: follows, barks at threats, sniffs loot.
    if (dog) {
      dog.update(dt, map, player, enemies,
        (dg) => { Sound.sfx.bark(); shake = Math.max(shake, 2); },
        (dg, item) => {
          // little sniff sparkle drifting toward the loot it found
          const a = Math.atan2(item.y - dg.y, item.x - dg.x);
          particles.push({ x: dg.x + Math.cos(a) * 14, y: dg.y + Math.sin(a) * 14,
            vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, life: 0.6, color: "#7CFF00", r: 2 });
        });
    }

    updateBolts(dt);
    updateAtmosphere(dt);

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
    } else if (it.type === "medkit") {
      player.health = Utils.clamp(player.health + 35, 0, player.maxHealth);
      Sound.sfx.pickup(); score += 80;
      floaty(it.x, it.y, "+35 HEALTH", "#ff5577");
      burst(it.x, it.y, "#ff5577", 10);
    } else if (it.type === "scrap") {
      try { localStorage.setItem("labescape.scrap", String(scrapTotal() + 1)); } catch {}
      applyUpgrades(player);                    // upgrades apply immediately
      Sound.sfx.pickup(); score += 40;
      const next = 4 - (scrapTotal() % 4);
      floaty(it.x, it.y, next === 4 ? "WEAPON UPGRADED!" : "+SCRAP", "#ffae42");
      burst(it.x, it.y, "#ffae42", 9);
    }
  }

  // Floaty world-space text that drifts up and fades — pure "juice".
  function floaty(x, y, text, color) {
    floaters.push({ x, y: y - 14, text, color, life: 1.1, vy: -36 });
  }

  // ---- Atmosphere: ambient drips, sprinkler rain, slippery-floor splashes ----
  function spawnDrip(x, groundY) {
    drips.push({ x, y: groundY - Utils.rand(120, 200), vy: Utils.rand(60, 120),
                 groundY, sprinkler: false });
  }

  function updateAtmosphere(dt) {
    // Occasional lone water drip somewhere near the player (off-screen-ish).
    dripTimer -= dt;
    if (dripTimer <= 0) {
      dripTimer = Utils.rand(1.4, 4.2);
      const dx = player.x + Utils.rand(-W * 0.4, W * 0.4);
      const dy = player.y + Utils.rand(-H * 0.4, H * 0.4);
      if (!GameMap.isWall(map, dx, dy)) {
        spawnDrip(dx, dy);
        Sound.sfx.drip();
      }
    }

    // Inside the sprinkler room: constant rainfall + periodic hiss.
    if (player.onWet && map.wetRoom) {
      const r = map.wetRoom;
      for (let i = 0; i < 2; i++) {
        const x = (r.x + Math.random() * r.w) * TILE;
        const y = (r.y + Math.random() * r.h) * TILE;
        drips.push({ x, y: y - Utils.rand(140, 220), vy: Utils.rand(220, 320),
                     groundY: y, sprinkler: true });
      }
      sprinklerTimer -= dt;
      if (sprinklerTimer <= 0) { Sound.sfx.sprinkler(); sprinklerTimer = Utils.rand(0.5, 1.1); }
    }

    // Fall + splash.
    for (let i = drips.length - 1; i >= 0; i--) {
      const d = drips[i];
      d.vy += 600 * dt;
      d.y += d.vy * dt;
      if (d.y >= d.groundY) {
        burst(d.x, d.groundY, "#9fd6ff", d.sprinkler ? 3 : 5);
        drips.splice(i, 1);
      }
    }
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

    // Ranged stun bolt fires along with the swing once unlocked by rank.
    const tier = player.weaponTier || 1;
    if (tier >= 2) {
      const a = player.facing, spd = 520;
      bolts.push({
        x: player.x + Math.cos(a) * player.r, y: player.y + Math.sin(a) * player.r,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 0.7,
        dmg: tier >= 3 ? 40 : 26, pierce: tier >= 3, hits: 0,
      });
      Sound.sfx.zap();
    }
  }

  // Stun bolts: travel forward, stun + damage what they hit, fizzle on walls.
  function updateBolts(dt) {
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      let gone = b.life <= 0 || GameMap.isWall(map, b.x, b.y);
      if (!gone) {
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          if (Utils.dist(b.x, b.y, e.x, e.y) < e.r + 5) {
            const ang = Math.atan2(b.vy, b.vx);
            const dead = e.hit(b.dmg, ang);
            e.stun = Math.max(e.stun, 1.6);
            burst(b.x, b.y, "#36d1ff", 6);
            if (dead) killEnemy(e, j);
            b.hits++;
            if (!b.pierce || b.hits >= 3) { gone = true; }
            break;
          }
        }
      }
      if (gone) bolts.splice(i, 1);
    }
  }

  function drawBolts() {
    for (const b of bolts) {
      const a = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(b.x, b.y); ctx.rotate(a);
      ctx.shadowColor = "#36d1ff"; ctx.shadowBlur = 12;
      ctx.fillStyle = "#bdecff";
      ctx.fillRect(-10, -2, 20, 4);
      ctx.fillStyle = "#36d1ff";
      ctx.fillRect(-6, -1, 14, 2);
      ctx.restore();
    }
    ctx.shadowBlur = 0;
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
    UI.showGameOver(level, Math.floor(score), Math.floor(elapsed), !reviveUsed);
  }

  // Rewarded-ad revive: pick the worker back up mid-floor with partial health,
  // clear the immediate area, and a moment of invulnerability. One per floor.
  function revive() {
    if (state !== "dead" || reviveUsed) return false;
    reviveUsed = true;
    player.health = 60;
    player.invuln = 2;
    // shove nearby enemies off so you don't instantly die again
    for (const e of enemies) {
      if (Utils.dist(player.x, player.y, e.x, e.y) < 170) {
        const a = Math.atan2(e.y - player.y, e.x - player.x);
        e.kx += Math.cos(a) * 320; e.ky += Math.sin(a) * 320; e.stun = 2;
      }
    }
    state = "playing";
    Sound.sfx.rescue();
    Sound.startAmbient();
    return true;
  }

  function winLevel() {
    state = "win";
    // ---- Tiered (1-3 star) victory rating ----
    //   ★    Escaped alive
    //   ★★   Escaped with > 50% health
    //   ★★★  Escaped in under 90 seconds (speedrun)
    const hpPct = Math.round(player.health);
    const secs = elapsed;
    let stars = 1;
    if (hpPct > 50) stars++;
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
      hpOk: hpPct > 50, hp: hpPct,
      timeOk: secs < 90, time: secs.toFixed(1),
      rescued, animals: map.animals.length,
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
    drawAnimals();
    drawExit();
    for (const e of enemies) cullDraw(e);
    if (dog) dog.draw(ctx);
    drawBolts();
    drawDrips();
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

    // Sprinkler screen droplets — streaks on the "lens" while under the water.
    if (player && player.onWet) drawScreenDroplets();
  }

  function drawDrips() {
    ctx.strokeStyle = "rgba(160,210,255,0.6)";
    ctx.lineWidth = 2; ctx.lineCap = "round";
    for (const d of drips) {
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x, d.y + (d.sprinkler ? 10 : 6));
      ctx.stroke();
    }
  }

  // Cheap, cached "water on the camera" overlay while in the sprinkler zone.
  function drawScreenDroplets() {
    if (!drawScreenDroplets.pts) {
      drawScreenDroplets.pts = [];
      for (let i = 0; i < 14; i++)
        drawScreenDroplets.pts.push({ x: Math.random(), y: Math.random(), r: 4 + Math.random() * 9 });
    }
    ctx.save();
    for (const p of drawScreenDroplets.pts) {
      const x = p.x * W, y = p.y * H;
      ctx.fillStyle = "rgba(180,215,255,0.10)";
      ctx.beginPath(); ctx.arc(x, y, p.r, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath(); ctx.arc(x - p.r * 0.3, y - p.r * 0.3, p.r * 0.35, 0, 7); ctx.fill();
    }
    ctx.restore();
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
          const wet = map.wet && map.wet.has(x + "," + y);
          const dark = (x + y) % 2 === 0;
          if (wet) {
            // flooded sprinkler floor — cold blue sheen with a wet glint
            ctx.fillStyle = dark ? "#0a1622" : "#0c1c2c";
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = "rgba(120,190,255,0.10)";
            ctx.fillRect(px, py, TILE, TILE);
            const gl = 0.5 + 0.5 * Math.sin(performance.now() / 400 + x + y);
            ctx.fillStyle = `rgba(160,210,255,${0.05 + gl * 0.06})`;
            ctx.beginPath(); ctx.ellipse(px + TILE / 2, py + TILE * 0.7, TILE * 0.32, TILE * 0.14, 0, 0, 7); ctx.fill();
          } else {
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

    // Ceiling light fixtures (drawn on the floor as the housing; the glow is
    // punched into the darkness overlay in drawLighting).
    for (const lt of map.lights) {
      if (lt.x < cam.x - 40 || lt.x > cam.x + W + 40 ||
          lt.y < cam.y - 40 || lt.y > cam.y + H + 40) continue;
      const on = lightFlicker(lt) > 0.15;
      ctx.fillStyle = "#1a2230";
      ctx.fillRect(lt.x - 14, lt.y - 4, 28, 8);
      ctx.fillStyle = on ? "rgba(220,240,255,0.9)" : "rgba(60,70,85,0.8)";
      ctx.fillRect(lt.x - 11, lt.y - 2, 22, 4);
    }
  }

  // Per-light flicker factor 0..1. Broken fixtures stutter hard; good ones
  // hum with a faint waver.
  function lightFlicker(lt) {
    const t = performance.now() / 1000;
    if (lt.broken) {
      const f = Math.sin(t * 13 + lt.phase) * Math.sin(t * 7.3 + lt.phase * 2);
      let v = 0.35 + 0.65 * Math.max(0, f);
      if (Math.random() < 0.06) v *= 0.15;       // random blackout blink
      return v;
    }
    return 0.8 + 0.2 * Math.sin(t * 2 + lt.phase);
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
      } else if (it.type === "scrap") {
        ctx.shadowColor = "#ffae42"; ctx.fillStyle = "#ffae42";
        // a little nut/bolt cog
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const aa = (k / 6) * Math.PI * 2;
          ctx[k ? "lineTo" : "moveTo"](Math.cos(aa) * 9, Math.sin(aa) * 9);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#0c1218"; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, 7); ctx.fill();
      } else {
        ctx.shadowColor = "#ff3366"; ctx.fillStyle = "#fff";
        ctx.fillRect(-10, -10, 20, 20);
        ctx.fillStyle = "#ff1f3d"; ctx.fillRect(-2, -7, 4, 14); ctx.fillRect(-7, -2, 14, 4);
      }
      ctx.restore();
    }
  }

  const ANIMAL_ICON = { dog: "🐕", rabbit: "🐇", monkey: "🐒", rat: "🐀", cat: "🐈" };
  function drawAnimals() {
    const now = performance.now();
    for (const a of map.animals) {
      if (a.freed) continue;
      const pulse = 0.5 + 0.5 * Math.sin(now / 300 + a.x);
      ctx.save();
      ctx.translate(a.x, a.y);
      // cage glow (dog cage glows warm gold to draw the eye)
      ctx.shadowColor = a.kind === "dog" ? "#ffcf5c" : "#9fd6ff";
      ctx.shadowBlur = 8 + pulse * 10;
      ctx.fillStyle = a.kind === "dog" ? "rgba(255,207,92,0.18)" : "rgba(159,214,255,0.12)";
      ctx.fillRect(-14, -14, 28, 28);
      ctx.shadowBlur = 0;
      // captive
      ctx.font = "16px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(ANIMAL_ICON[a.kind] || "🐾", 0, 6);
      // cage bars
      ctx.strokeStyle = "rgba(180,200,220,0.7)"; ctx.lineWidth = 1.5;
      for (let bx = -12; bx <= 12; bx += 6) {
        ctx.beginPath(); ctx.moveTo(bx, -14); ctx.lineTo(bx, 14); ctx.stroke();
      }
      ctx.strokeRect(-14, -14, 28, 28);
      ctx.restore();
    }
    ctx.textAlign = "left";
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

  // Lighting model: the lab is dark and lit ONLY by the facility's own
  // (flickering) ceiling lights, plus a small glow the player carries by
  // proximity. No flashlight. A separate buffer is punched out of black.
  function drawLighting(ox, oy) {
    lightCtx.clearRect(0, 0, W, H);
    lightCtx.fillStyle = "rgba(2,4,8,0.9)";
    lightCtx.fillRect(0, 0, W, H);

    lightCtx.globalCompositeOperation = "destination-out";
    const px = player.x - cam.x + ox, py = player.y - cam.y + oy;

    // Soft personal glow so you can always see your immediate surroundings.
    let g = lightCtx.createRadialGradient(px, py, 14, px, py, 150);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.55, "rgba(0,0,0,0.7)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    lightCtx.fillStyle = g;
    lightCtx.beginPath(); lightCtx.arc(px, py, 150, 0, 7); lightCtx.fill();

    // Flickering ceiling-light pools — now the PRIMARY light. Broken bulbs
    // stutter and die, throwing enemies into tense silhouette.
    for (const lt of map.lights) {
      const lx = lt.x - cam.x + ox, ly = lt.y - cam.y + oy;
      if (lx < -180 || lx > W + 180 || ly < -180 || ly > H + 180) continue;
      const f = lightFlicker(lt);
      if (f < 0.1) continue;
      const rad = 165 * f;
      const lg2 = lightCtx.createRadialGradient(lx, ly, 8, lx, ly, rad);
      lg2.addColorStop(0, `rgba(0,0,0,${0.96 * f})`);
      lg2.addColorStop(0.7, `rgba(0,0,0,${0.6 * f})`);
      lg2.addColorStop(1, "rgba(0,0,0,0)");
      lightCtx.fillStyle = lg2;
      lightCtx.beginPath(); lightCtx.arc(lx, ly, rad, 0, 7); lightCtx.fill();
    }

    lightCtx.globalCompositeOperation = "source-over";
    ctx.drawImage(lightCanvas, 0, 0);

    // Cold fluorescent tint inside the lit pools for mood.
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    for (const lt of map.lights) {
      const lx = lt.x - cam.x + ox, ly = lt.y - cam.y + oy;
      if (lx < -180 || lx > W + 180 || ly < -180 || ly > H + 180) continue;
      const f = lightFlicker(lt);
      if (f < 0.1) continue;
      const tg = ctx.createRadialGradient(lx, ly, 8, lx, ly, 165 * f);
      tg.addColorStop(0, `rgba(150,200,255,${0.10 * f})`);
      tg.addColorStop(1, "rgba(150,200,255,0)");
      ctx.fillStyle = tg;
      ctx.beginPath(); ctx.arc(lx, ly, 165 * f, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  return {
    boot, start, update, render, revive,
    get state() { return state; },
    setState: (s) => { state = s; },
    get level() { return level; },
    get score() { return score; },
    resetScore: () => { score = 0; },
  };
})();
