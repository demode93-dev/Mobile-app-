import { useMemo } from 'react'
import { ARENA_HALF_SIZE } from '../lib/constants'

const PILLAR_RING_RADIUS = ARENA_HALF_SIZE * 0.86
const PILLAR_COUNT = 14

/** A bright, sterile research-facility arena: glossy light tile floor, a
 * ring of white lab columns with blue status caps for spatial reference,
 * and a soft blue boundary marker so the player has a legible edge while
 * sprinting. */
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
      {/* Floor: glossy light tile so it reads as a clean-room surface and
       * still picks up soft reflections from the overhead panel lights. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[ARENA_HALF_SIZE * 1.05, 64]} />
        <meshStandardMaterial color="#e7e9ee" roughness={0.35} metalness={0.5} envMapIntensity={1.2} />
      </mesh>

      {/* Faint concentric floor markings for depth/scale cues */}
      {[6, 12, 18].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
          <ringGeometry args={[r - 0.04, r, 128]} />
          <meshBasicMaterial color="#9aa8c2" transparent opacity={0.3} />
        </mesh>
      ))}

      {/* Perimeter wall: low blue hazard-boundary marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[ARENA_HALF_SIZE - 0.15, ARENA_HALF_SIZE, 96]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.55} />
      </mesh>

      {/* Laboratory columns: white shafts with a blue status cap */}
      {pillarPositions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh castShadow position={[0, 2.2, 0]}>
            <boxGeometry args={[0.6, 4.4, 0.6]} />
            <meshStandardMaterial color="#f2f4f7" roughness={0.4} metalness={0.25} />
          </mesh>
          <mesh position={[0, 4.5, 0]}>
            <boxGeometry args={[0.72, 0.12, 0.72]} />
            <meshStandardMaterial color="#2563eb" emissive="#2563eb" emissiveIntensity={0.6} roughness={0.3} metalness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function ArenaFog() {
  return <fogExp2 attach="fog" args={['#dde2ec', 0.012]} />
}
