import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/** Landscape design target: 62° vertical FOV reads right on a ~16:9 frame. */
const BASE_VERTICAL_FOV = 62
const REFERENCE_ASPECT = 16 / 9
/** Cap how far portrait can widen the vertical FOV before it starts looking fisheye. */
const MAX_VERTICAL_FOV = 100

/**
 * A fixed vertical FOV looks right in landscape but turns into a claustro-
 * phobic tunnel in portrait: horizontal FOV = 2*atan(tan(vFov/2)*aspect), so
 * as aspect shrinks below 1 the horizontal view narrows sharply even though
 * the vertical view hasn't changed. This is the standard "Hor+" fix —
 * derive the horizontal FOV the landscape design implies, then re-derive a
 * (wider) vertical FOV that preserves it at the current aspect ratio —
 * clamped so extreme portrait ratios don't fisheye into nonsense.
 */
function computeVerticalFov(aspect: number): number {
  if (aspect >= REFERENCE_ASPECT) return BASE_VERTICAL_FOV

  const baseVFovRad = THREE.MathUtils.degToRad(BASE_VERTICAL_FOV)
  const hFovRad = 2 * Math.atan(Math.tan(baseVFovRad / 2) * REFERENCE_ASPECT)
  const vFovRad = 2 * Math.atan(Math.tan(hFovRad / 2) / aspect)

  return THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vFovRad), BASE_VERTICAL_FOV, MAX_VERTICAL_FOV)
}

/** Keeps the default PerspectiveCamera's aspect and FOV in sync with the
 * canvas size on every resize/orientation change — landscape stays as
 * designed, portrait (phones held upright) widens the vertical FOV instead
 * of narrowing the horizontal one. */
export function ResponsiveCamera() {
  const camera = useThree((s) => s.camera)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    const aspect = width / height
    camera.aspect = aspect
    camera.fov = computeVerticalFov(aspect)
    camera.updateProjectionMatrix()
  }, [camera, width, height])

  return null
}
