import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Flat, semi-translucent shell shader for the Sensory Pulse. Deliberately
 * almost no shading — a hyper-vibrant solid color plus a thin brighter
 * fresnel edge so the sphere still reads as a sweeping wavefront and not a
 * hollow glowing membrane, but nothing about it ripples or ages the color
 * over time the way the old "living threat" shell did.
 */
export const SoundBubbleMaterial = shaderMaterial(
  {
    uColor: new THREE.Color('#ff17d6'),
    uOpacity: 1,
  },
  /* glsl vertex */ `
    varying vec3 vNormal;
    varying vec3 vViewDir;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vNormal = normalize(mat3(modelMatrix) * normal);
      vViewDir = normalize(cameraPosition - worldPosition.xyz);
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  /* glsl fragment */ `
    uniform vec3 uColor;
    uniform float uOpacity;

    varying vec3 vNormal;
    varying vec3 vViewDir;

    void main() {
      vec3 n = normalize(vNormal);
      vec3 v = normalize(vViewDir);
      float fresnel = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.2);

      // Flat fill plus a thin brighter rim for shape definition — no ripple,
      // no color aging, just the one hyper-vibrant hue throughout.
      float alpha = clamp((0.45 + fresnel * 0.3) * uOpacity, 0.0, 1.0);

      gl_FragColor = vec4(uColor, alpha);
    }
  `,
)

extend({ SoundBubbleMaterial })

declare module '@react-three/fiber' {
  interface ThreeElements {
    soundBubbleMaterial: ThreeElements['shaderMaterial'] & {
      uColor?: THREE.Color | string
      uOpacity?: number
    }
  }
}
