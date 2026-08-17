# Blokrush — Open Findings

Target: [index.html](../html/index.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** one item open — #44, promoted from [feature-ideas.md](feature-ideas.md). Every review
finding raised so far has shipped.

**When an item here gets fixed:** the established loop (see [testing.md](testing.md)) is regression
test → fix → move the finding's whole entry from this file to [done.md](done.md), prepending a
`> **Fixed <date>.**` note that describes what shipped and keeping the original write-up below it as
the historical record → add an entry to [release-notes.md](release-notes.md).

**Line references, once written, are only valid against the current `index.html`** — the same
re-anchoring discipline applies here as in `done.md`. The entry below deliberately carries **no line
anchors at all**: it describes a feature that does not exist yet, so every reference is to a
function by name, which does not go stale.

New items go here, keeping the shared numbering: the next free number is **#74**.

---

## Gameplay

### 44. Boss levels — ten of them, at every level ending in 0 (L)

Every polished breakout in the genre eventually stops handing you a static wall and gives you
something that fights back — *Arkanoid*'s DOH, *Shatter*'s per-zone bosses, *Wizorb*'s monsters.
Blokrush has a hundred levels of wall. This is the one item in the backlog that changes what kind of
game it is.

**Ten bosses, one at each level ending in 0 — 10, 20, … 100 — each replacing the level that used to
sit there.** The cadence is not arbitrary: two facts already true of the code make it free.

- `THEME_LEVELS` is 2 and there are five `THEMES`, so the backdrop cycles every ten levels and
  **every level ending in 0 already lands in act V, the crimson void**, with `MUSIC_ACTS[4]` under
  it — the flat fifth, the slowest and heaviest of the five. Every boss level is already dressed as
  one, and nothing about the theme or the music has to learn what a boss is.
- `CONFIG.progression.extraLifeEvery` is 10, so **clearing a boss already awards the extra life**.
  The reward exists before the boss does.

#### The roster

Common shape: one entity moving along the top of the field, a fixed number of ball hits to destroy,
and a hazard on a cadence. The **New idea** column is the one thing each boss adds; everything above
it in the table is assumed known by the player by the time they reach that row. That column, read
top to bottom, *is* the difficulty curve — the hit counts and the speeds are the smaller half of it.

| # | Level | EN / FR | Hits | Movement | Vulnerable | Hazard | Arena | New idea |
|---|---|---|---|---|---|---|---|---|
| B1 | 10 | **SENTINEL** / **SENTINELLE** | 12 | slides ↔, 70 px/s, reverses at the edges; +15% speed every 4 hits | whole body | none | empty | the entity itself — the big thing *is* the level |
| B2 | 20 | **SALVO** / **SALVE** | 16 | ↔ 90 px/s | whole body | one shot dropped straight down from its own x every 2.6 s; on the paddle it costs the combo and applies `narrow` for 3 s; a laser bolt kills it | one thin row of cover bricks | dodging |
| B3 | 30 | **CARAPACE** / **CARAPACE** | 6 plates + 12 core | slow sine, 80 px/s | the core, only once all six silver plates are stripped; it regrows one plate every 8 s | salvo, 3.0 s | thin cover row | a vulnerability window you have to open *and keep* open |
| B4 | 40 | **GEMINI** / **GÉMEAUX** | 2 × 12 | one body until 50%, then two half-width bodies moving in opposition | both halves, always | the halves fire alternately, 3.2 s | two `#` wall pillars flanking the field | two targets, and a mid-fight change of shape |
| B5 | 50 | **AEGIS** / **ÉGIDE** | 26 | ↔ 100 px/s | only while its deflector bar is down — 4 s up, 3 s down | every 6 s a telegraphed 0.8 s column over the paddle's current x, then a beam applying `narrow` for 5 s if the paddle is still in it | cover row + pillars | the fight has a rhythm, and standing still is punished |
| B6 | 60 | **THE HIVE** / **LA RUCHE** | 28 | ↔ 100 px/s | whole body | spawns 2 drifting minions every 5 s, capped at 6 alive; one reaching the paddle line applies `narrow` and vanishes; ball or laser kills one | two-row honeycomb of cover | crowd control |
| B7 | 70 | **PHANTOM** / **SPECTRE** | 32 | blinks: fades over 0.4 s, reappears at a new x, every 2.2 s; the ball passes through while it is faded | only while solid | drops explosive minions that detonate at the paddle line | sparse cover | timing and prediction rather than tracking |
| B8 | 80 | **MIRAGE** / **MIRAGE** | 34 | eases toward the paddle's x — it is always above you; at 50% it stops tracking for 5 s and barrages instead | whole body | a 3-shot fan every 3.5 s | pillars only | the boss reacts to *you*; hitting it means leaving the ball's return path |
| B9 | 90 | **LEVIATHAN** / **LÉVIATHAN** | 38 | 240 px wide, 50 px/s, and **descends one brick row every 10 hits** | whole body | alternating salvos and a sweeping beam; its shots now **cost a life**, telegraphed with a 1 s flash | walls, no cover | a soft timer — the arena shrinks, so stalling loses |
| B10 | 100 | **OMEGA** / **OMÉGA** | 3 × 15 | see phases | see phases | see phases | all of it | the composite, and the end of the campaign |

**OMEGA's three phases**, each ending in a 1.5 s invulnerable roar with a screen shake:

- **I** — plated like Carapace, firing like Salvo.
- **II** — splits into two Aegis-shielded halves that blink.
- **III** — reassembles, tracks the paddle, descends, and spawns explosive minions.

Beating it needs no new ending: `checkLevelClear()` already routes the last level to `endGame(true)`
and the `victory` screen.

The curve, read down that last column: entity → dodge → open a window → two targets → rhythm and
positioning → crowd control → prediction → the boss reacts to you → a soft timer → all of it. Hit
counts run 12 → 45 and speeds 70 → 100 px/s. **Every figure in the table is a first-pass tuning
value, not a decision** — the roster is the decision.

Arena composition escalates with the roster rather than staying constant: the first bosses fight
over an empty field so the new entity reads clearly, the middle ones gain cover bricks and wall
pillars that constrain the ball's angles, and the last ones fill the field with what they spawn.

#### Decisions to write down before they can be violated

- **`levelDef(idx)` stays the only thing that reads level data.** A boss level's definition is the
  same `{ rows, speed }` object with a `boss` field added, so `buildLevel()` and
  `resetPaddleAndBall()` keep their current contract and no caller learns what a boss is.
- **The boss is the only thing that counts toward `remainingBricks`.** Arena cover bricks and
  spawned minions never do. `checkLevelClear()`'s single `remainingBricks <= 0` condition is then
  unchanged, #16's "a counter, not a scan" invariant holds, and the whole softlock class
  `ensureReachable()` exists to prevent — a destructible brick the ball cannot reach — cannot arise
  in a boss arena at all.
- **A boss's remaining hits survive a lost ball.** `resetPaddleAndBall()` is per-life and must not
  rebuild the boss; if it does, B7 upward is unwinnable.
- **The sub-phase lives on `state`, not in `state.phase`.** An intro beat (name card, ball held) and
  a death beat, both modelled on `state.lifeLost` — a `{ remaining }` countdown that gates the frame
  — rather than new entries in the phase machine. #18's lesson: the fewer transitions bypassing
  `setPhase()`, the better.
- **Score parity.** A boss level must award roughly what the 60-to-90-brick level it replaced did,
  or the score curve dents at every tenth level and the global board stops comparing runs honestly.
  Per-hit score × `levelMultiplier(n)`, tuned to match, plus a kill bonus.
- **Presentation respects `prefers-reduced-motion`,** exactly as #58's impact layer does. The blink
  fade, the roar shake and the beam flash are the motion-suppressed half; the hazards themselves
  are not — suppressing those would change the fight.

#### Retiring the authored level 10

Level 10 is hand-authored, so a boss taking that slot means `LEVELS` shrinks from ten entries to
nine and its tenth row-set is deleted. Three consequences, recorded here so implementation does not
have to rediscover them:

- `levelSpeed()` re-anchors on `LEVELS[8].speed` (1.95, not 2.08) and on `LEVELS.length === 9`, so
  the generated speed curve shifts slightly. `levelMultiplier()`'s `n <= LEVELS.length` identity
  branch now covers levels 1–9; level 10 falls to the saturating branch and stays monotonic.
- `generateLevel()`'s escalation counter `d = idx - LEVELS.length` would otherwise count boss levels
  as generated ones. It needs a `layoutIndex(idx)` — the count of non-boss levels before `idx` —
  while the seed stays keyed on the real `idx`, so a level's layout does not move if the boss
  cadence is ever changed.
- **#68's regression test pins `LEVELS[9]` directly** and has to be re-pointed. The right
  replacement is stronger than the original: assert that *every* authored layout is fully reachable,
  with a flood fill local to the test, so the guard covers the whole table rather than one row of it.

#### Needs

What has to exist that does not today:

| | |
|---|---|
| A boss entity | `state.boss`, its update/draw pair called from `frame()`'s `playing` block and from `draw()`, and a `BOSSES` table holding the ten definitions |
| Boss–ball collision | reusing `circleRectCollide` / `resolveBrickCollision` against the boss body and its plates |
| A boss-shot array | `state.bossShots`, modelled on `state.lasers` — the existing projectile system, aimed the other way |
| A minion kind | bricks flagged so they are excluded from `remainingBricks`, spawned and expired at runtime |
| i18n | a `boss.<id>.name` family plus an intro-card key, in **both** language tables — the `i18n` suite fails otherwise |
| Achievements | three rows: the first boss down, a boss beaten without losing a ball, all ten beaten in one run. Presentation only, per #65 — nothing here awards points, lives or power-ups |
| Tests | a `boss` suite, the `SEAM` names it needs (keep the list short), and the #68 re-point above |
