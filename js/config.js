/* ============================================================
   Monetization config. Fill these in to switch from the built-in
   SIMULATION to real Lemon Squeezy checkout + real rewarded ads.
   Everything stays static / Netlify- & Pages-friendly.

   ⚠️ Client-only entitlement note: a purely static site cannot
   *securely* verify a purchase. For real anti-fraud you need a tiny
   serverless function (Netlify) that consumes the Lemon Squeezy
   webhook and records the entitlement. Until then, unlocks are
   granted client-side on the checkout "success" event (fine for a
   prototype / honor-system, not fraud-proof).
   ============================================================ */
const CONFIG = {
  lemonSqueezy: {
    enabled: false,                  // ← set true once URLs are filled in
    // Lemon Squeezy "buy" overlay URLs (Dashboard → Products → Share/Buy link).
    // One product per premium skin (or reuse one URL for all):
    skinCheckoutUrls: {
      shadow:   "",                  // e.g. https://YOURSTORE.lemonsqueezy.com/buy/XXXX-UUID
      ember:    "",
      tactical: "",
    },
  },
  ads: {
    enabled: false,                  // ← set true once publisher ID is filled in
    provider: "adsense-h5",          // Google H5 Games Ads (rewarded)
    adsensePublisherId: "",          // "ca-pub-XXXXXXXXXXXXXXXX"
  },
};
