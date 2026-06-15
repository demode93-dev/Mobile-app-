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

  // ---- Payments: Lemon Squeezy checkout (PLACEHOLDER) ----
  // TODO real integration:
  //   1) <script src="https://app.lemonsqueezy.com/js/lemon.js" defer></script>
  //   2) window.LemonSqueezy.Url.Open('https://STORE.lemonsqueezy.com/checkout/buy/VARIANT_ID')
  //   3) confirm purchase server-side (Netlify function + LS webhook) -> grant(id)
  function buySkin(id, onDone) {
    console.warn("[Commerce] Lemon Squeezy not configured — simulating skin purchase:", id);
    grant(id);
    if (onDone) onDone(true);
  }

  // ---- Ads: rewarded video for revive (PLACEHOLDER) ----
  // TODO: integrate a rewarded-ad SDK (AdMob / Unity Ads / AppLovin via a
  // wrapper, or an H5 ad network). Call onReward(true) ONLY on completion.
  function showRewardedAd(onReward) {
    console.warn("[Commerce] Ad network not configured — simulating rewarded ad.");
    if (onReward) onReward(true);
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
