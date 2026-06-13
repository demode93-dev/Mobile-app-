// Player + enemy types. Sprites are drawn procedurally with canvas shapes,
// so no image assets are required.

class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.r = 14;
    this.speed = 165;
    this.health = 100;
    this.maxHealth = 100;
    this.battery = 100;
    this.torchOn = true;
    this.facing = 0;        // radians
    this.keys = 0;
    this.hurtFlash = 0;
    this.invuln = 0;
    this.walkPhase = 0;
    this.stepTimer = 0;
  }

  update(dt, map) {
    Input.poll();
    let { x: mx, y: my } = Input.move;
    const moving = mx !== 0 || my !== 0;
    const sprint = Input.sprint && this.battery > 0;
    const spd = this.speed * (sprint ? 1.6 : 1);

    if (moving) {
      this.facing = Math.atan2(my, mx);
      const res = GameMap.moveCircle(map, this.x, this.y, this.r, mx * spd * dt, my * spd * dt);
      this.x = res.x; this.y = res.y;
      this.walkPhase += dt * (sprint ? 16 : 10);
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) { Sound.sfx.step(); this.stepTimer = sprint ? 0.28 : 0.42; }
    }

    // Torch drains battery; sprint drains faster.
    if (this.torchOn) this.battery -= dt * 1.6;
    if (sprint && moving) this.battery -= dt * 4;
    this.battery = Utils.clamp(this.battery, 0, 100);
    if (this.battery <= 0) this.torchOn = false;

    if (Input.torchToggled && this.battery > 0) {
      this.torchOn = !this.torchOn;
      Sound.sfx.zap();
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

  draw(ctx) {
    const { x, y, r } = this;
    const wob = Math.sin(this.walkPhase) * 2;
    ctx.save();
    ctx.translate(x, y);

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(0, r * 0.7, r * 0.9, r * 0.4, 0, 0, 7); ctx.fill();

    // body — hazmat survivor with cyan visor
    ctx.rotate(0);
    ctx.fillStyle = this.hurtFlash > 0 ? "#ff5566" : "#ffd23f";
    ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, wob, r, 0, 7); ctx.fill(); ctx.stroke();

    // chest stripe
    ctx.fillStyle = "#00e5ff";
    ctx.fillRect(-r * 0.7, wob - 2, r * 1.4, 4);

    // visor facing direction
    const fx = Math.cos(this.facing), fy = Math.sin(this.facing);
    ctx.fillStyle = "#001b1f";
    ctx.beginPath(); ctx.arc(fx * 5, wob + fy * 5, r * 0.5, 0, 7); ctx.fill();
    ctx.fillStyle = "#7CFF00";
    ctx.beginPath(); ctx.arc(fx * 6, wob + fy * 6, r * 0.22, 0, 7); ctx.fill();
    ctx.restore();
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

    const boost = 1 + level * 0.06;
    if (type === "zombie") {
      this.r = 15; this.speed = 58 * boost; this.dmg = 14; this.color = "#5fbf3f"; this.senseR = 230;
    } else if (type === "mutant") {
      this.r = 18; this.speed = 92 * boost; this.dmg = 20; this.color = "#c026d3"; this.senseR = 300;
    } else { // insect swarm unit
      this.r = 9; this.speed = 120 * boost; this.dmg = 6; this.color = "#ff7a00"; this.senseR = 200;
    }
  }

  update(dt, map, player) {
    const d = Utils.dist(this.x, this.y, player.x, player.y);
    const see = d < this.senseR && GameMap.hasLOS(map, this.x, this.y, player.x, player.y);
    if (see) {
      if (!this.alerted && this.type !== "insect") Sound.sfx.growl();
      this.alerted = true;
    }

    let ang;
    if (this.alerted && d < this.senseR * 1.6) {
      ang = Math.atan2(player.y - this.y, player.x - this.x);
      // insects jitter erratically
      if (this.type === "insect") ang += Math.sin(this.phase + performance.now() / 120) * 0.9;
    } else {
      // wander
      this.wanderT -= dt;
      if (this.wanderT <= 0) { this.wanderAng = Utils.rand(0, 7); this.wanderT = Utils.rand(0.7, 2); }
      ang = this.wanderAng;
    }

    const spd = this.speed * (this.alerted ? 1 : 0.45);
    const dx = Math.cos(ang) * spd * dt;
    const dy = Math.sin(ang) * spd * dt;
    const res = GameMap.moveCircle(map, this.x, this.y, this.r, dx, dy);
    if (res.x === this.x && res.y === this.y && !this.alerted) {
      this.wanderT = 0; // bumped a wall, repick
    }
    this.x = res.x; this.y = res.y;
    this.phase += dt * 8;
    if (this.flash > 0) this.flash -= dt;

    // contact damage
    if (d < this.r + player.r) player.damage(this.dmg * dt * 3.2);
    return d;
  }

  draw(ctx) {
    const { x, y, r, type } = this;
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath(); ctx.ellipse(0, r * 0.7, r * 0.9, r * 0.35, 0, 0, 7); ctx.fill();

    const glow = this.alerted ? 14 : 4;
    ctx.shadowColor = this.color; ctx.shadowBlur = glow;

    if (type === "zombie") {
      const lean = Math.sin(this.phase) * 0.18;
      ctx.rotate(lean);
      ctx.fillStyle = this.flash > 0 ? "#eaffea" : this.color;
      ctx.strokeStyle = "#14310a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
      // glowing eyes
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ff1f3d";
      ctx.beginPath(); ctx.arc(-5, -3, 2.6, 0, 7); ctx.arc(5, -3, 2.6, 0, 7); ctx.fill();
      // jagged mouth
      ctx.strokeStyle = "#2a0000"; ctx.beginPath();
      ctx.moveTo(-6, 6); ctx.lineTo(-2, 4); ctx.lineTo(2, 7); ctx.lineTo(6, 5); ctx.stroke();
    } else if (type === "mutant") {
      const pulse = 1 + Math.sin(this.phase) * 0.08;
      ctx.fillStyle = this.flash > 0 ? "#fff" : this.color;
      ctx.strokeStyle = "#3b0a47"; ctx.lineWidth = 2;
      // spiky blob
      ctx.beginPath();
      const spikes = 9;
      for (let i = 0; i <= spikes; i++) {
        const a = (i / spikes) * Math.PI * 2;
        const rad = (i % 2 ? r * 1.25 : r * 0.85) * pulse;
        ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#7CFF00";
      ctx.beginPath(); ctx.arc(-6, -4, 3.2, 0, 7); ctx.arc(6, -4, 3.2, 0, 7); ctx.arc(0, 4, 2.6, 0, 7); ctx.fill();
    } else { // insect
      ctx.fillStyle = this.flash > 0 ? "#fff" : this.color;
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.7, this.phase, 0, 7); ctx.fill();
      // skittering legs
      ctx.strokeStyle = "#2a1500"; ctx.lineWidth = 1.5;
      const lg = Math.sin(this.phase * 2) * 3;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(s * (r + 4), -4 + lg);
        ctx.moveTo(0, 0); ctx.lineTo(s * (r + 5), 2 - lg);
        ctx.moveTo(0, 0); ctx.lineTo(s * (r + 3), 6 + lg);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffe600";
      ctx.beginPath(); ctx.arc(r * 0.5, -2, 1.6, 0, 7); ctx.arc(r * 0.5, 2, 1.6, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
}
