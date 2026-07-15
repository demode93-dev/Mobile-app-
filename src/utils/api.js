// Thin API client for Netlify Functions with full localStorage fallback so the
// game is completely playable offline / without a deployed backend.

import { STORAGE_KEYS } from './constants.js';

const FUNCTIONS_BASE = '/.netlify/functions';
const NETWORK_TIMEOUT_MS = 4000;
const MAX_LOCAL_SCORES = 100;

async function callFunction(name, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
  try {
    const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Function ${name} responded ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// Exported (not just used internally) so other modules share one localStorage
// read/write path instead of re-implementing the try/catch guards.
export function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

export function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // localStorage unavailable (private mode, quota) - fail silently, game keeps running in-memory.
  }
}

// ---------------------------------------------------------------------------
// Meta-Currency - the rare, persistent currency kept regardless of whether a
// run is won or lost. Local-only for now (no server endpoint).
// ---------------------------------------------------------------------------
export function loadMetaCurrencyLocal() {
  return readLocal(STORAGE_KEYS.META_CURRENCY, 0);
}

export function saveMetaCurrencyLocal(amount) {
  writeLocal(STORAGE_KEYS.META_CURRENCY, amount);
}

// ---------------------------------------------------------------------------
// Gold run leaderboard
// ---------------------------------------------------------------------------
// Standard competition ranking ("1224"): ties share a rank and the next rank
// skips ahead by the number of tied entries, rather than compressing gaps.
export function rankEntries(entries) {
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  let rank = 0;
  let prevScore = null;
  return sorted.map((entry, i) => {
    if (entry.score !== prevScore) {
      rank = i + 1;
      prevScore = entry.score;
    }
    return { ...entry, rank };
  });
}

function readLocalScores() {
  return readLocal(STORAGE_KEYS.GOLD_RUN_SCORES, []);
}

function writeLocalScore({ playerName, gold }) {
  const scores = readLocalScores();
  scores.push({ name: playerName, score: gold });
  scores.sort((a, b) => b.score - a.score);
  writeLocal(STORAGE_KEYS.GOLD_RUN_SCORES, scores.slice(0, MAX_LOCAL_SCORES));
}

export async function submitGoldRun(payload) {
  // Persisted locally first so the leaderboard has something to show even if
  // the network call below succeeds now but a later reload happens offline.
  writeLocalScore(payload);
  try {
    return await callFunction('submit-run-score', { method: 'POST', body: payload });
  } catch (e) {
    return { ok: false, offline: true, message: 'Score saved locally only (offline).' };
  }
}

export async function getGoldLeaderboard() {
  try {
    return await callFunction('get-leaderboard');
  } catch (e) {
    const entries = rankEntries(readLocalScores());
    return { ok: true, offline: true, entries };
  }
}

// ---------------------------------------------------------------------------
// Rewarded ads - standard ad-network monetization, no real money changes
// hands between players.
// ---------------------------------------------------------------------------
export async function verifyAdReward(adToken) {
  try {
    return await callFunction('verify-ad-reward', { method: 'POST', body: { adToken } });
  } catch (e) {
    // Offline: trust the client-side ad-complete callback so ad placements still work in dev/offline play.
    return { ok: true, offline: true };
  }
}
