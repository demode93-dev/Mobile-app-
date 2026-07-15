// Rewarded-ad system. Providers implement a single requestReward(placementId,
// onProgress) method returning { success: true } or { success: false, reason }
// - this shape matches how real ad SDKs actually work (one call that
// internally handles fill-checking + playback + completion), so swapping
// providers is a one-file change and nothing that calls showRewardedAd()
// needs to know the difference. See AdSenseProvider.js for the real
// (Google H5 Games Ads) implementation.
export class MockAdProvider {
  async requestReward(placementId, onProgress = () => {}) {
    await wait(300 + Math.random() * 400); // simulated fill latency
    if (Math.random() < 0.1) return { success: false, reason: 'no_fill' }; // ~10% no-fill, matching real ad SDK behavior

    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      await wait(150);
      onProgress(i / steps);
    }
    return { success: true };
  }
}

export default class AdManager {
  constructor(provider = new MockAdProvider()) {
    this.provider = provider;
  }

  // Returns { success: true } or { success: false, reason: '...' }.
  async showRewardedAd(placementId, onProgress = () => {}) {
    return this.provider.requestReward(placementId, onProgress);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
