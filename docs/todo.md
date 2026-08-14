# Blokrush — Open Findings

Target: [blokrush.html](../blokrush.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** 7 open findings.

**When an item here gets fixed:** the established loop (see [testing.md](testing.md)) is regression
test → fix → move the finding's whole entry from this file to [done.md](done.md), prepending a
`> **Fixed <date>.**` note that describes what shipped and keeping the original write-up below it as
the historical record → add an entry to [release-notes.md](release-notes.md).

**Line references, once written, are only valid against the current `blokrush.html`** — the same
re-anchoring discipline applies here as in `done.md`.

---

## Gameplay / UX enhancements

### 41. Endless mode past level 5 (M)

A procedural level generator for play past level 10 was the alternative considered when #32
(`done.md`) took the game from 5 hand-authored levels to 10 — and set aside in favor of it, to keep
the existing finite-levels-then-`victory` structure intact rather than redesigning what "winning"
means for an endless mode.

Revisiting this means deciding what replaces the current win condition: `checkLevelClear()`'s
`LEVELS.length - 1` check, the HUD's `n/LEVELS.length` readout, and the `victory` phase itself would
all need either an indefinite continuation or a new, explicit stopping point (a score target, a
survival timer, a difficulty ceiling). Generation would also need to keep clearing the same physics
invariants the hand-authored levels are held to (`test/suites/physics.js`'s randomised sweeps) —
solvable, brick-adjacency layouts that don't trap the ball.

Not attempted; flagged here as a possible follow-up if endless play is wanted later, not as a
commitment.

---

## New brick types

### 49. Explosive bricks (S)

A brick that, when destroyed, destroys its immediate neighbours in a small radius and pushes a
particle shockwave outward. It is the most satisfying single brick type in the genre because it
converts a lucky hit into a visible cascade, and it gives level authors a lever for building
deliberate chain reactions. Implementation touches `brickHit()` and the level character map only.

### 51. Regenerating and multi-hit-with-feedback bricks (S)

A brick that returns after a delay unless the level is cleared first, forcing the player to
prioritise. Related and smaller: silver bricks currently signal damage only by a colour swap
(`Sc`) — a crack overlay would make hit points readable at a glance, which matters more as brick
types multiply.

### 52. Mystery bricks (S)

A brick whose type is hidden until first struck, then resolves into any other type — including an
indestructible wall, which is the risk that makes it interesting. It is a small change (one new
character in the level map plus a resolve step in `brickHit()`) that adds per-run variance to
hand-authored levels for free.

---

## Feel, presentation, and audio

### 58. Screen shake, hit-stop, and impact scaling (S)

The game already has particles and floating score text; what it lacks is the sub-100ms feedback
layer — a few frames of frozen time on a big hit, a brief camera shake on an explosion, a paddle
squash on ball contact. This is the cheapest possible investment in perceived quality per line of
code, and it must be gated behind the existing `prefers-reduced-motion` handling (see finding #25
in [done.md](done.md)), which is already wired up.

### 59. Music and a richer sound bed (M)

Audio today is `beep()` — bare oscillator tones. A layered synth loop that adds voices as the
combo multiplier climbs, plus distinct sounds per brick type and a rising pitch ladder for
consecutive hits, would do for the ear what the neon palette does for the eye. It stays
dependency-free: everything needed is in the Web Audio API already in use. The existing mute
toggle and its persisted state cover the opt-out.

### 60. Background parallax and per-level themes (S/M)

Each level currently draws the same background. Giving levels (or groups of levels) a distinct
palette and a slow parallax starfield or grid would make progress visible in the environment rather
than only in the HUD counter, which is how *Shatter* and *Wizorb* sell their act structure.

---
