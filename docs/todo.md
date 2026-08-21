# Blokrush — Open Findings

Target: [index.html](../html/index.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** 9 open items — #47 (promoted from [feature-ideas.md](feature-ideas.md) §A), #50
(promoted from §B), #56–57 (promoted from §C), #62–64 (promoted from §D), and #82–83 (raised directly,
not promoted from `feature-ideas.md`). Every review finding, and every other directly-requested
feature, raised so far has shipped, and so have #46 from the §A batch and #53, #54, and #55 from the
§C batch (see [done.md](done.md)).

**When an item here gets fixed:** the established loop (see [testing.md](testing.md)) is regression
test → fix → move the finding's whole entry from this file to [done.md](done.md), prepending a
`> **Fixed <date>.**` note that describes what shipped and keeping the original write-up below it as
the historical record → add an entry to [release-notes.md](release-notes.md).

**Line references, once written, are only valid against the current `index.html`** — the same
re-anchoring discipline applies here as in `done.md`. The entries below deliberately carry
**no line anchors**: they describe features that do not exist yet, so every reference is to a
function or field name, which does not go stale.

---

Every review finding raised so far has shipped, and so has every directly-requested feature — #44
(boss levels), #74 (the boss-kill celebration built on top of it), #75 (a follow-on to #37), #78
(effect-bar names), #76 (hall-of-fame name validation), #77 (hall-of-fame profanity filtering), #79
(the boss-kill death beat's music/explosion/sound gaps), #80 (level-progress-driven music intensity),
#81 (the level-clear fanfare), #46 (level select), #53 (the fireball power-up), #54 (the safety-net
shield), and #55 (magnet paddle / hold-to-slow bullet time) — see [done.md](done.md). What is open
below is #47 (daily challenge seed), #50 (moving bricks), #62 (colourblind-safe brick markers), #63
(difficulty selection), #64 (resume an interrupted run), and two power-up/ball-mechanics ideas, all
promoted from [feature-ideas.md](feature-ideas.md) and keeping their numbers; that file still holds
the proposals not yet promoted. #82 (the `neonbreak-*` → `blokrush-*` rename) and #83 (per-level star
ratings, split out of #46 — the two were originally one item) were raised directly rather than
promoted from there. New review findings go here too, keeping the shared numbering: the next free
number is **#84**.

---

## A. Content and progression

Promoted from [feature-ideas.md](feature-ideas.md) §A. #45 (procedural levels past the authored 10)
and #48 (a level editor and shareable layouts) were discarded outright rather than promoted alongside
these — #45 duplicated finding #41, already shipped as the 100-level campaign; #48 was dropped from
the menu. #47 keeps its number. #46 originally covered both level select and per-level star ratings as
one item; the two were split before either shipped — star ratings moved out to **#83**, immediately
below, since they're usable independently of one another (star ratings need a per-level score to rate,
but level select doesn't need a rating to be worth shipping on its own). Level select itself has since
shipped — see [done.md](done.md) — leaving #83 the one half of the original item still open here.

### 83. Per-level star ratings (S)

Raised directly, split out of what was originally one item (#46) covering both level select and star
ratings. This entry is the rating half: once a level is unlocked (#46), grade how well it was
cleared, 1–3 stars, and show that rating wherever the level is listed. It builds on #46's persistence
and level-select overlay rather than duplicating either — #46 is a prerequisite in practice (there's
nowhere to display a star rating without a level-select list), though nothing here requires #46 to
land in the same change if the two are picked up separately; a rating with no list to show it in is
still worth persisting, just not visibly useful yet.

**Extends #46's stored record, not a second key.** #46's `LEVELS_KEY` persists at least the highest
cleared index; this entry adds a 1–3 star field to that same per-level record via
`loadLevelProgress()`/`saveLevelProgress()`, rather than introducing a parallel store that the two
features would have to keep in sync. Re-clearing an already-rated level should only ever raise its
stored rating, never lower it — a worse replay of a level already mastered shouldn't erase that
level's best showing.

**Star thresholds have to scale with the level, not be fixed.** `CONFIG.progression.scoreCap`/
`scoreTau` already grow the per-brick score multiplier through `levelMultiplier()` as the campaign
progresses (#41), so a fixed point threshold that means "3 stars" on level 3 would be trivial on
level 80. Nothing today tracks score *per level* — `state.score` is cumulative for the whole run —
so this needs a small addition: capture `state.levelStartScore = state.score` in `startLevel()`
(next to where it already resets `state.achStats.levelTime`), and rate stars at clear time off
`state.score - state.levelStartScore` against thresholds expressed as a multiple of that level's
`levelMultiplier()`, not an absolute number.

**Display is a small addition to #46's list, not a new screen.** `overlay-levelselect`'s rows already
show lock/unlock state (#46); an unlocked row additionally renders its stored star count (a glyph
repeated per star, matching how `?`/`X`/`R` already render non-colour brick markers elsewhere in the
canvas rather than inventing a new icon convention). No new overlay, no new entry point.

#### Tests

- `#83a` — re-clearing an already-unlocked level never lowers a star rating already earned, and a
  better replay raises it.
- `#83b` — star thresholds scale with `levelMultiplier()`: the same absolute per-level score earns
  fewer stars on a late level than on an early one.
- `#83c` — a level cleared for the first time is rated using only the score earned *during that
  level* (`state.score - state.levelStartScore`), not cumulative run score.

### 47. Daily challenge seed (M)

One generated level per calendar day, identical for every player, with its own small leaderboard.

**The layout half of this is already solved.** `generateLevel(idx)` doesn't call `Math.random()` —
it draws from `seededRandom((idx + 1) * 104729)`, the same deterministic Lehmer/Park-Miller generator
`buildStars()` uses, precisely so a layout comes out the same every time a level is entered (see the
comment at `seededRandom`'s definition). A daily challenge needs a second entry point into that same
machinery keyed by date instead of `idx`, not a new PRNG. What the original feature-ideas.md write-up
got wrong is the claim that gameplay "randomness" needs to be routed through a seedable PRNG generally — it
doesn't: `rollPowerup()`'s drop rolls and the `?` mystery-brick resolution both stay on `Math.random()`
deliberately, and should keep doing so here too. The daily challenge is a same-layout competition, not
a frame-identical replay — two players seeing the same bricks but different power-up drops is exactly
how the existing 100-level campaign already works for two different playthroughs of the same level.

**`generateLevel(idx)` conflates two things `idx` currently does at once** — it seeds the RNG
(`(idx + 1) * 104729`) and it drives difficulty/speed/theme (`layoutIndex(idx)` feeding `d`,
`levelSpeed(idx + 1)`, `themeFor(idx)`). A daily challenge needs the first without the second: pulling
today's date through the campaign's own difficulty ramp would make the daily level swing from
trivial to brutal depending on which date happens to hash near which `idx`, which defeats the "one
small leaderboard" premise — a score is only comparable to another player's if the level was roughly
the same difficulty both times. The fix is to split `generateLevel(idx)` into a seed argument and a
difficulty argument (`generateLevelFrom(seed, d)`, `idx`'s two current jobs pulled apart), with
`generateLevel(idx)` becoming a thin wrapper that passes `(idx + 1) * 104729` and
`layoutIndex(idx) - LEVELS.length` through, and a new `generateDailyLevel(dateSeed)` picking one
fixed `d` (a mid-campaign band — hard enough to be a real challenge, not the level-90+ wall-heavy
end game) for every day alike.

**The seed must not collide with a campaign level's.** Reusing `(idx + 1) * 104729` for a
date-derived integer would risk a specific day landing on the exact same seed as whatever campaign
level happens to share that product — cosmetically confusing (today's challenge would be a level the
player may have already cleared) even though nothing breaks. The date seed needs its own multiplier,
distinct from `104729` (`generateLevel`) and `7919` (`buildStars`) — a third large prime, applied to a
day count (`Math.floor(dateUTC.getTime() / 86400000)`), keeps the same "prime times an integer" shape
the other two call sites already use without sharing their stream.

**Whose calendar day.** Must be UTC, not the client's local date — the same reasoning #67 already
applies to dating a hall-of-fame run server-side (a token carries a server timestamp so elapsed time
doesn't depend on the client's clock): a local-date seed would hand a player in one timezone a new
challenge, and a fresh shot at the board, hours before a player elsewhere, and would make the
server unable to independently verify which day's level a submitted score claims to be for.

**The run itself needs a mode flag, not a new phase machine.** A daily run is a single level, not a
100-level campaign — `checkLevelClear()`'s branch on `state.levelIndex >= CONFIG.progression.totalLevels
- 1` (go to `endGame(true)` vs `setPhase("levelclear")`) needs a third condition, `state.dailyMode`,
that also ends the run on that one clear. `startLevel()`/`resetPaddleAndBall()` are otherwise reusable
unchanged — `buildLevel(idx)` already takes whatever `levelDef(idx)` returns without caring where it
came from, so the daily level only needs to be slotted into `levelCache`/`levelDef` the same way a
boss level's `bossLevelDef` is (a source `levelDef` recognizes by a flag on `state`, not by `idx`,
since the daily level isn't part of the 1–100 index space at all).

**The leaderboard cannot simply reuse `/api/scores`.** Its validation constants
(`MIN_RUN_MS`, `MAX_POINTS_PER_SEC`, `ABSOLUTE_MAX_SCORE` in `functions/api/scores.js`) are tuned for
a 100-level, one-to-two-hour campaign; a single generated level's legitimate score and duration range
is nowhere near that envelope, so a shared endpoint would either reject genuine daily runs or fail to
catch forged ones. This needs its own table (additive, per the D1 discipline in
[CLAUDE.md](../CLAUDE.md) — `daily_scores` with a `seed_date` column, never touching `scores`) and its
own route or a `mode`-discriminated branch in the existing one, with its own tuned thresholds. The
local-storage fallback should follow the same `neonbreak-` namespaced, defensively-parsed pattern as
`HOF_KEY`/`ACH_KEY`, but keyed by date rather than being one flat list — and, deliberately out of
scope for this pass, does not need to let a player browse or resubmit to a past day's board; only
today's is ever writable, mirroring how the world board already discards a stale token in
`readToken`/`age > TOKEN_MAX_AGE_MS`.

**Entry point.** A new ghost button on `overlay-start` alongside `btn-view-hof`/`btn-view-ach`,
its own overlay (`overlay-dailychallenge`?) rather than reusing `overlay-ready`'s campaign-flavoured
"Niveau X / 100" text, and new `STRINGS` keys in both `fr`/`en` tables — the `i18n` suite already
fails on a key missing from either language, so both need adding together.

#### Tests

- `#47a` — `generateDailyLevel(dateSeed)` returns the identical layout for the same date called
  twice, and the layout is unaffected by `state.levelIndex`/campaign progress.
- `#47b` — two different dates produce different layouts (the seed formula doesn't degenerate to the
  same stream for adjacent days).
- `#47c` — the daily seed for a given UTC date never equals `(idx + 1) * 104729` for any campaign
  `idx` in range, so a daily challenge never silently reproduces a campaign level.
- `#47d` — clearing the daily level ends the run (`endGame`) rather than advancing to a next level,
  regardless of `state.levelIndex`.
- `#47e` — a score submitted against yesterday's `seed_date` is rejected, mirroring the existing
  stale-token rejection in `functions/api/scores.js`.

---

## B. New brick types

Promoted from [feature-ideas.md](feature-ideas.md) §B, which now has nothing left in it.

### 50. Moving bricks (M)

Rows that slide horizontally, or individual bricks that oscillate, wrapping or reversing at the
field edge.

**The motion primitive already exists — this doesn't need new physics.** `sideToSide(part, dt,
speed, minX, maxX)` already drives Sentinel's, Salvo's, and Gemini's boss parts: it advances
`part.x` by `part.dir * speed * dt` and flips `part.dir` at `minX`/`maxX` (defaulting to the field
edges). A brick object from `buildLevel()` already has the `x`/`w` shape `sideToSide` expects; giving
a moving brick a `dir` field and calling `sideToSide(b, dt, b.moveSpeed, b.minX, b.maxX)` reuses the
function verbatim rather than inventing a second oscillator. `updateBricks(dt)` is the right home for
that call — it already runs once per frame, before `updateBalls(dt)` (so a brick's collision rect is
current for the frame the ball checks it against) and before `checkLevelClear()` (the same ordering
`updateBricks`'s existing regen branch, #51, already depends on). Nothing in `drawBricks()` needs to
change either — it already reads `b.x`/`b.y` fresh every frame, the same as every other brick.

**The real problem is where a mover is allowed to travel, not how it moves.** `sideToSide`'s default
bounds are the whole field, which is fine for a boss part with clear space around it but wrong for a
brick sitting in a row next to other bricks — sliding the field's full width would pass straight
through its neighbours. `minX`/`maxX` instead have to be derived per-brick, at `buildLevel()` time,
from the *existing* `.` run the brick sits in: scan its row left and right from its column until
hitting a non-`.` cell or the field edge, and convert those column bounds to pixels with the same
`FIELD_PAD + c * (BRICK_W + BRICK_MARGIN)` arithmetic `buildLevel()` already uses for `x`. A brick
with no adjacent `.` on either side simply isn't a candidate for `M` — this is a placement constraint
on top of the grid, not a new grid feature, and it means `M` never needs to displace or overlap
another brick to move.

**Authored levels (1–9) place `M` by hand, same as every other special type in `LEVELS`.** A single
`.` neighbour is a real but small amplitude — one `BRICK_W + BRICK_MARGIN` (~46px) of travel — so
worth doing for a first, low-stakes appearance; a row deliberately authored with a two-or-three-cell
gap (rather than retrofitting an existing row's incidental single dot) reads as an actual moving
target rather than a jitter. Every other special character in `LEVELS` debuts on a specific level
(`X` on 3, `R` on 4, `?` on 2) and ramps in from there; `M` fits the same pattern, debuting later than
those three rather than earlier — a moving target is the hardest thing to time a hit against, so it
belongs after the player has seen the others, not before.

**Generated levels (11+, skipping every boss) can't reuse `scatterType()` as-is.** `scatterType()`
scatters a type onto cells that are *already* plain bricks (`"1"–"4"`), which is right for `X`/`?`/`R`
— they don't care what's next to them — but wrong for `M`, which needs the opposite: a plain-brick
cell with a `.` run already beside it (most of `ARCHETYPES` already produce these — the checker and
diagonal shapes especially). A parallel `scatterMoving(grid, rows, rnd, count)` should only convert
candidates that already have that runway, and skip the roll entirely (fewer movers, not a forced
rewrite of the layout) when a shape like the solid-band archetype leaves none. This is deliberate:
carving new gaps into a shape to make room for a mover would fight `ensureReachable()`'s job and
blur the archetypes' visual identity, both of which #41's generator was careful about. Thread the
count through `d = layoutIndex(idx) - LEVELS.length` the same way `X` (`d >= 2`), `?` (`d >= 5`), and
`R` (`d >= 10`) already do — a higher threshold than all three, say `d >= 15` (roughly the high-20s
in level number), keeps a moving target from stacking onto a player who hasn't cleared a level with
`R` in it yet.

**Boss arenas get this for free, and three of them are ready-made for it.** A boss's `arena` is
built through `bossArena(rows)` into the exact same `{ rows, speed }` shape `buildLevel()` reads from
every other source (see the architecture note in [CLAUDE.md](../CLAUDE.md) on `levelDef()`) — so `M`
in an arena row needs no boss-specific code once `buildLevel()`/`updateBricks()` support it generally.
Gemini (level 40, `["#........#", "#........#"]`), Mirage (level 80, the same two rows), and Leviathan
(level 90, three of them) already frame a fully open 8-cell runway between two `#` walls in every
row — swapping one `.` for `M` in one of Gemini's rows, both of Mirage's, and two or three of
Leviathan's (counter-phased, i.e. opposite starting `dir`) is a natural escalation that costs no
layout redesign. Not every boss needs one — Omega's arena (`"#1#2#3#4#1", "2S3S4S1S2S"`) has no
existing runway, and carving one would mean editing the `#` walls that make up its actual puzzle,
which is a different decision than adding a mover.

**Left out of this pass, deliberately.** Vertical movement — the feature-ideas write-up mentions it
in passing, but `BRICK_H` spacing between rows is tight enough that a vertically-drifting brick risks
overlapping the row above or below it, which `sideToSide`'s horizontal-only model sidesteps entirely.
Brick-on-ball "sweeping" tunnelling — the same category of concern #38 fixed for the paddle with a
swept check — is a real but much smaller risk here: a brick is far wider than the ball and `moveSpeed`
is going to be modest next to `CONFIG.progression.speedCap`, so the plain per-frame overlap test
`resolveBrickCollision()` already does should hold in practice; a formal swept-rect version is the
kind of thing that would push this from M to L and isn't needed to ship a first version.

#### Tests

- `#50a` — a brick with `type === "M"` moves each frame (`updateBricks(dt)` changes `b.x`) and
  reverses `dir` on reaching `minX`/`maxX` without ever leaving them.
- `#50b` — `minX`/`maxX` computed for an `M` cell never allow it to overlap a neighbouring alive
  brick's rect in the same row.
- `#50c` — `generateLevel()`'s `scatterMoving()` never selects a cell with no `.` neighbour, and
  produces zero movers rather than forcing one when no candidate exists.
- `#50d` — a moving brick still counts toward `remainingBricks`/`checkLevelClear()` exactly like a
  stationary one of the same hp, and a boss arena's `M` cover bricks still don't (per #44).

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

---

## D. Input, accessibility, and platform

Promoted from [feature-ideas.md](feature-ideas.md) §D. #61 (gamepad support) was discarded outright
rather than promoted alongside it — dropped from the menu on its own terms, not because it duplicated
anything already shipped. #62, #63, and #64 keep their numbers.

### 62. Colourblind-safe palette option (S)

Brick identity is currently carried almost entirely by hue — cyan, magenta, amber, lime — which is
the failure mode for deuteranopia and protanopia the original write-up named.

**Most of this has already shipped, one type at a time, without anyone tracking it as #62 until
now.** `drawBricks()` already draws a non-colour marker for four of the seven live types: `X` gets a
white core dot, `R` a ring, a cracked `S` (`Sc`) a pair of scratch lines, and `?` its own glyph — and
three of those four comments say so explicitly (`X`'s: "colour alone would leave the one brick that
behaves differently unreadable to a colourblind player, the same gap #62 covers for the rest of the
set"; `Sc`'s and `R`'s point back the same way). `#` also reads independently of hue, via its darker
fill, smaller `shadowBlur`, and a black stroke none of the others get. **What's actually left is the
five types `drawBricks()` has no branch for at all: `1`/`2`/`3`/`4` (the four saturated hues the
write-up called out by name) and pristine `S` before its first hit** — `drawBricks()`'s if/else-if
chain falls through them with nothing drawn beyond the fill rect.

**Finishing the pattern already there is cheaper than the "alternate palette" half of the original
proposal, and makes it redundant.** The write-up offered two options — a whole second palette, or a
per-type marker — as alternatives; now that a marker exists for `X`/`R`/`Sc`/`?` and reads fine
without a settings toggle, building a second, switchable colour scheme for the remaining five types
would be inconsistent (two accessibility mechanisms doing the same job) for no real gain. The decision
this entry should make explicitly, rather than leave open: markers only, and always-on — matching how
`X`/`R`/`Sc`/`?` already behave, not gated behind a new preference the way `MUTED_KEY`/`LANG_KEY` gate
sound and language. A toggle would also mean a fourth persisted setting, new `STRINGS` keys in both
languages, and a UI control to place it behind — none of which the four shipped markers needed.

**The fix for `1`–`4` is close to free, because the type character is already the label.** `?`'s
branch is the exact template: `ctx.font = DROP_FONT; ctx.textAlign = "center"; ctx.textBaseline =
"middle"; ctx.fillText(...)`, the same font `drawDrops()` already uses to stamp a power-up capsule's
`label` — `W`, `S`, `M`, and so on — over its fill, for the identical reason. Bricks don't even need a
new label table the way drops did (`POWERUPS[i].label` exists because `type: "widen"` isn't a single
glyph); `b.type` already *is* one for `1`–`4`. A trailing `else` after the `?` branch — catching
anything not already handled, i.e. `1`/`2`/`3`/`4` today — that fills `b.type` in the same style
closes the gap for all four in one small addition. It also means #50's pending `M` (moving bricks)
type would land in that same `else` and get a marker automatically, with nothing further to do for it
when that ships.

**Pristine `S` is the one case worth a decision rather than falling into that `else` unmodified.**
Drawing the literal character `"S"` on an undamaged silver brick would work exactly like the digits do,
but silver is already distinguishable from the four hues by luminance and saturation alone (a pale
grey next to four saturated colours), which is a smaller gap than the four hues being indistinguishable
*from each other*. Giving it a marker anyway — reusing the same `else` branch rather than a bespoke
one — costs nothing extra and keeps every non-wall, non-mystery type consistently marked; there's no
real reason to special-case it out.

#### Tests

- `#62a` — `drawBricks()` draws a distinguishable mark (not just a fill colour) for every alive brick
  type, `1`–`4` and pristine `S` included — asserted by checking each type's draw path calls
  `fillText`/`stroke`/`arc` beyond the base `fillRect`, the same shape the existing `X`/`R`/`Sc`/`?`
  assertions already use.
- `#62b` — the marker drawn for `b.type === "1"` is `"1"` and not shared with any other type's marker
  (guards against a copy-paste that stamps the same glyph on two types).

### 63. Difficulty selection (S)

An explicit easy / normal / hard choice at the start screen, adjusting starting lives, base ball
speed, and the drop rate of bad power-ups.

**Correction to the original write-up: the tuning surface is not "already centralised in `CONFIG`"
— none of the three named levers live there today.** Starting lives is the literal `3`, duplicated in
`newGame()` and again in `submitLevelJump()`'s non-run-phase branch, not a `CONFIG` field. Base ball
speed is `state.baseBallSpeed`, set once to `250` in the state object literal at module load and never
reassigned afterward — not by `newGame()`, not by anything — so today it is not so much "centralised"
as "write-once." And the bad/good power-up mix is `POWERUPS`' per-entry `weight`, a module-level array
sitting next to `CONFIG`, not inside it. Picking this up means actually building the centralisation
the write-up assumed already existed, not just wiring a UI to it.

**Name the preset table around the collision, not into it.** `CONFIG.difficulty` already exists and
means something unrelated — the within-level ramp (`wallBounceMult`, `brickMilestone`,
`brickMilestoneMult`, `max` in `bumpDifficulty()`/`CONFIG.difficulty.max`), not a player-facing easy/
normal/hard choice. A new preset table has to live somewhere else — `CONFIG.difficultyPresets` (or
similar), each entry supplying `lives`, `ballSpeed`, and a bad-power-up weight multiplier — precisely
so nobody later reads `CONFIG.difficulty.easy` and gets the ramp tuning instead.

**Starting lives and ball speed are two straightforward reads at `newGame()` time.**
`state.lives = presets[state.difficulty].lives` replaces both existing `3` literals (also fixing the
duplication along the way), and `state.baseBallSpeed = presets[state.difficulty].ballSpeed` needs to
be added to `newGame()` as a new line — nothing resets that field today, so without it the first
run's ball speed would persist across every subsequent difficulty change once one is picked. `maxLives`
(5, the extra-life cap from `CONFIG.progression.extraLifeEvery`) stays fixed across all three — the
cap is about pacing the mid-run relief, not about starting strength, so there's no reason to vary it.

**The bad-power-up weight needs `rollPowerup()` to read a multiplier, not a rebalanced table.**
`POWERUPS`' weights stay the "normal" baseline unchanged (zero risk to existing balance); `rollPowerup()`
computes its weighted sum fresh each call already (it is only invoked on the ~16% of brick hits that
pass `DROP_CHANCE`, nowhere near a hot path), so multiplying `!p.good` entries' weight by
`presets[state.difficulty].badWeightMult` (1 on normal, <1 on easy, >1 on hard) before summing is a
same-cost change to that function rather than a second table to keep in sync with the first.

**Hall-of-fame and best-score eligibility need the same explicit call #46 and #47 already made for
their own boundary cases, not a new one invented from scratch.** `endGame()` gates the nameentry
detour on `!state.jumped && qualifiesForHallOfFame(...)`, and `maybeSaveBest()` skips a jumped run
outright — both because an unfairly-earned score on the one board that "must never be reset" (per
[CLAUDE.md](../CLAUDE.md)) undermines it for everyone else. An easy-mode run reaching deeper into the
campaign on more lives and gentler drops is the same problem in a milder form. The decision: add
`state.difficulty` (default `"normal"`) alongside `state.jumped` rather than folding difficulty into
that flag — they are different reasons a run doesn't count, and collapsing them would make
`victory`/`gameover`'s `run.jumped` messaging lie about which one actually applied. Both
`endGame()`'s guard and `maybeSaveBest()`'s become `!state.jumped && state.difficulty === "normal"`;
easy and hard stay fully playable, just like a jumped run, without touching the board or the
persisted personal best.

**The UI is a three-way toggle on `overlay-start`, reusing the `.lang-btn` pattern verbatim rather
than inventing a new control.** `.lang-btn`/`data-lang`/`aria-pressed` (with `applyLanguage()` as the
set-and-persist function, #23's fix for toggle buttons reflecting their state) is the exact shape a
`.difficulty-btn`/`data-difficulty` group needs — three buttons, one `aria-pressed="true"`, a
`setDifficulty(value)` sibling to `applyLanguage()` that writes `state.difficulty`, persists it under
a new `neonbreak-difficulty` key (same defensive-default-to-`"normal"` read as every other
`storageGet` caller), and updates the pressed state. It belongs only on `overlay-start` — nowhere
reachable mid-run offers it, so there is no separate "lock it for the run" mechanism to build:
`newGame()` simply reads whatever `state.difficulty` currently holds when `btn-start`/`btn-restart` is
pressed, the same moment it already reads `state.lives`'s and `state.baseBallSpeed`'s new preset
values.

#### Tests

- `#63a` — selecting each difficulty and starting a run sets `state.lives`/`state.baseBallSpeed` to
  that preset's values, and a second run without changing the selection reuses the same preset
  (persisted across `newGame()` calls, not just the one that was active when the button was clicked).
- `#63b` — `rollPowerup()` on hard produces a higher proportion of `!p.good` results than on easy over
  a large sample, holding `DROP_CHANCE` itself constant.
- `#63c` — a qualifying score on easy or hard does not trigger the `nameentry` detour and does not
  raise `state.best`, exactly as a jumped run does not; the same score on normal does both.
- `#63d` — `CONFIG.difficulty` (the within-level ramp) and the new difficulty-preset table are
  distinct objects — a regression guard against the naming collision this entry calls out.

### 64. Resume an interrupted run (S/M)

Since #41 a full campaign is 100 levels — one to two hours in a single sitting — so today, closing
the tab or letting the OS kill a backgrounded one doesn't cost a few minutes, it costs the whole run:
nothing survives past `state`, which lives only in memory. `autoPause()` already freezes the
simulation on `visibilitychange`/`blur` (`frame()` only advances on `playing`/`ready`), but freezing
in memory and surviving a reload are different problems — this entry is the second one.

**What actually needs serializing is a snapshot, not the whole `state` object.** Most of `state` is
either reconstructible or disposable: `state.stars`/`state.theme` come back identical from
`buildStars(idx)`/`themeFor(idx)` since both are pure functions of the level index (the same
determinism #47's write-up leans on), and `state.particles`/`state.floatingTexts`/`state.lightning`
are purely cosmetic — losing whatever was mid-flight when the tab was hidden is invisible, since
`autoPause()` already stops rendering them at that instant anyway. `state.drops`/`state.lasers`/
`state.bossShots`/`state.minions` are gameplay-live but transient hazards; discarding them on resume
is the same trade `resetPaddleAndBall()` already makes on every ordinary serve, just extended to "the
tab came back", so a resumed run starts each life's hazards clean rather than needing to save and
rehydrate in-flight geometry for objects that were, at most, one paused frame old.

**What's left is a small, plain-data slice, because every field involved already is plain data.**
`levelIndex`, `score`, `lives`, `jumped`, `combo`, `difficultyMult`, `bricksDestroyed`,
`remainingBricks`, `levelBrickTotal`, `baseBallSpeed`, `slowMeter`, the seven effect fields
(`widthEffect`/`speedEffect`/`stickyEffect`/`laserEffect`/`fireballEffect`/`shieldEffect`/
`magnetEffect`, each already either `null` or a `{mult, remaining}`/`{remaining}` literal), `paddle`
(`x`, `baseW`), `balls`, `bricks`, `achStats`, and — see below — `sessionToken`. `state.boss` looks
like it would be the hard case, but `spawnBoss()` builds it as a plain object too (`defIdx`, `t`,
`hitsTaken`, `parts`, `dead`, `transition`, `fireGrace`, `hpTotal`); `updateBoss()` looks up
`BOSSES[b.defIdx]` fresh every frame rather than closing over a function reference, so a boss fight
serializes and restores exactly like an ordinary level's bricks do, with no special case beyond
carrying `defIdx` through. `bricks` has to be the *live* array, not a call to `buildLevel(idx)` — a
generated level is deterministic in its starting layout, but not in what survives a level partway
through, so regenerating from `idx` would silently resurrect every brick already destroyed.

**Save on every transition into `paused`, not on a separate timer.** `setPhase(p)` is already the one
place every phase change flows through (per the note at `PHASE_OVERLAY`); a `p === "paused" &&
RUN_PHASES[state.phase]`-style guard there is the natural single call site for `saveResume()`, and it
already fires on every path that matters — manual pause, `autoPause()` on `visibilitychange`/`blur`,
and `openLevelJump()`'s "paused" `jumpReturn`. A `pagehide` listener calling the same function as a
second line of defense costs one more `addEventListener` and covers the rare case (some in-app
browser shells) where `visibilitychange` doesn't fire before teardown.

**The session token has to be carried through unchanged, not refreshed.** `fetchGlobalBoard()` is
what dates a run — it hands back a fresh, server-signed `state.sessionToken` timestamped "now", which
is exactly right at `newGame()`/boot but exactly wrong here: refreshing the token on resume would
re-date the run from the moment it was resumed rather than when it actually started, undermining the
`age`-based checks in `functions/api/scores.js` that a resumed run should still be measured against.
The saved snapshot has to include the literal token string and restore it verbatim, and boot's
`setPhase("start")` → `fetchGlobalBoard()` sequence (module init, near the bottom of the file) must
not clobber a restored token with its own boot-time fetch when a resume is in play.

**`TOKEN_MAX_AGE_MS` (24h, `functions/api/scores.js`) is a real ceiling this feature makes reachable
for the first time, not a new one to add.** Before #64, nobody could pause for 24 hours — the tab
closing lost the run outright, and a tab merely left open in the background doesn't advance the
token's age any differently than one in active use. After #64 it's an actual outcome: a player who
pauses, closes the laptop, and resumes two days later has a snapshot that restores fine client-side,
but the eventual score submission gets `bad_session_age`'d by the server exactly as a same-length
single sitting already would. Nothing needs to change about that check — it's the correct backstop —
but it deserves a decision here rather than being discovered as a bug report: **a token-expired
submission should fail the same way a network-unreachable one already does**, silently, via whatever
`submitGlobalScore()`'s existing rejection path is, not a special error surfaced to the player, since
from their side nothing looks different than any other API hiccup.

**A resumed run is hall-of-fame eligible — the open design question the original write-up flagged.**
#69's `state.jumped` exists to exclude a run that skipped levels it didn't earn; pausing and resuming
skips nothing. The fix here does not add a new exclusion flag alongside `jumped` the way #63 has to
for difficulty — it simply never touches `jumped`, and a saved-and-restored run reaches
`endGame()`/`qualifiesForHallOfFame()` through the exact same, unmodified gate every uninterrupted run
already does.

**Boot needs a resume affordance, and the cheapest one is the existing pause overlay, not a new
one.** Landing a restored run straight into `setPhase("paused")` instead of `"start"` reuses
`overlay-pause` and its `btn-resume` verbatim — the player sees the same screen they would have left
behind, and `resume()` already does the right thing. The one gap: `overlay-pause` today has no way to
decline and start fresh (there's never been a reason for one — abandoning progress mid-run from an
ordinary pause is a destructive action this overlay has deliberately never offered). A second,
secondary button on that overlay — visible only when the pause was reached via a restored save, not
during an ordinary mid-run pause — covers it: a new `state.resumedFromSave` flag set only by the boot
restore path gates its visibility, and its handler is just `clearResume()` (drop the saved snapshot)
followed by `newGame()`.

**Persistence follows the established shape.** A new `RESUME_KEY = "neonbreak-resume"` (namespaced
like every other key `persistence.js` asserts), `loadResume()`/`saveResume()`/`clearResume()`
following `loadAchievements()`'s defensive pattern — guard against valid-JSON-but-wrong-shape data and
return `null` rather than throwing, since a corrupt snapshot should fall back to an ordinary boot, not
break one. `saveResume()` is called from `setPhase()` and the `pagehide` listener; `clearResume()` is
called from `newGame()` (a fresh run has nothing to resume back to) and from `endGame()` (the run is
over either way).

#### Tests

- `#64a` — pausing a run with damaged bricks, an active effect, and a mid-flight ball, then
  simulating a fresh boot against the saved storage, restores `state.bricks` (including a brick
  already at reduced hp), the active effect, and the ball's exact position/velocity — not a fresh
  `startLevel()`.
- `#64b` — the restored run's `sessionToken` is the literal string saved at pause time, not a new one
  fetched at boot.
- `#64c` — `loadResume()` recovers to `null` from malformed storage (missing key, non-JSON, JSON that
  isn't the expected shape) instead of throwing, and boot falls through to the ordinary `"start"`
  phase in that case.
- `#64d` — a run restored from a save reaches `nameentry`/hall-of-fame submission the same as an
  uninterrupted run of the same score would (`state.jumped` stays `false` through a save/restore
  round-trip).
- `#64e` — `newGame()` and `endGame()` both clear any saved snapshot (`loadResume()` afterward returns
  `null`).

---

## E. Code quality / structure

Raised directly, not promoted from [feature-ideas.md](feature-ideas.md).

### 82. Rename `neonbreak-*` to `blokrush-*` (S)

[CLAUDE.md](../CLAUDE.md)'s persistence section currently says to leave the four/five `localStorage`
keys (`BEST_KEY`, `LANG_KEY`, `MUTED_KEY`, `HOF_KEY`, `ACH_KEY` — `html/index.html` around L2377-2381)
named `neonbreak-*`, because renaming them would orphan an existing player's save. That reasoning no
longer holds: the game has not been released to production, so there is no installed base to strand.
Renaming the namespace to `blokrush-*` is now purely a cleanup, not a compatibility break worth
avoiding — do it.

**This isn't just the five key literals.** `persistence.js` (the test suite) asserts the namespace
structurally, not just by example — a `^neonbreak-` regex, presumably in `test/suites/persistence.js`
near where it walks every persisted key — so the assertion itself has to flip to `^blokrush-` in the
same change, or the suite would fail the moment the keys move. Every test file that boots against a
seeded `storage: { "neonbreak-...": ... }` fixture needs the same string updated — `persistence.js`,
`i18n.js`, `rules.js`, `state.js`, `boss.js`, and `regressions.js` all currently seed or assert against
literal `neonbreak-*` keys (`git grep -in neonbreak` is the way to find every call site, since new
ones get added as tests are written — safer than trusting this list to stay exhaustive).

**[CLAUDE.md](../CLAUDE.md) itself needs its wording changed, not just the code.** The Persistence
section's "The keys are still named `neonbreak-*` from before the rename to Blokrush. **Leave
them.**" paragraph is the thing that would otherwise contradict this fix on the next read — it has to
be rewritten to describe the *new* namespace and the fact that the rename already happened, or the
project's own guidance would tell a future session to leave what this finding just changed.
[docs/testing.md](testing.md)'s example snippet (`storage: { "neonbreak-best-score": "500" }`) needs
the same update so a copy-pasted example still works.

**`docs/done.md` is history, not live documentation — leave its existing entries alone.** Past
`✅ FIXED` write-ups (e.g. the hall-of-fame and achievements entries) describe what shipped *at the
time*, under the name that was then current; rewriting them to say `blokrush-*` would misdescribe what
actually happened in that commit. This finding's own entry, once it moves to `done.md`, is what
records the rename — earlier entries don't need touching.

#### Tests

- `#82a` — every persisted key written by a fresh boot (`localStorage`/the test harness's fake store)
  matches `/^blokrush-/`, and none matches `/^neonbreak-/`.
- `#82b` — `persistence.js`'s namespace assertion itself checks `^blokrush-`, not `^neonbreak-`
  (guards against the regex being left behind if the keys are renamed by hand later without also
  touching the test).
