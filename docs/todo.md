# Blokrush — Open Findings

Target: [index.html](../html/index.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** 6 open items — #47 (promoted from [feature-ideas.md](feature-ideas.md) §A), #50
(promoted from §B), #56–57 (promoted from §C), #63 (promoted from §D), and #83 (raised directly,
not promoted from `feature-ideas.md`). #46 from the §A batch, #53, #54, and #55 from the §C batch,
#82 (raised directly), #84–#93 (the full 2026-08-21 review pass, correctness and security/backend
alike), and #64 (promoted from §D) have shipped (see [done.md](done.md)). #62 (promoted from §D) was
discarded outright rather than fixed — see the note in §D below.

**When an item here gets fixed:** the established loop (see [testing.md](testing.md)) is regression
test → fix → move the finding's whole entry from this file to [done.md](done.md), prepending a
`> **Fixed <date>.**` note that describes what shipped and keeping the original write-up below it as
the historical record → add an entry to [release-notes.md](release-notes.md).

**Line references, once written, are only valid against the current `index.html`** — the same
re-anchoring discipline applies here as in `done.md`. The entries below deliberately carry
**no line anchors**: they describe features that do not exist yet, so every reference is to a
function or field name, which does not go stale.

---

Every directly-requested feature raised so far has shipped — #44 (boss levels), #74 (the boss-kill
celebration built on top of it), #75 (a follow-on to #37), #78 (effect-bar names), #76 (hall-of-fame
name validation), #77 (hall-of-fame profanity filtering), #79 (the boss-kill death beat's
music/explosion/sound gaps), #80 (level-progress-driven music intensity), #81 (the level-clear
fanfare), #46 (level select), #53 (the fireball power-up), #54 (the safety-net shield), #55 (magnet
paddle / hold-to-slow bullet time), #82 (the `neonbreak-*` → `blokrush-*` rename), and #64 (resume an
interrupted run) — see [done.md](done.md). Everything left open below is a feature: #47 (daily
challenge seed), #50 (moving bricks), #63 (difficulty selection), and two power-up/ball-mechanics
ideas, all promoted from [feature-ideas.md](feature-ideas.md) and keeping their numbers; that file
still holds the proposals not yet promoted. #83 (per-level star ratings, split out of #46 — the two
were originally one item) was raised directly rather than promoted from there. The ten findings
raised by a full-codebase review on 2026-08-21 (#84–#93, correctness and security/backend alike) are
all shipped — see [done.md](done.md) §I. #62 (colourblind-safe brick markers) was discarded rather
than shipped — see §D.
New review findings go here too, keeping the shared numbering: the next free number is **#94**.

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
local-storage fallback should follow the same `blokrush-` namespaced, defensively-parsed pattern as
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
anything already shipped. #62 was promoted alongside #63/#64 but has since been discarded outright too
— dropped from the menu on its own terms, same as #61, not because it turned out to duplicate anything
shipped. #63 and #64 keep their numbers.

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
a new `blokrush-difficulty` key (same defensive-default-to-`"normal"` read as every other
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
