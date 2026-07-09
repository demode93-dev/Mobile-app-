import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

/** Bloom makes the shout bubbles read as glowing kinetic energy rather than
 * flat transparent geometry; the vignette + faint noise keep the arena
 * feeling moody and analog instead of clean/CG. */
export function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={1.35}
        luminanceThreshold={0.18}
        luminanceSmoothing={0.35}
        mipmapBlur
        radius={0.85}
      />
      <Vignette eskil={false} offset={0.28} darkness={0.85} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.06} />
    </EffectComposer>
  )
}
