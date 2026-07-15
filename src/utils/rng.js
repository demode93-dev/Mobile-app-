// Seeded pseudo-random number generator (mulberry32) plus a small set of
// helpers mirroring Math.random()/Phaser.Utils.Array so call sites can swap
// between "real" randomness and a deterministic, replayable stream without
// changing their logic.
//
// This is what makes the Daily Dungeon fair and (eventually) server-replay
// verifiable: every draw that shapes a run - initial board layout, cascade
// refills, enemy type/position selection, camp upgrade card draws - comes
// from the same seeded stream, consumed in the same order every time the
// same sequence of player choices is made. Two players who make identical
// moves against the same daily seed will see identical outcomes; a server
// replaying a submitted move history can reproduce the run byte-for-byte.
// Same algorithm as the seedFromDate() helper duplicated in
// netlify/functions/generate-daily-dungeon.js / get-daily-dungeon.js /
// submit-tournament-score.js (Netlify Functions run as separate CommonJS
// deployables and can't import from src/, so it's kept in sync by hand -
// change all four together). Deterministic so an offline client computes
// the exact same daily seed as the server, instead of falling back to a
// random one that would break the "everyone plays the same dungeon" premise.
export function seedFromDate(dateKey) {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function createSeededRng(seed) {
  let state = seed >>> 0;
  const next = () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  next.int = (maxExclusive) => Math.floor(next() * maxExclusive);
  next.pick = (array) => array[next.int(array.length)];
  next.shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = next.int(i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  return next;
}
