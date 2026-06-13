// Small shared helpers used across the game.
const Utils = (() => {
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Axis-aligned circle vs rect overlap (used for wall collisions).
  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = clamp(cx, rx, rx + rw);
    const ny = clamp(cy, ry, ry + rh);
    return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
  }

  return { clamp, lerp, rand, randInt, dist, choice, circleRect };
})();
