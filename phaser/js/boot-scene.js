/* BootScene — generates all textures procedurally (no art assets), then
   launches the game + UI scenes. */
class BootScene extends Phaser.Scene {
  constructor() { super("BootScene"); }

  create() {
    const T = 32; // tile size

    // ---- Tileset image: [floor | wall | exit] laid out horizontally ----
    const ts = this.make.graphics({ x: 0, y: 0, add: false });
    // floor (index 0)
    ts.fillStyle(0x0c1218, 1); ts.fillRect(0, 0, T, T);
    ts.lineStyle(1, 0x39ff14, 0.06); ts.strokeRect(0.5, 0.5, T - 1, T - 1);
    // wall (index 1)
    ts.fillStyle(0x10151f, 1); ts.fillRect(T, 0, T, T);
    ts.fillStyle(0x1b2740, 1); ts.fillRect(T + 2, 2, T - 4, T - 6);
    ts.fillStyle(0x00e5ff, 0.10); ts.fillRect(T + 2, 2, T - 4, 3);
    // exit (index 2)
    ts.fillStyle(0x0e1620, 1); ts.fillRect(T * 2, 0, T, T);
    ts.fillStyle(0x7CFF00, 0.5); ts.fillRect(T * 2 + 6, 6, T - 12, T - 12);
    ts.fillStyle(0x02110a, 1); ts.fillRect(T * 2 + 11, 11, T - 22, T - 22);
    ts.generateTexture("tiles", T * 3, T);
    ts.destroy();

    // ---- Player (hazmat worker) ----
    this.circleTexture("player", 12, 0xffd23f, 0x00e5ff);
    // ---- Enemies ----
    this.circleTexture("zombie", 13, 0x5fbf3f, 0xff1f3d);  // slow, tanky
    this.circleTexture("mutant", 15, 0xc026d3, 0x7CFF00);  // charger
    this.circleTexture("insect", 8,  0xff7a00, 0xffe600);  // fast skittery

    // Launch UI overlay alongside the game.
    this.scene.start("GameScene", { floor: 1 });
    this.scene.launch("UIScene");
  }

  // Helper: round token sprite with a contrasting "eye" dot.
  circleTexture(key, r, body, eye) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x000000, 0.35); g.fillEllipse(r + 2, r * 1.7 + 2, r * 1.8, r * 0.8);
    g.fillStyle(body, 1); g.fillCircle(r + 2, r + 2, r);
    g.lineStyle(2, 0x10100a, 1); g.strokeCircle(r + 2, r + 2, r);
    g.fillStyle(eye, 1);
    g.fillCircle(r + 2 - r * 0.35, r + 2 - r * 0.2, Math.max(2, r * 0.22));
    g.fillCircle(r + 2 + r * 0.35, r + 2 - r * 0.2, Math.max(2, r * 0.22));
    g.generateTexture(key, (r + 2) * 2, (r + 2) * 2 + r);
    g.destroy();
  }
}
