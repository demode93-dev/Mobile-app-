import { Bloom, EffectComposer, Noise, SSAO, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

/** Bloom makes the shout bubbles read as glowing kinetic energy rather than
 * flat transparent geometry; SSAO seats the cover pillars into the floor
 * with real contact shadows instead of looking pasted on; the vignette +
 * faint noise keep the arena feeling moody and analog instead of clean/CG.
 * SSAO runs before Bloom in the chain so bloom blooms the *lit* result,
 * not a result that's already been flattened by ambient occlusion. */
export function Effects() {
  return (
    <EffectComposer multisampling={4} enableNormalPass>
      <SSAO
        radius={0.35}
        intensity={22}
        luminanceInfluence={0.55}
        bias={0.035}
        worldDistanceThreshold={1}
        worldDistanceFalloff={0.5}
        worldProximityThreshold={6}
        worldProximityFalloff={1}
      />
      <Bloom
        intensity={1.5}
        luminanceThreshold={0.1}
        luminanceSmoothing={0.35}
        mipmapBlur
        radius={0.85}
      />
      <Vignette eskil={false} offset={0.28} darkness={0.85} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.06} />
    </EffectComposer>
  )
}
