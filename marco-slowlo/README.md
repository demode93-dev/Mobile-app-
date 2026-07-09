# Marco Slow-lo

*Tag, with your own voice as the weapon.*

A playable 3D browser prototype built with React Three Fiber, set in a
bright, sterile research facility. You and the Bot play a 60-second game
of tag. Whoever is "It" must shout — a visible, expanding deep-crimson
sound bubble growing outward from where they stood, at exactly walking
speed — and catch the other person in it to pass the tag on. Duck behind
a containment pillar and its "acoustic shadow" blocks the hit entirely.
Survive as the target until the clock runs out to win.

## Run it

```bash
npm install
npm run dev
```

Open the printed localhost URL, click **Start Match**, then click the
canvas once to grab mouse-look (pointer lock).

**Controls (desktop):** `WASD` move · `SHIFT` sprint (drains stamina) ·
`SPACE` / `click` shout.

**Controls (touch):** drag anywhere in the bottom-left to move with a
floating joystick — push it to the edge to sprint, same stamina cost as
Shift — and tap **SHOUT** bottom-right, wired to the identical trigger
Space uses. Both work as independent touches at once (they track separate
pointer ids), so you can run and shout in the same motion. There's no
touch look-control yet; the camera trails the player from a fixed
world-space angle rather than one you can spin around, which is a known
limitation, not an oversight.

## The rules

- **Start / Playing / Game Over.** A match is 60 seconds. The Bot always
  starts as "It." When the clock hits 0, whoever is NOT "It" at that
  instant wins.
- **Tagging.** Only a bubble owned by the current "It" can tag anyone —
  the bubble's own owner is never a valid target, so there's no "self-tag"
  case to worry about. Land a hit on the other party (not blocked by
  cover) and the roles instantly reverse.
- **The shout is a commitment.** Walk speed 3 m/s, sprint 6 m/s, bubble
  growth rate 3 m/s — sprint is the only way to out-pace a bubble. Every
  shout roots the shouter in place for 0.5s, with a matching 1.0s grace
  window on their own fresh bubble (sized to exactly cover the gap the
  root creates) so the root doesn't turn every shout into an unavoidable
  self-tag.
- **The Bot switches strategy on the tag.** Hunting, it beelines for you
  and shouts once in range and off cooldown. Evading, it stops shouting
  entirely and instead flees your bubble if it's close, otherwise paths to
  whichever pillar hides it best from you and sits there.
- **Cover matters both ways.** ~40 scattered pillars block a tag via
  "acoustic shadow" (a pillar on the straight line between a bubble's
  origin and its target defeats it regardless of radius), and the evading
  Bot actively seeks them out to hide behind.

## How it works

- `src/lib/physics.ts` — pure, framework-free spatial math: a bubble's
  radius at time `t`, the point-in-sphere "caught" test, the segment-vs-
  circle "acoustic shadow" line-of-sight test, and `findHidingSpot` (picks
  the nearest pillar-shadow point away from a threat — the evading Bot's
  entire hiding strategy). Fully covered by `physics.test.ts`
  (`npx vitest run`), including the origin-standing edge case.
- `src/lib/world.ts` — a single shared `gameClock`, advanced by the same
  clamped per-frame delta every moving system uses. Bubble radius and actor
  movement must share one timeline, or a frame-rate hitch lets the
  wavefront and the player drift out of sync.
- `src/store/gameStore.ts` — the match state machine: `phase`
  (`start`/`playing`/`gameOver`), `currentItId` (who's hunting),
  `matchTimeRemaining` (counts down, flips to `gameOver` at 0), and
  `tagOpponent()` (flips the role and opens a brief tag-immunity window).
  Note `matchStartTime`: `gameClock` never resets, so "time since this
  match began" has to be measured relative to a captured start time, not
  to 0.
- `src/components/SoundBubbleManager.tsx` — expires bubbles and runs the
  live tag check every frame: a bubble only counts if its owner is
  currently "It," the target isn't in cover, and neither the match-start
  nor post-tag immunity window is active.
- `src/components/PlayerController.tsx` — pointer-lock third-person
  camera, WASD-relative-to-camera movement, stamina-gated sprint, shout
  trigger with the post-shout root. Also releases pointer lock the instant
  the match isn't `playing`, so the Start/Game Over overlay buttons are
  actually clickable (a real bug caught via headless testing — pointer
  lock left engaged made "Play Again" unclickable).
- `src/components/Bots.tsx` — the one Bot, reading `currentItId` fresh
  every frame to decide whether to hunt (chase + shout in range) or evade
  (flee the hunter's bubble, else head for `findHidingSpot`).
- `src/lib/pillars.ts` / `src/components/CoverPillars.tsx` — the ~40 cover
  pillars as white containment-crate columns, generated once as plain data
  so the InstancedMesh renderer, the line-of-sight check, and the hiding-
  spot search all agree on where they are.
- `src/components/Effects.tsx` — just SSAO, for contact shadows under the
  pillars/characters in the bright, clinical render.
- `src/lib/colors.ts` — `colorForOwner` is identity-only (visor/body trim);
  every bubble uses the single shared `BUBBLE_THREAT_COLOR` regardless of
  who shouted, so the danger reads as one unmistakable shape.
- `src/lib/input.ts` / `src/components/TouchControls.tsx` — the touch
  joystick and SHOUT button live entirely outside the Canvas as plain DOM,
  and bridge into PlayerController through a shared mutable
  `touchMoveVector` (added straight into the same forward/right axes the
  keyboard uses) and a `shoutTrigger` ref that PlayerController points at
  its real `triggerShout` — the button calls that exact function, not a
  copy of it. Built on the Pointer Events API (not raw touch/mouse
  events), so each control tracks its own pointer id independently and a
  thumb on the joystick can't steal events from a thumb on SHOUT.
- `src/components/ResponsiveCamera.tsx` — a fixed vertical FOV looks right
  in landscape but turns into a tunnel in portrait (horizontal FOV shrinks
  with aspect ratio even though vertical doesn't change). This widens the
  vertical FOV as the viewport narrows (the standard "Hor+" fix),
  preserving roughly the same horizontal view, clamped so extreme
  portrait ratios don't fisheye into nonsense.

### A trap worth knowing about

Every shout originates at distance 0 from its owner. Padding the catch
radius with a hitbox size (reasonable for a bubble approaching from a
distance) makes `distance <= radius + hitbox` true for a mandatory stretch
right after every shout — even at full sprint — because a constant offset
dominates while both distance and radius are still small. The tag check
therefore uses a bare point/sphere test (no padding); see the comment in
`SoundBubbleManager.tsx`. The post-shout root reintroduces a similar gap
deliberately (for game feel), which is why it needs its own explicit,
time-boxed immunity window rather than relying on the padding-free check
alone.
