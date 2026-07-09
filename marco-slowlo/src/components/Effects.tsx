import { EffectComposer, SSAO } from '@react-three/postprocessing'

/** Just SSAO now: it seats the containment-crate pillars and characters
 * into the glossy floor with real contact shadows, which matters even more
 * in a bright, evenly-lit facility where nothing else is casting visual
 * weight. Bloom, vignette, and film grain are gone on purpose — a crisp,
 * clinical render is the point, and the dark crimson bubbles need to read
 * as an intentional void in that brightness, not get blown out by glow. */
export function Effects() {
  return (
    <EffectComposer multisampling={4} enableNormalPass>
      <SSAO
        radius={0.32}
        intensity={16}
        luminanceInfluence={0.7}
        bias={0.035}
        worldDistanceThreshold={1}
        worldDistanceFalloff={0.5}
        worldProximityThreshold={6}
        worldProximityFalloff={1}
      />
    </EffectComposer>
  )
}
