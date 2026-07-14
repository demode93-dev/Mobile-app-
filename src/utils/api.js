// Thin API client for Netlify Functions with full localStorage fallback so the
// game is completely playable offline / without a deployed backend.

import { STORAGE_KEYS } from './constants.js';
import { seedFromDate } from './rng.js';

const FUNCTIONS_BASE = '/.netlify/functions';
const NETWORK_TIMEOUT_MS = 4000;

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

// Exported (not just used internally) so other modules - e.g. rewards.js,
// which needs to read yesterday's local scores - share one localStorage
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
// Journal persistence
// ---------------------------------------------------------------------------
// Stored as two plain localStorage keys (not one combined blob) so JournalScene
// can read/write insight and unlocked-node state independently and instantly.
export async function saveJournal({ insight, unlocked }) {
  writeLocal(STORAGE_KEYS.INSIGHT, insight);
  writeLocal(STORAGE_KEYS.JOURNAL_NODES, unlocked);
  try {
    await callFunction('update-journal', { method: 'POST', body: { insight, unlocked } });
  } catch (e) {
    // offline fallback already saved locally, nothing more to do
  }
}

export function loadJournalLocal() {
  const insight = readLocal(STORAGE_KEYS.INSIGHT, 0);
  const unlocked = readLocal(STORAGE_KEYS.JOURNAL_NODES, []);
  return { insight, unlocked };
}

// ---------------------------------------------------------------------------
// Daily dungeon / leaderboard
// ---------------------------------------------------------------------------
export async function getDailyDungeon() {
  try {
    return await callFunction('get-daily-dungeon');
  } catch (e) {
    const cached = readLocal(STORAGE_KEYS.DAILY_DUNGEON_CACHE, null);
    const dateKey = new Date().toISOString().slice(0, 10);
    if (cached && cached.date === dateKey) return cached;
    // Offline: derive the same deterministic seed the server would, so an
    // offline player still gets today's shared dungeon, not a private one.
    const generated = { date: dateKey, seed: seedFromDate(dateKey), offline: true };
    writeLocal(STORAGE_KEYS.DAILY_DUNGEON_CACHE, generated);
    return generated;
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const SCORE_HISTORY_DAYS = 7;

// Local-only leaderboard store, keyed by date so both "today" (for the live
// leaderboard) and "yesterday" (for the reward check, which runs the day
// after the dungeon closed) can be read back. Shape: { "<date>": [{name, depth, score}] }.
// Pruned to the last SCORE_HISTORY_DAYS dates on every write so it can't grow unbounded.
export function getScoresForDate(dateKey) {
  const store = readLocal(STORAGE_KEYS.DAILY_SCORES, {});
  return store[dateKey] || [];
}

function writeLocalScore({ playerName, depthReached, score }) {
  const dateKey = todayKey();
  const store = readLocal(STORAGE_KEYS.DAILY_SCORES, {});
  store[dateKey] = [...(store[dateKey] || []), { name: playerName, depth: depthReached, score }];

  const keptDates = Object.keys(store).sort().slice(-SCORE_HISTORY_DAYS);
  const pruned = {};
  for (const d of keptDates) pruned[d] = store[d];

  writeLocal(STORAGE_KEYS.DAILY_SCORES, pruned);
}

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

export async function submitTournamentScore(payload) {
  // Persisted locally first so the leaderboard has something to show even if
  // the network call below succeeds now but a later reload happens offline.
  writeLocalScore(payload);
  try {
    return await callFunction('submit-tournament-score', { method: 'POST', body: payload });
  } catch (e) {
    return { ok: false, offline: true, message: 'Score saved locally only (offline).' };
  }
}

export async function getLeaderboard() {
  try {
    return await callFunction('get-leaderboard');
  } catch (e) {
    const entries = rankEntries(getScoresForDate(todayKey()));
    return { ok: true, offline: true, entries };
  }
}

// ---------------------------------------------------------------------------
// Gems - virtual currency earned only from Daily Dungeon leaderboard rewards.
// Local-only for now (no server endpoint), same as the rest of the reward system.
// ---------------------------------------------------------------------------
export function loadGemsLocal() {
  return readLocal(STORAGE_KEYS.GEMS, 0);
}

export function saveGemsLocal(gems) {
  writeLocal(STORAGE_KEYS.GEMS, gems);
}

// ---------------------------------------------------------------------------
// Rewarded ads (Second Wind revive) - standard ad-network monetization, no
// real money changes hands between players.
// ---------------------------------------------------------------------------
export async function verifyAdReward(adToken) {
  try {
    return await callFunction('verify-ad-reward', { method: 'POST', body: { adToken } });
  } catch (e) {
    // Offline: trust the client-side ad-complete callback so "Second Wind" still works in dev/offline play.
    return { ok: true, offline: true };
  }
}
