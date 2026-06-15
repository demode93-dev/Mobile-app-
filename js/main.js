// Bootstrap: wires the menus/HUD, runs the fixed-timestep-ish game loop,
// and starts the show.

const UI = (() => {
  const el = (id) => document.getElementById(id);
  const hud = el("hud"), touch = el("touch");
  const menu = el("menu"), gameover = el("gameover"), win = el("win");
  const healthFill = el("healthFill"), staminaFill = el("staminaFill");
  const staminaStat = staminaFill.closest(".stat");
  const keyCount = el("keyCount"), hudMsg = el("hudMsg");
  const transmissionEl = el("transmission"), transmissionTxt = el("transmissionText");
  const nemesisEl = el("nemesis");
  let transTimer = null;

  function showGame() {
    menu.classList.add("hidden");
    gameover.classList.add("hidden");
    win.classList.add("hidden");
    hud.classList.remove("hidden");
    touch.classList.remove("hidden");
  }
  function updateHUD(p) {
    healthFill.style.width = Math.max(0, p.health) + "%";
    staminaFill.style.width = Math.max(0, p.stamina) + "%";
    keyCount.textContent = `${p.keys} / 3`;
    // Low-stamina state pulses the bar when you're nearly out of sprint.
    staminaStat.classList.toggle("low", p.stamina < 20);
  }
  function flash(text) { hudMsg.textContent = text; hudMsg.classList.add("show"); }
  function clearFlash() { hudMsg.classList.remove("show"); }

  // One-line radio transmission slides up from the bottom, then auto-hides.
  function transmission(text) {
    transmissionTxt.textContent = text;
    transmissionEl.classList.remove("hidden");
    transmissionEl.classList.remove("show"); void transmissionEl.offsetWidth;
    transmissionEl.classList.add("show");
    if (transTimer) clearTimeout(transTimer);
    transTimer = setTimeout(() => {
      transmissionEl.classList.remove("show");
      setTimeout(() => transmissionEl.classList.add("hidden"), 350);
    }, 4500);
  }

  // Named-threat banner ("PATIENT ZERO IS AWAKE").
  function nemesis(text) {
    nemesisEl.textContent = text;
    nemesisEl.classList.remove("hidden");
    nemesisEl.style.animation = "none"; void nemesisEl.offsetWidth; nemesisEl.style.animation = "";
    setTimeout(() => nemesisEl.classList.add("hidden"), 2600);
  }

  function updateLore(count) {
    const m = el("loreMeter");
    if (m) m.textContent = `${count} / ${Lore.total}`;
  }

  function showGameOver(level, score, time, canRevive) {
    hud.classList.add("hidden"); touch.classList.add("hidden");
    el("goStats").innerHTML =
      `You reached <b>Level ${level}</b> and survived <b>${time}s</b>.<br>Score: <b>${score}</b>`;
    el("btnRevive").style.display = canRevive ? "block" : "none";
    gameover.classList.remove("hidden");
  }

  let lastWin = null;          // data for the shareable rescue certificate
  function showWin(level, score, time, stars, best, detail) {
    hud.classList.add("hidden"); touch.classList.add("hidden");
    lastWin = { level, score, stars, rescued: detail.rescued || 0, animals: detail.animals || 0 };
    // Light up the earned stars with a staggered pop animation.
    const starEls = win.querySelectorAll(".star");
    starEls.forEach((s, i) => {
      s.classList.remove("earned");
      setTimeout(() => { if (i < stars) s.classList.add("earned"); }, 280 + i * 300);
    });
    const rescuedLine = detail.animals
      ? `<div class="rate ${detail.rescued === detail.animals ? "ok" : "no"}">` +
          `🐾 Animals rescued <span>(${detail.rescued}/${detail.animals})</span></div>`
      : "";
    el("winStats").innerHTML =
      `<div class="rate ${detail.hpOk ? "ok" : "no"}">` +
        `${detail.hpOk ? "★" : "☆"} Health &gt; 50% <span>(${detail.hp}%)</span></div>` +
      `<div class="rate ${detail.timeOk ? "ok" : "no"}">` +
        `${detail.timeOk ? "★" : "☆"} Under 90s <span>(${detail.time}s)</span></div>` +
      rescuedLine +
      `<div class="winscore">Level ${level} cleared • Score <b>${score}</b>` +
        `${best > stars ? `<br><span class="best">Best: ${best}★</span>` : ""}</div>`;
    win.classList.remove("hidden");
  }

  return { showGame, updateHUD, flash, clearFlash, transmission, nemesis,
           updateLore, showGameOver, showWin, getLastWin: () => lastWin };
})();

window.addEventListener("load", () => {
  const canvas = document.getElementById("game");
  Game.boot(canvas);
  Input.setup();
  UI.updateLore(Lore.count());

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

  // ---- Rewarded-ad revive ----
  document.getElementById("btnRevive").addEventListener("click", () => {
    Commerce.showRewardedAd((ok) => {
      if (ok && Game.revive()) {
        document.getElementById("gameover").classList.add("hidden");
        UI.showGame();
      }
    });
  });

  // ---- Social share (rescue certificate) ----
  document.getElementById("btnShare").addEventListener("click", () => {
    const w = UI.getLastWin();
    if (w) Commerce.shareCertificate(w);
  });

  // ---- Dog skin shop ----
  const shop = document.getElementById("shop");
  const shopList = document.getElementById("shopList");
  function renderShop() {
    shopList.innerHTML = "";
    for (const skin of Commerce.SKINS) {
      const owned = Commerce.owns(skin.id);
      const active = Commerce.selectedId() === skin.id && owned;
      const row = document.createElement("div");
      row.className = "shop-row" + (active ? " active" : "");
      row.innerHTML =
        `<span class="swatch" style="background:${skin.body};box-shadow:0 0 8px ${skin.accent}"></span>` +
        `<span class="shop-name">${skin.name}${skin.premium ? " ⭐" : ""}</span>` +
        `<span class="shop-act">${active ? "EQUIPPED" : owned ? "EQUIP" : "$2.99"}</span>`;
      row.addEventListener("click", () => {
        if (active) return;
        if (owned) { Commerce.select(skin.id); renderShop(); }
        else Commerce.buySkin(skin.id, (done) => { if (done) { Commerce.select(skin.id); renderShop(); } });
      });
      shopList.appendChild(row);
    }
  }
  document.getElementById("btnShop").addEventListener("click", () => { renderShop(); shop.classList.remove("hidden"); });
  document.getElementById("btnShopClose").addEventListener("click", () => shop.classList.add("hidden"));

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
