// All sound is synthesized with the Web Audio API so the game ships with
// zero audio asset files. Must be unlocked by a user gesture (mobile policy).
const Sound = (() => {
  let ctx = null;
  let master = null;
  let ambientOn = false;
  let muted = false;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }

  function unlock() {
    init();
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  function tone(freq, dur, type = "sine", gain = 0.3, slideTo = null) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, gain = 0.2, hp = 800) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filt).connect(g).connect(master);
    src.start(t);
  }

  // --- named effects ---
  const sfx = {
    pickup:   () => { tone(660, 0.08, "square", 0.25); tone(990, 0.12, "square", 0.2); },
    keycard:  () => { tone(523, 0.1, "triangle", 0.3); tone(784, 0.16, "triangle", 0.3, 1100); },
    hurt:     () => { tone(180, 0.18, "sawtooth", 0.35, 70); noise(0.12, 0.25, 400); },
    zap:      () => { tone(1200, 0.06, "square", 0.18, 300); },
    door:     () => { tone(110, 0.4, "sawtooth", 0.25, 240); },
    win:      () => { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,0.25,"triangle",0.3),i*120)); },
    dead:     () => { tone(220, 0.8, "sawtooth", 0.35, 50); noise(0.6, 0.2, 200); },
    growl:    () => { tone(90, 0.5, "sawtooth", 0.22, 60); },
    alarm:    () => { tone(880, 0.18, "square", 0.12, 660); },
    step:     () => { noise(0.04, 0.05, 1200); },
    drip:     () => { tone(1500, 0.06, "sine", 0.10, 600); tone(700, 0.10, "sine", 0.06, 300); },
    sprinkler:() => { noise(0.3, 0.05, 2200); },
    swing:    () => { noise(0.10, 0.16, 1700); tone(320, 0.07, "square", 0.10, 140); },
    splat:    () => { noise(0.10, 0.22, 520); tone(140, 0.10, "sawtooth", 0.18, 60); },
    kill:     () => { noise(0.18, 0.26, 360); tone(160, 0.22, "sawtooth", 0.28, 50); },
  };

  // Low looping ambient hum + heartbeat that quickens with danger.
  let humOsc = null, humGain = null, heartTimer = null, heartRate = 1100;
  function startAmbient() {
    if (!ctx || ambientOn) return;
    ambientOn = true;
    humOsc = ctx.createOscillator();
    humGain = ctx.createGain();
    humOsc.type = "sawtooth";
    humOsc.frequency.value = 55;
    humGain.gain.value = 0.04;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 120;
    humOsc.connect(lp).connect(humGain).connect(master);
    humOsc.start();
    scheduleHeart();
  }
  function scheduleHeart() {
    if (!ambientOn) return;
    tone(60, 0.12, "sine", 0.18);
    setTimeout(() => tone(50, 0.1, "sine", 0.14), 130);
    heartTimer = setTimeout(scheduleHeart, heartRate);
  }
  function setDanger(level01) { // 0 calm .. 1 terror
    heartRate = Utils.lerp(1200, 380, Utils.clamp(level01, 0, 1));
    if (humGain) humGain.gain.value = 0.04 + level01 * 0.06;
  }
  function stopAmbient() {
    ambientOn = false;
    if (heartTimer) clearTimeout(heartTimer);
    if (humOsc) { try { humOsc.stop(); } catch (e) {} humOsc = null; }
  }

  function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; }

  return { unlock, sfx, startAmbient, stopAmbient, setDanger, toggleMute };
})();
