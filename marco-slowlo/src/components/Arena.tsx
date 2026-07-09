import { useMemo } from 'react'
import { ARENA_HALF_SIZE } from '../lib/constants'

const PILLAR_RING_RADIUS = ARENA_HALF_SIZE * 0.86
const PILLAR_COUNT = 14

/** A moody, high-contrast arena: dark reflective floor, a ring of glowing
 * pillars for spatial reference, and a soft perimeter wall so the player has
 * a legible boundary while sprinting. */
export function Arena() {
  const pillarPositions = useMemo(() => {
    const positions: [number, number, number][] = []
    for (let i = 0; i < PILLAR_COUNT; i++) {
      const angle = (i / PILLAR_COUNT) * Math.PI * 2
      positions.push([Math.cos(angle) * PILLAR_RING_RADIUS, 0, Math.sin(angle) * PILLAR_RING_RADIUS])
    }
    return positions
  }, [])

  return (
    <group>
      {/* Floor: dark, highly reflective metal so bubbles/pillars wash light across it */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[ARENA_HALF_SIZE * 1.05, 64]} />
        <meshStandardMaterial color="#0b0912" roughness={0.1} metalness={0.8} envMapIntensity={1.4} />
      </mesh>

      {/* Faint concentric rings etched into the floor for depth/scale cues */}
      {[6, 12, 18].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
          <ringGeometry args={[r - 0.04, r, 128]} />
          <meshBasicMaterial color="#5b2bff" transparent opacity={0.14} />
        </mesh>
      ))}

      {/* Perimeter wall: low, glowing boundary marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[ARENA_HALF_SIZE - 0.15, ARENA_HALF_SIZE, 96]} />
        <meshBasicMaterial color="#c084fc" transparent opacity={0.5} />
      </mesh>

      {/* Pillars */}
      {pillarPositions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh castShadow position={[0, 2.2, 0]}>
            <boxGeometry args={[0.6, 4.4, 0.6]} />
            <meshStandardMaterial color="#141019" roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh position={[0, 4.5, 0]}>
            <boxGeometry args={[0.72, 0.12, 0.72]} />
            <meshStandardMaterial
              color="#7c3aed"
              emissive="#7c3aed"
              emissiveIntensity={2.2}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function ArenaFog() {
  return <fogExp2 attach="fog" args={['#0a0712', 0.028]} />
}
