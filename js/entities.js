// Player + enemy types. Sprites are drawn procedurally with canvas shapes,
// so no image assets are required.

// Filled rounded rectangle helper (used to build the character sprites).
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.r = 14;
    this.speed = 168;
    this.health = 100;
    this.maxHealth = 100;
    this.stamina = 100;       // sprint fuel (replaces the old torch battery)
    this.facing = 0;        // radians
    this.keys = 0;
    this.hurtFlash = 0;
    this.invuln = 0;
    this.walkPhase = 0;
    this.stepTimer = 0;
    this.moving = false;
    this.vx = 0; this.vy = 0;   // velocity (enables slippery wet floors)
    this.onWet = false;
    // --- Combat ---
    this.attackDmg = 44;
    this.attackRange = 60;   // reach in pixels (plus enemy radius)
    this.attackArc = 1.05;   // half-angle of the swing cone (radians)
    this.attackCd = 0;       // cooldown timer
    this.swing = 0;          // swing animation timer
    this.pendingHit = false; // one-shot flag consumed by the game controller
  }

  update(dt, map) {
    Input.poll();
    let { x: mx, y: my } = Input.move;
    const moving = mx !== 0 || my !== 0;
    this.moving = moving;
    const sprint = Input.sprint && this.stamina > 0 && moving;
    this.sprinting = sprint;              // mutants let you dash past while true
    const spd = this.speed * (sprint ? 1.7 : 1);

    if (moving) this.facing = Math.atan2(my, mx);

    // Velocity-based movement. On dry floor acceleration is near-instant (feels
    // responsive); on the flooded sprinkler floor it's sluggish, so you slide.
    this.onWet = GameMap.isWet(map, this.x, this.y);
    const accel = this.onWet ? 3.2 : 26;
    const k = Math.min(1, accel * dt);
    this.vx += (mx * spd - this.vx) * k;
    this.vy += (my * spd - this.vy) * k;

    const res = GameMap.moveCircle(map, this.x, this.y, this.r, this.vx * dt, this.vy * dt);
    if (res.x === this.x) this.vx *= 0.2;   // bumped a wall — bleed off momentum
    if (res.y === this.y) this.vy *= 0.2;
    this.x = res.x; this.y = res.y;

    const speedNow = Math.hypot(this.vx, this.vy);
    if (speedNow > 12) {
      this.walkPhase += dt * (sprint ? 16 : 10);
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        Sound.sfx.step(); this.stepTimer = sprint ? 0.28 : 0.42;
      }
    }
    this.moving = speedNow > 12;

    // Sprint burns stamina; it recovers when you ease off.
    if (sprint) this.stamina = Utils.clamp(this.stamina - dt * 32, 0, 100);
    else this.stamina = Utils.clamp(this.stamina + dt * 22, 0, 100);

    // --- Combat: melee swing on a cooldown. Game controller resolves the hit. ---
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.swing > 0) this.swing -= dt;
    if (Input.attackToggled && this.attackCd <= 0) {
      this.attackCd = 0.4;
      this.swing = 0.2;
      this.pendingHit = true;
      Sound.sfx.swing();
    }

    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.invuln > 0) this.invuln -= dt;
  }

  damage(amount) {
    if (this.invuln > 0) return;
    this.health -= amount;
    this.hurtFlash = 0.35;
    this.invuln = 0.6;
    Sound.sfx.hurt();
  }

  // Continuous contact damage (no invuln gate) — `dps` is damage-per-second so
  // lingering against a zombie or hazard drains you fast, glancing hits don't.
  contact(dps, dt) {
    this.health -= dps * dt;
    this.hurtFlash = Math.max(this.hurtFlash, 0.3);
    this._hurtSfxT = (this._hurtSfxT || 0) - dt;
    if (this._hurtSfxT <= 0) { Sound.sfx.hurt(); this._hurtSfxT = 0.4; }
  }

  draw(ctx) {
    const r = this.r;
    const hurt = this.hurtFlash > 0;
    const stride = this.moving ? Math.sin(this.walkPhase) : 0;
    ctx.save();
    ctx.translate(this.x, this.y);

    // ground shadow (unrotated)
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * 0.85, 0, 0, 7); ctx.fill();

    ctx.rotate(this.facing);  // local forward = +x

    // legs trailing behind, alternating with stride
    ctx.fillStyle = "#1f2b4d";
    rr(ctx, -r * 0.95 + stride * 3, -r * 0.6, r * 0.7, r * 0.42, 3);
    rr(ctx, -r * 0.95 - stride * 3,  r * 0.18, r * 0.7, r * 0.42, 3);

    // backpack unit at rear (glows green while sprinting/recovered)
    ctx.fillStyle = "#363b46";
    rr(ctx, -r * 0.85, -r * 0.5, r * 0.55, r * 1.0, 4);
    ctx.fillStyle = this.sprinting ? "#b78bff" : "#2a6a55";
    rr(ctx, -r * 0.68, -r * 0.18, r * 0.16, r * 0.36, 2);

    // arms
    ctx.fillStyle = hurt ? "#ff5566" : "#e9b800";
    rr(ctx, r * 0.05, -r * 1.0, r * 0.55, r * 0.3, 3);  // off hand to the side
    rr(ctx, r * 0.15,  r * 0.55, r * 0.8, r * 0.3, 3);  // weapon hand

    // torso (hazmat suit)
    ctx.fillStyle = hurt ? "#ff5566" : "#ffd23f";
    ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 0.78, 0, 0, 7); ctx.fill(); ctx.stroke();
    // cyan chest stripe (across the body)
    ctx.fillStyle = "#00e5ff";
    rr(ctx, -r * 0.16, -r * 0.62, r * 0.32, r * 1.24, 2);

    // head with visor facing forward
    ctx.fillStyle = hurt ? "#ffaab0" : "#ffe08a";
    ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(r * 0.32, 0, r * 0.5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#001b1f";
    ctx.beginPath(); ctx.arc(r * 0.52, 0, r * 0.26, 0, 7); ctx.fill();
    ctx.fillStyle = "#7CFF00";
    ctx.beginPath(); ctx.arc(r * 0.6, 0, r * 0.12, 0, 7); ctx.fill();

    // stun baton in the forward hand
    ctx.fillStyle = "#2b2f3a";
    rr(ctx, r * 0.95, r * 0.5, r * 0.5, r * 0.24, 2);
    ctx.fillStyle = "#36d1ff";
    rr(ctx, r * 1.36, r * 0.54, r * 0.14, r * 0.16, 1);

    // melee swing — a bright crescent sweeping across the front
    if (this.swing > 0) {
      const t = 1 - this.swing / 0.2;          // 0 → 1 over the swing
      const sweep = -this.attackArc + t * 2 * this.attackArc;
      ctx.save();
      ctx.rotate(sweep);
      ctx.strokeStyle = `rgba(180,240,255,${0.85 * (1 - t) + 0.25})`;
      ctx.lineWidth = 4;
      ctx.shadowColor = "#aef"; ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, this.attackRange * 0.75, -0.45, 0.45);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }
}

// Rescued dog companion: follows the player, barks to warn of nearby threats,
// and sniffs out the nearest loot.
class Dog {
  constructor(x, y) {
    this.x = x; this.y = y; this.r = 11;
    this.speed = 200;
    this.facing = 0;
    this.phase = Math.random() * 7;
    this.barkCd = 0;
    this.sniffCd = 0;
    this.bark = 0;          // bark animation/alert timer
    this.sniffTarget = null;
    // Cosmetic skin (from the shop). Falls back to the default breed.
    this.skin = (typeof Commerce !== "undefined") ? Commerce.activeSkin()
              : { body: "#c79b6b", accent: "#8a6238" };
  }

  update(dt, map, player, enemies, onBark, onSniff) {
    const d = Utils.dist(this.x, this.y, player.x, player.y);
    // Follow, but keep a little personal space so it doesn't jitter on the player.
    if (d > 46) {
      const step = GameMap.nextStepToward(map, this.x, this.y, player.x, player.y) ||
        { x: Math.cos(0), y: 0 };
      const ang = Math.atan2(step.y, step.x);
      this.facing = ang;
      const spd = this.speed * (d > 160 ? 1.25 : 1);  // catch up if far
      const res = GameMap.moveCircle(map, this.x, this.y, this.r, Math.cos(ang) * spd * dt, Math.sin(ang) * spd * dt);
      this.x = res.x; this.y = res.y;
    }
    this.phase += dt * 10;
    if (this.bark > 0) this.bark -= dt;
    if (this.barkCd > 0) this.barkCd -= dt;
    if (this.sniffCd > 0) this.sniffCd -= dt;

    // Bark when a threat gets close.
    if (this.barkCd <= 0) {
      let near = null, nd = 200;
      for (const e of enemies) {
        const ed = Utils.dist(this.x, this.y, e.x, e.y);
        if (ed < nd) { nd = ed; near = e; }
      }
      if (near) { this.bark = 0.6; this.barkCd = 2.2; onBark && onBark(this, near); }
    }

    // Sniff out the nearest loot every few seconds.
    if (this.sniffCd <= 0 && map.items) {
      let best = null, bd = 360;
      for (const it of map.items) {
        if (it.taken) continue;
        const id = Utils.dist(this.x, this.y, it.x, it.y);
        if (id < bd) { bd = id; best = it; }
      }
      this.sniffTarget = best;
      if (best) { this.sniffCd = 2.8; onSniff && onSniff(this, best); }
      else this.sniffCd = 1.5;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(0, this.r * 0.7, this.r * 0.9, this.r * 0.35, 0, 0, 7); ctx.fill();
    ctx.rotate(this.facing);
    const wob = Math.sin(this.phase) * 1.5;
    const body = this.skin.body, accent = this.skin.accent;
    // body
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, this.r, this.r * 0.7, 0, 0, 7); ctx.fill();
    // collar (skin accent)
    ctx.strokeStyle = accent; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(this.r * 0.35, 0, this.r * 0.55, -1, 1); ctx.stroke();
    // tail (wags)
    ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-this.r * 0.8, 0);
    ctx.lineTo(-this.r * 1.4, Math.sin(this.phase * 2) * 5); ctx.stroke();
    // head forward
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(this.r * 0.7, wob, this.r * 0.6, 0, 7); ctx.fill();
    // ear + snout + eye
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.ellipse(this.r * 0.5, wob - this.r * 0.4, 3, 5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#3a2a16";
    ctx.beginPath(); ctx.arc(this.r * 1.15, wob, 2.4, 0, 7); ctx.fill();
    ctx.restore();
    // bark "!" alert
    if (this.bark > 0) {
      ctx.fillStyle = "#ffcf5c"; ctx.font = "bold 16px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center"; ctx.shadowColor = "#ffcf5c"; ctx.shadowBlur = 8;
      ctx.fillText("!", this.x, this.y - this.r - 6);
      ctx.shadowBlur = 0; ctx.textAlign = "left";
    }
  }
}

class Enemy {
  constructor(type, x, y, level) {
    this.type = type;
    this.x = x; this.y = y;
    this.alerted = false;
    this.wanderAng = Utils.rand(0, 7);
    this.wanderT = 0;
    this.phase = Math.random() * 7;
    this.flash = 0;
    this.faceAng = 0;        // direction the villain is oriented (toward prey)
    this.kx = 0; this.ky = 0; // knockback velocity from player hits
    this.stun = 0;           // frozen by a stun bolt while > 0
    this.scent = 0;          // swarm/nemesis memory of the player's trail

    const boost = 1 + level * 0.06;
    const hpBoost = 1 + level * 0.12;
    if (type === "zombie") {
      // Slow, predictable shambler — solid damage if it reaches you.
      this.r = 15; this.speed = 50 * boost; this.dmg = 26; this.color = "#5fbf3f";
      this.senseR = 240; this.maxHp = 58 * hpBoost;
    } else if (type === "mutant") {
      // Stationary corridor hazard. Tanky; dash past or chip it down.
      this.r = 21; this.speed = 0; this.dmg = 42; this.color = "#c026d3";
      this.senseR = 0; this.maxHp = 160 * hpBoost;
    } else if (type === "nemesis") {
      // Patient Zero — relentless boss that paths around corners.
      this.r = 20; this.speed = 98 * boost; this.dmg = 32; this.color = "#ff1f3d";
      this.senseR = 460; this.alerted = true; this.name = "PATIENT ZERO";
      this.maxHp = 360 * hpBoost;
    } else { // insect swarm unit
      // Very fast, low damage, follows your scent around corners.
      this.r = 9; this.speed = 134 * boost; this.dmg = 6; this.color = "#ff7a00";
      this.senseR = 240; this.maxHp = 12 * hpBoost;
    }
    this.hp = this.maxHp;
  }

  // Take a hit from the player. Returns true if this kills the enemy.
  hit(dmg, fromAngle) {
    this.hp -= dmg;
    this.flash = 0.14;
    this.alerted = true;
    this.scent = this.type === "nemesis" ? 6 : 3;  // getting hit reveals you
    const k = this.type === "mutant" ? 40 : this.type === "nemesis" ? 90 : 240;
    this.kx += Math.cos(fromAngle) * k;
    this.ky += Math.sin(fromAngle) * k;
    return this.hp <= 0;
  }

  update(dt, map, player) {
    const d = Utils.dist(this.x, this.y, player.x, player.y);

    // Apply knockback (decays fast) for every type, sliding along walls.
    if (this.kx || this.ky) {
      const res = GameMap.moveCircle(map, this.x, this.y, this.r, this.kx * dt, this.ky * dt);
      this.x = res.x; this.y = res.y;
      const decay = Math.pow(0.0009, dt);
      this.kx *= decay; this.ky *= decay;
      if (Math.hypot(this.kx, this.ky) < 6) { this.kx = 0; this.ky = 0; }
    }

    // Stunned by a bolt — frozen, harmless, twitching.
    if (this.stun > 0) {
      this.stun -= dt;
      this.phase += dt * 2;
      if (this.flash > 0) this.flash -= dt;
      return d;
    }

    // --- Mutant: stationary hazard. Blocks the corridor; only hurts you if you
    //     touch it WITHOUT sprinting (dash past it, or destroy it). ---
    if (this.type === "mutant") {
      this.phase += dt * 4;
      if (this.flash > 0) this.flash -= dt;
      if (d < this.r + player.r && !player.sprinting) {
        player.contact(this.dmg, dt);
      }
      return d;
    }

    const see = d < this.senseR && GameMap.hasLOS(map, this.x, this.y, player.x, player.y);
    if (see && !this.alerted && this.type !== "insect") Sound.sfx.growl();
    if (see) this.alerted = true;

    let ang = null;
    let hunting = false;

    if (this.type === "insect" || this.type === "nemesis") {
      // --- Scent tracking: lock on via LOS or proximity, then pursue around
      //     corners with BFS pathing until the scent trail fades. ---
      if (see || d < this.r + 64) this.scent = this.type === "nemesis" ? 6 : 2.6;
      else this.scent = Math.max(0, this.scent - dt);

      if (this.scent > 0) {
        const step = GameMap.nextStepToward(map, this.x, this.y, player.x, player.y);
        ang = step ? Math.atan2(step.y, step.x)
                   : Math.atan2(player.y - this.y, player.x - this.x);
        if (this.type === "insect") ang += Math.sin(this.phase + performance.now() / 120) * 0.5;
        hunting = true;
        this.alerted = true;
      }
    } else if (this.alerted && d < this.senseR * 1.6) {
      // --- Zombie: slow, predictable straight-line shamble. ---
      ang = Math.atan2(player.y - this.y, player.x - this.x);
      hunting = true;
    }

    if (ang === null) {
      // wander
      this.wanderT -= dt;
      if (this.wanderT <= 0) { this.wanderAng = Utils.rand(0, 7); this.wanderT = Utils.rand(0.7, 2); }
      ang = this.wanderAng;
    }
    this.faceAng = ang;

    const spd = this.speed * (hunting ? 1 : 0.45);
    const dx = Math.cos(ang) * spd * dt;
    const dy = Math.sin(ang) * spd * dt;
    const res = GameMap.moveCircle(map, this.x, this.y, this.r, dx, dy);
    if (res.x === this.x && res.y === this.y && !hunting) {
      this.wanderT = 0; // bumped a wall, repick
    }
    this.x = res.x; this.y = res.y;
    this.phase += dt * 8;
    if (this.flash > 0) this.flash -= dt;

    // contact damage (continuous — zombies/nemesis hit hard if they reach you)
    if (d < this.r + player.r) player.contact(this.dmg, dt);
    return d;
  }

  draw(ctx) {
    const { x, y, r, type } = this;
    const lit = this.flash > 0;
    ctx.save();
    ctx.translate(x, y);

    // ground shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath(); ctx.ellipse(0, r * 0.7, r * 0.9, r * 0.35, 0, 0, 7); ctx.fill();

    ctx.shadowColor = this.color; ctx.shadowBlur = this.alerted ? 16 : 5;

    if (type === "zombie") {
      ctx.rotate(this.faceAng);
      // clawed arms reaching toward the prey
      const reach = this.alerted ? r * 1.0 : r * 0.5;
      const sway = Math.sin(this.phase) * 6;
      ctx.strokeStyle = "#3f6b2f"; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(r * 0.3, -r * 0.45); ctx.lineTo(r * 0.4 + reach, -r * 0.35 + sway);
      ctx.moveTo(r * 0.3,  r * 0.45); ctx.lineTo(r * 0.4 + reach,  r * 0.35 - sway);
      ctx.stroke();
      // hunched body
      ctx.fillStyle = lit ? "#eaffea" : this.color;
      ctx.strokeStyle = "#14310a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.92, 0, 0, 7); ctx.fill(); ctx.stroke();
      // rotting flesh patches
      ctx.fillStyle = "#3f6b2f"; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(-r * 0.25, r * 0.3, r * 0.28, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.1, -r * 0.4, r * 0.18, 0, 7); ctx.fill();
      // glowing eyes + gnashing maw, forward
      ctx.fillStyle = "#ff1f3d"; ctx.shadowColor = "#ff1f3d"; ctx.shadowBlur = 7;
      ctx.beginPath(); ctx.arc(r * 0.5, -r * 0.22, 2.6, 0, 7); ctx.arc(r * 0.5, r * 0.22, 2.6, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#1a0000";
      ctx.beginPath(); ctx.ellipse(r * 0.85, 0, r * 0.18, r * 0.28, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r * 0.72, -3); ctx.lineTo(r * 0.98, 0); ctx.lineTo(r * 0.72, 3); ctx.stroke();

    } else if (type === "mutant") {
      // Writhing, anchored horror: thrashing tentacles + spiked carapace + big eye.
      const pulse = 1 + Math.sin(this.phase) * 0.1;
      ctx.strokeStyle = "#7a1a8c"; ctx.lineWidth = 4; ctx.lineCap = "round";
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + this.phase * 0.2;
        const wig = Math.sin(this.phase * 2 + i) * 0.5;
        const len = r * (1.4 + Math.sin(this.phase + i) * 0.25);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
        ctx.lineTo(Math.cos(a + wig) * len, Math.sin(a + wig) * len);
        ctx.stroke();
      }
      // spiked body
      ctx.fillStyle = lit ? "#fff" : this.color;
      ctx.strokeStyle = "#3b0a47"; ctx.lineWidth = 2;
      ctx.beginPath();
      const spikes = 11;
      for (let i = 0; i <= spikes; i++) {
        const a = (i / spikes) * Math.PI * 2;
        const rad = (i % 2 ? r * 1.25 : r * 0.85) * pulse;
        ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // pulsing toxic core + cluster of eyes
      ctx.shadowColor = "#7CFF00"; ctx.shadowBlur = 12;
      ctx.fillStyle = `rgba(124,255,0,${0.6 + Math.sin(this.phase) * 0.3})`;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.4 * pulse, 0, 7); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = "#06140a";
      ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.2, 3, 0, 7);
      ctx.arc(r * 0.35, -r * 0.2, 3, 0, 7); ctx.arc(0, r * 0.35, 2.5, 0, 7); ctx.fill();

    } else if (type === "nemesis") {
      // Patient Zero — a hulking boss with a blood aura, crown of spikes, and maw.
      ctx.rotate(this.faceAng);
      const pulse = 1 + Math.sin(this.phase) * 0.12;
      ctx.shadowColor = "#ff1f3d"; ctx.shadowBlur = 28;
      ctx.strokeStyle = `rgba(255,31,61,${0.4 + Math.sin(this.phase) * 0.25})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r + 9 * pulse, 0, 7); ctx.stroke();
      // muscular arms reaching forward
      ctx.strokeStyle = "#7a0010"; ctx.lineWidth = 6; ctx.lineCap = "round";
      const reach = r * 1.1, sway = Math.sin(this.phase) * 7;
      ctx.beginPath();
      ctx.moveTo(r * 0.3, -r * 0.5); ctx.lineTo(r * 0.5 + reach, -r * 0.4 + sway);
      ctx.moveTo(r * 0.3,  r * 0.5); ctx.lineTo(r * 0.5 + reach,  r * 0.4 - sway);
      ctx.stroke();
      // body
      ctx.fillStyle = lit ? "#fff" : this.color;
      ctx.strokeStyle = "#3a0008"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
      // crown of bony spikes
      ctx.fillStyle = "#7a0010";
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + this.phase * 0.25;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a) * (r + 11), Math.sin(a) * (r + 11));
        ctx.lineTo(Math.cos(a + 0.32) * r, Math.sin(a + 0.32) * r);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      // glowing eyes + fanged maw, forward
      ctx.fillStyle = "#ffd000"; ctx.shadowColor = "#ffd000"; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(r * 0.45, -r * 0.28, 3.4, 0, 7); ctx.arc(r * 0.45, r * 0.28, 3.4, 0, 7); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#1a0000";
      ctx.beginPath(); ctx.ellipse(r * 0.8, 0, r * 0.22, r * 0.34, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff";
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(r * 0.66, i * 6); ctx.lineTo(r * 0.95, i * 6 - 2); ctx.lineTo(r * 0.95, i * 6 + 2);
        ctx.fill();
      }

    } else { // insect swarm unit
      ctx.rotate(this.faceAng);
      // beating wings
      const flap = Math.abs(Math.sin(this.phase * 3));
      ctx.fillStyle = `rgba(255,200,120,${0.25 + flap * 0.25})`;
      ctx.beginPath(); ctx.ellipse(-r * 0.2, -r * 0.9, r * 0.9, r * 0.4 * (0.4 + flap), -0.5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-r * 0.2,  r * 0.9, r * 0.9, r * 0.4 * (0.4 + flap),  0.5, 0, 7); ctx.fill();
      // skittering legs
      ctx.strokeStyle = "#2a1500"; ctx.lineWidth = 1.5; ctx.lineCap = "round";
      const lg = Math.sin(this.phase * 2) * 3;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(s * (r + 4), -4 + lg);
        ctx.moveTo(0, 0); ctx.lineTo(s * (r + 5), 2 - lg);
        ctx.moveTo(0, 0); ctx.lineTo(s * (r + 3), 6 + lg);
        ctx.stroke();
      }
      // segmented body
      ctx.fillStyle = lit ? "#fff" : this.color;
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.72, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#7a3a00";
      ctx.beginPath(); ctx.ellipse(-r * 0.4, 0, r * 0.4, r * 0.55, 0, 0, 7); ctx.fill();
      // antennae + eyes forward
      ctx.strokeStyle = "#2a1500"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r * 0.7, -2); ctx.lineTo(r * 1.2, -5);
      ctx.moveTo(r * 0.7, 2); ctx.lineTo(r * 1.2, 5); ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = "#ffe600";
      ctx.beginPath(); ctx.arc(r * 0.6, -2, 1.8, 0, 7); ctx.arc(r * 0.6, 2, 1.8, 0, 7); ctx.fill();
    }
    ctx.restore();
    ctx.shadowBlur = 0;

    // Stun arc — crackling electric ring while frozen.
    if (this.stun > 0) {
      ctx.strokeStyle = `rgba(54,209,255,${0.5 + Math.random() * 0.4})`;
      ctx.lineWidth = 2; ctx.shadowColor = "#36d1ff"; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, r + 5, Math.random() * 6, Math.random() * 6); ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r + 5, Math.random() * 6, Math.random() * 6); ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Health bar above wounded enemies (world space, unrotated).
    if (this.hp < this.maxHp && this.hp > 0) {
      const w = Math.max(20, r * 2), h = 3, yy = y - r - 9;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x - w / 2, yy, w, h);
      ctx.fillStyle = type === "nemesis" ? "#ff1f3d" : type === "mutant" ? "#c026d3" : "#7CFF00";
      ctx.fillRect(x - w / 2, yy, w * Math.max(0, this.hp / this.maxHp), h);
    }
  }
}
