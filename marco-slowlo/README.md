# Marco Slow-lo

*Outrun your own voice.*

A playable 3D browser prototype built with React Three Fiber, set in a
bright, sterile research facility. Shout, and the sound wave becomes a
visible, expanding deep-crimson bubble that grows outward from where you
stood — at exactly walking speed — standing out as a dark, high-contrast
threat against the clean-room white. Stand still and it swallows you.
Sprint clear before it catches up. Duck behind a containment pillar and
its "acoustic shadow" blocks the wave entirely.

## Run it

```bash
npm install
npm run dev
```

Open the printed localhost URL, click **Enter the Arena**, then click the
canvas once to grab mouse-look (pointer lock).

**Controls:** `WASD` move · `SHIFT` sprint (drains stamina) · `SPACE` /
`click` shout.

## The rules

- Walk speed 3 m/s, sprint 6 m/s, bubble growth rate 3 m/s — sprint is the
  only way to out-pace your own voice.
- Shouting roots you in place for 0.5s (you can still turn/look around),
  with a 1.0s grace period on your own fresh bubble so the root doesn't turn
  every shout into an automatic loss — the grace window is sized to exactly
  cover the gap the root creates, assuming you sprint the instant it ends.
- The first second of a round is fully invulnerable, so a bot can't catch
  you before you've even gotten your bearings.
- Bots spawn at least 15m away from your start point.
- ~40 scattered pillars provide "acoustic shadow": if a pillar sits on the
  straight line between a bubble's origin and you, that bubble can't catch
  you no matter how big it's grown.

## How the mechanic works

- `src/lib/physics.ts` — pure, framework-free spatial math: a bubble's
  radius at time `t`, the point-in-sphere "caught" test, and the
  segment-vs-circle "acoustic shadow" line-of-sight test for cover pillars.
  Fully covered by `physics.test.ts` (`npx vitest run`), including the
  origin-standing edge case and a regression test documenting why the
  player's own shout must NOT be checked with hitbox padding (see below).
- `src/lib/world.ts` — a single shared `gameClock`, advanced by the same
  clamped per-frame delta every moving system uses. Bubble radius and actor
  movement must share one timeline, or a frame-rate hitch lets the wavefront
  and the player drift out of sync.
- `src/lib/pillars.ts` — generates the cover pillar layout once as plain
  data; both the InstancedMesh renderer and the line-of-sight check read the
  same array, so visuals and collision can never disagree about placement.
- `src/components/SoundBubbleManager.tsx` — spawns/expires bubbles and runs
  the live collision check (round-start grace, self-bubble grace, cover)
  against the player each frame.
- `src/components/PlayerController.tsx` — pointer-lock third-person camera,
  WASD-relative-to-camera movement, stamina-gated sprint, shout trigger with
  the post-shout root.
- `src/components/Bots.tsx` — wandering NPCs that shout on their own timer
  and flee nearby bubbles, proving the bubble physics generalize to more
  than one simultaneous shouter (the part that matters once real networking
  gets bolted on — this prototype has no netcode, it's single-session).
- `src/components/CoverPillars.tsx` — the ~40 cover pillars as white
  containment-crate columns (one InstancedMesh for the shafts, one more for
  the blue metallic accent bands) — still cylindrical, matching the
  circle-based collision math exactly, so what you see is what blocks a
  shout.
- `src/shaders/SoundBubbleMaterial.ts` — the fresnel-rim shell shader
  (procedural ripple, no textures) for the bubble: a semi-translucent deep
  crimson mass with a constant base fill plus a defined edge, not a
  bloom-fed glow — the danger is a shadow in this facility, not a light
  source.
- `src/components/Effects.tsx` — just SSAO, for contact shadows under the
  pillars/characters. No bloom/vignette/grain: the bright, clinical render
  is the point, and the dark bubbles need to read as an intentional void in
  that brightness rather than get blown out by glow.
- `src/lib/colors.ts` — `colorForOwner` is identity-only now (visor/body
  trim, so you can tell bots apart); every bubble uses the single shared
  `BUBBLE_THREAT_COLOR` regardless of who shouted, since the danger should
  read as one unmistakable shape, not a rainbow of per-owner glows.

### A trap worth knowing about

Every shout originates at distance 0 from its owner. Padding the catch
radius with the player's own hitbox size (reasonable for a bubble
approaching from a distance) makes `distance <= radius + hitbox` true for a
mandatory stretch right after every shout — even at full sprint — because a
constant offset dominates while both distance and radius are still small.
The game therefore checks the player's own bubble with a bare point/sphere
test (no padding); see the comment in `SoundBubbleManager.tsx` and the
regression test in `physics.test.ts`. The post-shout root reintroduces a
similar gap deliberately (for game feel), which is why it needs its own
explicit, time-boxed grace period rather than relying on the padding-free
check alone.
