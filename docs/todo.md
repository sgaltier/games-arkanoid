# Blokrush — Open Findings

Target: [index.html](../html/index.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** 1 open finding.

**When an item here gets fixed:** the established loop (see [testing.md](testing.md)) is regression
test → fix → move the finding's whole entry from this file to [done.md](done.md), prepending a
`> **Fixed <date>.**` note that describes what shipped and keeping the original write-up below it as
the historical record → add an entry to [release-notes.md](release-notes.md).

**Line references, once written, are only valid against the current `index.html`** — the same
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
