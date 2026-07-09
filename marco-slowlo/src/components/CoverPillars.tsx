import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { COVER_PILLARS } from '../lib/pillars'
import { COVER_PILLAR_HEIGHT, COVER_PILLAR_RADIUS } from '../lib/constants'

const ACCENT_BAND_HEIGHT = 0.4
const ACCENT_BAND_Y = COVER_PILLAR_HEIGHT * 0.72
const ACCENT_BAND_RADIUS = COVER_PILLAR_RADIUS * 1.04

/** Renders the scattered cover pillars as containment-crate columns — one
 * InstancedMesh draw call for the white shafts and one more for the blue
 * metallic accent band, instead of a mesh per obstacle. Positions come
 * straight from COVER_PILLARS (lib/pillars.ts), the same array the
 * line-of-sight "acoustic shadow" check reads, so rendering and collision
 * can never disagree about where a pillar actually is. The shafts stay
 * cylindrical (matching the circle-based collision math exactly) rather
 * than boxy crates, so there's no gap between what you see and what
 * actually blocks a shout. */
export function CoverPillars() {
  const shaftRef = useRef<THREE.InstancedMesh>(null)
  const bandRef = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const shaft = shaftRef.current
    const band = bandRef.current
    if (!shaft || !band) return
    const dummy = new THREE.Object3D()

    COVER_PILLARS.forEach((pillar, i) => {
      dummy.position.set(pillar.x, COVER_PILLAR_HEIGHT / 2, pillar.z)
      dummy.updateMatrix()
      shaft.setMatrixAt(i, dummy.matrix)

      dummy.position.set(pillar.x, ACCENT_BAND_Y, pillar.z)
      dummy.updateMatrix()
      band.setMatrixAt(i, dummy.matrix)
    })
    shaft.instanceMatrix.needsUpdate = true
    band.instanceMatrix.needsUpdate = true
  }, [])

  if (COVER_PILLARS.length === 0) return null

  return (
    <>
      <instancedMesh ref={shaftRef} args={[undefined, undefined, COVER_PILLARS.length]} castShadow receiveShadow>
        <cylinderGeometry args={[COVER_PILLAR_RADIUS, COVER_PILLAR_RADIUS, COVER_PILLAR_HEIGHT, 12]} />
        {/* Crisp white containment-crate shafts. */}
        <meshStandardMaterial color="#f4f6f9" roughness={0.4} metalness={0.3} />
      </instancedMesh>
      <instancedMesh ref={bandRef} args={[undefined, undefined, COVER_PILLARS.length]}>
        <cylinderGeometry args={[ACCENT_BAND_RADIUS, ACCENT_BAND_RADIUS, ACCENT_BAND_HEIGHT, 12]} />
        {/* Blue metallic status band. */}
        <meshStandardMaterial color="#2563eb" roughness={0.25} metalness={0.7} />
      </instancedMesh>
    </>
  )
}
