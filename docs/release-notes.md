# Release notes

Changes to **Blokrush**, newest first. `#N` references point at the numbered findings in
[done.md](done.md) (shipped) or [todo.md](todo.md) (still open).

The project is not versioned or tagged, so entries are grouped by the commit that delivered them.

## Review progress

| Findings | Status |
|---|---|
| #1, #2, #3 | ✅ Fixed — 2026-08-12 |
| #4, #5, #6 | ✅ Fixed — 2026-08-12 |
| #7, #8, #9, #10 | ✅ Fixed — 2026-08-13 |
| #11, #12, #13 | ✅ Fixed — 2026-08-13 |
| #14, #15, #16, #17 | ✅ Fixed — 2026-08-13 |
| #18, #19, #20, #21 | ✅ Fixed — 2026-08-13 |
| #22, #23, #24, #25 | ✅ Fixed — 2026-08-13 |
| #26, #27, #28, #29 | ✅ Fixed — 2026-08-13 |
| #30, #31 | ✅ Fixed — 2026-08-13 |
| #33, #34 | ✅ Fixed — 2026-08-13 |
| #35, #36 | ✅ Fixed — 2026-08-13 |
| #37 | ✅ Fixed — 2026-08-13 |
| #32 | ✅ Fixed — 2026-08-13 |
| #38, #39, #40 | ✅ Fixed — 2026-08-14 |
| #42, #43 | ✅ Fixed — 2026-08-14 |
| #67 | ✅ Fixed — 2026-08-14 |
| #49 | ✅ Fixed — 2026-08-14 |
| #51 | ✅ Fixed — 2026-08-14 |
| #52 | ✅ Fixed — 2026-08-14 |
| #58 | ✅ Fixed — 2026-08-14 |
| #59 | ✅ Fixed — 2026-08-15 |
| #60 | ✅ Fixed — 2026-08-15 |
| #41 | ✅ Fixed — 2026-08-15 |
| #68 | ✅ Fixed — 2026-08-15 |
| #69 | ✅ Fixed — 2026-08-15 |
| #71 | ✅ Fixed — 2026-08-15 |
| #72, #73 | ✅ Fixed — 2026-08-16 |
| #70 | ✅ Fixed — 2026-08-16 |
| #65 | ✅ Fixed — 2026-08-16 |
| #44 | ✅ Fixed — 2026-08-17 |
| #74 | ✅ Fixed — 2026-08-17 |
| #75 | ✅ Fixed — 2026-08-17 |
| #78 | ✅ Fixed — 2026-08-17 |
| #76 | ✅ Fixed — 2026-08-18 |
| #77 | ✅ Fixed — 2026-08-18 |
| #79 | ✅ Fixed — 2026-08-18 |
| #53 | ✅ Fixed — 2026-08-19 |
| #80 | ✅ Fixed — 2026-08-19 |
| #81 | ✅ Fixed — 2026-08-19 |
| #54 | ✅ Fixed — 2026-08-20 |
| #55 | ✅ Fixed — 2026-08-20 |
| #46 | ✅ Fixed — 2026-08-21 |
| #82 | ✅ Fixed — 2026-08-21 |
| #84 | ✅ Fixed — 2026-08-21 |
| #85 | ✅ Fixed — 2026-08-21 |
| #86 | ✅ Fixed — 2026-08-21 |
| #87 | ✅ Fixed — 2026-08-21 |
| #88 | ✅ Fixed — 2026-08-21 |
| #89 | ✅ Fixed — 2026-08-21 |
| #90 | ✅ Fixed — 2026-08-21 |
| #91 | ✅ Fixed — 2026-08-21 |
| #92 | ✅ Fixed — 2026-08-21 |
| #93 | ✅ Fixed — 2026-08-21 |
| #64 | ✅ Fixed — 2026-08-21 |
| #57 | ✅ Fixed — 2026-08-21 |
| #83 | ✅ Fixed — 2026-08-21 |
| #94 | ✅ Fixed — 2026-08-21 |

84 of 84 fixed — the full-codebase review raised on 2026-08-21 is done, ten for ten, #64 (resume an
interrupted run) has shipped alongside it, and #57 (laser-vs-bad-drop counterplay) closes out the §C
power-up batch. #83 (per-level star ratings) is the other half of what was originally #46, and #94
puts that rating on screen at the moment it's earned, not just later in level select. See
[todo.md](todo.md) for the feature ideas still open, and [feature-ideas.md](feature-ideas.md) for
proposals not yet promoted to it.

---

## 2026-08-21 — Show the star rating on the levelclear overlay (#94)

### Fixed

`#83` rated a level 1-3 stars the moment it cleared, but the only place that rating ever showed up was
level select — the levelclear overlay itself, shown right when the rating is earned, said nothing
about it. `checkLevelClear()` now stashes the computed rating in `state.lastLevelStars` (a display-only
field — not persisted, not part of a resumed run's snapshot), and `renderDynamicText()` writes it into
a new `#levelclear-stars` line using the same `starGlyphs()` level select already uses, so the two
never draw a rating two different ways. It's styled gold via the existing `--neon-amber` token, with a
glow and a larger size than the score line above it, since here it's the payoff the screen exists to
show.

### Tests

One new case in `regressions.js` (`#94`), confirmed failing first against the unfixed code (the element
didn't exist yet): clearing a level for 3 stars shows `"★★★"`, and clearing the next one for 1 star
updates it to `"★☆☆"` rather than leaving the previous level's rating on screen.

---

## 2026-08-21 — Per-level star ratings (#83)

### Fixed

Once a level is unlocked (#46), it's now graded 1-3 stars on how well it was cleared, shown next to
its number in level select. `startLevel()` captures `state.levelStartScore = state.score` so
`checkLevelClear()` can isolate what the level just finished actually earned
(`state.score - state.levelStartScore`) from the run's cumulative score. `starsForClear()` rates that
against `CONFIG.progression.starThresholds`, expressed as a multiple of `levelMultiplier()` rather than
a fixed number, so the same raw score reads as fewer stars on a late level than an early one — matching
how brick value itself scales (#41). `recordLevelClear()` now takes the computed rating and folds it
into the same `{level}` record `#46` already persists under `LEVELS_KEY`, raising a level's stored
rating only ever up, never down, on a replay. `renderLevelSelect()` shows it as "★"/"☆" repeated per
star, the same plain-glyph convention as the "?"/"X"/"R" brick markers elsewhere rather than a new icon.

### Tests

Three new cases in `regressions.js` (`#83a`, `#83b`, `#83c`), confirmed failing first against the
unfixed code: a worse replay never lowers an already-earned rating and a better one raises it; the
same absolute per-level score earns fewer stars on a late, high-multiplier level than an early one;
and a level cleared right after a huge cumulative score is rated on what it alone earned, not inflated
by the run so far.

---

## 2026-08-21 — Negative power-up counterplay (#57)

### Fixed

`narrow` and `fast` power-ups used to just happen to you, with no way to see one coming and avoid it
short of dodging the paddle out of the way. `updateLasers()` gained a third pass — after the existing
brick and boss-part checks — that sweeps a bolt against `state.drops` and destroys the first `!good`
one it overlaps, using the same ±10px hit box `updateDrops()` already uses against the paddle. A hit
splices the drop, bursts in the drop's own colour, and plays a distinct "denied" tone; good drops
(`widen`, `life`, and the rest) are untouchable by design, and a kill scores nothing — this is
defence, not offence.

### Tests

Two new cases in `regressions.js` (`#57a`, `#57b`), confirmed failing first against the unfixed code:
a laser bolt destroys a falling `narrow` drop before it lands, and a bolt passes through a falling
`widen` drop untouched.

---

## 2026-08-21 — Resume an interrupted run (#64)

### Fixed

A full campaign is 100 levels — one to two hours in a single sitting — and until now nothing survived
past `state`, which lives only in memory: closing the tab or letting the OS kill a backgrounded one
cost the whole run. Pausing now snapshots the plain-data slice of a run that can't be reconstructed
from the level index or safely discarded (levels/bricks/balls/effects/`achStats`/the boss fight/the
session token) to a new `blokrush-resume` key, and boot restores it straight into the pause screen
instead of the start screen when one exists.

The snapshot is taken by a guard inside `setPhase()` itself (transitioning into `"paused"` from any
phase a run is actually live in), so manual pause, `autoPause()` on `visibilitychange`/`blur`, and the
developer level-jump's "paused" return path all cover it for free, with a `pagehide` listener as a
second line of defense for the browser shells that don't reliably fire `visibilitychange` before
teardown. The session token is restored verbatim rather than refreshed, so a resumed run is still
dated from when it actually started for `functions/api/scores.js`'s age check. A resumed run stays
hall-of-fame eligible — it never touches `jumped`, unlike a level-jumped run. The pause overlay grew a
second, `hidden`-by-default button, shown only on the screen a restore landed on, for the one case
where continuing isn't wanted: drop the snapshot and start fresh.

### Tests

Five new cases in `regressions.js` (`#64a`-`#64e`), confirmed failing first against the unfixed code:
the full round-trip (a damaged brick, an active effect, the live ball's exact position/velocity)
survives a save-then-reboot; the literal session token survives without boot refetching the board;
malformed `blokrush-resume` storage degrades to an ordinary boot; `jumped` stays `false` through a
restore so hall-of-fame eligibility is unaffected; and `newGame()`/`endGame()` both clear the saved
snapshot.

## 2026-08-21 — Omega's phase-2 blink never actually teleported (#93)

### Fixed

`cycleBlink()` teleports a part to a new x each time it comes back — Phantom (level 70) relies on
exactly that. Omega's phase 2 called it too, but immediately ran `sideToSide` on the same part with
half-field bounds, which clamped the teleport away in the same frame: the half reappeared at
whichever lane edge was nearest instead of somewhere new, and the second half was never passed to
`cycleBlink` at all.

The opposed sliding was already phase 2's more distinctive motion, so `cycleBlink()` now takes an
optional `teleport` flag (default on, so Phantom's call is unchanged) and Omega's phase 2 passes
`false` — the blink still drives the solid/vulnerable timing for both halves, it just no longer
fights its own sliding for control of their position.

## 2026-08-21 — Endpoint and CI hardening (#92)

### Fixed

**Three small, unrelated gaps, closed together.**

`POST /api/scores` now rejects any request whose `content-type` doesn't start with
`application/json` before it even parses the body — blocking the plain-form-POST shape that let a
cross-origin page drive a visitor's browser into submitting a score under that visitor's IP, with no
CORS preflight involved and no way for the attacker to read the response either way.

The rate-limit check and its insert were a `SELECT COUNT(*)` followed by a separate `INSERT`, so two
POSTs from the same IP arriving together could both read the same count and both pass. They're now
one D1 statement — `INSERT INTO submissions ... SELECT ?, ? WHERE (SELECT COUNT(*) ...) < ?` — gated
on whether the insert actually happened rather than on a count read moments earlier.

`.github/workflows/test.yml` declared no `permissions:` block, so `GITHUB_TOKEN` got the repository's
default (often broader) permissions for a workflow that only runs `node test/run.js`. It now declares
`permissions: contents: read` at the workflow level.

### Tests

Three new cases in `regressions.js`, confirmed failing first against the unfixed files. Following
`#90`/`#91`'s source-text pattern (`scores.js`'s ES-module shape still has no runtime harness — see
that entry's note): one confirms the content-type check, one confirms the combined
`INSERT ... SELECT ... WHERE ... COUNT(*)` statement replaced the old two-step read, one confirms
`test.yml` declares the permissions block.

---

## 2026-08-21 — `submissions` grew without bound and wasn't counted until after the score landed (#91)

### Fixed

**The rate-limit log no longer grows forever, and a failed submission no longer skips it.**
`submissions` existed purely to back a 10-minute rate-limit window — [schema.sql](../schema.sql)'s
own comment says its rows "may be pruned freely" — but nothing ever pruned them, so on a database
#67 forbids resetting the table grew without bound for data whose useful life is ten minutes.

`onRequestPost` now opens its D1 `try` block with `DELETE FROM submissions WHERE created_at < ?`,
bound to the start of the current rate window, so every request that already touches the table
trims it back to real traffic — no cron, no second entry point.

Separately, the `INSERT` into `submissions` ran *after* the `INSERT` into `scores`, so anything that
failed between them — including the `UNIQUE`-constraint replay rejection the `catch` below expects —
stored a score without it ever counting against the submitting IP's rate limit. The two inserts are
now swapped: `submissions` is written first, so a rejected or replayed submission still costs the
attacker a rate-limit slot.

### Tests

One new case in `regressions.js`, confirmed failing first (neither the prune statement nor the
reordered inserts existed on the unfixed file). It reads `scores.js`'s source text — the same
`require()`-can't-load-an-ES-module workaround `#90` used — confirms the `DELETE FROM submissions`
statement exists, and asserts the `submissions` insert's source position precedes the `scores`
insert's.

---

## 2026-08-21 — The scoring-rate ceiling stopped binding after ~2h47m (#90)

### Fixed

**A stale hall-of-fame token could no longer skip the scoring-rate check just by being old.**
`onRequestPost` rejected a submission when its score implied more than `MAX_POINTS_PER_SEC`, using
the token's age to derive the allowed ceiling — and separately rejected anything over the flat
`ABSOLUTE_MAX_SCORE`. With the shipped constants those two crossed at exactly 10,000 seconds (2h47m):
past that age the rate formula's own threshold already exceeded the absolute cap, so the rate check
stopped rejecting anything for the remaining ~21 hours of `TOKEN_MAX_AGE_MS`'s 24-hour window — dead
code disguised as a live envelope.

`RATE_CHECK_MAX_AGE_MS` now caps the age the rate formula uses (not the token's actual age, and not
`TOKEN_MAX_AGE_MS` itself) at that same crossing point, so the rate check stays meaningful for a
token's whole redemption window instead of quietly giving up partway through it. `TOKEN_MAX_AGE_MS`
is untouched — shortening it instead would have closed the same gap but taken #64's
resume-after-a-break case down with it.

### Tests

One new case in `regressions.js`, confirmed failing first (`RATE_CHECK_MAX_AGE_MS` didn't exist on
the unfixed file). It reads `MAX_POINTS_PER_SEC`, `ABSOLUTE_MAX_SCORE`, `TOKEN_MAX_AGE_MS`, and the
new cap out of `scores.js`'s source text — the file is an ES module the test can't `require()`
directly — confirms the rate check now references the cap, and asserts the oldest redeemable token's
threshold lands exactly on `ABSOLUTE_MAX_SCORE` instead of past it.

**Doc anchors across `done.md` and `todo.md` were re-anchored** by the net +12 lines this added to
`functions/api/scores.js`, per the re-anchoring discipline both files describe.

---

## 2026-08-21 — The profanity filter renamed ordinary people (#89)

### Fixed

**The hall-of-fame name filter no longer fires from inside an unrelated word.** `isProfaneName()`
matched every root in `PROFANITY_LIST` as a plain substring of the normalised name, and
`normalizeForProfanity()` stripped every space and punctuation mark before the check ran — which is
what let `#77`'s spacing/leetspeak evasions (`s e x`, `a55`) work, but also meant any name that merely
*contained* a three-or-four-letter root got silently renamed `"Bisounours"`: `Computer` (`pute`),
`Cassandra` (`ass`), `Hitchcock` (`cock`), `Dickens` (`dick`), `Essex` (`sex`), `Analyst` (`anal`), and
others, with nothing on screen explaining why. On the world board that substitution is permanent —
`#67`'s standing requirement is that `scores` is never reset.

Each root in `PROFANITY_LIST` now has to land on a letter boundary — string start/end, or any
non-letter — on both sides, so it can only match a whole run of letters and never a substring
straddling part of one word and part of another. `normalizeForProfanity()` still folds leetspeak and
accents, but keeps spaces and punctuation instead of deleting them: they're the separators the
boundary check relies on, and an optional run of them between a root's own letters is what keeps the
`#77` evasions matching as a single word. The trade-off: symmetric boundaries drop the "for free"
suffix/plural coverage a bare substring match had, so `asses`/`asshole` are now listed next to `ass`
explicitly. The mirror in `functions/api/scores.js` got the identical change, since `POST /api/scores`
is public and reachable directly, and the two lists must keep judging a name the same way.

### Tests

Three new cases in `regressions.js`, two confirmed failing first. `#89a` submits the six ordinary
names above and asserts each lands on the board under its own name. `#89b` re-submits `#77`'s own
evasions plus a suffixed root (`asshole`) and asserts all five still get swapped for the fallback name.
`#89c` extracts both `PROFANITY_LIST` array literals as text and asserts they stay identical,
word-for-word and in order.

**Doc anchors across `done.md` and `todo.md` were re-anchored** by the net +10 lines this added to
`index.html` (+17 to `functions/api/scores.js`), per the re-anchoring discipline both files describe.

---

## 2026-08-21 — Leviathan's telegraph was invisible (#88)

### Fixed

**A telegraphed boss shot now warns before it's live, whichever shape it is.** `drawBossShots()` only
applied the warning treatment (`globalAlpha` down to `0.35`) inside its `kind === "beam"` branch; the
`else` branch, which draws every other shot — including Leviathan's `drop` — ignored `s.telegraph`
entirely and always drew at full opacity. Leviathan's shot is the only hazard in the game that costs a
life outright, and its whole second of telegraph time is meant to make that read as fair — instead it
was pixel-identical to a live, incoming shot for that entire second.

`warn = s.telegraph > 0` is now computed once, above the `kind` branch, and both branches read it: the
beam branch unchanged, the `else` branch newly dropping to the same `0.35` alpha while still
telegraphed.

### Tests

One new case in `regressions.js`, confirmed failing first. It parks a `kind: "drop"` shot with
`telegraph: 1.0`, records one frame's canvas ops, and asserts a `fill` was logged at `globalAlpha ===
0.35` and none at full opacity.

**Doc anchors across `done.md` and `todo.md` were re-anchored** by the one line this added to
`index.html`, per the re-anchoring discipline both files describe.

---

## 2026-08-21 — Minions detonated on the paddle line, not on the paddle (#87)

### Fixed

**A minion now only detonates `narrow` when it actually overlaps the paddle, not merely its height.**
`updateMinions()`'s hit test checked `m.y + m.r >= state.paddle.y` and nothing else, so a minion
reaching the paddle's height applied `narrow` regardless of where it was across the field —
`updateBossShots()` already tested both axes for the other hazard shape, so this was the odd one out.
Hive's pairs, Phantom's explosives, and Omega's third phase all landed their `narrow` unconditionally;
the ball was the only counterplay, even though minions are drawn as objects that drift on their own
`vx` specifically so a player can dodge them.

The open question the finding raised — whether a clean dodge should still cost something — is settled
as no: a minion that clears the paddle line without overlapping it just despawns, silently, with no
effect and no sound.

### Tests

One new case in `boss.js`, confirmed failing first (`narrow` applied from 200px away). It parks a
falling minion off to the side of the paddle, freezes the ball (`attached = true`) so a lost life
can't clear the minions out from under the assertion for the wrong reason, runs frames until the
minion despawns on its own, and asserts no score and no `widthEffect`. The existing positive-case test
was updated to place its minion over the paddle explicitly, since it previously relied on the bug to
pass.

**Doc anchors across `done.md` and `todo.md` were re-anchored** by the +7 lines this added to
`index.html`, per the re-anchoring discipline both files describe.

---

## 2026-08-21 — A life lost to a boss hazard was invisible to the achievement roster (#86)

### Fixed

**A `"life"` boss hazard now counts as a lost life for achievements, not just for `state.lives`.**
`applyBossHazard`'s `"life"` branch decremented `state.lives` directly and never touched
`state.achStats`, while `loseLife()` — the only other thing that takes a life — increments
`ballsLost` and `levelLosses` right at the top. Those two counters back four achievements:
"Untouchable" (`ballsLost === 0`), "Flawless Victory" (`levelLosses === 0` at a boss kill), and
"Clean Sheet"/"Iron Ten" via `cleanStreak`. Leviathan (level 90) is the only boss that fires this
hazard, and it cost a whole life for free as far as the roster was concerned — including on
"Untouchable", the hardest tier-4 entry.

The fix increments both counters from the `"life"` branch itself and leaves `loseLife()` and the
field names alone; the branch still calls `endGame(false)` directly rather than routing through
`loseLife()`, since there is no ball for #71's `lifelost` beat to hold for.

### Tests

Two new cases in `regressions.js`, both watched failing first. `#86a` drives a Leviathan `"life"`
shot into the paddle and asserts `achStats.ballsLost` and `achStats.levelLosses` each rise by
exactly one. `#86b` takes the same hazard and then beats the boss for real, asserting
`achStats.flawlessBoss` stays `false`.

**Doc anchors across `done.md` and `todo.md` were re-anchored** by the +6 lines this added to
`index.html`, per the re-anchoring discipline both files describe.

---

## 2026-08-21 — Every boss is drawn with the previous shape's colour (#85)

### Fixed

**Each of the ten boss fights now has its own colour.** Seven draw sites read `def.color`/`def.glow`
and no entry in `BOSSES` ever defined either. Assigning `undefined` to `fillStyle`/`shadowColor` is
not an error — the canvas silently ignores it — so a boss body, its hp strip, its hit bursts and
#79's death-beat lightning were all painted in whatever fill the brick layer happened to leave
behind on the way past, and the neon glow the rest of the game is built on was missing entirely from
the one entity that most needs to stand out. The only part that read correctly was an *in*vulnerable
one, because that colour is a literal.

The fix is data, not defensive call sites: every entry now carries a `color`/`glow` pair, the way
`BRICK_COLOR` and `POWERUPS` already do. Hues are spread across the wheel rather than themed to the
act — Sentinel cyan, Salvo orange, Carapace jade, Gemini violet, Aegis gold, Hive chartreuse,
Phantom pale lilac (washed out on purpose: it fades in and out), Mirage magenta, Leviathan deep
blue, Omega red — so no two of the ten read as the same fight.

### Tests

Two new cases in `regressions.js`, both watched failing first. `#85a` is the data guard: every entry
defines a non-empty `color` and `glow`, and no two share a `color`. `#85b` reads the draw path
itself — it records one frame of the Sentinel fight, finds the `fillRect` that painted the body, and
asserts a fill and a shadow colour were set for it and are the ones the roster defines.

**New harness seam:** `handle.recordCanvas()` in [dom-stub.js](../test/dom-stub.js) opens a log of
canvas ops (`{ op, args }` plus the fill/stroke/shadow/alpha in force at the time). It is off unless
a test asks for it, since a single frame appends hundreds of entries.

**Doc anchors across `done.md` and `todo.md` were re-anchored** by the +19 lines this added to
`index.html`, per the re-anchoring discipline both files describe.

---

## 2026-08-21 — Gemini's split halves are indexed off by one (#84)

### Fixed

**Both halves of the level-40 boss now fight.** Gemini opens as a single body and splits into two
half-width bodies when it goes down, each meant to slide in opposition across its own side of the
field. `onPartDown` pushes the halves onto the array the spent body is still in — `[body, left,
right]` — but `update` addressed `parts[0]`/`parts[1]` as though they were the two halves. `parts[0]`
was the dead body, skipped by its own `alive` guard; `parts[1]` was the *left* half and was handed
the *right* half's bounds, so it jumped across the midpoint on its first frame; `parts[2]`, the right
half, was never updated at all and stood still for the whole fight. Both halves therefore ended up
crowded into the right quarter of the field, one of them frozen — the "two targets moving in
opposition" the fight is built around never happened at any point since #44 shipped.

`update` now uses `parts[1]`/`parts[2]`, matching the indexing `fire` already used. The spent body
stays in `parts` deliberately: `bossBounds()` unions over dead parts so that #79's death beat is
anchored on the boss's real geometry, which splicing would take away.

**Nothing else in the fight changed.** `hpTotal` is still snapshotted at spawn over the single body,
so #80's music progress still dips when the split adds parts — documented behaviour, not a second bug.

### Tests

Two new cases in `regressions.js`, both watched failing first. `#84a` splits the boss through the
real `bossPartHit()`/`onPartDown()` path, then asserts lane containment every frame for two seconds
*and* that both halves actually moved — the second half of that is what catches the frozen one.
`#84b` is the structural guard: it collects the parts `update()` moves and the parts `fire()` shoots
from and asserts the two sets are equal, so re-introducing the skew in one function alone fails even
when each function is internally consistent.

**Doc anchors across `done.md` and `todo.md` were re-anchored** by the +6 lines this added to
`index.html`, per the re-anchoring discipline both files describe.

---

## 2026-08-21 — Rename `neonbreak-*` to `blokrush-*` (#82)

### Fixed

**The `localStorage` namespace is now `blokrush-*`.** The reasoning that previously kept the old
`neonbreak-*` keys in place — renaming would orphan an existing player's save — no longer held: the
game has never shipped to production, so there was no installed base to strand. All six keys
(`BEST_KEY`, `LANG_KEY`, `MUTED_KEY`, `HOF_KEY`, `ACH_KEY`, `LEVELS_KEY`) moved in one change, along
with `persistence.js`'s structural `^neonbreak-` namespace assertion (now `^blokrush-`) and every test
fixture across the suite that seeded or asserted a literal `neonbreak-*` key. [CLAUDE.md](../CLAUDE.md)
and [docs/testing.md](testing.md) were reworded to match — the "leave them named `neonbreak-*`"
guidance no longer applies.

**Note for #46's entry above:** it shipped earlier the same day and, per its own write-up, used
`neonbreak-levels` because #82 hadn't landed yet. That key moved along with the rest here.

---

## 2026-08-21 — Level select (#46)

### Fixed

**A level unlocks once its predecessor is cleared, and a new screen lets a player replay any level
already earned.** `checkLevelClear()` now records the level just finished (`recordLevelClear()`,
`neonbreak-levels` in storage) the moment its clear is settled, so the campaign's last level unlocks
too. `isLevelUnlocked()` reads that record back: level 1 is always open, and each further level opens
once the one before it has a record — replaying an already-unlocked level is a no-op on it, never a
regression.

**A new `overlay-levelselect`, reached the same way the achievements roster is** — a ghost button next
to `btn-view-hof`/`btn-view-ach` on the start screen and both end screens. Its 100 rows are real
`<button>` elements rather than an `innerHTML`-rendered list like the board or the roster: a locked row
is a genuinely disabled button (out of tab order, read as unavailable by a screen reader), not one
merely styled to look inert. Selecting an unlocked row reuses #69's developer-jump machinery —
`submitLevelJump()` was split to share a new `jumpToLevel(idx, preserveRun)` with the new
`selectLevel()`, both setting `state.jumped = true` — so a level-select run is excluded from the hall
of fame and the best score exactly like a chord-jumped one, and level select can never be used to grind
the world board from a late level.

**Persistence deviates from the original write-up in one place.** The finding anticipated the
`blokrush-` namespace #82 (the `neonbreak-*` → `blokrush-*` rename) would establish; #82 hasn't shipped
yet, so the new key follows the namespace `persistence.js` actually asserts today, `neonbreak-levels`.

**Follow-up: the grid now shows all 100 levels at once, no scrollbar.** The first cut capped the list
at `max-height: 46%` with `overflow-y: auto`, matching `.ach-list` — with an `auto-fill` grid at that
width, most of the 100 rows landed below the fold. Switched to a fixed 10-column grid sized to fit all
of them: cells shrink with the available width instead of wrapping into an eleventh row.

---

## 2026-08-20 — Magnet paddle and hold-to-slow bullet time (#55)

### Fixed

**Two new skill-reward mechanics, both aimed at the long do-nothing descent after a top-wall bounce.**
`magnet` is a new good power-up: while `state.magnetEffect` is active, a descending ball's angle bends
gently toward the paddle's centre each frame — implemented by rotating the existing `dx`/`dy` angle by
a clamped step and converting back with `Math.cos`/`Math.sin`, which keeps `dx*dx + dy*dy == 1` by
construction rather than by discipline. It gets its own `.effect-bar` slot, the sixth; two bars still
fit each wrapped row at the narrowest supported width, so the row's reserved height didn't need to
grow past #53's.

**Hold-to-slow ("bullet time") is always available, not a pickup.** Holding `Shift` (or a new on-screen
button, whose own fill doubles as the meter) drops `ballSpeedMult()` while a meter — 3 seconds of hold,
recharging at half that rate once released — has charge left. It stacks with the existing `slow`/`fast`
power-up rather than replacing it.

**A flicker at the meter's floor, caught by its own test.** The first cut turned the slow-down off the
instant the meter hit exactly zero even with the button still held, which let a fraction of a frame's
recharge sneak in — then drained it straight back down next frame, oscillating between 0 and one
frame's worth of recharge for as long as the button stayed pressed. Separating "is the button held"
from "is the slow-down actually active" (the latter alone gating `ballSpeedMult()`) fixed it: draining
only ever goes one direction while held, all the way to a stable zero.

---

## 2026-08-20 — Safety-net shield power-up (#54)

### Fixed

**A new good power-up, `shield`, turns the next ball lost off the bottom into a bounce instead of a
life.** Armed by `state.shieldEffect`, a plain flag rather than a `{remaining}` duration — it decays by
use, not by time, so it sits outside `updateEffects()`'s countdown loop entirely. The save itself is a
single guard added to `updateBalls()`'s existing bottom-loss check: while armed, the ball that would
have been spliced out is reflected back up instead and the combo resets the way a real paddle touch
does, then the shield is consumed. Only the first ball to cross the floor in a given frame gets saved;
any others that frame are lost as usual. `resetPaddleAndBall()` clears an unused shield on every fresh
life, so it can't be hoarded across lives.

**Its "armed" state gets a static badge, not a duration bar.** With nothing to shrink, it doesn't join
`.effect-bars` — instead a small shield icon appears in the corner of the lives HUD cell, shown and
hidden by `updateHud()`, absolutely positioned so the toggle never resizes the shared HUD row.

**Incidental fallout:** adding a new entry to `POWERUPS` reweights the table `rollPowerup()` draws
against, which shifted which power-up a given random draw resolves to deep into a run — enough to
change the outcome of `#52d`'s seeded 40-second mystery-brick test. Its seed moved from 999 to 998 to
keep exercising the case it's meant to cover.

---

## 2026-08-19 — A short fanfare on level clear (#81)

### Fixed

**An ordinary (non-boss) level clear now has a sound of its own.** `checkLevelClear()`'s non-boss
branch used to go straight to `setPhase("levelclear")` with nothing played. It now fires a ~2-second
multi-instrument fanfare first, built by reusing #74's `BOSS_FANFARE` machinery — the same layered
sawtooth call, octave-down bass, third-above pad, and kick/hat percussion, scheduled against the audio
clock and resolved through the level's own scale. Trimmed down from `BOSS_FANFARE`'s two-bar call plus
flourish to one rising call and a final chord, so it reads as belonging to the same score without
running anywhere near as long. Like the boss fanfare and the ball-loss sting, it's always the same
fixed figure — a recognizable stinger, not one that varies with combo, score, or difficulty.

**Guarded against stacking with a boss kill's own celebration.** A boss level already gets a longer
fanfare plus its own explosion sound from the death beat before `checkLevelClear()` ever reaches the
non-boss branch for that level, so the new call is conditioned on `!isBossLevel(state.levelIndex)`.

---

## 2026-08-19 — Music intensity driven by level progress, not combo (#80)

### Fixed

**The music bed's arrangement now tracks how close the level is to clear, instead of a combo
streak.** `nextIntensity()` used to read `state.combo` against fixed thresholds — a voice joined the
instant a streak reached it and left slowly once the streak broke — which rewarded breaking bricks
fast without a paddle touch in between, rather than actual progress. It now computes progress as
`1 - remainingBricks / levelBrickTotal` (a new field set once per level alongside the existing live
count) and walks the same kind of thresholds against that fraction instead, so the arrangement builds
toward the last few bricks whether or not the player is on a streak. The decay that eases a voice back
out is unchanged, so a regenerating brick thins the bed gradually rather than yanking a voice the
instant it comes back.

**Boss levels — which have no bricks to count — read the fight's own health instead.** The boss's
starting hit points are snapshotted once when it spawns; `nextIntensity()` branches on `state.boss`
and reads the fraction of that total still standing, the same guard `checkLevelClear()` already uses
to treat a boss level as a special case. A fight that adds parts mid-way (a split enemy) dips progress
the same way a regenerating brick does, eased back up rather than jumped.

A new one-line accessor exposes the bed's live intensity to tests directly, since the internal `music`
object is reassigned wholesale on every serve and level break. Four new regression cases replace the
old combo-driven one, and four existing cases that used to force a full arrangement with a maxed-out
combo were updated to do it via progress instead.

---

## 2026-08-19 — Fireball power-up (#53)

### Fixed

**A ninth power-up: a timed effect that ploughs the ball through ordinary and silver bricks instead
of bouncing off the first one it touches.** `updateBalls()`'s brick collision used to pick exactly one
brick per ball per frame — whichever it penetrated least — so a ball couldn't take out more than one
brick in a single frame even lined up straight through a column. While fireball is active, every alive
brick the ball overlaps that frame goes down outright, with no bounce, and the ball keeps travelling.

**Indestructible walls and boss parts are the two things it still can't get through.** A `"#"` wall
still bounces a fireball ball exactly like a normal one, and a boss fight is completely unaffected —
plowing through either would trivialise walls-as-obstacles and boss fights outright, so both paths were
left untouched.

**A fireball ball also looks different.** It's the first power-up to change ball appearance rather than
paddle or ball behaviour: while active, every ball on screen swaps its usual white fill/glow for a warm
flame palette, so ploughing through a column reads as distinct from an ordinary bounce landing on the
same brick. A fifth `.effect-bars` slot shows the remaining time, and the container's reserved height
grew to fit a third wrapped row on narrow viewports.

---

## 2026-08-18 — A boss kill's death beat gets its own music, explosion and sound (#79)

### Fixed

**Three related gaps in the #74 death beat, all landing on the same moment.** The main music bed used
to keep looping straight through the explosion and the fanfare instead of ducking out for them —
`updateMusic()` gated only on the game phase, and the beat deliberately stays in `"playing"` (there's
no paddle or ball to freeze around otherwise), so it fell straight through that guard. It now also
checks whether a death beat is running and stops scheduling for as long as it is.

**The explosion is anchored on the boss, not the center of the screen.** Both the escalating pulses and
the finishing blast used to burst at `GAME_W / 2, GAME_H / 2` regardless of where the boss's parts
actually stood, so the fireworks landed next to it rather than on it whenever a boss wasn't centered.
They now scatter across the boss's own bounding box, captured once when the kill lands (parts hold
still for the rest of the beat, so one snapshot stays valid throughout).

**The explosion also has a distinct look and its own sound.** A new warm-flame particle burst — shorter
life, a fixed warm palette, a soft glow — replaces the plain reused hit-effect for both the pulses and
the finishing blast, and the finishing blast now also throws a handful of jagged lightning bolts
outward from the boss. The blast itself was silent before; it now fires a layered explosion sound (a
low rumble, a sharper crack on top, a short pitch-drop underneath) alongside the fanfare that follows
it.

---

## 2026-08-18 — Hall of fame names are checked for profanity (#77)

### Fixed

**A name matching a profanity/slur list is now silently swapped for a fixed placeholder, "Bisounours",
before it reaches either board.** Nothing previously filtered what an entered name actually said —
only control characters and length were enforced. The check normalizes the name first (folding
leetspeak look-alikes like `a55` to their letter, folds French accented letters to their plain
equivalent (`nègre` → `negre`) so they don't dodge the filter by evading the `a`-`z` match entirely,
then drops any remaining spacing/punctuation so tricks like `s e x` can't dodge it by splitting a word
across the gap) and matches the result against a self-hosted word list covering both languages the
game ships in, root words rather than an exhaustive one so suffixes and plurals are caught for free. A
match doesn't reject the submission the way an under-length one does (#76) — it substitutes silently,
since the name itself is otherwise well-formed.

The check runs independently in both places a name can land: `index.html`'s local-board path, and
`functions/api/scores.js`'s `POST /api/scores` handler for the global board, since that endpoint is
public and reachable directly, bypassing any client-side check entirely. The word list and
normalization logic are mirrored verbatim between the two files, the same "restated in both places"
arrangement `NAME_MAX` already has.

### Notes

A self-hosted list was chosen over an external moderation API to avoid adding a network dependency (and
a new failure mode) to a backend that's explicitly allowed to degrade to "the leaderboard is empty",
not to "the leaderboard rejects everyone."

---

## 2026-08-18 — Hall of fame names have a floor as well as a ceiling (#76)

### Fixed

**A name shorter than 3 characters — including a blank submission — is now rejected instead of being
saved.** `submitHallOfFameName()` used to silently swap an empty trim for a `"???"` placeholder and
placed no lower bound on anything else, so `"x"` or `"ab"` went onto the board exactly as typed. It
now blocks submission below the 3-character minimum, leaves the player on the name-entry screen, and
shows an inline message explaining why — the submit button and the input's Enter key both go through
the same check, so neither can accept what the other rejects.

**The maximum name length is now 16 characters, up from 12** — raised in the client
(`CONFIG.hallOfFame.nameMax`, mirrored in the input's `maxlength`) and in the global board's own
`NAME_MAX`, which used to re-clamp independently at the old limit of 12 and would otherwise have
truncated a 13-16 character name on the global board while showing it in full on the local one.

### Notes

The now-unreachable `nameentry.anonymous` placeholder string was removed from both language tables.

---

## 2026-08-17 — Effect bars show the power-up's name, not just a letter (#78)

### Fixed

**The widen/narrow, slow/fast, sticky and laser timer bars now show the power-up's whole name**
directly on the bar, not a bare `W`/`N`/`S`/`F`/`St`/`L`. Long names clip with an ellipsis on a
narrow bar rather than spilling out of it; hovering or focusing a clipped bar reveals the full name
via its `title`. Six new strings (`powerup.widen`/`narrow`/`slow`/`fast`/`sticky`/`laser`) were added
to both language tables; `multi` and `life` have no timer bar, so they got no entry.

### Notes

`bar-sticky`/`bar-laser` used to hard-code their letter directly in the markup instead of going
through a label element like width/speed did; both now route through one the same way, so all four
bars reach their name through the same code path.

---

## 2026-08-17 — The power-up timer bars stay below the canvas at every width (#75)

### Fixed

**The effect-bars sidebar no longer floats beside the canvas on a normal-width window.** #37 had put
the widen/narrow, slow/fast, sticky and laser countdown bars in an 84px column to the right of the
canvas so a slot appearing or disappearing mid-rally couldn't shove the canvas — but on any desktop
or tablet-width browser that read as a misplaced sidebar rather than a deliberate layout, and a phone
was the only width that got the bars where a player would expect them, below the play field.

The bars now sit below the canvas at every width, not just on a phone: a fixed, reserved row height
(sized for the worst-case two-row wrap of all four bars) keeps #37's original guarantee — a timer
slot toggling never moves the canvas — without needing a side column to do it. That also closes the
narrow-viewport trade-off #37 had explicitly accepted: small phones no longer get a canvas-shift
either, since the reserved height applies everywhere now instead of only above a breakpoint.

### Notes

CSS-only; `fitCanvas()` (#17) already re-derives the canvas's backing-store size from its displayed
width every resize, so nothing in JS needed to change.

---

## 2026-08-17 — A boss kill deserves more than a shake (#74)

### Added

**The boss now visibly comes apart before the level clears.** A silent burst of escalating particle
pulses — bigger and more frequent for a bigger boss — culminating in one big blast, then a fanfare,
and only once the fanfare finishes does "level cleared" appear. The field holds still throughout: no
paddle, no ball, nothing left to hit anyway.

**A five-second victory fanfare**, playing once per boss defeated: a rising call played twice,
climbing an octave, a quick descending flourish, and a final chord that rings out. Several
instruments layer on the same beats — the melody doubled an octave down for weight, a harmony voice
above it, and the same kick/hat percussion the ordinary music bed already uses — so it sounds like
part of the score rather than a jingle dropped on top of it. Pitched from whichever act's musical
scale the level sits in.

### Fixed

A first version of this shipped earlier the same day and was reverted within the hour: it scored the
explosion, the fanfare, and the level-clear transition in parallel rather than in sequence, so
"level cleared" appeared instantly and the fanfare played out behind it rather than before it. Caught
in manual testing. This entry is the corrected, sequenced version.

### Notes

Presentation only, same rule as #58 and #65: the score, the kill bonus, and the achievement stats are
all settled before the celebration starts, so a seeded fight's outcome never depends on whether the
beat is watched in full.

---

## 2026-08-17 — Ten boss levels (#44)

### Added

**Boss fights at levels 10, 20, … 100**, replacing the brick grid that used to sit there — Sentinel,
Salvo, Carapace, Gemini, Aegis, The Hive, Phantom, Mirage, Leviathan, and Omega for the campaign's
last level. Each adds exactly one new idea and keeps the ones before it: dodging a falling shot,
opening a plated core's vulnerability window and keeping it open, splitting into two targets, a
shielded rhythm that punishes standing still, a swarm of small minions the ball can also destroy, a
boss that blinks and passes through the ball while faded, one that tracks the paddle instead of a
fixed pattern, one that descends the arena as it takes damage, and a three-phase finale that
recombines the previous nine.

Beating one still awards the every-tenth-level extra life exactly as it always did, and the backdrop
and music were already on their darkest, heaviest act at every one of those levels — nothing about
the presentation had to learn what a boss is.

### Changed

**Level 10's hand-authored layout retired** — the `LEVELS` table now covers levels 1-9, with the
generated campaign's difficulty curve re-anchored to skip boss levels rather than counting them as
generated ones.

### Added (achievements)

Three new entries: beating your first boss, beating one without losing a ball that fight, and beating
all ten in a single run.

### Notes

Promoted from `feature-ideas.md` and expanded into a full ten-boss roster before being built — see
`done.md` for the roster and the design decisions behind it (why a boss's hit points survive a lost
ball, why cover bricks in a boss arena never gate the level, why Omega reuses rather than reinvents).

---

## 2026-08-16 — Achievements (#65)

### Added

**Twenty achievements**, reachable from the start screen and from both end screens. They span the
first minute of play to things nobody may ever manage: a combo of twenty-five without touching the
paddle, ten levels in a row without losing a ball, six bricks in one explosion, the campaign finished
without a single ball lost.

A third of them exist to point at parts of the game a player can otherwise finish the whole campaign
without noticing — that explosive bricks chain, that the purple ones come back, that mystery bricks
turn into something, that the laser exists at all. Locked entries show what they want rather than a
row of question marks.

**Unlocks appear as a banner** while you play, and the two end screens say how many the run unlocked
— a banner during play can't be seen from behind the game-over panel.

### Notes

They are **saved per browser**, like the best score and the local scoreboard: no accounts, and no
sync between your phone and your laptop. Clearing site data clears them. That is a deliberate
decision rather than an oversight — see the write-up in `done.md`.

**A run started with the level-jump shortcut unlocks nothing**, the same rule that keeps it off the
scoreboard, and the achievements screen says so rather than leaving it looking broken.

Nothing here changes how the game plays: no achievement awards points, lives or power-ups, and a
test asserts that an identical run produces an identical score, ball and brick state whether a dozen
unlock or none do. Unlocks are silent on purpose — they usually land in the middle of the combo
ladder, which is the sound you are actually listening to.

Eight regression cases, each confirmed failing before the feature existed.

## 2026-08-16 — The music stops repeating itself (#70)

### Changed

**The music was a two-second loop.** Sixteen steps, played over and over for however many minutes a
level lasts — and since the campaign is a hundred levels, that is a lot of the same two seconds. It
is now a fifteen-second phrase: eight bars, each with its own rhythm for each instrument and its own
chord, and a fill on the last bar that turns it back round.

**There are drums.** A kick on every bar whatever you are doing, and a hi-hat that arrives with a
streak — the first sound in the game that is noise rather than a tone. Having something else carry
the beat is what lets the melodic parts drop out for a bar without the whole thing falling apart,
which is most of what stops a loop sounding like a loop.

**Each act has its own music.** The backdrop already changes every two levels; the score now changes
with it — a different scale, a different tempo and different instruments, five acts before it comes
back round. Previously the only thing that changed from level to level was the key, which across a
level break is not something anyone can hear. The first act is exactly the music that was there
before.

The phrase also keeps its place across a lost ball or a level break, so dying repeatedly no longer
means hearing the first bar over and over.

### Notes

Nothing about how the game plays has changed: the bed reads the score and the combo, writes nothing,
and mute still covers all of it including the new percussion. It also still rolls no dice — the
noise the hat is made of is generated from a fixed seed, for the same reason the screen shake and
the starfield are: anything in the audio path drawing from the shared random stream would make
power-up drops depend on how long the music had been playing.

Four new regression cases, each confirmed failing against the old bed, on top of #59's seven, which
pass unchanged.

## 2026-08-16 — The end screens explain themselves (#72, #73)

### Fixed

**A run that used the level jump now says so when it ends.** Jumping to a level has always taken the
run out of the hall of fame — otherwise skipping to level 90, where bricks are worth twenty times
what they are at the start, would be the cheapest high score in the game. What it did not do was
mention it. The only notice was a line of small grey text on the jump prompt, read once and several
minutes before it mattered, so the end of the run looked exactly like the leaderboard being broken.
That is how it was reported.

The victory and game-over screens now carry the reason, and say that playing again gives an eligible
run — the exclusion has always been per run, not permanent. The warning on the jump prompt itself is
no longer the quietest thing on the overlay.

### Added

**A "high scores" button on both end screens.** The board used to be reachable only from the start
screen, so checking where a run landed cost a restart — which replaced the score you wanted to
compare against. The new button sits beside "Play again" and returns to the screen you came from.
Restart stays the default action on both screens.

It is also the only way a jumped run can reach the board at all, since it never gets the
name-entry detour.

### Notes

Six regression cases, each confirmed failing before the fix. The rule itself is unchanged: a jumped
run still sets neither the world board nor the local best score.

## 2026-08-15 — Losing a ball finally lands (#71)

### Added

**Missing the ball is an event now.** It used to be a small screen rattle and nothing else — no
particles, no sound, and the music simply stopped. The ball now bursts where it went out, white for
the ball itself and red for the life that went with it, over a short falling four-note sting pitched
in the level's own key so it lands in tune with the music that just cut out.

**The game holds a beat before serving again**, about three quarters of a second. That is the part
that made the rest possible: the loss used to resolve in the very frame it happened, so the ball
vanished and the "Ready?" prompt was already up, leaving nowhere for any of this to happen. The same
pause now precedes game over, which is the moment that deserves it most. The paddle still answers
during it — freezing input for most of a second reads as a stall.

### Notes

Under "reduce motion" the burst thins out and the shake stays off, but **the pause itself is
unchanged**. It is pacing rather than movement, and the game's rhythm should not depend on an
accessibility setting.

Nothing simulates during the pause — no ball, no scoring, no bricks moving — so this is presentation
over an unchanged game, the same footing as the screen shake and the music. Mute covers the sting
like every other sound.

Four regression cases, each verified against the mutation that should break it, plus two new test
helpers: a lost ball no longer resolving in one frame moved about thirty existing assertions, and
that is better handled once in the harness than thirty times by hand.

## 2026-08-15 — A level-jump shortcut for testing (#69)

### Added

**Holding S, E and B together opens a "jump to level" prompt** — from the menu, mid-game, from the
pause screen or from the hall of fame. Type a number between 1 and 100 and the game starts that
level; from there the run carries on exactly as it normally would, level by level, all the way to
the victory screen. `Enter` jumps, `Escape` backs out, and backing out mid-game leaves the game
paused rather than dropping you straight back into a live ball.

Since the campaign is 100 levels long, this is the difference between being able to look at level 84
and having to play to it.

### Notes

**A run started this way cannot enter the hall of fame, and does not set the best score** — the
prompt says so before you use it. The world leaderboard can never be reset and a level-90 brick is
worth nearly twice a level-10 one, so jumping to the end would otherwise be the cheapest high score
in the game. The flag is sticky: jumping once on level 3 keeps the whole run out, and only starting a
fresh game clears it. Jumping from the menu starts a new run; jumping mid-game keeps the score and
lives you already had.

This is not a hidden mode. The game is a single file of JavaScript anyone can read, so the shortcut
is a convenience for whoever is working on the game, not a secret and not a protected one.

Fixing this turned up a real bug in the overlay code: only buttons released keyboard focus when an
overlay closed, never text fields. It had never mattered, because the one existing text field always
handed off to a screen with a button. The jump prompt hands off to the "ready" screen, which has
none — so the field kept focus and swallowed the space bar, and the ball could not be launched from
the keyboard. Five regression cases, each verified against the mutation that should break it.

## 2026-08-15 — Level 10 was unfinishable (#68)

### Fixed

**Level 10 could not be cleared.** Its top two rows were offset by one, which walled each of the top
row's five silver bricks in on every side — walls left, right and below, the ceiling above. The ball
is too big to squeeze through a 3 px diagonal gap, so those five could never be hit by anything the
game has, and the level never registered as complete. The two rows are now aligned into wall and
silver pillars: same bricks, same count, same speed, but every silver has something breakable under
it.

Before the 100-level campaign this meant the game could not be won. After it, the run stopped dead
at level 10 with ninety levels behind it.

### Notes

Generated levels are already checked for this at generation time; hand-authored ones were not, so
the check now runs over those too, and a test pins the specific shape that caused it.

## 2026-08-15 — A 100-level campaign (#41)

### Added

**The game is 100 levels long.** It used to end after the ten hand-authored ones, about fifteen
minutes of play. Those ten are unchanged and still open the run; levels 11 to 100 are built from the
level number, and the run still finishes on the same `victory` screen it always did. There is no
endless mode — a run that ends is what keeps one global, never-reset leaderboard meaningful.

**Level 47 is level 47 for everybody.** Layouts are seeded from the level number, not rolled, so
every player meets the same board and a retry is a retry rather than a fresh shuffle.

**Levels are built from shapes, not noise** — solid bands, checker, columns, pyramid, diamond,
fortress, arch — each mirrored down the middle, which is most of what makes a layout read as drawn
by hand. Silver, walls, explosives, mystery and regenerating bricks arrive on a schedule as the
campaign deepens, so level 11 still plays like a level and level 90 does not look like level 11 with
more of everything.

**Clearing every tenth level hands back a life**, up to the usual maximum of five. Three lives across
a hundred levels is not a game.

### Notes

Speed rises toward a ceiling rather than climbing forever: 2.32× at level 20, 2.65× at 50, 2.78× at
100. Past a point, a faster ball stops being harder and starts being unreadable, so the back half of
the difficulty is carried by what the levels are made of. Brick value saturates the same way — a
level-100 brick is worth about twice a level-10 one, not ten times — and scoring through the first
ten levels is bit-for-bit what it was.

Every generated level is checked, at generation time, for bricks the ball could never reach; a wall
that would seal one off is downgraded until the layout is clearable. A brick you cannot hit is a run
that cannot end.

Two server-side limits moved with it: a finished 100-level run scores enough, fast enough, that the
old anti-forgery ceiling would have rejected it outright, and a run now takes long enough that the
old session window could expire mid-game. Scores already on the world board stay exactly as they
are; new runs simply score on a larger scale.

Eight regression cases, each verified against the mutation that should break it.

## 2026-08-15 — Per-act backdrops and parallax (#60)

### Added

**The background is no longer the same board every level.** The ten levels are grouped into five
acts of two, each with its own sky: violet night, teal abyss, ember, ice field, crimson void. Two
levels in, the field you are playing over has changed — progress you can see without reading the
HUD.

**A parallax star field drifts behind the play area**, three layers deep, with a slow horizon grid
scrolling over them. Nearer layers move faster, which is what gives the field depth rather than
just texture.

Brick colours are untouched, on purpose: a brick's colour is what tells you its type, so it is the
one thing that should never shift with the decor.

### Notes

Under `prefers-reduced-motion` the drift stops and the palette stays — an act still looks like its
own act, it just holds still — and it follows the setting being changed mid-session.

The star field is generated from the level number rather than rolled, so a level looks the same
every time you enter it. Rolling for it would also have put the paint into the same random stream
drop chances come out of, which is the trap the screen shake (#58) and the music (#59) already
avoid.

Four regression cases, each verified against the mutation that should break it.

## 2026-08-15 — Music and a richer sound bed (#59)

### Added

**The game has a soundtrack now, and it listens to how you are playing.** A four-voice loop runs
under the ball: a bass line always, and three more voices that join as a combo streak climbs and
drift back out once it breaks. Play well and the arrangement fills in; lose the ball and it thins
back to the bass.

**Every brick type has its own voice.** A wall thuds and refuses, silver rings, a mystery brick
sparkles upward as it resolves, an explosive drops through the floor of the mix. And consecutive
hits climb a pitch ladder — a long streak is now audible as a rising run, not just a rising number.

Each level plays in its own key, and the music, the brick voices and the ladder are all pitched
from it, so a hit lands in tune with what is behind it.

None of this is new UI or new files: it is still oscillators and the same Web Audio API the old
blips used, and the existing mute button covers all of it.

### Notes

Frames decide *what* to play; the audio clock decides *when*. A note placed at frame time lands
wherever the frame happened to fall — up to 16 ms off the beat at 60 Hz, which is audible — so the
loop queues steps a fraction of a second ahead and lets WebAudio place them.

A backgrounded tab leaves the audio clock tens of seconds ahead of the bar. The scheduler skips to
now instead of catching up: playing every missed beat at once would be a burst, not music.

The bed reads the game and writes none of it, and rolls no dice — the same discipline as #58's
impact layer, for the same reason: a note chosen randomly would make what the game rolls depend on
how long it had been playing.

The test harness now records every note the game schedules, so the voices, the ladder and the mute
behaviour are asserted against what would actually be heard rather than against a flag. Seven
regression cases, each verified against the mutation that should break it.

## 2026-08-14 — Impact feedback (#58)

### Added

**The screen shakes, time stops, and the paddle flinches.** An explosion kicks the camera and
freezes the game for about three frames; losing a ball shakes it harder and longer; every bounce off
the paddle flattens the paddle for a tenth of a second before it springs back. None of it changes
how the game plays — it is the layer of feedback that lands in the first hundred milliseconds of a
hit, which the particles and the floating score were never fast enough to cover.

All of it is off under `prefers-reduced-motion`, where explosions still explode and the game plays
identically — which is the point: the feedback layer is decoration over an unchanged simulation.

### Notes

The boundary between presentation and physics is enforced rather than described. The shake is a
single canvas translate wrapped around the whole scene, so nothing the game simulates moves because
of it, and the paddle's squash is applied to the drawn rectangle only — its collision box never
flexes, so it cannot become easier or harder to hit.

The shake offset is computed from its own timer rather than rolled. A `Math.random()` call inside
the paint would have made what the game rolls — drop chances, mystery resolutions — depend on how
many frames it happened to draw, and that would have surfaced much later as seeded tests that no
longer reproduce.

Hit-stop is set, not summed: a chain of five explosives freezes the game for exactly as long as one
does. Summed, a big cascade would read as a hang rather than as impact.

Six regression cases, each verified against the mutation that should break it.

## 2026-08-14 — Mystery bricks (#52)

### Added

**A `?` brick that could be anything.** It has no type until you hit it; the first strike resolves
it into an ordinary brick, silver, an explosive, a regenerator — or an indestructible wall, which is
the risk that makes hitting one a decision rather than a formality. The revealing hit then lands on
whatever it became, so a `?` that turns into an explosive goes off immediately, and one that turns
into a wall simply refuses. Eight are placed across levels 2, 5, 7, 9 and 10.

Ordinary bricks are weighted heavily, so most reveals are anticlimactic and the rare ones land. The
wall is rarest, being the only outcome that costs the player something permanently.

### Notes

The finding described this as a small change — one character in the level map and a resolve step.
It is one line longer than that, and the extra line prevents a softlock: a `?` is counted as
clearable when the level is built, because it has 1hp like anything else, so a `?` that resolves
into an indestructible wall has to come off the count as it resolves. Without that the level could
never reach zero and the run would sit there with nothing left to hit.

Five regression cases, each checked against a mutation that should break it, including that exact
softlock. Two of them depend on a seeded board producing a wall and a silver, so both now assert the
interesting case actually occurred — otherwise a future change to how randomness is consumed would
leave them passing while checking nothing.

Also fixed a wrong model in the tests: the first version of the counter helper treated a brick that
is down awaiting regeneration as still destroyable. It deliberately is not (#51) — that is what lets
a level clear while one is away. The helper was wrong, not the game.

---

## 2026-08-14 — Regenerating bricks, and silver you can read (#51)

### Added

**A new `R` brick that comes back.** Destroy it and it returns seven seconds later, up to three
times — so it is not a brick you clear, it is a brick you decide whether to deal with. A level ends
the moment nothing is standing, so the counter-play is to finish everything else while it is down
rather than to keep hitting it. Six are placed across levels 4, 7, 9 and 10.

While it is down, its cell is drawn as an outline that fills as the timer runs out. That is
deliberate: a brick that reappears from nowhere reads as a bug, and without the countdown a player
has nothing to judge "can I clear the rest in time?" against.

**Damaged silver now cracks.** It previously signalled damage only by swapping one grey for another
— two shades you had to have seen side by side to distinguish, and near-identical to some
colourblind players. The crack reads as damage on its own. `R` gets a ring marker for the same
reason `X` got a dot in #49.

### Notes

Returns are capped at three, and the cap is doing real work: uncapped, a regenerating brick is an
unlimited supply of points, and since #67 the leaderboard is global — farming one brick would
otherwise be the highest-scoring strategy in the game.

The regen timer ticks in the same `playing`-only block as the power-up timers, so it cannot drain
behind the pause screen, and it runs before the level-clear check so a brick returning on the same
frame the last other one fell correctly keeps the level open.

Six regression cases, each verified against a mutation that should break it *and* confirmed not to
fire on the other five — including the case where a downed brick keeps counting toward level clear,
which is the plausible-looking implementation that would quietly contradict what the feature is for.

---

## 2026-08-14 — Explosive bricks (#49)

### Added

**A new `X` brick type that takes its neighbours with it.** One hit destroys it like any 1hp brick,
and the blast then damages the eight surrounding cells — so a well-placed shot cascades instead of
clearing one brick. Two explosives side by side chain into each other, which is the point of the
type and what level authors get to build with. Seven are placed across levels 3, 5, 6, 8 and 10,
singly at first and paired later.

Drawn in the hottest colour on the board with a white core dot. The dot is not decoration: colour
alone would leave the one brick that behaves differently unreadable to a colourblind player, which
is the same gap #62 covers for the rest of the set.

### Notes

The blast deals damage through `brickHit()` rather than clearing cells directly. That is the whole
design: it is why walls stay standing, why silver takes two blasts, why scoring, combos, drops and
`state.remainingBricks` all stay consistent, and why one explosive sets off the next. Clearing cells
directly would have been shorter and would have quietly desynced the brick counter, making levels
end early or become unclearable.

Neighbours are found by geometry — one cell pitch on each axis plus a 1px tolerance — rather than by
grid arithmetic, so the blast keeps working if the layout constants ever change.

Six regression cases, each verified against a mutation that should break it: the explosion disabled,
the radius widened to two cells, and the blast bypassing `brickHit`. Two of the six deliberately
survive a disabled explosion, because they guard the opposite mistakes — an over-wide blast and a
desynced counter.

---

## 2026-08-14 — One global hall of fame (#67)

### Added

**The hall of fame is now a single world board rather than one per browser.** Until now every
visitor had a private list in their own `localStorage`, so two players never saw each other's
scores and the same person saw different boards on their phone and their laptop. Scores now go to a
Cloudflare Pages Function backed by D1 — `GET /api/scores` for the top 10, `POST /api/scores` to
submit — and the overlay labels which board it is showing.

**The local board is kept, demoted to an offline fallback.** If the API cannot be reached — offline,
opened from `file://`, endpoint not yet provisioned — the game silently uses the device's own board
and says so. A run played offline still lands somewhere rather than being lost.

### Anti-cheat

Deterrence, not verification, and worth stating plainly: the game is client-side, so a patched
client can still forge a score within the plausible range. What ships is an HMAC-signed session
token issued with the board and redeemable exactly once (a `UNIQUE` nonce in the database is what
enforces that), a minimum run length and points-per-second ceiling measured against the server's own
clock rather than anything the client claims, a per-IP rate limit, and server-side name limits now
that names are world-visible. With no `HOF_SECRET` configured the endpoint fails closed.

Real verification — replaying a submitted input trace server-side — is still unbuilt and still
blocked on the game being deterministic; see #47.

### Notes

Seven regression cases cover the fallback, the world board taking precedence, the token being spent
once, and the board re-rendering from the server's response. One of them (`#67e`) was rewritten
after it passed against the very bug it was meant to catch: the original fixture gave the world
board a single entry, which made the wrong rank coincidentally equal the right one.

`test/run.js` was made async in the process. It called `test.fn(assert)` without awaiting, so any
async test would have reported PASS while asserting nothing.

**The Function has not been executed anywhere yet** — there is no wrangler or D1 in the development
environment, so every test exercises a stub rather than the endpoint. It needs a D1 database bound
as `DB`, `HOF_SECRET`, and `schema.sql` applied before it does anything but return 503.

---

## 2026-08-14 — View the hall of fame before playing (#43)

### Added

**A second button on the start screen opens the board on demand** — until now the hall of fame (#42)
was only reachable as a detour after a qualifying run ended, so a returning player had no way to
check it first. The new button sets the board's "continue" destination and shows `halloffame`
directly, without resetting score, lives, or level the way starting a game does. Viewing a fresh
install's empty board shows the same "no scores yet" message the post-game path already had.

`state.pendingWon` (a `true`/`false`/`null` flag, only ever set right before the post-game detour)
is generalized into `state.returnPhase` (`"start"` / `"victory"` / `"gameover"`), so the one field
now serves both entry points into `halloffame` instead of the continue button needing a third,
unnamed case for "opened from the start screen."

### Notes

Five new regression cases cover the board being reachable from the start screen, the empty-board
message actually rendering when opened that way (the one path #42's own tests never exercised, since
all of them produce or seed an entry first), continue routing back to `start`, opening the board
never touching score/level, and — closing a coverage gap #42 itself left, since only the win path
had a continue-routing test — a fresh case confirming a loss still routes to `gameover` after the
`returnPhase` rename. Whether `gameover`/`victory` should also get a "view the board" link is left
open, not attempted here.

Full suite: 194 passed, 0 failed, 0 pending.

---

## 2026-08-14 — Hall of fame (#42)

### Added

**A top-10 leaderboard, with name entry on a qualifying run** — clearing the final level or losing
your last life now checks whether the final score cracks the current top 10 (strictly beats the
lowest entry, or the board isn't full yet — a score of exactly 0 never qualifies, board or no board).
If it does, the game detours through a new name-entry screen before the usual victory/game-over
screen, then shows the updated board with the just-added entry highlighted. If it doesn't, nothing
changes — no prompt, straight to victory/game over as before.

Two new phases, `nameentry` and `halloffame`, slot into the existing `state.phase` →
`setPhase()` → `PHASE_OVERLAY` → `showOverlay()` pipeline (#18) the same way every other phase does,
rather than bolting an input onto the existing victory/game-over overlays. The board itself is a
capped, sorted `{name, score}` list persisted under a new storage key, through the same guarded
`storageGet`/`storageSet` helpers the best score and language already use (#2) — a throw, or
corrupted data under that key, degrades to an empty board rather than taking the game down.

A submitted name is trimmed, capped to 12 characters, and falls back to a placeholder when left
empty. It's the first free-text player input this game has ever rendered, so every value that reaches
the board goes through an HTML-escaping helper before being interpolated into the page — a name like
`<img src=x onerror=...>` renders as literal text, never as markup. Space still reaches the name field
(the same guard that hands Space to a focused button now also recognises a focused text input,
instead of hijacking it for launch/laser), and Enter submits directly from the field.

### Notes

Ten `#42a`–`#42j` regression cases cover the qualification gate (including the score-0 and
tie-with-the-lowest-entry edge cases), sorted insertion, the empty-name fallback, HTML-escaping,
routing back to victory vs. game over, Space/Enter handling, and the board's size cap — plus two
round-trip cases in the `persistence` suite, one of them under `storageThrows`. Four existing tests
that happened to end a run with a score that would have incidentally qualified now seed a full board
via the `storage` boot option, so they keep testing what they were actually about (restart resetting
state, live language re-rendering, best-score persistence) rather than tripping over the hall of fame.

Full suite: 188 passed, 0 failed, 0 pending.

---

## 2026-08-14 — Review backlog split into `done.md` and `todo.md`

### Changed

**`docs/code-review.md` is now two files** — `docs/done.md` (every shipped finding, unchanged
content, each still carrying its `✅ FIXED` note) and `docs/todo.md` (the open backlog — currently
just #41, a procedural-endless-mode idea pulled out of #32's fix note in `done.md` into a proper
numbered entry). Numbering is shared across both files and never reused: a finding keeps its number
when it moves from `todo.md` to `done.md` on the day it ships.

The two-file split makes "what's still open" a single short file to scan instead of the last item in
a 700-line document that's otherwise all done. `CLAUDE.md`, `docs/testing.md`, `test/run.js`, and
`test/suites/regressions.js` all had their `code-review.md` references updated to point at whichever
of the two files is now accurate; historical entries elsewhere in this changelog that describe past
commits keep the name the file actually had at the time.

No code changes. Full suite: 177 passed, 0 failed, 0 pending.

---

## 2026-08-14 — Paddle no longer tunnels at worst-case speed, plus test/doc follow-ups (#38, #39, #40)

### Fixed

**A fast ball stacked with the difficulty ramp can no longer tunnel through the paddle** (#38)
The existing "cannot tunnel through the paddle at maximum speed" test only budgeted for level speed
times the `fast` power-up's 1.4x, capped by the frame loop's 33ms clamp — it never accounted for
`state.difficultyMult`, the mid-level ramp that stacks on top of both (up to 1.6x). Factor that in and
a single slow frame (>~22ms, well inside the 33ms clamp) on level 10 with `fast` active and the ramp
maxed let the ball cross the paddle's 26px total thickness (paddle height plus the ball's diameter) in
one step — the paddle collision check never got a chance to fire, and the ball was lost on the next
frame with no bounce. `updateBalls()` now runs a swept check for the paddle specifically (bricks stay
exempt — a missed brick costs nothing) immediately before the existing overlap test: when the ball's
start-of-frame position was above the paddle and its end-of-frame position has already cleared the
paddle's bottom edge — the tunneling signature — it's rewound to the point where it crossed the
paddle's top plane, so the existing top-hit steering runs exactly as it would for a normal bounce.

The `LEVELS` comment that claimed level 10's speed was "kept under the ceiling" of the old test is
corrected: that ceiling never actually held once the ramp was in the mix, and level speed is no longer
a correctness constraint now that the sweep exists.

**Stale "1/5" HUD markup fallback** (#39)
The static pre-JS fallback text for the level counter still read "1/5" after #32 took the game to 10
levels. `updateHud()` overwrites it on the very first frame, so this was only ever visible for one
frame before JS ran — but that's exactly the case #32 already reasoned about and fixed for the two
overlay-eyebrow fallbacks. Now reads "1/10" to match.

**Physics invariant sweeps now cover all 10 levels** (#40)
Both randomised-run sweeps in `test/suites/physics.js` hard-coded a level bound (`5` and `3`) left over
from before #32. Levels 6–10 introduce much denser wall/silver checkerboards than 1–5 — level 10's top
two rows have no empty cells at all — which is exactly the kind of brick-adjacency layout the
smallest-penetration collision resolver (#10) was written to handle, and it was going untested. Both
loops now derive their bound from `LEVELS.length` instead.

### Notes

The old "cannot tunnel" test was paper math — it asserted the displacement formula stayed under the
paddle's thickness, not that the game actually bounced the ball. It's now a behavioural test that
drives the real worst case (level 10, `fast`, `difficultyMult` pinned to its cap, one clamped 33ms
frame) through the actual collision code and asserts the ball still bounces. Matching regression tests
for #38 and #39 were added to `test/suites/regressions.js`, each confirmed failing against the pre-fix
code before the fix landed, per the project's test convention.

Full suite: 177 passed, 0 failed, 0 pending.

---

## 2026-08-13 — Five more levels (#32)

### Fixed

**Levels 6–10** — `LEVELS` grows from 5 entries to 10, taking the game from a ~20-minute run to
roughly double that. Went with hand-authoring over the other option on the table (a procedural
generator for endless play past level 5): every place that reads `LEVELS.length` — the win check in
`checkLevelClear()`, the HUD's `n/total` readout, the `level.of` string — was already written
generically, so the finite-levels-then-`victory` structure just extended without any code changes
there. Endless mode would have meant redesigning what "winning" means; out of scope for this pass.

The new levels lean harder on walls (`#`, indestructible — shape the ball's path rather than being
something to clear) and silver bricks (`S`, 2hp) instead of just stacking more 1hp rows, continuing
levels 1–5's escalation in kind, not just in ball speed. Speed still ramps per level, but more gently
than before (~7% a level instead of ~10–13%): level 10's speed is deliberately capped below the
threshold the existing "ball cannot tunnel through the paddle at maximum speed" physics test
enforces, rather than sitting right on the edge of it.

### Notes

Caught one real thing along the way: my first pass at the new levels' speeds (continuing the
original ~10–13%-per-level curve out to level 10) failed that tunneling-invariant test outright — at
that speed, `baseBallSpeed * LEVELS[9].speed` times the fast-powerup's 1.4x times the frame loop's
clamped max `dt` exceeded the paddle's thickness plus the ball's diameter, meaning a ball could cross
the paddle in a single frame with no collision ever detected. Rescaled the level-10-and-under speed
curve to stay safely under that ceiling instead of chasing the original growth rate. (Separately,
that same test doesn't factor in the mid-level difficulty ramp — `state.difficultyMult`, up to 1.6x —
stacked on top of the fast powerup; a check on paper suggests even level 5's original speed could
theoretically tunnel under that fuller combination. Pre-existing, unrelated to #32, and out of scope
here — flagging in case it's worth its own finding later.)

Also updated the static "Niveau 1 / 5" markup fallback (the text shown for one frame before
`renderDynamicText()` paints the real level count) to "Niveau 1 / 10", and CLAUDE.md's "5
hand-authored levels" line, which was now stale.

No new regression test: the existing suite already asserts level-count-agnostic invariants (every
level loadable with at least one destructible brick, bricks laid out inside the play field, winning
on `LEVELS.length - 1`) in a loop over `LEVELS.length`, so it exercises all 10 levels automatically
without needing per-level test additions.

Full suite: 175 passed, 0 failed, 0 pending.

---

## 2026-08-13 — Power-up timer bars no longer shift the canvas (#37)

### Fixed

**The effect-bars sidebar is now a flex sibling of the screen, not a block above it**
`.effect-bars` used to sit between the HUD and `.screen-wrap` in `.cabinet`'s flex column, with
each timer slot toggled via the `hidden` attribute (#31). Every time a power-up started or every
active one ended, the bars container's height changed, and because it lived in that same flex
column, the change pushed `.screen-wrap` — and the `<canvas>` inside it — up or down. Catching a
power-up mid-rally, exactly when the player's eyes and mouse/thumb are locked onto the canvas, made
the whole play field hop.

Moved the bars markup to sit *beside* `.screen-wrap` instead of above it, wrapped together in a new
`.play-row` flex row. `.effect-bars` now takes a fixed-width column (`flex: 0 0 84px`) rather than
wrapping horizontally, so a slot appearing or hiding resizes only that column's own height — the
screen next to it, and the canvas inside it, never move. The canvas needed no code changes to get
narrower to make room: `fitCanvas()` (#17) already re-derives the backing-store size from the
canvas's actual displayed width on every resize.

Below a 560px-viewport breakpoint there's no width to spare for a side column without squeezing the
canvas uncomfortably small, so the layout falls back to the original stacked arrangement there — the
canvas-shift comes back on small phones, an accepted trade-off (the bug was specifically about the
*shift*, not the bars' position) rather than a full fix for every viewport.

### Notes

This one came directly from the user playing the game and noticing the canvas hop, rather than from
a `/code-review` pass — filed and fixed as #37 (`done.md`) the same session. Pure CSS/markup
change with no JS logic touched, so there's nothing for the existing regression-test harness (which
drives game logic against a DOM stub with hardcoded element geometry, not real flexbox layout) to
usefully assert; verified by re-reading the resulting box model by hand instead.

Full suite: 175 passed, 0 failed, 0 pending.

---

## 2026-08-13 — Touch launch guard and a merged overlay/button map (#35, #36)

### Fixed

**`touchend` no longer launches while a second finger is still down** (#35)
The touch-launch handler ran off the lifted finger's `changedTouches` entry with no check for
whether another finger was still touching the canvas. Resting a second finger on the canvas — easy
to do by accident on a phone — while dragging the primary one to aim during `"ready"` launched the
ball the instant that primary finger lifted, even though the player hadn't committed to the serve.
Guarded the launch with `e.touches.length === 0`; aiming (`changedTouches`) still updates
unconditionally, so a lone finger drags and launches exactly as before.

**`OVERLAY_PRIMARY_BTN` and `PHASE_OVERLAY` folded into one map** (#36)
These were two hand-synced lookups — `PHASE_OVERLAY` mapping phase → overlay id, `OVERLAY_PRIMARY_BTN`
separately mapping overlay id → button id — with nothing tying them together, so a future phase added
to one without the other would show its overlay but never focus its button. `PHASE_OVERLAY` now
carries both per phase in one entry (e.g. `paused: { overlay: "overlay-pause", button: "btn-resume" }`),
`OVERLAY_PRIMARY_BTN` is gone, and both `showOverlay()`'s stale-focus guard (#33's `OVERLAY_BUTTON_IDS`)
and `setPhase()` derive what they need from the single map.

### Notes

Both were found by the same `/code-review` pass over `bb8ebf1` that surfaced #33/#34, tracked as open
findings until this round (now `done.md`). Regression tests per finding (`#35`, `#36` in
`test/suites/regressions.js`), confirmed failing against the unfixed code first. `#35`'s test needed
`test/dom-stub.js`'s `touch()` helper to actually empty `e.touches` on `touchend` (matching a real
touch event) and to accept an explicit remaining-finger count, since the stub previously always
reported one finger down regardless of event type. `#36`'s test exposed `PHASE_OVERLAY` through the
`SEAM`, a deliberate addition since the finding is specifically about that map's shape.

Full suite: 175 passed, 0 failed, 0 pending.

---

## 2026-08-13 — Overlay focus regressions (#33, #34)

### Fixed

**`showOverlay()` no longer blurs buttons that aren't its own** (#33)
The stale-focus guard added under #26 — meant to drop a stray button focus left over from whatever
overlay had just hidden — ran unconditionally on every phase transition, regardless of which button
actually held focus. The deck's mute and pause buttons deliberately keep focus after a keyboard
activation (#6/#23) so they stay operable via Space; a level clearing or a life being lost while one
of them had focus silently yanked it back to `document.body`, with no user action behind it. The
blur is now scoped to buttons that actually belong to an overlay, via a small `OVERLAY_BUTTON_IDS`
lookup built from `OVERLAY_PRIMARY_BTN`'s own values — the deck buttons never appear in it, so they're
never touched by a transition that has nothing to do with them.

**Boot routes through `setPhase()` again** (#34)
`showOverlay("overlay-start")` was being called directly at boot to focus "Lancer la partie" on the
first frame — exactly the pattern #18 fixed and removed elsewhere, reintroduced because `"start"`
wasn't a key in `PHASE_OVERLAY`. Added a `start: "overlay-start"` entry (`OVERLAY_PRIMARY_BTN` already
had the matching button since #26) and boot now calls `setPhase("start")` instead, keeping the single
entry point single and closing the gap #18 left for a future phase to reopen.

### Notes

Both were found by an `/code-review` pass over `bb8ebf1` and tracked as open findings before this
round fixed them (now `done.md`). Same procedure as prior rounds: a regression test per
finding (`#33`, `#34` in `test/suites/regressions.js`), confirmed failing against the unfixed code,
then fixed.

Full suite: 173 passed, 0 failed, 0 pending.

---

## 2026-08-13 — Sticky paddle, laser, and power-up timer bars

### Fixed

**Two new power-ups: sticky paddle and laser** (#30)
The suggested "natural additions" are in. **Sticky** re-attaches a ball on a genuine top-face paddle
hit while active, letting you aim before serving again — capped to one ball at a time so multi-ball
can't stack several on the paddle at once. **Laser** gives the existing action button (Space, click,
or tap) a second job during play: fire classic twin bolts from the paddle, on a cooldown, that destroy
whatever brick they reach via the same `brickHit()` path a ball hit goes through — so scoring, combo,
and difficulty all just work. Releasing a stuck ball and firing both route through the same
`handleLaunchOrResume()` entry point every other input already uses. Both slot into the existing
timed-effect architecture (`POWERUPS`, `CONFIG.effects`, `applyPowerup`) rather than inventing a
parallel system.

One existing assumption needed generalizing: `updatePaddle()`'s attached-ball tracking was hardcoded
to `balls[0]` (true only because, before sticky, that was the only ball that could ever be attached).
It now loops over every ball, since sticky can catch any of them mid-play.

**Active power-up timers are now visible** (#31)
A thin depleting bar per effect now sits under the HUD — one each for the paddle-width effect, the
ball-speed effect, sticky, and laser — resized every frame from `remaining / duration` and hidden
entirely when that effect isn't active. Reuses the same "recover which specific powerup from the sign
of `mult`" trick `drawPaddle()`'s colour swap already relied on, rather than teaching `widthEffect`/
`speedEffect` to remember which powerup produced them.

### Notes

Same procedure as prior rounds: a regression test per finding, confirmed failing against the unfixed
code before the fix landed. One test (`#30c`, sticky's "at most one ball" cap) needed a rewrite after
its first version passed against the *unfixed* code for the wrong reason — with no sticky feature at
all, "the second ball doesn't stick" was trivially true. Restructured it to first prove a lone catch
*does* stick (the control), so the test actually depends on the cap existing rather than passing by
accident.

Fixing #30 also exposed a real, unrelated invariant gap in `test/suites/physics.js`'s power-up sweep:
it asserted every ball's direction vector has unit length, which had always been vacuously true before
(only ever the pre-serve ball, and only outside the `"playing"` phase where that sweep runs) but breaks
now that a ball can legitimately go stationary (`dx = dy = 0`) *during* active play. Excluded attached
balls from that specific assertion.

Extended the test harness's `SEAM` with `handleLaunchOrResume`, needed to drive the sticky-release and
laser-fire paths directly rather than simulating a full DOM event round-trip.

Full suite: 171 passed, 0 failed, 0 pending.

---

## 2026-08-13 — Gameplay/UX: keyboard overlays, touch-and-drag, difficulty ramp, score feel

### Fixed

**Space and Enter now work from every overlay, including the very first screen** (#26)
`showOverlay()` now focuses the overlay's own call-to-action button whenever one appears — "Rejouer"
on game over, "Niveau suivant" on level clear, "Reprendre" on pause, and "Lancer la partie" even at
boot, routed through `showOverlay()` instead of relying purely on the static markup. Once a button
holds focus, the existing `isButtonFocused()` guard (#6) hands Space back to the browser and native
button activation does the rest. A companion fix: `showOverlay()` now also blurs a stale focus left
over from the overlay that just hid, so it can't keep swallowing Space once the new overlay (like
"ready") has no button of its own to take over.

**A touch now aims before it launches** (#27)
`touchstart` used to set the paddle position and immediately serve the ball in the same instant — you
could not aim before the ball launched, and your finger sat right on top of the paddle blocking the
view. Launching moved to a new `touchend` handler; `touchstart`/`touchmove` now only update the aim,
so dragging into position before lifting your finger works as expected. The "vertical offset" half of
the original suggestion — making the paddle itself track above the finger — was deliberately skipped:
the paddle only ever steers horizontally, and adding vertical tracking would be a materially bigger
change (new collision geometry, different feel from mouse/keyboard play) than the fix this bug
actually needed.

**Ball speed now ramps up over the course of a level** (#28)
Classic Breakout speeds the ball up so a level can't stall out forever on the last couple of bricks.
`state.difficultyMult` now does the same here: it bumps (cumulative, multiplicative, capped) every
time the ball hits the top wall, and every `CONFIG.difficulty.brickMilestone` bricks destroyed, then
multiplies directly into ball velocity alongside the existing power-up speed effect. It resets to 1
at the start of every level.

**Destroying bricks now has canvas feedback, and a combo rewards not touching the paddle** (#29)
Points were only ever visible in the HUD number. Each brick destroyed now pops a floating `"+N"` at
its position that rises and fades. Consecutive bricks destroyed without the ball touching the paddle
in between also build a combo that scales the points awarded (capped), reset by any paddle contact —
top face or side clip alike. This changes the scoring curve going forward: an unbroken combo now
scores more than the same bricks hit in isolation, so newly-earned best scores aren't directly
comparable to ones saved before this change.

### Notes

Same procedure as prior rounds: a regression test per finding, confirmed failing against the unfixed
code before the fix landed. Fixing #26 (focusing overlay buttons on every transition, including at
boot) surfaced a real interaction the test suite hadn't previously exercised: a button left focused
from a prior overlay was silently blocking Space once a buttonless overlay like "ready" appeared —
this is the `showOverlay()`-blurs-stale-focus fix folded into #26 above, and it required updating a
couple of existing focus tests (`#6b`, and an input-suite test) to stop asserting the old "always ends
up unfocused" behavior for the pause button specifically, since it now correctly ends up focused on
the pause overlay's own resume button instead.

No new test-harness capabilities were needed; #26–#29 are all exercised through the existing seam
(`setPhase`, `state`, `CONFIG`, touch events).

Full suite: 164 passed, 0 failed, 0 pending.

---

## 2026-08-13 — Accessibility: overlay announcements, toggle state, reduced motion

### Fixed

**Overlay changes are now announced to screen readers** (#22)
Level-clear, game-over, and victory overlays used to swap in silently. All six overlays now carry
`role="status" aria-live="polite"`, and `showOverlay()` keeps `aria-hidden` in sync with the `.show`
class on every transition — the overlay actually on screen is the only one ever left in the
accessibility tree, which is what lets a screen reader announce it as it appears.

**Both deck buttons now expose `aria-pressed`, and the pause button finally reflects its own state** (#23)
Neither the mute nor the pause icon button told assistive tech (or a glance) whether it was currently
"on." Both now default to and track `aria-pressed`. The pause button previously showed the same "II"
icon and "Mettre en pause" label at all times, even while already paused — it now swaps to a play
icon and a "Reprendre la partie" label, mirroring the mute button's existing muted/unmuted swap, kept
in sync on every phase change and language switch.

**The canvas now points assistive tech at the HUD** (#24)
The canvas had an `aria-label` but no live text of its own for score or lives, and the real HUD text
sitting right above it wasn't referenced from it. Confirmed the HUD was already reachable — plain,
unhidden DOM text ahead of the canvas in reading order — so no fallback content inside the canvas was
needed; it just needed `aria-describedby` pointing at the HUD, for a screen-reader user who lands
directly on the canvas rather than reading the page in order.

**`prefers-reduced-motion` now reaches the canvas, not just the CSS title flicker** (#25)
Brick-hit particle bursts kept their full particle count regardless of the OS motion preference, since
CSS media queries can't reach into canvas drawing. `burst()` now reads
`matchMedia("(prefers-reduced-motion: reduce)")` and scales its particle count down to roughly a
third (never to zero) when it matches — read live via a `change` listener, so toggling the setting
mid-session takes effect on the very next burst rather than needing a reload.

### Notes

Same procedure as prior rounds: a regression test per finding, confirmed failing against the unfixed
code before the fix landed. The test harness grew a `matchMedia` stub (one `MediaQueryList` per
distinct query, plus a `fireMedia(query, matches)` handle method to simulate the OS setting changing
mid-session) and a `reducedMotion` boot option to seed it.

Full suite: 155 passed, 0 failed, 0 pending.

---

## 2026-08-13 — Structure cleanup: phase transitions, dead code, audio, tuning

### Fixed

**Every phase transition now flows through `setPhase()`** (#18)
`togglePause`, `checkLevelClear`, and `endGame` each used to assign `state.phase` and call
`showOverlay()` directly instead of going through `setPhase()`, which existed to be the single place
that mapping lives. `setPhase()` didn't even handle the `levelclear`/`victory`/`gameover` phases —
those three call sites existed *because* of that gap. `setPhase()` now owns the complete
phase→overlay mapping (via a `PHASE_OVERLAY` lookup), and all three call sites just call
`setPhase(...)`. No behavior change; this closes off a duplication that would have caused an
overlay/phase desync the next time a phase was added.

**Three pieces of dead/redundant code removed** (#19)
`state.paddle.w` was assigned on every `updatePaddle()` call but nothing ever read it —
`paddleWidth()` was always the actual source of truth. The four calls right before the first
`requestAnimationFrame(frame)` (`updateHud(); drawBackground(); drawBricks(); drawPaddle();`)
duplicated exactly what that first frame already paints ~16ms later. `updateBalls(dt, now)` declared
a `now` parameter it never used.

**A suspended `AudioContext` is now resumed, and muting now survives a reload** (#20)
Some browsers hand back an `AudioContext` in a `"suspended"` state unless it's constructed directly
inside a user-gesture handler; `beep()` now calls `actx.resume()` whenever that happens, rescuing
audio for the rest of the session instead of staying silently mute. Separately, `state.muted` now
round-trips through the same `storageGet`/`storageSet` pair already used for the best score and the
language preference — the "same three lines as `loadLang`/`saveLang`" the finding called for.

**Scattered magic numbers collected into one `CONFIG` object** (#21)
Drop fall speed, particle gravity, the ball cap, the paddle bounce spread, and each power-up's
mult/duration pair were literals repeated (or coincidentally matching) across `applyPowerup`,
`updateDrops`, `updateParticles`, and `updateBalls`. They're now one `CONFIG` object near the top of
the file, and every call site reads from it. Purely a refactor — the values themselves are unchanged.

### Notes

Same procedure as prior rounds: a regression test per finding, confirmed failing against the unfixed
code before the fix landed (#18 and #21 needed `CONFIG` added to the test harness's `SEAM`; #20's audio
resume needed the harness's `AudioContext` stub to grow a `state`/`resume()` pair, defaulting to
`"suspended"` so a missing `resume()` call shows up as a real failure rather than passing by luck).

Re-anchored every line reference in `docs/code-review.md` that shifted as a result — including one
long-stale pre-existing anchor this pass happened to touch: finding #1's third citation had pointed at
unrelated mid-script content since at least the previous round; it now points at the closing
`</body></html>` tags it was always meant to cite.

Full suite: 149 passed, 0 failed, 0 pending.

---

## 2026-08-13 — Render-loop performance

### Fixed

**`drawDrops` no longer forces a style recalculation every frame** (#14)
`ctx.font` was rebuilt from `getComputedStyle(document.body).fontFamily` once per falling power-up,
per frame — a synchronous layout cost, and the single most expensive line in the render path. The
font string is now computed once into a module-level constant; the body's font never changes at
runtime, so there was nothing to gain from asking every frame.

**The HUD only writes to the DOM when a displayed value actually changes** (#15)
`updateHud()` ran unconditionally every frame in addition to its existing event-driven calls,
rewriting all four HUD nodes — score, best, level, lives — 60 times a second regardless of whether
anything on screen had moved. It now caches what's currently displayed and skips the `textContent`
write for any field that hasn't changed. The per-frame call itself stays, since it's still what
catches `best` needing to track a live-updating `score`.

**Level-clear no longer rescans every brick every frame** (#16)
`checkLevelClear()` ran `.some()` over the full brick array — up to 80 bricks — on every frame while
playing. A `remainingBricks` counter is now seeded when a level is built and decremented at the one
place a brick actually dies, turning the per-frame check into an `O(1)` comparison.

**The canvas backing store now scales with how big the canvas is actually displayed** (#17)
`fitCanvas()` always allocated `480 × 680 × devicePixelRatio` pixels, regardless of how large the
canvas — styled `width: 100%; height: auto` — was actually rendered. On a narrow phone screen that
wasted a lot of memory and fill-rate on pixels that were never shown. The backing store is now scaled
by `dpr * min(1, displayWidth / GAME_W)`: unchanged whenever the canvas is shown at or above its
logical size, shrunk when it's rendered smaller.

### Notes

Same procedure as prior rounds: a regression test per finding, confirmed failing against the unfixed
code before the fix landed. #14 and #15 already had `pending` tests written ahead of time in
`test/suites/perf.js`; those are now unpended. #16 and #17 are new entries in
`test/suites/regressions.js`, the latter backed by a new `canvasWidth` option on the test harness's
`boot()` so the canvas's displayed size can be overridden independently of `dpr`.

The #16 fix changes an implicit invariant: `state.remainingBricks` must now stay in sync with how many
destructible bricks in `state.bricks` are alive. A few existing tests that killed bricks directly by
setting `.alive = false` (bypassing `brickHit`, which is the only production code path that maintains
the counter) needed a one-line update to keep the counter in sync by hand.

Full suite: 142 passed, 0 failed, 0 pending.

---

## 2026-08-13 — Drops, multi-ball, and score persistence

### Fixed

**A falling power-up no longer visually clips the paddle without being caught** (#11)
`updateDrops`'s hit test used an 8px radius while `drawDrops` renders the capsule with a 10px radius,
so a drop could visibly overlap the paddle for a couple of pixels without registering as collected.
The hit test now matches the drawn radius.

**A multi-ball clone can no longer spawn aimed straight down** (#12)
The clone angle used to be the source ball's exact angle plus a small random offset, so a descending
source ball produced two descending clones that were usually lost within a second — "M" felt like a
dud. The source angle is now mirrored upward first when it's descending, then the pair spreads
symmetrically to either side of that upward angle.

**The best score now survives closing the tab right after a level clear** (#13)
Only `endGame()` used to call `saveBest()`, so clearing four levels and closing the tab before losing
lost the whole score. A shared `maybeSaveBest()` helper is now also called from `checkLevelClear()`,
checkpointing progress at every level clear rather than only at the very end of the run.

### Notes

Same procedure as the round above: a regression test per finding, added to
`test/suites/regressions.js` and confirmed failing against the unfixed code before the fix landed.
Full suite: 137 passed, 0 failed, 2 pending (#14, #15, unrelated performance findings).

---

## 2026-08-13 — Input handling and collision fixes

### Fixed

**Arrow keys no longer scroll the page** (#7)
`ArrowLeft`/`ArrowRight`/`KeyA`/`KeyD` are now `preventDefault`ed in the `keydown` handler alongside
the existing pointer-release logic. On a narrow viewport where the cabinet overflows, steering the
paddle used to scroll the document under it.

**Right- and middle-click no longer launch the ball** (#8)
`mousedown` on the canvas now checks `e.button === 0` before treating the click as a launch/resume.
Previously any mouse button did it, so opening a context menu with a right-click also served the ball.

**A ball clipping the paddle's side is no longer teleported onto the top** (#9)
The paddle collision now remembers the ball's `y` from before the frame moved it. Only a ball that was
above the paddle top resolves as a top-face bounce; a ball that was already level with the paddle
resolves as a side hit instead — horizontal reflection only, same treatment a brick's side face gets.
Previously any downward-moving ball touching the paddle at all was snapped onto the top, which read as
a phantom save when the ball had actually clipped the side.

**Corner brick collisions now resolve against the brick actually struck, not array order** (#10)
When a ball overlaps two adjacent bricks at once — a corner between them — the collision now scores
each overlapping brick by penetration depth and resolves against the shallowest one. It previously
just took the first overlap in array order, which is always the top-row brick since that's how bricks
are stored, producing occasional wrong-direction ricochets in the dense levels 4–5.

### Notes

Each fix landed with a regression test added first against the unfixed code and confirmed failing,
per the convention in [testing.md](testing.md). #7 and #8 already had `pending` tests written ahead of
time in `test/suites/input.js`; those are now unpended. #9 and #10 are new entries in
`test/suites/regressions.js`. Full suite: 134 passed, 0 failed, 2 pending (#14, #15, unrelated
performance findings).

---

## 2026-08-12 — English and French

The game is now bilingual. It picks a language on first load and offers a toggle to override that
choice, which is remembered for next time.

### Added

**A language toggle in the marquee**
A small segmented `FR`/`EN` pill sits to the right of the title, styled as quiet cabinet trim rather
than as another neon element. The active language is marked with `aria-pressed`, so the control is
usable and legible to assistive tech as a pair of toggle buttons. It survives the narrow-viewport
breakpoint that hides the tagline.

**Automatic language selection**
On first load the game reads `navigator.languages` — the ordered list of languages the player's
browser and OS are already configured for — and picks French if French appears anywhere in it,
otherwise English. The list is respected in order, so a `de-DE, fr-FR` browser gets French.

This is locale, not geography. Deciding by IP address would mean calling a third-party service on
every load, which would break a file designed to run offline from `file://` with no dependencies, and
the Geolocation API would raise a permission prompt out of all proportion to choosing a language.
Locale is also the more accurate signal: it reflects what the player actually reads, not where they
happen to be sitting.

**The choice is remembered**
Picking a language stores it, and a stored choice always wins over detection on subsequent loads.
Storage failures are non-fatal — the selection simply lasts for the session, consistent with how the
best score already behaves.

### Changed

**All display text now comes from a string table**
Static text is tagged in the markup and swapped at runtime; interpolated text (scores, level numbers)
is rebuilt from one function. Switching language mid-game re-renders whatever overlay is currently
showing, so a paused or game-over screen updates immediately rather than waiting for the next state
change.

French typography is preserved rather than machine-copied: French keeps its space before a colon
("Score : 420"), English does not ("Score: 420").

**The mute button's label is now correct**
Its accessible label previously read "Couper le son" permanently, including while already muted. It
now tracks both the language and the on/off state. This is part of finding #23, which remains open
for the rest (`aria-pressed`, and the pause button, still do not reflect state).

**Storage helpers generalised**
The guarded `localStorage` wrappers added earlier were specific to the best score; they are now
generic `storageGet`/`storageSet`, reused for the language preference. This is the groundwork finding
#20 calls for in order to persist the mute setting.

### Notes

The document language attribute (`<html lang>`) follows the selection, so screen readers and browser
translation features get the right hint.

Verified with the headless harness, now at 49 assertions. Alongside runtime checks it performs static
checks that catch the realistic failure mode for translation work: that both tables define the same
keys, that placeholders match across languages, and that every key referenced from markup or code
actually exists. The harness is not committed.

---

## 2026-08-12 — Pause behaviour and keyboard access (`3ab988f`)

### Fixed

**Power-up timers no longer drain while the game is paused** (#4)
A 10-second "widen" used to keep counting down on the pause screen, so pausing to answer the door
could cost you the whole bonus. Effects now carry a `remaining` duration measured in seconds of
actual play instead of an absolute wall-clock deadline. As a side benefit the timers are now immune
to background-tab throttling and system clock adjustments.

**The game pauses itself when you switch away** (#5)
Backgrounding the tab or clicking into another window previously left the ball live. Returning
dropped you straight into the action with no warm-up, and power-up timers kept expiring in the
meantime. Both now trigger an automatic pause. It only fires on leaving — coming back never
auto-resumes, so you restart play deliberately.

**Space activates a focused button instead of being swallowed** (#6)
Space was unconditionally suppressed to stop the page scrolling, which also meant a keyboard-only
player who tabbed to "Rejouer" could not press it with Space (Enter still worked). Space is now
handed back to the browser whenever a button holds focus.

This carried a companion fix worth knowing about: the pause and mute buttons on the deck stay
on-screen and keep focus after a mouse click, so the change alone would have made Space toggle pause
instead of launching the ball. Those buttons now drop focus after pointer clicks only — keyboard
activation keeps focus, so tab-order navigation is unaffected.

### Notes

Verified with a throwaway headless harness that stubs the DOM, loads the real script, and drives the
game loop directly — 18 assertions covering timer suspension across a 30-second pause, both
auto-pause triggers, and the Space/focus interaction. The harness was not committed.

---

## 2026-08-12 — Document structure and crash-safety (`18130c8`)

### Fixed

**Accented French text can no longer mojibake** (#1)
The file began directly at `<style>` with no doctype and no charset declaration. Opened over
`file://`, or served without a `charset` header, browsers fell back to windows-1252 and rendered
`Détruisez` as `DÃ©truisez`. The page now has a proper `<!doctype html>`, `<html lang="fr">`, and a
`<head>` carrying `<meta charset="utf-8">`, a viewport meta, and a `<title>`.

This also moves the page out of quirks mode into standards mode.

**A blocked `localStorage` no longer kills the game** (#2)
The best score was read at startup while building the game state. In Safari private browsing, with
site data disabled, or in some sandboxed `file://` contexts, touching `localStorage` *throws* — which
aborted the entire script and left a dead black canvas with no error the player could see. Reads and
writes are now guarded, falling back to an in-memory best score.

**The paddle no longer sticks to a wall after alt-tabbing** (#3)
No `keyup` is delivered for a key still held when the window loses focus, so alt-tabbing mid-press
left the paddle pinned against the edge until you pressed and released that key again. Held keys are
now cleared on blur.

---

## 2026-08-12 — Code review (`d20ab63`)

Added `docs/code-review.md` (since split into [done.md](done.md) and [todo.md](todo.md) — see the
2026-08-14 entry below): 32 numbered findings across correctness, performance, code structure,
accessibility, and gameplay, each anchored to the relevant source lines with an effort estimate. No
code changes.

---

## 2026-08-12 — Initial commit (`8b6c46d`)

`index.html` — a single self-contained French-language neon arcade breakout game. Vanilla JS in an
IIFE, 2D canvas, WebAudio blips, five hand-authored levels, six power-ups, no dependencies and no
build step.
