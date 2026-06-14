/* UIScene — HUD overlay drawn on top of GameScene: health bar, floor counter,
   and centre messages. Communicates with GameScene via global game events. */
class UIScene extends Phaser.Scene {
  constructor() { super({ key: "UIScene", active: false }); }

  create() {
    this.barX = 16; this.barY = 16; this.barW = 230; this.barH = 18;

    this.barBg = this.add.graphics();
    this.barFill = this.add.graphics();
    this.hpText = this.add.text(this.barX + 8, this.barY + 1, "VITALS", {
      fontFamily: "Trebuchet MS, sans-serif", fontSize: "12px", color: "#04140a", fontStyle: "bold",
    }).setDepth(1);

    this.floorText = this.add.text(this.scale.width - 16, 16, "FLOOR 1", {
      fontFamily: "Trebuchet MS, sans-serif", fontSize: "20px", color: "#7CFF00", fontStyle: "bold",
    }).setOrigin(1, 0).setShadow(0, 0, "#7CFF00", 10);

    this.msg = this.add.text(this.scale.width / 2, this.scale.height * 0.4, "", {
      fontFamily: "Trebuchet MS, sans-serif", fontSize: "30px", color: "#ff2bd6", fontStyle: "bold",
      align: "center",
    }).setOrigin(0.5).setShadow(0, 0, "#ff2bd6", 14);

    this.drawHealth(this.registry.get("health") != null ? this.registry.get("health") : 100);

    // ---- Listen to game events from GameScene ----
    this.game.events.on("ui:health", this.drawHealth, this);
    this.game.events.on("ui:floor", (f) => this.floorText.setText("FLOOR " + f), this);
    this.game.events.on("ui:message", (t) => this.msg.setText(t || ""), this);

    this.scale.on("resize", this.layout, this);
    this.events.once("shutdown", () => {
      this.game.events.off("ui:health", this.drawHealth, this);
      this.scale.off("resize", this.layout, this);
    });
  }

  layout() {
    this.floorText.setPosition(this.scale.width - 16, 16);
    this.msg.setPosition(this.scale.width / 2, this.scale.height * 0.4);
  }

  drawHealth(hp) {
    hp = Phaser.Math.Clamp(hp, 0, 100);
    const { barX, barY, barW, barH } = this;
    this.barBg.clear();
    this.barBg.fillStyle(0x000000, 0.5);
    this.barBg.fillRoundedRect(barX - 2, barY - 2, barW + 4, barH + 4, 6);
    this.barBg.lineStyle(1, 0xffffff, 0.12);
    this.barBg.strokeRoundedRect(barX - 2, barY - 2, barW + 4, barH + 4, 6);

    // green → amber → red as health drops
    const col = hp > 50 ? 0x39ff14 : hp > 25 ? 0xffd000 : 0xff1f3d;
    this.barFill.clear();
    this.barFill.fillStyle(col, 1);
    this.barFill.fillRoundedRect(barX, barY, Math.max(0, (barW * hp) / 100), barH, 5);
  }
}
