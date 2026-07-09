import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { COVER_PILLARS } from '../lib/pillars'
import { COVER_PILLAR_HEIGHT, COVER_PILLAR_RADIUS } from '../lib/constants'

/** Renders the scattered cover pillars as a single InstancedMesh — one draw
 * call for 30-50 obstacles instead of one mesh each. Positions come straight
 * from COVER_PILLARS (lib/pillars.ts), the same array the line-of-sight
 * "acoustic shadow" check reads, so rendering and collision can never
 * disagree about where a pillar actually is. */
export function CoverPillars() {
  const meshRef = useRef<THREE.InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    COVER_PILLARS.forEach((pillar, i) => {
      dummy.position.set(pillar.x, COVER_PILLAR_HEIGHT / 2, pillar.z)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [])

  if (COVER_PILLARS.length === 0) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, COVER_PILLARS.length]}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[COVER_PILLAR_RADIUS, COVER_PILLAR_RADIUS, COVER_PILLAR_HEIGHT, 12]} />
      {/* Dark and matte on purpose: they should absorb light rather than
       * mirror it, so SSAO's contact shadow at their base actually reads
       * against the glossy floor instead of blending into a reflection. */}
      <meshStandardMaterial color="#050308" roughness={0.95} metalness={0.02} />
    </instancedMesh>
  )
}
