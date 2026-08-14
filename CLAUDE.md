# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Blokrush — a bilingual (French/English) neon-arcade Breakout clone. The game itself
(HTML + CSS + JS) is one self-contained file, [html/index.html](html/index.html): no build step,
no dependencies, no `package.json`. Open it directly in a browser (`file://` works) to play it.

Since #67 there is also a server side — [functions/api/scores.js](functions/api/scores.js), a
Cloudflare Pages Function backing the global hall of fame. It is **not** required to play: with the
API unreachable the game falls back to the per-browser `localStorage` board, which is exactly how
`file://` and the whole test suite run. Keep it that way — the single-file game working with no
network is a constraint, not an accident.

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

## Deployment

Cloudflare Pages, connected to this repo's `main` branch — every push deploys. There is no build
command; Pages publishes the `html/` directory as-is, named by `pages_build_output_dir` in
[wrangler.jsonc](wrangler.jsonc). That key is version-controlled rather than left to the dashboard
alone so the setting is reviewable here.

The game must therefore stay at `html/index.html` — static hosting serves the site root from
`index.html`, so renaming or moving it breaks the production URL as well as the test harness
(`GAME_FILE` in [test/dom-stub.js](test/dom-stub.js) and the doc-anchor regexes in
[test/suites/structure.js](test/suites/structure.js)).

### Global hall of fame backend (#67)

`functions/api/scores.js` is backed by D1. Both databases and both secrets are already provisioned;
the bindings live in [wrangler.jsonc](wrangler.jsonc), the secrets only in Cloudflare.

| | Production | Preview |
|---|---|---|
| D1 database | `blokrush-hof` | `blokrush-hof-preview` |
| `HOF_SECRET` | set | set (same value) |

Two things about this setup are easy to get wrong:

- **The Pages project is named `games-blokrush`, not `blokrush`** — it took the repo name. The `name`
  in `wrangler.jsonc` must match it. A mismatch does not fail the build; it just means the file is
  disregarded and the bindings vanish.
- **Preview inherits production bindings unless overridden.** `env.preview` in `wrangler.jsonc`
  exists solely to stop branch and PR previews writing test scores into the production board. Since
  `d1_databases` is a non-inheritable key, any binding added at the top level must be restated under
  `env.preview` or preview silently loses it.

If a binding or the secret is missing the endpoint returns 503 and the game quietly falls back to
the per-browser board — so a broken backend looks like "the leaderboard is empty", not like an
error. Check `/api/scores` directly rather than trusting the UI.

`HOF_SECRET` signs the session tokens that date each run. Rotating it invalidates every token in
flight (players mid-run lose that submission) but nothing already stored. Re-set it with
`npx wrangler pages secret put HOF_SECRET --project-name games-blokrush` (and again with
`--env preview`).

**The board must never be reset** — that was the explicit requirement behind #67, and it constrains
maintenance: migrations on `scores` must be additive and carry `schema_version`, and deleting the
Pages project or the D1 database destroys it irrecoverably. Take an export
(`npx wrangler d1 export blokrush-hof --remote --output backup.sql`) before anything structural.

Production is `blokrush.sebkiller.com`. The domain is registered at Gandi and its DNS stays there —
a single `CNAME` from the `blokrush` subdomain to the project's `.pages.dev` hostname. The zone is
deliberately *not* on Cloudflare: `sebkiller.com` carries live Gandi Mail (`MX` + SPF), and moving
nameservers to gain one static subdomain would put that at risk for no benefit.

## Architecture

### Single-file structure

`index.html` is `<style>` + markup + a `<script>` containing one IIFE — the whole game is a
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

The keys are still named `neonbreak-*` from before the rename to Blokrush. **Leave them.** Renaming
them would orphan every existing player's best score and board; `persistence.js` asserts the
`^neonbreak-` namespace precisely so this does not get "tidied up" later.

Since #67 the hall of fame has a second, authoritative source: the global board from
`/api/scores`. `activeBoard()` is the single place that decides which one the game means — the world
board when `state.globalScores` is non-null, the local one otherwise. Note that `globalScores` stays
`null` rather than `[]` when the API has not answered, because an empty array is a legitimately
empty world board and conflating the two would hide the fallback.

## Testing

Full conventions live in [docs/testing.md](docs/testing.md); the essentials:

- **The test harness never touches `index.html`.** [test/dom-stub.js](test/dom-stub.js) reads
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
