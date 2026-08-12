# Testing

```
node test/run.js              # everything
node test/run.js physics      # one suite
node test/run.js input i18n   # several
```

No dependencies, no install step, no `package.json`. Node 22 or newer. The whole
suite runs in roughly a third of a second.

CI runs the same command on every push to `main` and on every pull request —
[.github/workflows/test.yml](../.github/workflows/test.yml).

---

## The convention

**When you fix a bug**

1. Add a test to [`test/suites/regressions.js`](../test/suites/regressions.js), named for its
   finding: `#12 — multi-ball clones never spawn downward`.
2. **Run it against the unfixed code and watch it fail.** A regression test that has never been
   observed failing proves nothing — it may be asserting something that was always true.
3. Fix the bug. Watch it pass.
4. Mark the finding fixed in [code-review.md](code-review.md) and add an entry to
   [release-notes.md](release-notes.md).

**When you add a feature**

Extend the suite that covers the area. New user-visible strings need no extra work: the `i18n`
suite fails automatically if a key is missing from a language table, if placeholders disagree, or
if markup references a key that does not exist.

**Before committing**

`node test/run.js`. CI will enforce it anyway, but the loop is faster locally.

---

## Suites

| Suite | What it covers |
|---|---|
| `structure` | The document shell — doctype, charset, viewport, title, `lang`. Also that docs line anchors still point at real lines and that their labels agree. |
| `state` | The phase machine, and that each phase shows exactly its own overlay. |
| `input` | Keyboard, mouse and touch, including focus interactions. |
| `physics` | Collision, plus randomised invariant sweeps. |
| `rules` | Scoring, brick durability, level progression, power-up effects on state. |
| `effects` | Timed power-ups: application, expiry, suspension while paused. |
| `i18n` | String tables, locale detection, the toggle, interpolation. |
| `persistence` | Storage round-trips, and behaviour when storage throws. |
| `perf` | Per-frame budgets measured from the instrumented DOM stub. |
| `regressions` | One test per fixed finding. |

---

## Pending tests

A test may carry a `pending` marker naming an open finding:

```js
{
  name: "#7 — arrow keys suppress page scrolling",
  pending: "#7",
  fn(a) { /* ... */ },
}
```

Pending tests run and report as `PEND`. They **do not fail the build** — they document how an
unfixed finding should behave once someone gets to it.

If a pending test *passes*, the runner reports `FIXED?` and **exits non-zero**. That is deliberate:
it means the finding is resolved and the marker needs removing. The suite tells you when to close
a finding out rather than relying on anyone remembering.

Currently pending: #7, #8 (input), #14, #15 (perf).

---

## How the harness works

The game is an IIFE inside a single HTML file, so nothing is reachable from outside.
[`test/dom-stub.js`](../test/dom-stub.js) reads the real `arkanoid.html`, extracts the `<script>`
block, and injects a handle just before the closing `})();` exposing the names listed in `SEAM`.

`arkanoid.html` itself is never modified — the injection happens on an in-memory copy.

`boot(opts)` gives you a fresh game with a fake DOM:

```js
const g = boot({ langs: ["en-GB"], storage: { "neonbreak-best-score": "500" } });
g.start();          // click Start, press Space — a ball is now in play
g.runAlive(2.0);    // 2s of frames with the paddle tracking the ball
g.T.state.score;    // reach into the closure
```

| Option | Purpose |
|---|---|
| `langs` | What `navigator.languages` reports |
| `storage` | Pre-seeded `localStorage` contents |
| `storageThrows` | Make every storage access throw, as in Safari private browsing |
| `seed` | Seed for the deterministic RNG, so physics runs reproduce |
| `dpr` | `devicePixelRatio` |

Useful handle methods: `run(seconds)`, `runAlive(seconds)` (keeps the paddle under the ball so play
continues), `frame()`, `key(code)`, `hold`/`release`, `mouseMove(x)`, `touch(type, x)`,
`fireWin(type)`, `fireDoc(type)`, `el(id)`, `byKey(i18nKey)`, `langButton(lang)`,
`shownOverlays()`, and `counters` for per-frame budgets.

### Two traps worth knowing about

Both of these cost real debugging time and are commented in the source so they are not
"simplified" away:

- **`globalThis.navigator` is a getter-only accessor on Node 22.** Plain assignment silently
  no-ops, so a naive stub leaves the host's real locale in place and every locale assertion
  quietly measures this machine instead of the value under test. It must be installed with
  `Object.defineProperty`. This produced five false passes before it was caught.

- **The clock starts at 1000, not 0.** The game computes its frame delta as
  `now - (state.lastTime || now)`, so a `lastTime` of `0` reads as "unset" and the first frame
  yields `dt === 0` — nothing moves, and hand-placed collision tests silently do nothing. `boot()`
  primes with a non-zero timestamp.

### The test seam

The injected handle couples the tests to internal names (`state`, `applyPowerup`, `frame`, …).
That is a deliberate trade: driving a closed IIFE purely through DOM events cannot reach the
physics at all. Keep `SEAM` short — adding to it should be a decision, not a reflex.
