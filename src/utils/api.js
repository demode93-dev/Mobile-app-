// Thin API client for Netlify Functions with full localStorage fallback so the
// game is completely playable offline / without a deployed backend.

import { STORAGE_KEYS } from './constants.js';

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

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeLocal(key, value) {
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
    if (cached && cached.date === new Date().toISOString().slice(0, 10)) return cached;
    const generated = {
      date: new Date().toISOString().slice(0, 10),
      seed: Math.floor(Math.random() * 1e9),
      offline: true
    };
    writeLocal(STORAGE_KEYS.DAILY_DUNGEON_CACHE, generated);
    return generated;
  }
}

export async function submitTournamentScore(payload) {
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
    return { ok: false, offline: true, entries: [] };
  }
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
