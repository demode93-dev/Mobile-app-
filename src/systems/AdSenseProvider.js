// Real rewarded-ad provider using Google's Ad Placement API (AdSense for
// Games / H5 Games Ads). Implements the same { requestReward(placementId,
// onProgress) } interface as AdManager's MockAdProvider, so this swaps in
// without touching AdOverlayScene or any GameOverScene call site.
//
// Needs a real AdSense for Games publisher client ID before it serves
// anything - set VITE_ADSENSE_CLIENT_ID (see .env.example). Until that's
// configured, `configured` stays false, the real Google script is never
// even requested, and BootScene falls back to MockAdProvider automatically
// - so the ad flow stays fully testable without real credentials, same
// pattern this project already uses for FAUNA_SECRET/AD_REWARD_SECRET on
// the server side.
//
// API reference: https://developers.google.com/ad-placement/apis/adbreak
let scriptInjected = false;

export default class AdSenseProvider {
  constructor() {
    const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID;
    this.configured = !!clientId;
    if (this.configured && !scriptInjected) {
      scriptInjected = true;
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
      document.head.appendChild(script);
    }
  }

  requestReward(placementId, onProgress = () => {}) {
    if (!this.configured || typeof window.adBreak !== 'function') {
      return Promise.resolve({ success: false, reason: 'sdk_not_configured' });
    }

    return new Promise((resolve) => {
      let resolved = false;
      const finish = (result) => {
        if (resolved) return;
        resolved = true;
        resolve(result);
      };

      window.adBreak({
        type: 'reward',
        name: placementId,
        // The player already opted in by tapping "Watch Ad" before this
        // provider is ever invoked - AdOverlayScene is that confirmation +
        // loading UI - so trigger playback immediately rather than showing
        // Google's own pre-ad prompt stacked on top of ours.
        beforeReward: (showAdFn) => {
          onProgress(0);
          showAdFn();
        },
        adViewed: () => {
          onProgress(1);
          finish({ success: true });
        },
        adDismissed: () => {
          finish({ success: false, reason: 'dismissed' });
        },
        // Always called, even when adViewed/adDismissed never fire at all
        // (no ad available, network error, frequency capped, etc.) - the
        // catch-all that guarantees this promise always settles.
        adBreakDone: (placementInfo) => {
          const status = placementInfo && placementInfo.breakStatus;
          finish(status === 'viewed' ? { success: true } : { success: false, reason: status || 'no_fill' });
        }
      });
    });
  }
}
