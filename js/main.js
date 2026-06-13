// Bootstrap: wires the menus/HUD, runs the fixed-timestep-ish game loop,
// and starts the show.

const UI = (() => {
  const el = (id) => document.getElementById(id);
  const hud = el("hud"), touch = el("touch");
  const menu = el("menu"), gameover = el("gameover"), win = el("win");
  const healthFill = el("healthFill"), batteryFill = el("batteryFill");
  const keyCount = el("keyCount"), hudMsg = el("hudMsg");

  function showGame() {
    menu.classList.add("hidden");
    gameover.classList.add("hidden");
    win.classList.add("hidden");
    hud.classList.remove("hidden");
    touch.classList.remove("hidden");
  }
  function updateHUD(p) {
    healthFill.style.width = Math.max(0, p.health) + "%";
    batteryFill.style.width = Math.max(0, p.battery) + "%";
    keyCount.textContent = `${p.keys} / 3`;
  }
  function flash(text) { hudMsg.textContent = text; hudMsg.classList.add("show"); }
  function clearFlash() { hudMsg.classList.remove("show"); }

  function showGameOver(level, score, time) {
    hud.classList.add("hidden"); touch.classList.add("hidden");
    el("goStats").innerHTML =
      `You reached <b>Level ${level}</b> and survived <b>${time}s</b>.<br>Score: <b>${score}</b>`;
    gameover.classList.remove("hidden");
  }
  function showWin(level, score, time) {
    hud.classList.add("hidden"); touch.classList.add("hidden");
    el("winStats").innerHTML =
      `Cleared <b>Level ${level}</b> in <b>${time}s</b>.<br>Score: <b>${score}</b><br>Ready to go deeper?`;
    win.classList.remove("hidden");
  }

  return { showGame, updateHUD, flash, clearFlash, showGameOver, showWin };
})();

window.addEventListener("load", () => {
  const canvas = document.getElementById("game");
  Game.boot(canvas);
  Input.setup();

  const beginRun = (lvl) => {
    Sound.unlock();
    UI.showGame();
    Game.start(lvl);
  };

  document.getElementById("btnPlay").addEventListener("click", () => { Game.resetScore(); beginRun(1); });
  document.getElementById("btnRetry").addEventListener("click", () => { Game.resetScore(); beginRun(1); });
  document.getElementById("btnNext").addEventListener("click", () => beginRun(Game.level + 1));
  document.getElementById("btnMenu").addEventListener("click", () => {
    document.getElementById("win").classList.add("hidden");
    document.getElementById("menu").classList.remove("hidden");
    Game.setState("menu");
  });

  // Game loop
  let last = performance.now();
  function loop(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05; // clamp big frame gaps (tab switches)
    Game.update(dt);
    Game.render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Register service worker for offline / installable PWA.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
});
