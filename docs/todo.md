# Blokrush — Open Findings

Target: [index.html](../html/index.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** 4 open items — the findings of the **second holistic review pass on 2026-08-22**, a read
of the whole repository (`index.html`, `functions/api/scores.js`, the schema, the test harness, the
docs), the same shape as the passes that produced #84–#93 and #95–#101. They are grouped into §L
(correctness, all in `index.html`) and §M (security and backend). Every one was reproduced against
the current file — through the test harness for the game-side findings — before being written up;
the reproduction is quoted in each entry. Everything from earlier passes has shipped: #95–#101 (the
first 2026-08-22 pass) live in [done.md](done.md) §J/§K, #102–#103 (the first two of this second
pass) in §L, #84–#93 in §I, and every directly-requested feature so far in §H. #47, #50, #56, and #63
sit unshipped in [feature-ideas.md](feature-ideas.md); #62 was discarded outright rather than fixed.

**When an item here gets fixed:** the established loop (see [testing.md](testing.md)) is regression
test → fix → move the finding's whole entry from this file to [done.md](done.md), prepending a
`> **Fixed <date>.**` note that describes what shipped and keeping the original write-up below it as
the historical record → add an entry to [release-notes.md](release-notes.md).

**Line references, once written, are only valid against the current `index.html`** — the same
re-anchoring discipline applies here as in `done.md`. New review findings go here, keeping the
shared numbering: the next free number is **#108**.

---

## L. Correctness

Raised by the 2026-08-22 second holistic pass using Fable. All are in [index.html](../html/index.html); none is
caught by the current suite.

### 104. `isScoreEntry` uses global `isFinite`, so null/boolean/string scores pass both board validators (S)

`isScoreEntry` ([2640](../html/index.html#L2640)) is #96's single predicate for "a row a board can
render", shared by `loadHallOfFame()` ([2641-2653](../html/index.html#L2641-L2653)) and
`sanitizeBoard()` ([2876-2883](../html/index.html#L2876-L2883)) — but it checks `isFinite(e.score)`,
and the **global** `isFinite` coerces: `isFinite(null)`, `isFinite(true)`, and `isFinite("250")` are
all `true`. Reproduced through the harness at both boundaries:

```
HOF_KEY = [{name:"Ghost",score:null},{name:"Bool",score:true},{name:"Str",score:"250"}]
  -> state.hallOfFame keeps all three
/api/scores -> {scores:[{name:"Api",score:null}]}
  -> state.globalScores = [{"name":"Api","score":null}]
```

The board then renders "null"/"true" in the score column
([5790](../html/index.html#L5790)), and `rankIn()`'s `score > list[i].score` comparisons
([5596-5601](../html/index.html#L5596-L5601)) run on coerced values. This is precisely the class of
wrong-shape data #96 exists to keep out — a truncated or version-skewed API response, or foreign
JSON under `HOF_KEY` — surviving the check that was written to reject it. The fix is one word:
`Number.isFinite`, which coerces nothing. (Arguably `Number.isInteger`, matching the server's own
`bad_score` check, but finite is the property rendering and ranking actually need.)

#### Tests

- `#104a` — `HOF_KEY` rows with `score: null` / `true` / `"250"` are dropped by `loadHallOfFame()`.
- `#104b` — an API response row with a non-number score is dropped by `sanitizeBoard()` (and a
  response that is *only* such rows degrades to the local board, per #96's null-vs-[] rule).

### 105. A corrupt resume snapshot with an out-of-range `levelIndex` kills the game at boot (S)

`loadResume()` ([2799-2814](../html/index.html#L2799-L2814)) checks shapes —
`Number.isInteger(snap.levelIndex)`, the arrays, the paddle — but no ranges. A snapshot with a
negative `levelIndex` (a manual edit, a bit of foreign JSON, a future format change) passes, and
`restoreFromResume()` then calls `themeFor(state.levelIndex)`
([2826](../html/index.html#L2826)): JS's `%` keeps the sign, so `themeFor(-5)` indexes
`THEMES[-3]` ([2207-2209](../html/index.html#L2207-L2209)) and returns `undefined`. The first
frame's `drawBackground()` → `skyFor()` ([6014-6021](../html/index.html#L6014-L6021)) then throws
reading `theme.top`, and since `requestAnimationFrame(frame)` is queued at the *end* of `frame()`
([6450](../html/index.html#L6450)), the loop never re-arms — a dead canvas, exactly what the
"corrupt snapshot degrades to an ordinary boot" rule ([2795-2798](../html/index.html#L2795-L2798))
exists to prevent. Reproduced through the harness:

```
RESUME_KEY = {"levelIndex":-5, "bricks":[], "balls":[], "paddle":{...}}
boot -> TypeError: Cannot read properties of undefined (reading 'top')
```

**Fix: bound the fields whose range the game indexes with.** `levelIndex` must sit in
`[0, CONFIG.progression.totalLevels)`; while there, `lives`/`score` deserve the same treatment
(`Number.isFinite`, non-negative) since they feed the HUD and `endGame()` arithmetic. Anything
failing returns `null` — the ordinary-boot fallback that already exists.

#### Tests

- `#105a` — a snapshot with `levelIndex: -5` (and one with `levelIndex: 999`) boots to the start
  screen instead of restoring — and the boot frame does not throw.
- `#105b` — a well-formed snapshot still restores, unchanged (guard against over-tightening).

### 106. `state.hofHighlight` is never cleared, so old submissions stay highlighted forever (S)

`submitHallOfFameName()` sets `state.hofHighlight` ([5752](../html/index.html#L5752)) so
`renderHallOfFame()` can pick out "the entry just submitted"
([5781-5786](../html/index.html#L5781-L5786)) — but nothing ever resets it
([3015](../html/index.html#L3015) is its only other mention, and `newGame()` doesn't touch it). For
the rest of the session, every later view of the board — opened from the start screen
([3823-3827](../html/index.html#L3823-L3827)), or after a later run that didn't qualify — still
highlights that old row as if it had just been entered. The highlight also matches by value, so
after the world board refreshes, *someone else's* row with the same name and score would light up.
Cosmetic, but it makes the one visual affordance meaning "this is the result you just got" say
something false. **Fix:** clear `state.hofHighlight` in `newGame()` (a fresh run has submitted
nothing), which keeps the highlight alive exactly from submission until the next run starts.

#### Tests

- `#106a` — submit a qualifying name, start a new game, open the board from the start screen: no row
  carries `hof-new`.

---

## M. Security and backend

Raised by the same pass. In [functions/api/scores.js](../functions/api/scores.js) and its
`index.html` mirror.

### 107. Bidi isolates and other invisible characters survive `cleanName()`'s strip (S)

#100 strips control characters, bidi *overrides* and zero-width characters from hall-of-fame names —
the class `U+0000–U+001F, U+007F, U+200B–U+200F, U+202A–U+202E` in `cleanName()`
([functions/api/scores.js:131-140](../functions/api/scores.js#L131-L140)) and its mirror
`cleanHofName()` ([5719-5724](../html/index.html#L5719-L5724)) — on the stated goal that a name
"cannot be used to visually reorder or hide characters on a permanent, world-visible board". The
range misses the characters that still can:

```
U+2066 LRI: SURVIVES | U+2067 RLI: SURVIVES | U+2069 PDI: SURVIVES | U+202E RLO: stripped
U+FEFF: SURVIVES | U+2060 WJ: SURVIVES | U+00AD SHY: SURVIVES | U+061C ALM: SURVIVES
```

The **bidi isolates** U+2066–U+2069 (LRI/RLI/FSI/PDI) reorder rendered text exactly the way the
stripped U+202A–U+202E embeddings/overrides do — they are the *newer* mechanism, introduced to
replace the old one — so the current strip closes the legacy door and leaves the modern one open. A
name like `abc<RLI>fed<PDI>` renders reordered on every player's board, permanently (#67's board is
never reset). U+FEFF (zero-width no-break space), U+2060–U+2064 (word joiner and invisible
operators), U+00AD (soft hyphen) and U+061C (Arabic letter mark) are invisible padding: a "name" of
mostly invisibles renders as a near-blank row while passing the server's non-empty check. None of
them helps evade the profanity filter — the survivors just count as the `[^a-z]*` filler
PROFANITY_RE already allows — so this is display integrity, not filter evasion.

**Fix: widen the class in both copies at once** (they must stay mirrored, per the #100/#89c rule) —
add `U+00AD, U+061C, U+2060–U+2064, U+2066–U+2069, U+FEFF` — or replace the blocklist with the
positive rule it is approximating: strip anything in Unicode categories Cf/Cc
(`/[\p{Cf}\p{Cc}]/gu`, supported in every runtime this ships to). Note the client mirror also feeds
the *local* board, so the fix lands in `index.html` even for offline play. A migration on rows
already stored is out of scope — the board is never reset, and no such name is known to be on it.

#### Tests

- `#107a` (game side) — a name containing U+2067/U+FEFF submitted through `cleanHofName()` lands on
  the local board with those characters gone.
- `#107b` — the two strip patterns in `index.html` and `functions/api/scores.js` are identical (the
  same structural assertion the profanity lists already get).
