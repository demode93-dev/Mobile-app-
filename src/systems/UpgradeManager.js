import { UPGRADE_POOL, RARITY_WEIGHTS } from '../utils/constants.js';

// Tracks the modifiers active for the current run: permanent Journal nodes
// (passed in as baseModifiers, never mutated here) merged with camp upgrade
// cards drafted during this run (which do stack).
export default class UpgradeManager {
  constructor(baseModifiers = {}) {
    this.baseModifiers = baseModifiers;
    this.runCards = [];
    this.modifiers = { ...baseModifiers };
  }

  drawOptions(count = 3) {
    const pool = [...UPGRADE_POOL];
    const chosen = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const card = this.weightedPick(pool);
      chosen.push(card);
      pool.splice(pool.indexOf(card), 1);
    }
    return chosen;
  }

  weightedPick(pool) {
    const weighted = pool.map(card => ({ card, weight: RARITY_WEIGHTS[card.rarity] }));
    const total = weighted.reduce((s, w) => s + w.weight, 0);
    let roll = Math.random() * total;
    for (const w of weighted) {
      roll -= w.weight;
      if (roll <= 0) return w.card;
    }
    return weighted[weighted.length - 1].card;
  }

  applyCard(card, { onInstantHeal } = {}) {
    this.runCards.push(card);
    const { effect } = card;
    switch (effect.type) {
      case 'stat':
        this.modifiers[effect.key] = (this.modifiers[effect.key] || 0) + effect.value;
        break;
      case 'flag':
        if (typeof effect.value === 'number') {
          this.modifiers[effect.key] = (this.modifiers[effect.key] || 0) + effect.value;
        } else {
          this.modifiers[effect.key] = true;
        }
        break;
      case 'active':
        this.modifiers[effect.key] = true;
        break;
      case 'instant':
        if (onInstantHeal) onInstantHeal(effect.value);
        break;
      default:
        break;
    }
    return this.modifiers;
  }

  hasCard(id) {
    return this.runCards.some(c => c.id === id);
  }
}
