// Environmental storytelling: short radio transmissions revealed by collecting
// PDA / terminal drops scattered through the facility. Recovered logs persist
// in localStorage, giving players a collection meta-goal across runs.
const Lore = (() => {
  const LOGS = [
    "Dr. Vance: Section 4 containment has breached. Lock down the sectors — now.",
    "Audio Log: They're mutating… and half the ceiling lights are already failing.",
    "Security: Keycards are the only way through the blast doors. Find three. Keep moving.",
    "Dr. Vance: The fast ones — the swarms — they track your scent around corners. Keep moving.",
    "Note: The big stationary ones block the halls. A hard sprint is the only way past them.",
    "FINAL LOG: Patient Zero is awake. It is not like the others. God help whoever's still down here.",
  ];

  const KEY = "labescape.lore.v1";

  function recovered() {
    try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); }
    catch { return new Set(); }
  }
  function recover(idx) {
    const set = recovered();
    set.add(idx);
    try { localStorage.setItem(KEY, JSON.stringify([...set])); } catch {}
    return set.size;
  }
  function count() { return recovered().size; }

  return { LOGS, recover, count, total: LOGS.length };
})();
