import * as THREE from 'three'

/**
 * A tiny synthetic "shout" ping, generated as PCM samples and encoded to a
 * WAV Blob URL entirely in-browser — no external MP3 asset, no network
 * fetch. drei's <PositionalAudio> only accepts a `url` (it loads via
 * THREE.AudioLoader under the hood), so this is the one shape that plugs
 * straight into that component unmodified: synthesize once at module load,
 * hand out the resulting blob: URL to every instance.
 */
const SAMPLE_RATE = 44100
const SHOUT_DURATION = 0.22

function synthesizeShoutSamples(): Float32Array {
  const length = Math.floor(SAMPLE_RATE * SHOUT_DURATION)
  const samples = new Float32Array(length)
  const startFreq = 880
  const endFreq = 420
  let phase = 0

  for (let i = 0; i < length; i++) {
    const progress = i / length
    const freq = THREE.MathUtils.lerp(startFreq, endFreq, progress)
    phase += (2 * Math.PI * freq) / SAMPLE_RATE

    // A touch of second harmonic gives it a "voice-like ping" timbre
    // instead of a pure sine-wave test-tone beep.
    const tone = 0.8 * Math.sin(phase) + 0.2 * Math.sin(2 * phase)

    // Half-sine envelope: starts and ends at 0, so there's no click at
    // either edge of the clip, peaking a third of the way through.
    const envelope = Math.sin(Math.PI * Math.min(1, progress / 0.7)) * (progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3)

    samples[i] = tone * envelope * 0.6
  }

  return samples
}

function encodeWavMono(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += bytesPerSample
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

export const SHOUT_SOUND_URL: string = URL.createObjectURL(
  encodeWavMono(synthesizeShoutSamples(), SAMPLE_RATE),
)

/**
 * Browsers refuse to run an AudioContext until a user gesture. Call this
 * from the first click/keydown so the very first shout is actually audible
 * instead of silently failing the autoplay policy.
 */
let audioUnlocked = false
export function unlockAudio(): void {
  if (audioUnlocked) return
  audioUnlocked = true
  // three's type declarations mistype getContext() as returning its own
  // (near-empty) AudioContext wrapper class; at runtime it's always the
  // native Web Audio context (see three's own JSDoc on the method).
  const ctx = THREE.AudioContext.getContext() as unknown as globalThis.AudioContext
  if (ctx.state === 'suspended') {
    void ctx.resume()
  }
}

/** (re)starts a positional shout sound from the top, ignoring a clip already in flight. */
export function playShout(audio: THREE.PositionalAudio | null | undefined): void {
  if (!audio || !audio.buffer) return
  if (audio.isPlaying) audio.stop()
  audio.play()
}

const MUFFLE_FREQUENCY = 800

/**
 * Applies (or removes) a lowpass filter on a PositionalAudio node so a
 * shout sounds muffled when line-of-sight to the listener is blocked by
 * cover. Idempotent — safe to call every frame with the current
 * blocked/clear state without thrashing the audio graph.
 */
export function setAudioMuffled(audio: THREE.PositionalAudio | null | undefined, muffled: boolean): void {
  if (!audio) return
  const hasFilter = !!audio.getFilter()
  if (muffled === hasFilter) return

  if (muffled) {
    const filter = audio.context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = MUFFLE_FREQUENCY
    audio.setFilter(filter)
  } else {
    audio.setFilter(undefined)
  }
}
