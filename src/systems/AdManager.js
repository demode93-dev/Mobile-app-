// Mock rewarded-ad system. MockAdProvider implements the same {load, show}
// shape a real SDK wrapper (AdMob, IMA, etc.) would, so swapping in a real
// provider later is a one-file change - nothing that calls showRewardedAd()
// needs to know the difference.
class MockAdProvider {
  async load() {
    await wait(300 + Math.random() * 400); // simulated fill latency
    return Math.random() > 0.1; // ~10% no-fill, matching real ad SDK behavior
  }

  async show(onProgress) {
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      await wait(150);
      onProgress(i / steps);
    }
  }
}

export default class AdManager {
  constructor(provider = new MockAdProvider()) {
    this.provider = provider;
  }

  // Returns { success: true } or { success: false, reason: 'no_fill' }.
  async showRewardedAd(placementId, onProgress = () => {}) {
    const filled = await this.provider.load(placementId);
    if (!filled) return { success: false, reason: 'no_fill' };
    await this.provider.show(onProgress);
    return { success: true };
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
