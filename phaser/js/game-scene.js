/* GameScene — the playable lab floor: tilemap, player, enemies, exit,
   difficulty scaling, and the premium-floor gate. */
const TILE = 32;

class GameScene extends Phaser.Scene {
  constructor() { super("GameScene"); }

  init(data) {
    this.floor = (data && data.floor) || 1;
    this.transitioning = false;
    this.invuln = 0;
  }

  create() {
    // Health persists across floors; reset only on a fresh game / after death.
    if (this.registry.get("health") == null) this.registry.set("health", 100);

    // ---- Build the tile-based lab floor ----
    const gen = this.generateFloor(this.floor);
    this.map = this.make.tilemap({ data: gen.grid, tileWidth: TILE, tileHeight: TILE });
    const tileset = this.map.addTilesetImage("tiles", "tiles", TILE, TILE, 0, 0);
    this.layer = this.map.createLayer(0, tileset, 0, 0);
    this.layer.setCollision(1); // only walls (index 1) block movement

    const worldW = this.map.widthInPixels, worldH = this.map.heightInPixels;
    this.physics.world.setBounds(0, 0, worldW, worldH);

    // ---- Player (WASD + arrows) ----
    this.player = this.physics.add.sprite(gen.spawn.x, gen.spawn.y, "player");
    this.player.body.setCircle(12, 2, 2);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.layer);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,A,S,D");

    // Camera follows the worker through the dark.
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBackgroundColor("#05060a");

    // ---- Enemies: harder every floor (more of them, faster) ----
    this.enemies = this.physics.add.group();
    this.physics.add.collider(this.enemies, this.layer);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.overlap(this.player, this.enemies, this.hitPlayer, null, this);

    const count = Math.min(40, 4 + this.floor * 2);
    const speedScale = 1 + (this.floor - 1) * 0.09;
    const TYPES = ["zombie", "mutant", "insect"];
    for (let i = 0; i < count; i++) {
      const t = gen.floorTiles[(Math.random() * gen.floorTiles.length) | 0];
      if (!t) break;
      this.spawnEnemy(TYPES[i % TYPES.length], t.x, t.y, speedScale);
    }

    // ---- Exit zone → next floor ----
    const zone = this.add.zone(gen.exitPx.x, gen.exitPx.y, 30, 30);
    this.physics.add.existing(zone, true);
    this.physics.add.overlap(this.player, zone, this.reachExit, null, this);

    // Tell the UI which floor we're on + current health.
    this.game.events.emit("ui:floor", this.floor);
    this.game.events.emit("ui:health", this.registry.get("health"));
    this.cameras.main.flash(300, 5, 8, 14);
  }

  // ---------- Enemy factory ----------
  spawnEnemy(type, x, y, scale) {
    const e = this.enemies.create(x, y, type);
    e.etype = type;
    e.phase = Math.random() * 7;
    e.chargeTimer = Phaser.Math.Between(1500, 3500);
    if (type === "zombie") { e.body.setCircle(13, 2, 2); e.spd = 55 * scale; e.dmg = 16; }
    else if (type === "mutant") { e.body.setCircle(15, 2, 2); e.spd = 80 * scale; e.dmg = 22; }
    else { e.body.setCircle(8, 2, 2); e.spd = 120 * scale; e.dmg = 8; } // insect
    e.setCollideWorldBounds(true);
    return e;
  }

  update(time, delta) {
    if (this.transitioning) return;
    const dt = delta / 1000;
    const p = this.player;

    // ---- Player movement (WASD + arrows) ----
    const speed = 175;
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy += 1;
    const len = Math.hypot(vx, vy) || 1;
    p.setVelocity((vx / len) * speed, (vy / len) * speed);

    // ---- Enemy "basic pathfinding": seek the player, per-type flavour ----
    for (const e of this.enemies.getChildren()) {
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      const dist = Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y);
      let spd = e.spd;
      let a = ang;

      if (e.etype === "insect") {
        // fast and erratic — weaves toward you
        a += Math.sin(time / 120 + e.phase) * 0.7;
      } else if (e.etype === "mutant") {
        // periodic lunge/charge
        e.chargeTimer -= delta;
        if (e.chargeTimer <= 0) { spd *= 2.4; if (e.chargeTimer < -350) e.chargeTimer = Phaser.Math.Between(1800, 3600); }
      }
      // ease off when far so they don't all dogpile instantly
      if (dist > 460) spd *= 0.45;

      e.setVelocity(Math.cos(a) * spd, Math.sin(a) * spd);

      // If wedged against a wall, nudge sideways so they slip around corners.
      if (e.body.blocked.x || e.body.blocked.y) {
        e.setVelocity(Math.cos(a + 1.2) * spd, Math.sin(a + 1.2) * spd);
      }
    }

    if (this.invuln > 0) this.invuln -= dt;
  }

  // ---------- Damage / death ----------
  hitPlayer(player, enemy) {
    if (this.invuln > 0) return;
    this.invuln = 0.7;
    const hp = Math.max(0, this.registry.get("health") - enemy.dmg);
    this.registry.set("health", hp);
    this.game.events.emit("ui:health", hp);
    this.cameras.main.shake(140, 0.012);
    this.cameras.main.flash(120, 60, 0, 10);
    if (hp <= 0) this.die();
  }

  die() {
    this.transitioning = true;
    this.player.setVelocity(0, 0);
    this.game.events.emit("ui:message", "YOU DIDN'T MAKE IT");
    this.cameras.main.flash(400, 80, 0, 0);
    this.time.delayedCall(1200, () => {
      this.registry.set("health", 100);
      this.game.events.emit("ui:message", "");
      this.scene.restart({ floor: 1 });
    });
  }

  // ---------- Floor progression + premium gate ----------
  reachExit() {
    if (this.transitioning) return;
    const next = this.floor + 1;

    // Premium floors (6+) require an unlock — Lemon Squeezy hook.
    if (Payments.floorRequiresPremium(next)) {
      this.transitioning = true;
      this.player.setVelocity(0, 0);
      this.scene.pause();
      Payments.showPaywall(
        () => { this.scene.resume(); this.scene.restart({ floor: next }); },
        () => { this.scene.resume(); this.transitioning = false; }   // turned back
      );
      return;
    }

    this.transitioning = true;
    this.player.setVelocity(0, 0);
    this.cameras.main.fade(350, 5, 8, 14);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.restart({ floor: next }));
  }

  // ---------- Procedural lab floor (rooms + corridors) ----------
  generateFloor(floor) {
    const cols = Math.min(44, 22 + floor * 2);
    const rows = Math.min(32, 16 + floor * 2);
    const grid = [];
    for (let y = 0; y < rows; y++) grid.push(new Array(cols).fill(1));

    const rooms = [];
    const roomCount = 6 + Math.min(floor, 6);
    for (let i = 0; i < roomCount; i++) {
      const rw = Phaser.Math.Between(4, 7), rh = Phaser.Math.Between(3, 6);
      const rx = Phaser.Math.Between(1, cols - rw - 2), ry = Phaser.Math.Between(1, rows - rh - 2);
      for (let y = ry; y < ry + rh; y++)
        for (let x = rx; x < rx + rw; x++) grid[y][x] = 0;
      rooms.push({ cx: rx + (rw >> 1), cy: ry + (rh >> 1) });
    }
    const carveH = (x1, x2, y) => { for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) grid[y][x] = 0; };
    const carveV = (y1, y2, x) => { for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) grid[y][x] = 0; };
    for (let i = 1; i < rooms.length; i++) {
      carveH(rooms[i - 1].cx, rooms[i].cx, rooms[i - 1].cy);
      carveV(rooms[i - 1].cy, rooms[i].cy, rooms[i].cx);
    }

    // Spawn = first room; exit = farthest room.
    const spawn = { x: (rooms[0].cx + 0.5) * TILE, y: (rooms[0].cy + 0.5) * TILE };
    let far = rooms[1] || rooms[0], best = -1;
    for (const r of rooms) {
      const d = Phaser.Math.Distance.Between(r.cx, r.cy, rooms[0].cx, rooms[0].cy);
      if (d > best) { best = d; far = r; }
    }
    grid[far.cy][far.cx] = 2; // exit tile
    const exitPx = { x: (far.cx + 0.5) * TILE, y: (far.cy + 0.5) * TILE };

    // Open floor tiles for enemy spawns (clear of the player's start).
    const floorTiles = [];
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        if (grid[y][x] === 0 && Phaser.Math.Distance.Between(x, y, rooms[0].cx, rooms[0].cy) > 5)
          floorTiles.push({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });

    return { grid, spawn, exitPx, floorTiles };
  }
}
