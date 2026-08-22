# Blokrush — Open Findings

Target: [index.html](../html/index.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** 6 open items — **#96–#101, what is left of the correctness and security/backend findings
of the 2026-08-22 holistic review pass** (§J and §K); #95 from that pass has shipped. #47, #50, #56,
and #63 — previously promoted here from
[feature-ideas.md](feature-ideas.md) — have been moved back there as unshipped proposals; see that
file for their write-ups. #46 from the old §A batch, #53, #54, #55, and #57 from the old §C batch,
#82 (raised directly), #83 (raised directly), #84–#93 (the full 2026-08-21 review pass), #64
(promoted from the old §D), #94 (raised directly), and #95 have shipped (see [done.md](done.md)).
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

Open below are six of the seven findings of a **holistic review on 2026-08-22** — a read of the whole
repository (`index.html`, `functions/api/scores.js`, the schema, the docs), the same shape as the
pass that produced #84–#93. They are grouped into §J (correctness, all in `index.html`) and §K
(security and backend, `functions/api/scores.js`); the seventh, #95, has shipped — see
[done.md](done.md) §J, which is where the rest land as they follow. Every one was reproduced against
the current file through the test harness before being written up; the reproduction is quoted in
each entry. New
review findings go here too, keeping the shared numbering: the next free number is **#102**.

---

## J. Correctness

Raised by the 2026-08-22 holistic pass. All four are in [index.html](../html/index.html); none of
them is caught by the current suite. #95, the fifth, has shipped — see [done.md](done.md) §J.

### 96. A malformed `/api/scores` response poisons the board and breaks every later render (M)

Every other boundary in the file where outside data arrives is shape-checked entry by entry:
`loadHallOfFame()` ([2638-2650](../html/index.html#L2638-L2650)) filters on
`typeof e.name === "string" && isFinite(e.score)`, `loadAchievements()`
([2657-2669](../html/index.html#L2657-L2669)), `loadLevelProgress()`
([2686-2704](../html/index.html#L2686-L2704)) and `loadResume()`
([2793-2807](../html/index.html#L2793-L2807)) all do the same for their own shapes. The **network**
boundary does not: `fetchGlobalBoard()` ([2861-2870](../html/index.html#L2861-L2870)) and
`submitGlobalScore()` ([2872-2897](../html/index.html#L2872-L2897)) check only
`Array.isArray(data.scores)` and assign the array straight into `state.globalScores`.

Reproduced with the harness's `api` stub returning `{ scores: [null, { name: "ok", score: 1 }] }`:

```
TypeError: Cannot read properties of null (reading 'name')
    at renderHallOfFame (index.html:5650)
```

The throw lands inside `fetchGlobalBoard()`'s `.then`, past `apiFetch()`'s `.catch`
([2847-2855](../html/index.html#L2847-L2855)) — so it surfaces as an unhandled rejection rather than
as the "no global board" signal every other network failure collapses to, and, worse,
`state.globalScores` is left holding the bad array. From then on `activeBoard()`
([2902-2904](../html/index.html#L2902-L2904)) hands it to everything downstream:
`renderHallOfFame()` ([5641-5666](../html/index.html#L5641-L5666)) throws on every call, which takes
`applyLanguage()` ([3764](../html/index.html#L3764)) with it — **the language toggle stops working** —
and `rankIn()` ([5510-5515](../html/index.html#L5510-L5515)) throws at the end of the run.

The server does validate what it stores, so this is defence in depth rather than a live exploit. It
is worth having anyway for the same reason `loadHallOfFame()` guards `localStorage`: a response can
be truncated by a proxy, served stale by a cache, or come from a future version of the endpoint, and
the whole design of the fallback is that a bad world board degrades to the local one rather than
breaking the game. Note the fallback is specifically *not* `[]` — `state.globalScores` must stay
`null` when the response is unusable, or the game shows an empty world board instead of the device's
own (see the note on `globalScores` at [2972-2975](../html/index.html#L2972-L2975)).

**The fix is one shared validator, not two.** A `sanitizeBoard(list)` that filters to
`{ name, score }` entries with the same predicate `loadHallOfFame()` already uses, returning `null`
when nothing survives a non-empty input, called from both `fetchGlobalBoard()` and
`submitGlobalScore()` — the latter matters too, since `landed` ([2886-2888](../html/index.html#L2886-L2888))
reads the same array.

#### Tests

- `#96a` — a `scores` array containing a non-object entry leaves `state.globalScores` null and the
  local board showing, rather than throwing.
- `#96b` — after such a response, `applyLanguage()` and opening the hall of fame still work.
- `#96c` — a well-formed response is still accepted unchanged, and an empty `scores: []` still means
  "an empty world board" rather than "no world board".

### 97. Once the world board is full of higher scores, nothing is ever written to the local board again (M)

`endGame()` ([5476-5497](../html/index.html#L5476-L5497)) decides whether to prompt for a name with
`qualifiesForHallOfFame()` ([5522-5524](../html/index.html#L5522-L5524)), which ranks against
`activeBoard()` ([5519-5521](../html/index.html#L5519-L5521)) — the **world** board whenever the API
answered. The name prompt is the only route to `insertHallOfFameEntry()`
([5531-5539](../html/index.html#L5531-L5539)), via `submitHallOfFameName()`
([5605-5634](../html/index.html#L5605-L5634)). So a score that does not crack the world top ten never
reaches the local board either — even when the local board is empty.

Reproduced with a world board of ten scores near 1,000,000 and a 5,000-point run:

```
phase after the run:   gameover      (no name prompt)
local board after run: []
blokrush-hall-of-fame: undefined      (never written)
```

The comment on `insertHallOfFameEntry()` already anticipates the *other* direction — "A score can
also fail to make the world top 10 while still deserving a place on this device's board, so rank -1
here is not the same question endGame() asked" — but the code never gets far enough to ask the local
question, because `endGame()` short-circuits first. The consequence is that an online player's device
board stays permanently empty, and the fallback board they are shown the first time they play offline
(or from `file://`, or with the API down) has nothing in it. That is precisely the board the
architecture keeps around so the game means something with no network.

**Two questions, asked in the wrong order.** "Should I prompt for a name?" is a world-board question;
"does this belong on this device's board?" is a local one, and today only the first is ever asked.
The smallest correct shape is for `endGame()` to prompt when the score qualifies on **either** board
(`rankIn(activeBoard(), s) !== -1 || rankIn(state.hallOfFame, s) !== -1`), leaving
`submitHallOfFameName()` and `submitGlobalScore()` unchanged — both already handle "made one board
but not the other" correctly, including `state.hofHighlight`'s fallback
([5625](../html/index.html#L5625)) for exactly this case. Worth deciding deliberately how the
`nameentry` eyebrow reads when a run makes only the local board: "Nouveau record !" over a run that
did not make the world top ten is defensible (it *is* a device record) but should be a choice, not an
accident.

#### Tests

- `#97a` — with a full world board of higher scores, a run that would still make an empty local board
  is offered the name prompt and lands on `state.hallOfFame`.
- `#97b` — that run's entry is written to `blokrush-hall-of-fame` and shows on the device board when
  the API is unreachable on the next boot.
- `#97c` — a run that qualifies for neither board still goes straight to victory/gameover.

### 98. At the game's own top speed the ball passes through a brick without hitting it (M)

The paddle got a swept check in #38 ([5265-5272](../html/index.html#L5265-L5272)) precisely because a
fast ball can step further in one frame than the paddle is thick. Bricks never got one: the brick loop
([5315-5329](../html/index.html#L5315-L5329)) tests `circleRectCollide()`
([5183-5188](../html/index.html#L5183-L5188)) at the ball's **post-move** position only, so a brick
the ball stepped clean over is never considered.

The numbers are the game's own, and the comment at [1140-1149](../html/index.html#L1140-L1149) already
quotes the key one. `baseBallSpeed` 250 × `progression.speedCap` 2.8
([1537](../html/index.html#L1537)) × `effects.fast.mult` 1.4 ([1558](../html/index.html#L1558)) ×
`difficulty.max` 1.6 ([1595](../html/index.html#L1595)) = 1568 px/s; `frame()` clamps `dt` at 0.033
([6247](../html/index.html#L6247)), giving **51.7 px in one step** against a brick 20 px tall — 34 px
including the ball's own diameter. Reproduced directly: an isolated brick spanning y 66-86, a ball at
y 100 heading up at that speed, one 33 ms frame:

```
before: ball.y 100    brick alive
after : ball.y 48.3   brick alive   -> TUNNELLED THROUGH
```

Note the comment at [1145-1149](../html/index.html#L1145-L1149) explicitly retires level speed as a
correctness constraint on the grounds that "a swept paddle check in updateBalls() now catches the
crossing directly instead" — true for the paddle, and this finding is what the same reasoning implies
for bricks.

It bites hardest exactly where it matters least to notice and most to play: the last brick or two of a
late level, with the mid-level ramp maxed and a `fast` pickup caught — which is the stalemate
`CONFIG.difficulty` exists to prevent. 33 ms frames are not hypothetical on a phone.

**Cheapest correct shape is a swept test only when the step warrants it.** Below roughly half the
brick's smaller dimension nothing can be missed, so a guard (`v > BRICK_H / 2`) keeps the ordinary
frame on today's single-position test and pays for the sweep only on the rare long step. Sampling the
segment `prev → new` at sub-brick intervals and running the existing least-penetration pick at the
first sample that overlaps reuses `circleRectCollide()`/`brickPenetration()`/`resolveBrickCollision()`
unchanged, which matters — the fireball branch ([5320-5323](../html/index.html#L5320-L5323)) and the
boss fallback ([5333-5343](../html/index.html#L5333-L5343)) both hang off this loop and must keep
behaving as they do.

#### Tests

- `#98a` — a ball at `speedCap × fast × difficulty.max` crossing an isolated brick in one 33 ms frame
  destroys it instead of passing through.
- `#98b` — the resolved bounce is the one the crossing implies (a ball coming up from below ends up
  below the brick heading down), not an ejection through the far side.
- `#98c` — an ordinary-speed frame still resolves against the least-penetrating of two overlapping
  bricks, unchanged (a guard against the sweep replacing the corner-case pick).

### 99. Aegis's beam renders its narrow effect on the wrong scale (S)

`applyBossHazard("narrow5")` ([4924-4926](../html/index.html#L4924-L4926)) is the one place a width
effect is created with a duration other than its `CONFIG.effects` one — `remaining: 5` rather than
`CONFIG.effects.narrow.duration` (8). `renderEffectBars()`
([5855-5859](../html/index.html#L5855-L5859)) recovers which power-up is behind `state.widthEffect`
from the sign of its `mult` and divides by the table's duration, so the bar opens at
`5 / 8 = 62.5 %` and drains from there. The one hazard in the game with its own duration is the one
the bar cannot describe.

Cosmetic — nothing reads the bar — but it is the kind of drift the `mult`-sign trick was always going
to produce, and the fix removes the trick rather than patching around it: give the effect object its
own `duration` field at creation (`{ mult, remaining, duration }`) and have `updateEffectBar()`
([5842-5852](../html/index.html#L5842-L5852)) read `effect.duration` instead of being handed one by
its caller. That also drops the `we &&`/`se &&` argument gymnastics at the two call sites, and means a
future hazard with its own timing cannot reintroduce this.

#### Tests

- `#99a` — a width effect created with a non-table duration renders a full bar at the instant it is
  applied, and drains proportionally to its own duration.
- `#99b` — widen/narrow/slow/fast still render with their `CONFIG.effects` durations and colours.

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
([index.html 2847-2855](../html/index.html#L2847-L2855)) collapses a non-ok response to `null`, so the
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
  `index.html`'s `submitHallOfFameName()` ([5607](../html/index.html#L5607)) the way the profanity
  list already is (`#89c` guards that pairing).

#### Tests

- `#100a` — a `readBoard()` failure after a successful insert returns a 503 JSON body, not an
  unhandled throw (a source-level assertion, in the same style as the existing `scores.js` tests —
  the endpoint itself is not exercised by the suite).
- `#100b` — a name containing a bidi override or a zero-width character is stored without it, in both
  `scores.js` and `index.html`, and the two agree (extending `#89c`'s cross-file pairing).

### 101. The HUD advertises a best score a jumped run can never earn (S)

`maybeSaveBest()` ([5413-5422](../html/index.html#L5413-L5422)) refuses to promote a jumped run's
score — that is #69's rule, and #72 added the end-screen disclosure that says so. But `updateHud()`
([5800-5801](../html/index.html#L5800-L5801)) shows `Math.max(state.best, state.score)`
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
