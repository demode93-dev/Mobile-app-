// Unified input: virtual thumbstick + action buttons for touch, WASD/arrows
// for desktop. Exposes a normalized movement vector and button states.
const Input = (() => {
  const move = { x: 0, y: 0 };      // normalized -1..1
  const keys = {};
  let sprint = false;
  let torchToggle = false;          // edge event consumed by game
  let _torchPressed = false;

  let stickActive = false, stickId = null;
  let baseX = 0, baseY = 0;
  const MAXR = 52;

  let nub, base;

  function setup() {
    base = document.getElementById("stick");
    nub = document.getElementById("stickNub");

    // --- Thumbstick ---
    base.addEventListener("touchstart", onStickStart, { passive: false });
    base.addEventListener("touchmove", onStickMove, { passive: false });
    base.addEventListener("touchend", onStickEnd);
    base.addEventListener("touchcancel", onStickEnd);

    // --- Action buttons ---
    const torchBtn = document.getElementById("btnTorch");
    const sprintBtn = document.getElementById("btnSprint");
    const press = (el, on, off) => {
      el.addEventListener("touchstart", (e) => { e.preventDefault(); on(); }, { passive: false });
      el.addEventListener("touchend", (e) => { e.preventDefault(); if (off) off(); }, { passive: false });
      el.addEventListener("mousedown", on);
      window.addEventListener("mouseup", () => { if (off) off(); });
    };
    press(torchBtn, () => { _torchPressed = true; }, null);
    press(sprintBtn, () => { sprint = true; }, () => { sprint = false; });

    // --- Keyboard ---
    window.addEventListener("keydown", (e) => {
      keys[e.key.toLowerCase()] = true;
      if (e.key === "Shift") sprint = true;
      if (e.key.toLowerCase() === "f") _torchPressed = true;
    });
    window.addEventListener("keyup", (e) => {
      keys[e.key.toLowerCase()] = false;
      if (e.key === "Shift") sprint = false;
    });
  }

  function onStickStart(e) {
    e.preventDefault();
    const t = e.changedTouches[0];
    stickActive = true; stickId = t.identifier;
    const r = base.getBoundingClientRect();
    baseX = r.left + r.width / 2;
    baseY = r.top + r.height / 2;
    updateNub(t.clientX, t.clientY);
  }
  function onStickMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) updateNub(t.clientX, t.clientY);
    }
  }
  function onStickEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        stickActive = false; stickId = null;
        move.x = 0; move.y = 0;
        nub.style.transform = "translate(-50%,-50%)";
      }
    }
  }
  function updateNub(px, py) {
    let dx = px - baseX, dy = py - baseY;
    const d = Math.hypot(dx, dy) || 1;
    const cl = Math.min(d, MAXR);
    const ux = (dx / d) * cl, uy = (dy / d) * cl;
    nub.style.transform = `translate(calc(-50% + ${ux}px), calc(-50% + ${uy}px))`;
    move.x = ux / MAXR;
    move.y = uy / MAXR;
  }

  // Merge keyboard each frame (touch already writes move directly).
  function poll() {
    if (!stickActive) {
      let kx = 0, ky = 0;
      if (keys["a"] || keys["arrowleft"]) kx -= 1;
      if (keys["d"] || keys["arrowright"]) kx += 1;
      if (keys["w"] || keys["arrowup"]) ky -= 1;
      if (keys["s"] || keys["arrowdown"]) ky += 1;
      const m = Math.hypot(kx, ky) || 1;
      move.x = kx / m * (m > 0 ? 1 : 0);
      move.y = ky / m * (m > 0 ? 1 : 0);
      if (kx === 0 && ky === 0) { move.x = 0; move.y = 0; }
    }
    // consume torch edge
    if (_torchPressed) { torchToggle = true; _torchPressed = false; }
    else torchToggle = false;
  }

  return {
    setup, poll, move,
    get sprint() { return sprint; },
    get torchToggled() { return torchToggle; },
  };
})();
