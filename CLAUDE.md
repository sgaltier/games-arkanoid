# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Blokrush — a bilingual (French/English) neon-arcade Breakout clone. The entire game
(HTML + CSS + JS) is one self-contained file, [html/blokrush.html](html/blokrush.html): no build step,
no dependencies, no `package.json`. Open it directly in a browser (`file://` works) to play it.

## Commands

```
node test/run.js              # run the whole test suite
node test/run.js physics      # run one suite (by filename or its `name`)
node test/run.js input i18n   # run several suites
```

Requires Node 22+. No install step — the suite is zero-dependency by design, and runs in well
under a second. CI ([.github/workflows/test.yml](.github/workflows/test.yml)) runs the same
command on every push to `main` and every PR. There is no separate lint/build command.

Run the suite before committing — except when the change touches only files under `docs/` (or `.md`
files generally): no code changed, so there's nothing for the suite to catch locally. CI still runs
it on the resulting push/PR regardless.

## Architecture

### Single-file structure

`blokrush.html` is `<style>` + markup + a `<script>` containing one IIFE — the whole game is a
closure with nothing exposed globally. Inside the IIFE, roughly top to bottom:

- `LEVELS` — 10 hand-authored levels as rows of characters (brick type per cell).
- `POWERUPS` — weighted drop table (`widen`, `slow`, `multi`, `life` good; `narrow`, `fast` bad).
- `STRINGS` / `SUPPORTED_LANGS` / `DEFAULT_LANG` — the i18n table and `t(key, params)` lookup.
- `state` — the single mutable game-state object (phase, score, bricks, balls, paddle, active
  power-up effects, lang, etc.). Almost everything reads/writes through this object.
- Per-frame update functions (`updatePaddle`, `updateBalls`, `updateDrops`, `updateEffects`,
  `updateParticles`) and draw functions (`drawBricks`, `drawPaddle`, `drawBalls`, ...), driven by
  `frame(now)` via `requestAnimationFrame`.
- Collision: `circleRectCollide` / `brickPenetration` / `resolveBrickCollision` for ball–brick,
  separate ball–paddle handling in `updateBalls`.

### Phase state machine

`state.phase` is one of
`start | ready | playing | paused | levelclear | nameentry | halloffame | victory | gameover`.
Transitions should always go through `setPhase(p)`, which also swaps the visible overlay via
`showOverlay(id)` — each phase has exactly one corresponding `.overlay` element in the DOM.
(A few transitions currently bypass `setPhase()` directly — see finding #18 in
[docs/done.md](docs/done.md) before adding a new one.) `nameentry`/`halloffame` are a detour
`endGame()` inserts before `victory`/`gameover` when the final score cracks the top-10 hall of fame
(#42) — see `qualifiesForHallOfFame()`.

### i18n

Every user-visible string lives in `STRINGS[lang]`, keyed by dotted path (e.g. `start.sub`).
Markup opts in via `data-i18n="key"` (text content), `data-i18n-html="key"` (innerHTML, for
strings with inline markup like `&hellip;`), or `data-i18n-attr="attr:key|attr2:key2"`
(attributes). `applyLanguage(lang)` walks the DOM and re-renders. `detectLang()` reads
`navigator.languages`; the choice persists via `saveLang`/`loadLang`. Adding a string means
adding the key to **every** language table — the `i18n` test suite fails otherwise (it also
checks placeholder agreement and that every `data-i18n*` reference resolves).

### Persistence

Four `localStorage` keys (`BEST_KEY`, `LANG_KEY`, `MUTED_KEY`, `HOF_KEY` — the hall-of-fame board,
#42), always accessed through `storageGet`/`storageSet`, which swallow throws (Safari
private-browsing throws on any access). `HOF_KEY` additionally guards against valid-JSON-but-wrong-shape
data in `loadHallOfFame()`, since it's parsed rather than just read as a raw string/number.

## Testing

Full conventions live in [docs/testing.md](docs/testing.md); the essentials:

- **The test harness never touches `blokrush.html`.** [test/dom-stub.js](test/dom-stub.js) reads
  the real file, extracts the `<script>` block, and injects `globalThis.__seam = {...}` just
  before the closing `})();`, exposing exactly the names listed in its `SEAM` array (`state`,
  `frame`, `setPhase`, `applyPowerup`, etc.) against an in-memory copy. This is the only way to
  reach the game's internals, since the IIFE otherwise exposes nothing. Keep `SEAM` short —
  adding to it should be a deliberate decision.
- `boot(opts)` (from `dom-stub.js`) builds a fresh game against a fake DOM/localStorage/RNG/clock
  and returns a handle with helpers like `start()`, `runAlive(seconds)`, `key(code)`,
  `mouseMove(x)`, `touch(type, x)`, `shownOverlays()`. See docs/testing.md for the full list and
  for two documented gotchas (`navigator` must be stubbed with `Object.defineProperty`; the fake
  clock starts at `1000`, not `0`, or the first frame's `dt` is `0`).
- Suites live in `test/suites/*.js`, each exporting `{ name, tests }`. **When fixing a bug**, add
  a test to `test/suites/regressions.js` named for the finding (e.g. `#12 — multi-ball clones
  never spawn downward`), confirm it fails against the unfixed code, then fix and confirm it
  passes.
- A test can carry `pending: "#N"` to document a known-open finding; it runs and reports `PEND`
  without failing the build, but if it starts passing the runner reports `FIXED?` and exits
  non-zero — a forcing function to update `todo.md`/`done.md`/`release-notes.md` rather than leaving
  a stale marker. Currently pending: none.

## Docs that track project state

- [docs/todo.md](docs/todo.md) — the backlog of known findings/enhancements not yet shipped, grouped
  by category (correctness, performance, structure, accessibility, gameplay), each with a severity
  estimate. Treat it as a menu, not a commitment.
- [docs/done.md](docs/done.md) — the same findings once shipped, each entry carrying a `✅ FIXED`
  note with the details. Numbering is shared across both files (never reused), so a finding keeps
  its number when it moves from `todo.md` to `done.md`.
- [docs/release-notes.md](docs/release-notes.md) — newest-first changelog, entries grouped by the
  commit that shipped them, cross-referencing finding numbers from `todo.md`/`done.md`.
- [docs/testing.md](docs/testing.md) — full test-harness documentation (see Testing above).

When fixing a numbered finding, the established loop is: regression test → fix → move the finding
from `todo.md` to `done.md` with a `✅ FIXED` note → add an entry to release-notes.md.
