// Daily Dungeon reward distribution. Fully client-side / offline for now -
// each device checks its own locally-recorded placement from yesterday's
// dungeon (see api.js's DAILY_SCORES history) rather than calling a backend.
import { STORAGE_KEYS } from './constants.js';
import { readLocal, writeLocal, getScoresForDate, rankEntries, loadGemsLocal, saveGemsLocal } from './api.js';

function yesterdayKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function tierForRank(rank, total) {
  if (rank === 1) return { insight: 100, gems: 50 };
  if (rank === 2) return { insight: 75, gems: 35 };
  if (rank === 3) return { insight: 50, gems: 25 };
  const top10Count = Math.max(1, Math.ceil(total * 0.1));
  if (rank <= top10Count) return { insight: 25, gems: 10 };
  return { insight: 5, gems: 0 };
}

// Returns null when there's nothing to show (already claimed, or the player
// didn't enter yesterday's dungeon on this device), otherwise
// { rank, total, tier, participantOnly }.
export function computeYesterdayReward() {
  const yKey = yesterdayKey();
  const lastClaim = readLocal(STORAGE_KEYS.LAST_REWARD_CLAIM, null);
  if (lastClaim === yKey) return null;

  // PLAYER_NAME is stored as a raw string (LeaderboardScene.ensurePlayerName(),
  // GameOverScene.submitScore()), not JSON-encoded like the other keys here -
  // read it the same way, not through readLocal()'s JSON.parse.
  const playerName = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
  const entries = getScoresForDate(yKey);
  const ranked = rankEntries(entries);
  const mine = playerName ? ranked.find(e => e.name === playerName) : null;

  if (!mine) {
    // Nothing to claim, but mark yesterday resolved so this check doesn't
    // re-run every app open until the next day rolls yesterdayKey() forward.
    writeLocal(STORAGE_KEYS.LAST_REWARD_CLAIM, yKey);
    return null;
  }

  const tier = tierForRank(mine.rank, ranked.length);
  return { rank: mine.rank, total: ranked.length, tier, participantOnly: mine.rank > 3 && tier.gems === 0 };
}

// Applies the reward to the player's persisted totals and marks yesterday as claimed.
export function claimYesterdayReward(scene, tier) {
  const insight = (scene.registry.get('insight') || 0) + tier.insight;
  scene.registry.set('insight', insight);
  writeLocal(STORAGE_KEYS.INSIGHT, insight);

  const gems = loadGemsLocal() + tier.gems;
  saveGemsLocal(gems);
  scene.registry.set('gems', gems);

  writeLocal(STORAGE_KEYS.LAST_REWARD_CLAIM, yesterdayKey());
  return { insight, gems };
}
