import { STORAGE_KEYS } from '../utils/constants.js';
import { readLocal, writeLocal } from '../utils/api.js';

export const BGM_KEY = 'bgm_dungeon';
export const SFX_KEYS = [
  'sfx_match', 'sfx_sword', 'sfx_shield', 'sfx_magic', 'sfx_potion',
  'sfx_enemy_hit', 'sfx_enemy_die', 'sfx_mimic_ambush', 'sfx_depth_clear',
  'sfx_campfire', 'sfx_unlock', 'sfx_button'
];

// Thin wrapper around Phaser's built-in (per-game, not per-scene) sound
// manager. A single instance lives on the game registry - see BootScene -
// so every scene and plain-JS system (CombatManager, Enemy, ...) shares one
// mute/volume state instead of each holding its own.
//
// Every play call is gated on the key actually being in the audio cache, so
// if the real asset files described in the audio asset list haven't been
// dropped into public/assets/audio/ yet (as of this build, they haven't),
// BootScene's normal loaderror handling just leaves that key out of the
// cache and every playSFX/playBGM call for it silently no-ops. The game
// never depends on audio to function.
export default class SoundManager {
  constructor(scene) {
    this.sound = scene.sound;
    this.audioCache = scene.cache.audio;
    this.bgmInstance = null;

    // Tracked ourselves rather than read back from Phaser's own
    // sound.mute/volume getters - in at least one tested environment
    // (headless Chromium with no real audio device) those setters apply on a
    // deferred tick, so a synchronous read immediately after assignment can
    // return the stale pre-write value. Owning the state here keeps
    // muted/volume (and anything driven by them, like the mute-toggle label)
    // correct on every read regardless of the underlying sound backend.
    this._muted = readLocal(STORAGE_KEYS.AUDIO_MUTED, false);
    this._volume = readLocal(STORAGE_KEYS.AUDIO_VOLUME, 0.7);
    this.sound.mute = this._muted;
    this.sound.volume = this._volume;
  }

  hasAudio(key) {
    return this.audioCache.exists(key);
  }

  playSFX(key) {
    if (this._muted) return;
    if (!this.hasAudio(key)) return;
    this.sound.play(key);
  }

  playBGM(key = BGM_KEY) {
    if (!this.hasAudio(key)) return;
    if (this.bgmInstance && this.bgmInstance.key === key) {
      if (!this.bgmInstance.isPlaying) this.bgmInstance.play();
      return;
    }
    this.stopBGM();
    this.bgmInstance = this.sound.add(key, { loop: true, volume: 0.5 });
    this.bgmInstance.play();
  }

  stopBGM() {
    if (this.bgmInstance) {
      this.bgmInstance.stop();
      this.bgmInstance.destroy();
      this.bgmInstance = null;
    }
  }

  get muted() {
    return this._muted;
  }

  setMuted(muted) {
    this._muted = muted;
    this.sound.mute = muted;
    writeLocal(STORAGE_KEYS.AUDIO_MUTED, muted);
  }

  toggleMuted() {
    this.setMuted(!this._muted);
    return this._muted;
  }

  setVolume(v) {
    const clamped = Math.max(0, Math.min(1, v));
    this._volume = clamped;
    this.sound.volume = clamped;
    writeLocal(STORAGE_KEYS.AUDIO_VOLUME, clamped);
  }
}

// Convenience for plain (non-Scene) classes that only hold a `scene`
// reference - CombatManager, BoardManager, Enemy, Mimic - so call sites don't
// each repeat the registry lookup + null-check.
export function playSFX(scene, key) {
  const sm = scene.registry.get('soundManager');
  if (sm) sm.playSFX(key);
}
