# Blokrush — Open Findings

Target: [index.html](../html/index.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** 2 open items — **#100–#101, what is left of the security/backend findings of the
2026-08-22 holistic review pass** (§K); #95, #96, #97, #98, and #99 from that pass have
shipped. #47, #50, #56, and #63 — previously promoted here from
[feature-ideas.md](feature-ideas.md) — have been moved back there as unshipped proposals; see that
file for their write-ups. #46 from the old §A batch, #53, #54, #55, and #57 from the old §C batch,
#82 (raised directly), #83 (raised directly), #84–#93 (the full 2026-08-21 review pass), #64
(promoted from the old §D), #94 (raised directly), #95, #96, #97, #98, and #99 have shipped (see
[done.md](done.md)).
#62 (promoted from the old §D) was discarded outright rather than fixed.

**When an item here gets fixed:** the established loop (see [testing.md](testing.md)) is regression
test → fix → move the finding's whole entry from this file to [done.md](done.md), prepending a
`> **Fixed <date>.**` note that describes what shipped and keeping the original write-up below it as
the historical record → add an entry to [release-notes.md](release-notes.md).

**Line references, once written, are only valid against the current `index.html`** — the same
re-anchoring discipline applies here as in `done.md`. Unlike the feature entries this file used to
carry, the ones below describe code that exists today, so they **do** carry line anchors and those
anchors go stale the moment the file is edited.

---

Every directly-requested feature raised so far has shipped — #44 (boss levels), #74 (the boss-kill
celebration built on top of it), #75 (a follow-on to #37), #78 (effect-bar names), #76 (hall-of-fame
name validation), #77 (hall-of-fame profanity filtering), #79 (the boss-kill death beat's
music/explosion/sound gaps), #80 (level-progress-driven music intensity), #81 (the level-clear
fanfare), #46 (level select), #53 (the fireball power-up), #54 (the safety-net shield), #55 (magnet
paddle / hold-to-slow bullet time), #82 (the `neonbreak-*` → `blokrush-*` rename), #83 (per-level star
ratings), #64 (resume an interrupted run), and #94 (showing #83's star rating on the levelclear
overlay) — see [done.md](done.md). #47 (daily challenge seed), #50 (moving bricks), #56 (paddle
spin), and #63 (difficulty selection) sit unshipped in [feature-ideas.md](feature-ideas.md). The ten
findings raised by the 2026-08-21 review (#84–#93) are all shipped — see [done.md](done.md) §I.

Open below are two of the seven findings of a **holistic review on 2026-08-22** — a read of the whole
repository (`index.html`, `functions/api/scores.js`, the schema, the docs), the same shape as the
pass that produced #84–#93. They are grouped into §K (security and backend,
`functions/api/scores.js`); #95, #96, #97, #98, and #99 (correctness, all in `index.html`) have
shipped — see [done.md](done.md) §J, which is where the rest land as they follow. Every one was
reproduced against the current file through the test harness before being written up; the
reproduction is quoted in each entry. New
review findings go here too, keeping the shared numbering: the next free number is **#102**.

---

## K. Security and backend

Raised by the same pass, over [functions/api/scores.js](../functions/api/scores.js) and the HUD's
reading of the #69 jump rule.

### 100. `onRequestPost` returns the board outside the try that guards every other D1 call (S)

The final `return json({ scores: await readBoard(env.DB) })`
([308](../functions/api/scores.js#L308)) sits **after** the `try`/`catch`
([270-306](../functions/api/scores.js#L270-L306)) that wraps every other database statement in the
handler. A throw there — D1 unavailable between the insert and the read, which is exactly the window
the rest of the function is written to survive — escapes as an unhandled rejection, so the client
gets a Worker error page instead of the `{ error: "unavailable" }, 503` every other failure returns.

The score **is** already stored at that point, and `apiFetch()`
([index.html 2850-2858](../html/index.html#L2850-L2858)) collapses a non-ok response to `null`, so the
player silently keeps the local board and never sees the world board they just landed on. Wrapping the
read (or moving it inside the existing `try`, with the `UNIQUE` branch narrowed so a read failure
cannot be misreported as `already_submitted`) makes the failure mode match the documented one:
"a broken backend looks like the leaderboard is empty".

Two smaller notes from the same read, both low severity and both fine to fold into this entry rather
than carry separately:

- **A rate-limited IP still costs two D1 statements per request.** The opportunistic prune
  ([274-277](../functions/api/scores.js#L274-L277)) runs unconditionally, and the guarded insert
  ([287-296](../functions/api/scores.js#L287-L296)) executes before returning 429. Tokens are free and
  unmetered from `onRequestGet` ([214-222](../functions/api/scores.js#L214-L222)), so a caller who is
  already over the limit can keep paying for writes indefinitely. Checking the count with a `SELECT`
  first would reintroduce the #92 race, so the shape to reach for is a cheap pre-check that only
  short-circuits (never authorises) — or accepting this and saying so in the comment.
- **`cleanName()` ([127-131](../functions/api/scores.js#L127-L131)) strips C0/C1 controls but not
  bidi overrides or zero-width joiners**, and `slice(0, NAME_MAX)` can split a surrogate pair. Neither
  is an XSS vector — `escapeHtml()` covers rendering — but the board is permanent and world-visible,
  which is the argument the profanity filter (#77/#89) was accepted on. A `U+200B-U+200F`/`U+202A-U+202E`
  strip and a code-point-aware truncation are a couple of lines, and must be mirrored in
  `index.html`'s `submitHallOfFameName()` ([5658](../html/index.html#L5658)) the way the profanity
  list already is (`#89c` guards that pairing).

#### Tests

- `#100a` — a `readBoard()` failure after a successful insert returns a 503 JSON body, not an
  unhandled throw (a source-level assertion, in the same style as the existing `scores.js` tests —
  the endpoint itself is not exercised by the suite).
- `#100b` — a name containing a bidi override or a zero-width character is stored without it, in both
  `scores.js` and `index.html`, and the two agree (extending `#89c`'s cross-file pairing).

### 101. The HUD advertises a best score a jumped run can never earn (S)

`maybeSaveBest()` ([5464-5473](../html/index.html#L5464-L5473)) refuses to promote a jumped run's
score — that is #69's rule, and #72 added the end-screen disclosure that says so. But `updateHud()`
([5851-5852](../html/index.html#L5851-L5852)) shows `Math.max(state.best, state.score)`
unconditionally, so throughout a jumped run the "Meilleur" cell climbs with the live score and then
silently snaps back to the real best when the run ends.

Small, but it is the one place the game states the rule and then contradicts it, and #72's whole
argument was that a rule nobody is told about is indistinguishable from a bug — a HUD that shows the
opposite of the rule is worse than one that stays quiet. Gating the `Math.max` on `!state.jumped` is
the whole change; the HUD cache (`hudLast`) already handles the value moving in either direction.

Worth deciding at the same time whether the cell should read the true best or something explicitly
inert during a jumped run — the end screens already carry `run.jumped`, so the HUD does not need to
repeat it, only to stop lying.

#### Tests

- `#101a` — during a jumped run the HUD's best cell never exceeds `state.best`, however high
  `state.score` climbs.
- `#101b` — an ordinary run still shows the live score in that cell as soon as it passes the stored
  best (the #15 behaviour this must not regress).
