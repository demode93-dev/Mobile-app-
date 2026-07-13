import { JOURNAL_NODES, INSIGHT_PER_DEPTH, INSIGHT_PER_3_KILLS, INSIGHT_MILESTONE_BONUS, STORAGE_KEYS } from '../utils/constants.js';
import { saveJournal, loadJournalLocal } from '../utils/api.js';

const DEFAULT_STATE = { insight: 0, unlocked: [] };

// Owns permanent meta-progression: Insight currency and the 22-node skill
// tree. Persists to localStorage immediately and best-effort syncs to the
// backend (update-journal function) when available.
export default class JournalManager {
  constructor() {
    this.state = loadJournalLocal(DEFAULT_STATE) || DEFAULT_STATE;
    if (!Array.isArray(this.state.unlocked)) this.state.unlocked = [];
    if (typeof this.state.insight !== 'number') this.state.insight = 0;
  }

  get insight() {
    return this.state.insight;
  }

  isUnlocked(nodeId) {
    return this.state.unlocked.includes(nodeId);
  }

  isAvailable(nodeId) {
    const node = JOURNAL_NODES.find(n => n.id === nodeId);
    if (!node || this.isUnlocked(nodeId)) return false;
    return node.prereqs.every(p => this.isUnlocked(p));
  }

  canAfford(nodeId) {
    const node = JOURNAL_NODES.find(n => n.id === nodeId);
    return node ? this.state.insight >= node.cost : false;
  }

  unlock(nodeId) {
    if (!this.isAvailable(nodeId) || !this.canAfford(nodeId)) return false;
    const node = JOURNAL_NODES.find(n => n.id === nodeId);
    this.state.insight -= node.cost;
    this.state.unlocked.push(nodeId);
    this.persist();
    return true;
  }

  addInsight(amount) {
    this.state.insight += amount;
    this.persist();
  }

  earnForRun({ depthReached, enemiesKilled }) {
    let earned = depthReached * INSIGHT_PER_DEPTH;
    earned += Math.floor(enemiesKilled / 3) * INSIGHT_PER_3_KILLS;
    for (const [milestone, bonus] of Object.entries(INSIGHT_MILESTONE_BONUS)) {
      if (depthReached >= Number(milestone)) earned += bonus;
    }
    this.addInsight(earned);
    return earned;
  }

  // Aggregates every unlocked node's effect into a single modifiers object,
  // ready to merge into a fresh run's UpgradeManager.
  computeModifiers() {
    const mods = {};
    for (const nodeId of this.state.unlocked) {
      const node = JOURNAL_NODES.find(n => n.id === nodeId);
      if (!node) continue;
      const { key, value } = node.effect;
      if (typeof value === 'number') {
        mods[key] = (mods[key] || 0) + value;
      } else {
        mods[key] = value;
      }
    }
    // Berserker's Vow trades max HP for Sword damage - reflected as a direct maxHp penalty here.
    if (mods.berserkersVow) mods.maxHp = (mods.maxHp || 0) - 2;
    return mods;
  }

  persist() {
    saveJournal(this.state);
  }

  resetForTesting() {
    this.state = { ...DEFAULT_STATE, unlocked: [] };
    this.persist();
  }
}

export { JOURNAL_NODES, STORAGE_KEYS };
