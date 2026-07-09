import { Sparkles } from '@react-three/drei'
import { ARENA_HALF_SIZE } from '../lib/constants'

/** Slow-drifting motes that catch the bloom pass, giving the fog a sense of
 * volume without a full volumetric-light shader pass. */
export function DustParticles() {
  return (
    <Sparkles
      count={260}
      scale={[ARENA_HALF_SIZE * 1.8, 6, ARENA_HALF_SIZE * 1.8]}
      position={[0, 3, 0]}
      size={1.6}
      speed={0.15}
      opacity={0.35}
      color="#c4b5fd"
      noise={1}
    />
  )
}
