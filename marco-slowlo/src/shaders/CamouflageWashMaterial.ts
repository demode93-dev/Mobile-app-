import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Chent's camouflage transition: a traveling color-swap boundary that
 * washes bottom-to-top across the torso's own LOCAL Y extent (object
 * space, not world space — so the sweep direction stays fixed relative to
 * his body regardless of which way he's facing or how deep his sprint lean
 * is) instead of an instant snap or a uniform whole-body blend. uProgress
 * drives the sweep from 0 (still entirely uFromColor) to 1 (fully
 * uToColor); PlayerController advances it over a level-tuned duration —
 * see CAMOUFLAGE wash constants in lib/levels.ts.
 *
 * The min/max below must match the Y extent of createTeardropGeometry in
 * PlayerController.tsx (-0.55 to 0.56) — they're baked into the shader as
 * literals rather than a uniform since the geometry is fixed.
 */
export const CamouflageWashMaterial = shaderMaterial(
  {
    uFromColor: new THREE.Color('#ff2bd6'),
    uToColor: new THREE.Color('#ff2bd6'),
    uProgress: 1,
  },
  /* glsl vertex */ `
    varying float vLocalY;
    varying vec3 vWorldNormal;

    void main() {
      vLocalY = position.y;
      vWorldNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  /* glsl fragment */ `
    uniform vec3 uFromColor;
    uniform vec3 uToColor;
    uniform float uProgress;

    varying float vLocalY;
    varying vec3 vWorldNormal;

    void main() {
      // 0 at the torso's tapered base, 1 at its rounded top.
      float t = clamp((vLocalY + 0.55) / 1.11, 0.0, 1.0);
      float washed = smoothstep(t - 0.12, t + 0.12, uProgress);
      vec3 base = mix(uFromColor, uToColor, washed);

      // Cheap fixed-direction lambert + ambient floor, matching the flat,
      // fully-lit look everywhere else in the store rather than reacting
      // to the scene's actual lights.
      vec3 lightDir = normalize(vec3(0.5, 0.85, -0.3));
      float ndotl = max(dot(normalize(vWorldNormal), lightDir), 0.0);
      vec3 lit = base * (0.55 + 0.5 * ndotl);

      gl_FragColor = vec4(lit, 1.0);
    }
  `,
)

extend({ CamouflageWashMaterial })

declare module '@react-three/fiber' {
  interface ThreeElements {
    camouflageWashMaterial: ThreeElements['shaderMaterial'] & {
      uFromColor?: THREE.Color | string
      uToColor?: THREE.Color | string
      uProgress?: number
    }
  }
}
