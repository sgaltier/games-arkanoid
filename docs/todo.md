# Neon Break — Open Findings

Target: [arkanoid.html](../arkanoid.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass (or found during play) that haven't
shipped yet. Fixed findings live in [done.md](done.md); numbering is shared across both files and
never reused, so a number here won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** 2 open findings.

**When an item here gets fixed:** the established loop (see [testing.md](testing.md)) is regression
test → fix → move the finding's whole entry from this file to [done.md](done.md), prepending a
`> **Fixed <date>.**` note that describes what shipped and keeping the original write-up below it as
the historical record → add an entry to [release-notes.md](release-notes.md).

**Line references, once written, are only valid against the current `arkanoid.html`** — the same
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

### 42. Hall of fame: prompt for a name at game over, show the top 10 (L)

Feature request: when a run ends (`endGame()`, [:1748](../arkanoid.html#L1748)) with a score that
qualifies, prompt the player for their name, then show a top-10 leaderboard of name+score pairs.

Today only a single number persists across sessions — `state.best`, round-tripped through
`loadBest()`/`saveBest()` ([:887–888](../arkanoid.html#L887-L888)) under `BEST_KEY`
([:870](../arkanoid.html#L870)), both guarded by `storageGet`/`storageSet`
([:878–886](../arkanoid.html#L878-L886)) per #2 (`done.md`). This replaces "a number" with "a list":
a new `localStorage` key (e.g. `neonbreak-hall-of-fame`) holding a JSON array of `{ name, score }`,
capped at 10, sorted descending, read/written through the same guarded helpers so a throwing
`localStorage` degrades the same way #2 already handles for the best score.

**Where it hooks in:** both `endGame(true)` and `endGame(false)` ([:1748](../arkanoid.html#L1748)) —
a run can end either by winning or by running out of lives, and both should qualify. The natural gate
is "does this score beat the lowest of the current top 10 (or is the list not yet full)?" — most runs
won't qualify, and skipping the prompt entirely for those keeps the existing victory/gameover flow
(`PHASE_OVERLAY` [:1196–1204](../arkanoid.html#L1196-L1204), `overlay-victory`/`overlay-gameover`
markup [:538–552](../arkanoid.html#L538-L552)) untouched for the common case.

**Open design questions, not pre-decided:**
- *New phase(s) vs. extending the existing overlays.* The cleanest fit with the existing
  `state.phase` → `setPhase()` → `PHASE_OVERLAY` → `showOverlay()` pipeline (#18, `done.md`) is one
  or two new phases — `nameentry` (a text input + submit button) and `halloffame` (the top-10 list
  plus a continue/restart button) — each getting its own `PHASE_OVERLAY` entry and `.overlay` div,
  rather than bolting a conditional input onto `overlay-victory`/`overlay-gameover` directly.
- *Name input hygiene.* Trim, cap length (the overlay layout wasn't built for arbitrary-length
  strings), fall back to a placeholder for an empty submission, and render entries with `textContent`
  (never `innerHTML`) when the list is redrawn — the same discipline `applyLanguage()` already uses
  for every other piece of user-facing text, but this is the first *player-supplied* string in the
  game.
- *i18n.* Every new string (the name-entry prompt, its input placeholder, the hall-of-fame title, an
  empty-list message) needs a key in both `STRINGS.fr` and `STRINGS.en` ([:764](../arkanoid.html#L764))
  — the `i18n` suite already fails the build if one language's table is missing a key the other has,
  so this is enforced automatically once the keys exist.
- *Keyboard/focus.* The name-entry overlay's input should get focus the way every other overlay's
  primary button does today (`showOverlay()` [:1215](../arkanoid.html#L1215), #26 `done.md`), and
  submitting needs both an Enter-in-the-input path and a click path — mirroring how
  `handleLaunchOrResume()` already serves keyboard, mouse, and touch from one entry point.

**Test coverage this would need:** a `persistence` suite case for the hall-of-fame round-trip
(including the `storageThrows` guard, per #2's test), a `state`/`rules` case for the qualifying-score
gate, and — since this is the first free-text player input — an explicit case asserting a name
containing HTML-special characters renders as literal text, not markup.

---
