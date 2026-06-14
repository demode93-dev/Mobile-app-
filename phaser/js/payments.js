/* ============================================================
   Lemon Squeezy payment hook — PLACEHOLDER.

   Premium unlocks floors 6+. Real integration steps are marked TODO;
   for now `checkout()` simulates a successful purchase so the flow is
   fully playable/testable without a store account.

   To go live with Lemon Squeezy:
   1. Add their script to index.html:
        <script src="https://app.lemonsqueezy.com/js/lemon.js" defer></script>
   2. Create a product + checkout in your Lemon Squeezy dashboard.
   3. Replace the body of checkout() below with:
        window.LemonSqueezy.Url.Open('https://YOUR-STORE.lemonsqueezy.com/checkout/buy/PRODUCT_ID');
      and confirm entitlement server-side (Netlify serverless function +
      Lemon Squeezy webhook) before calling markUnlocked().
   ============================================================ */
const Payments = (() => {
  const PREMIUM_KEY = "labescape.premium";
  const PREMIUM_FLOOR = 6;

  function isPremiumUnlocked() {
    try { return localStorage.getItem(PREMIUM_KEY) === "1"; } catch { return false; }
  }
  function markUnlocked() {
    try { localStorage.setItem(PREMIUM_KEY, "1"); } catch {}
  }
  function floorRequiresPremium(floor) {
    return floor >= PREMIUM_FLOOR && !isPremiumUnlocked();
  }

  // Open the Lemon Squeezy checkout. `onSuccess` runs once entitlement is
  // confirmed. (Placeholder: simulated purchase.)
  function checkout(onSuccess) {
    // --- TODO: real Lemon Squeezy hosted checkout ---
    // if (window.LemonSqueezy) {
    //   window.LemonSqueezy.Url.Open('https://YOUR-STORE.lemonsqueezy.com/checkout/buy/PRODUCT_ID');
    //   // entitlement confirmed via webhook -> Netlify function -> markUnlocked()
    //   return;
    // }
    console.warn("[Payments] Lemon Squeezy not configured — simulating purchase.");
    markUnlocked();
    if (onSuccess) onSuccess();
  }

  // Wire the DOM paywall overlay. `onUnlock` fires when access is granted.
  function showPaywall(onUnlock, onCancel) {
    const el = document.getElementById("paywall");
    const unlockBtn = document.getElementById("pw-unlock");
    const cancelBtn = document.getElementById("pw-cancel");
    el.classList.add("show");

    const cleanup = () => {
      el.classList.remove("show");
      unlockBtn.onclick = null;
      cancelBtn.onclick = null;
    };
    unlockBtn.onclick = () => checkout(() => { cleanup(); onUnlock && onUnlock(); });
    cancelBtn.onclick = () => { cleanup(); onCancel && onCancel(); };
  }

  return { isPremiumUnlocked, markUnlocked, floorRequiresPremium, checkout, showPaywall, PREMIUM_FLOOR };
})();
