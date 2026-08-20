# Blokrush — Open Findings

Target: [index.html](../html/index.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** 2 open items — #56–57, promoted from [feature-ideas.md](feature-ideas.md) §C. Every review
finding, and every other directly-requested feature, raised so far has shipped, and so have #53, #54,
and #55 from the promoted batch (see [done.md](done.md)).

**When an item here gets fixed:** the established loop (see [testing.md](testing.md)) is regression
test → fix → move the finding's whole entry from this file to [done.md](done.md), prepending a
`> **Fixed <date>.**` note that describes what shipped and keeping the original write-up below it as
the historical record → add an entry to [release-notes.md](release-notes.md).

**Line references, once written, are only valid against the current `index.html`** — the same
re-anchoring discipline applies here as in `done.md`. The two entries below deliberately carry
**no line anchors**: they describe features that do not exist yet, so every reference is to a
function or field name, which does not go stale.

---

Every review finding raised so far has shipped, and so has every directly-requested feature — #44
(boss levels), #74 (the boss-kill celebration built on top of it), #75 (a follow-on to #37), #78
(effect-bar names), #76 (hall-of-fame name validation), #77 (hall-of-fame profanity filtering), #79
(the boss-kill death beat's music/explosion/sound gaps), #80 (level-progress-driven music intensity),
#81 (the level-clear fanfare), #53 (the fireball power-up), #54 (the safety-net shield), and #55
(magnet paddle / hold-to-slow bullet time) — see [done.md](done.md). What is open below are two
power-up/ball-mechanics ideas promoted from [feature-ideas.md](feature-ideas.md), which keep their
numbers; that file still holds the proposals not yet promoted. New review findings go here too,
keeping the shared numbering: the next free number is **#82**.

---

## C. Power-ups and ball mechanics

Promoted together, originally as four items sharing a handful of functions —
`updateBalls()`/`resolveBrickCollision()`, `applyPowerup()`, `CONFIG.effects`, `renderEffectBars()`.
#53 (fireball), #54 (the safety-net shield), and #55 (magnet paddle / hold-to-slow bullet time) have
since shipped — see [done.md](done.md) for how each landed, including the `.effect-bars`
capacity/i18n/weight bookkeeping each accounted for on its own. What's left below no longer shares
much: #56 touches `updateBalls()`/`resolveBrickCollision()` (the paddle-physics half of the original
set), and #57 touches `updateLasers()` instead — read each as its own item.

### 56. Paddle spin — English on the ball (M)

Today the paddle-bounce angle in `updateBalls()` is purely a function of *where* the ball lands —
`rel = (ball.x - (pr.x + pw/2)) / (pw/2)`, clamped and scaled by `CONFIG.paddleBounceSpread` — with
no read of how the paddle itself was moving. Letting paddle *velocity* at the moment of contact bend
that angle further is the single change most likely to make the game feel skill-expressive to an
experienced player: it turns the paddle from a mirror into an instrument.

**Needs paddle velocity, which does not exist today.** `updatePaddle()` sets `state.paddle.x`
directly from keys or `state.pointerX` and never records how far it moved. Add
`state.paddle.vx = (state.paddle.x - prevX) / dt` at the end of `updatePaddle()`, `prevX` captured
before the movement branches.

**The mixed-input problem.** Keyboard/gamepad movement is naturally bounded —
`state.paddle.x -= speed * dt` — so `vx` from that path never exceeds `state.paddle.speed`.
Pointer/touch movement is not: `state.paddle.x = state.pointerX - w / 2` snaps to wherever the
cursor is *this frame*, so a mouse that jumped across the screen between two animation frames (a
real OS/browser coalescing behaviour, not a hypothetical) produces a `vx` far larger than any hand
could actually swing the paddle. `vx` must be clamped to a `CONFIG.paddle.maxSpin`-shaped constant
before it feeds the bounce angle, or a single fast mouse flick would out-spin a full second of
deliberate keyboard steering.

**The stalemate risk the original proposal called out.** Adding spin means adding to `angle` before
`Math.cos`/`Math.sin`, not adding to `ball.dx` directly (same unit-vector requirement as #55's
magnet). The existing formula already spends a `-Math.PI/2 ± paddleBounceSpread` budget; spin has to
share that budget, not extend it — `angle = rel * CONFIG.paddleBounceSpread + spinTerm - Math.PI/2`,
with the **total** deviation from straight-up clamped, not each term separately. Skip that and a
player who tracks the ball while spinning hard can, in principle, hold it in a near-horizontal loop
between the side wall and the paddle that never climbs back toward the bricks — exactly the
"horizontal stalemate" the feature-ideas entry flagged as the reason this is M and not S.

**Interacts with the tunnelling sweep, but doesn't complicate it.** The #38 rewind in
`updateBalls()` (`tCross`/`xCross`, recovering a paddle hit the ball's own per-frame movement
overshot) only cares about *where* the ball crossed the paddle's top plane, which spin doesn't
change — spin is applied to the outgoing angle after that rewind has already located the hit, so the
two features don't need to coordinate beyond "spin reads the same `rel` `isTopHit` already computed."

### 57. Negative power-up counterplay (S)

`narrow` and `fast` currently just happen to you — they land in `state.drops`, fall, and either miss
the paddle or apply themselves with no decision on the player's part. The concrete, cheap version of
"give the player an out": **let a laser bolt destroy a falling bad capsule before it lands.**

`updateLasers()` already sweeps every bolt against `state.bricks` and, failing that, against
`state.boss`; it needs a third pass, against `state.drops`, using the same hit-test shape
`updateDrops()` already uses for the paddle (`d.x`/`d.y` ± the drawn 10px radius). Restricted to
`!d.def.good` drops only — a bolt should never be able to snipe a `widen` or a `life` out of the
air; that would make good drops a liability near a laser-holding player, the opposite of the intent.
On a hit: splice the drop, a small burst at its position, a distinct tone so it reads as "denied"
rather than "collected," and no score — this is defence, not offence, and awarding points would make
`laser` strictly better at farming than at its existing job.

**Two small consequences worth deciding rather than discovering:** it only exists while
`state.laserEffect` is active (no laser, no counterplay — same as every other laser interaction),
and it stacks with #53's fireball for free if that ships too, since both are read-only additions to
functions that already loop over their respective collections once per frame.

**Left out of this pass, deliberately:** the feature-ideas entry's second option, a standalone
"cleanse" pickup that clears whatever bad effect is currently active (`state.widthEffect.mult < 1` /
`state.speedEffect.mult > 1`, nulled the same way `resetPaddleAndBall()` already does). It's a
natural follow-up — a new `POWERUPS` row plus a branch in `applyPowerup()`, genuinely S on its own —
but doing both at once is what would push this above S, and the laser version alone already converts
the frustration into a decision for anyone who picked up `laser` in the first place.

#### Tests

- `#56a` — a paddle moving right at the moment of contact steers the bounce further right than the
  same hit position would with a stationary paddle, within the clamp.
- `#56b` — the clamp holds: no combination of hit position and paddle velocity produces a bounce
  angle whose vertical component drops below the existing minimum.
- `#57a` — a laser bolt destroys a falling `narrow` drop and the drop never reaches the paddle.
- `#57b` — a laser bolt passes through a falling `widen` drop untouched.
