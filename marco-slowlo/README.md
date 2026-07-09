# Marco Slow-lo

*Outrun your own voice.*

A playable 3D browser prototype built with React Three Fiber. Shout, and the
sound wave becomes a visible, expanding spherical bubble that grows outward
from where you stood — at exactly walking speed. Stand still and it swallows
you. Sprint clear before it catches up.

## Run it

```bash
npm install
npm run dev
```

Open the printed localhost URL, click **Enter the Arena**, then click the
canvas once to grab mouse-look (pointer lock).

**Controls:** `WASD` move · `SHIFT` sprint (drains stamina) · `SPACE` /
`click` shout.

## How the mechanic works

- `src/lib/physics.ts` — pure, framework-free spatial math: a bubble's
  radius at time `t`, and the point-in-sphere "caught" test. Fully covered
  by `physics.test.ts` (`npx vitest run`), including the origin-standing
  edge case and a regression test documenting why the player's own shout
  must NOT be checked with hitbox padding (see below).
- `src/lib/world.ts` — a single shared `gameClock`, advanced by the same
  clamped per-frame delta every moving system uses. Bubble radius and actor
  movement must share one timeline, or a frame-rate hitch lets the wavefront
  and the player drift out of sync.
- `src/components/SoundBubbleManager.tsx` — spawns/expires bubbles and runs
  the live collision check against the player each frame.
- `src/components/PlayerController.tsx` — pointer-lock third-person camera,
  WASD-relative-to-camera movement, stamina-gated sprint, shout trigger.
- `src/components/Bots.tsx` — wandering NPCs that shout on their own timer
  and flee nearby bubbles, proving the bubble physics generalize to more
  than one simultaneous shouter (the part that matters once real networking
  gets bolted on — this prototype has no netcode, it's single-session).
- `src/shaders/SoundBubbleMaterial.ts` — the fresnel-rim "energy shell"
  shader (procedural ripple, no textures) that bloom picks up as glowing
  kinetic energy.

### A trap worth knowing about

Every shout originates at distance 0 from its owner. Padding the catch
radius with the player's own hitbox size (reasonable for a bubble
approaching from a distance) makes `distance <= radius + hitbox` true for a
mandatory stretch right after every shout — even at full sprint — because a
constant offset dominates while both distance and radius are still small.
The game therefore checks the player's own bubble with a bare point/sphere
test (no padding); see the comment in `SoundBubbleManager.tsx` and the
regression test in `physics.test.ts`.
