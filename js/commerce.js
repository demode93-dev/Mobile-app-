/* ============================================================
   Commercial layer — all hooks are PLACEHOLDERS with clear TODOs.
   Nothing here charges real money or shows real ads yet; the flows are
   fully simulated so the game stays playable/testable offline.

     • Dog skins      — cosmetic shop, free + premium breeds/vests
     • Payments       — Lemon Squeezy checkout placeholder (premium skins)
     • Ads            — rewarded-ad revive placeholder
     • Share          — social "rescue certificate" (Web Share API)
   ============================================================ */
const Commerce = (() => {
  // ---- Dog skins (cosmetic) ----
  const SKINS = [
    { id: "stray",  name: "Stray",       body: "#c79b6b", accent: "#8a6238", premium: false },
    { id: "husky",  name: "Husky",       body: "#cfd8e3", accent: "#6b7787", premium: false },
    { id: "shadow", name: "Shadow K9",   body: "#3a3f4a", accent: "#7CFF00", premium: true },
    { id: "ember",  name: "Ember Hound", body: "#e0683a", accent: "#ffcf5c", premium: true },
    { id: "tactical", name: "Tac-Vest",  body: "#5b6b52", accent: "#ffae42", premium: true },
  ];
  const OWN_KEY = "labescape.skins.v1";
  const SEL_KEY = "labescape.skin";

  function ownedSet() {
    try { return new Set(JSON.parse(localStorage.getItem(OWN_KEY) || "[]")); }
    catch { return new Set(); }
  }
  function owns(id) {
    const s = SKINS.find((k) => k.id === id);
    if (!s) return false;
    return !s.premium || ownedSet().has(id);
  }
  function grant(id) {
    const set = ownedSet(); set.add(id);
    try { localStorage.setItem(OWN_KEY, JSON.stringify([...set])); } catch {}
  }
  function selectedId() {
    try { return localStorage.getItem(SEL_KEY) || "stray"; } catch { return "stray"; }
  }
  function select(id) {
    if (owns(id)) { try { localStorage.setItem(SEL_KEY, id); } catch {} return true; }
    return false;
  }
  function activeSkin() {
    return SKINS.find((k) => k.id === selectedId() && owns(k.id)) || SKINS[0];
  }

  // ---- Payments: Lemon Squeezy hosted/overlay checkout ----
  // Uses lemon.js when CONFIG.lemonSqueezy.enabled and a checkout URL exists;
  // otherwise simulates the purchase so the game stays playable offline.
  let _lemonReady = false, _pendingGrant = null;

  function ensureLemon(cb) {
    if (window.LemonSqueezy) { cb(); return; }
    const s = document.createElement("script");
    s.src = "https://app.lemonsqueezy.com/js/lemon.js";
    s.defer = true;
    s.onload = () => {
      try { window.createLemonSqueezy && window.createLemonSqueezy(); } catch (e) {}
      try {
        window.LemonSqueezy && window.LemonSqueezy.Setup({
          eventHandler: (ev) => {
            // Granted client-side on success (see CONFIG note re: server verify).
            if (ev && /Checkout\.Success/i.test(ev.event || "") && _pendingGrant) {
              const g = _pendingGrant; _pendingGrant = null; g();
            }
          },
        });
      } catch (e) {}
      _lemonReady = true; cb();
    };
    s.onerror = () => cb(false);
    document.head.appendChild(s);
  }

  function buySkin(id, onDone) {
    const ls = CONFIG.lemonSqueezy;
    const url = ls && ls.enabled && ls.skinCheckoutUrls && ls.skinCheckoutUrls[id];
    if (url) {
      _pendingGrant = () => { grant(id); onDone && onDone(true); };
      ensureLemon((ok) => {
        if (ok === false || !window.LemonSqueezy) { _pendingGrant = null; onDone && onDone(false); return; }
        const sep = url.includes("?") ? "&" : "?";
        window.LemonSqueezy.Url.Open(url + sep + "embed=1");
      });
      return;
    }
    // Fallback: simulated purchase.
    console.warn("[Commerce] Lemon Squeezy not configured — simulating skin purchase:", id);
    grant(id);
    if (onDone) onDone(true);
  }

  // ---- Ads: Google H5 Games Ads rewarded video ----
  let _adsReady = false;
  function ensureAds(cb) {
    const a = CONFIG.ads;
    if (!a || !a.enabled || !a.adsensePublisherId) { cb(false); return; }
    if (_adsReady) { cb(true); return; }
    const s = document.createElement("script");
    s.async = true; s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + a.adsensePublisherId;
    s.onload = () => {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adConfig = window.adConfig || function (c) { (adsbygoogle = window.adsbygoogle || []).push(c); };
      window.adBreak = window.adBreak || function (o) { (adsbygoogle = window.adsbygoogle || []).push(o); };
      try { window.adConfig({ preloadAdBreaks: "on" }); } catch (e) {}
      _adsReady = true; cb(true);
    };
    s.onerror = () => cb(false);
    document.head.appendChild(s);
  }

  // Show a rewarded ad. `onReward(true)` ONLY on full view; false if skipped /
  // unavailable. Falls back to a simulated reward when ads aren't configured.
  function showRewardedAd(onReward) {
    ensureAds((ready) => {
      if (!ready) {
        console.warn("[Commerce] Ad network not configured — simulating rewarded ad.");
        if (onReward) onReward(true);
        return;
      }
      let rewarded = false, done = false;
      const finish = () => { if (done) return; done = true; if (onReward) onReward(rewarded); };
      try {
        window.adBreak({
          type: "reward",
          name: "revive",
          beforeReward: (showAdFn) => showAdFn(),
          adViewed: () => { rewarded = true; },
          adDismissed: finish,
          adBreakDone: finish,
        });
      } catch (e) { finish(); }
    });
  }

  // ---- Social: shareable "rescue certificate" image ----
  function buildCertificate({ level, rescued, animals, stars, score }) {
    const c = document.createElement("canvas");
    c.width = 600; c.height = 380;
    const x = c.getContext("2d");
    x.fillStyle = "#070b12"; x.fillRect(0, 0, 600, 380);
    x.strokeStyle = "#7CFF00"; x.lineWidth = 4; x.strokeRect(12, 12, 576, 356);
    x.textAlign = "center";
    x.fillStyle = "#7CFF00"; x.font = "bold 34px Trebuchet MS, sans-serif";
    x.fillText("LAB ESCAPE — RESCUE CERTIFICATE", 300, 70);
    x.fillStyle = "#eaffea"; x.font = "20px Trebuchet MS, sans-serif";
    x.fillText(`Escaped Floor ${level}`, 300, 130);
    x.font = "bold 26px Trebuchet MS, sans-serif"; x.fillStyle = "#ffcf5c";
    x.fillText(`🐾 ${rescued} / ${animals} animals rescued`, 300, 185);
    x.font = "40px sans-serif"; x.fillStyle = "#ffd000";
    x.fillText("★".repeat(stars) + "☆".repeat(3 - stars), 300, 245);
    x.fillStyle = "#9fb6c8"; x.font = "18px Trebuchet MS, sans-serif";
    x.fillText(`Score ${score}`, 300, 290);
    x.fillStyle = "#6f8aa0"; x.font = "14px Trebuchet MS, sans-serif";
    x.fillText("demode93-dev.github.io/Mobile-app-", 300, 340);
    return c;
  }

  async function shareCertificate(data) {
    const canvas = buildCertificate(data);
    const text = `I escaped Floor ${data.level} of LAB ESCAPE and rescued ` +
      `${data.rescued}/${data.animals} lab animals (${data.stars}★)! Can you beat it?`;
    const url = "https://demode93-dev.github.io/Mobile-app-/";
    try {
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      const file = new File([blob], "rescue-certificate.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text, url, title: "LAB ESCAPE" });
        return;
      }
      if (navigator.share) { await navigator.share({ text, url, title: "LAB ESCAPE" }); return; }
      // Fallback: download the image + copy the brag text.
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png"); a.download = "rescue-certificate.png"; a.click();
      try { await navigator.clipboard.writeText(text + " " + url); } catch {}
    } catch (e) { /* user cancelled share — ignore */ }
  }

  return {
    SKINS, owns, buySkin, selectedId, select, activeSkin,
    showRewardedAd, shareCertificate,
  };
})();
