import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Fresnel-rim "energy shell" shader for the expanding sound bubble. Uses a
 * cheap sum-of-sines procedural ripple instead of a noise texture lookup, so
 * the whole effect is a handful of ALU ops per fragment.
 */
export const SoundBubbleMaterial = shaderMaterial(
  {
    uTime: 0,
    uColor: new THREE.Color('#8b5cf6'),
    uOpacity: 1,
    uFresnelPower: 2.1,
  },
  /* glsl vertex */ `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vWorldPos;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPosition.xyz;
      vNormal = normalize(mat3(modelMatrix) * normal);
      vViewDir = normalize(cameraPosition - worldPosition.xyz);
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  /* glsl fragment */ `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uFresnelPower;

    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vWorldPos;

    float energyRipple(vec3 p, float t) {
      float a = sin(p.x * 2.2 + t * 1.6) * 0.5 + 0.5;
      float b = sin(p.y * 3.1 - t * 2.1 + p.z * 1.7) * 0.5 + 0.5;
      float c = sin((p.x + p.z) * 1.4 + t * 1.1) * 0.5 + 0.5;
      return a * 0.4 + b * 0.4 + c * 0.2;
    }

    void main() {
      vec3 n = normalize(vNormal);
      vec3 v = normalize(vViewDir);
      float fresnel = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), uFresnelPower);
      float ripple = energyRipple(vWorldPos * 0.55, uTime);
      float rim = fresnel * (0.55 + 0.45 * ripple);

      // Pushed past 1.0 on purpose — with toneMapped output disabled (see
      // SoundBubble.tsx) this overdrives Bloom's luminance threshold so the
      // shell reads as an intense light source, not a tinted transparency.
      vec3 color = uColor * (1.3 + ripple * 1.2);
      float alpha = clamp(rim * uOpacity, 0.0, 1.0);

      gl_FragColor = vec4(color, alpha);
    }
  `,
)

extend({ SoundBubbleMaterial })

declare module '@react-three/fiber' {
  interface ThreeElements {
    soundBubbleMaterial: ThreeElements['shaderMaterial'] & {
      uTime?: number
      uColor?: THREE.Color | string
      uOpacity?: number
      uFresnelPower?: number
    }
  }
}
