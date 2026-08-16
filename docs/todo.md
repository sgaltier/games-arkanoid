# Blokrush — Open Findings

Target: [index.html](../html/index.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** 1 open item.

**When an item here gets fixed:** the established loop (see [testing.md](testing.md)) is regression
test → fix → move the finding's whole entry from this file to [done.md](done.md), prepending a
`> **Fixed <date>.**` note that describes what shipped and keeping the original write-up below it as
the historical record → add an entry to [release-notes.md](release-notes.md).

**Line references, once written, are only valid against the current `index.html`** — the same
re-anchoring discipline applies here as in `done.md`.

---

Every *review finding* raised so far has shipped — see [done.md](done.md). What is open below is a
feature promoted from [feature-ideas.md](feature-ideas.md), which keeps its number. New review
findings go here too, keeping the shared numbering: the next free number is **#74**.

---

## Gameplay / UX enhancements

### 65. Achievements (M)

Promoted from [feature-ideas.md](feature-ideas.md), where it read, in full: *"A set of named,
persisted goals — clear a level without losing the ball, hit a 10× combo, finish a level using only
the laser, clear the game without a single bad power-up. They need a small event-emitting layer
inside the existing update functions, plus a display surface, plus new strings in every language
table."* That is the idea; below is the roster, which is the part that decides whether the feature is
worth having.

The case for it is that a run is now 100 levels (#41) and the only thing that persists between runs
is a number — the best score, and since #67 a place on the world board. Both reward the same thing:
one very good run. Nothing rewards playing *differently*, and nothing at all acknowledges the parts
of the game a player can go a whole run without noticing — that mystery bricks resolve into
something, that explosives chain, that the laser exists.

**The estimate moved from S/M to M.** Not because any one achievement is hard — most are a
comparison against state the game already keeps — but because twenty of them are forty strings in
two languages, plus an overlay, plus a toast, plus a persisted file that has to survive being
garbage. The roster is the cheap part.

#### The roster

Twenty, in four tiers. The tiers are not shown to the player; they are here because the roster has
to span "you will get this in the first minute" to "nobody may ever get this", or it is either
condescending or discouraging. **Needs** is what has to exist that does not today — the column that
decides the cost.

**I — arrive on their own.** These exist to teach the player that the system is there at all, and
should be unlocked before anyone goes looking for a list.

| Achievement | Unlocks when | Needs |
|---|---|---|
| First Crack | The first brick of the first run comes apart | — `brickHit()` ([2884](../html/index.html#L2884)) |
| Warm Cabinet | Level 10 is cleared | — `checkLevelClear()` ([3117](../html/index.html#L3117)) |
| Full House | You hold `maxLives` lives at once | — `state.lives`, which #41's milestone life feeds |

**II — skill.** The ones a player can aim at.

| Achievement | Unlocks when | Needs |
|---|---|---|
| Untouched Ten | A combo of 10 — ten bricks with no paddle touch between them | — `state.combo` |
| Untouched Twenty-Five | The same at 25 | — |
| Clean Sheet | A level is cleared without losing a ball | Lives at level start, kept for the level |
| Iron Ten | Ten levels in a row cleared without losing a ball | A run counter, reset in `loseLife()` |
| Blitz | A level is cleared in under 45 seconds of play | A per-level play-time accumulator (`dt` while `playing`, so pauses do not count) |

**III — the toys.** Each one names a mechanic a player can otherwise finish the game without ever
having noticed. This is the tier that earns its keep.

| Achievement | Unlocks when | Needs |
|---|---|---|
| Chain Reaction | Six or more bricks go up in a single explosive cascade | A count threaded through `explode()` ([2832](../html/index.html#L2832)) |
| Sharpshooter | 25 bricks destroyed by laser bolts in one run | A run counter on the laser hit path ([1964](../html/index.html#L1964)) |
| Three at Once | Three or more balls in play at the same moment | — `state.balls.length` |
| Whack-a-Brick | A regenerating brick is destroyed after coming back at least once | The brick's `regenLeft` against its starting value ([2884](../html/index.html#L2884)) |
| Curiosity | 25 mystery bricks resolved in one run | A run counter in `resolveMystery()` ([2868](../html/index.html#L2868)) |
| Silver Service | 50 silver bricks destroyed in one run | A run counter |
| Discerning | Five levels in a row cleared without catching `narrow` or `fast` | A counter reset in `applyPowerup()` ([2714](../html/index.html#L2714)) |

**IV — the long tail.** Rare by construction. The last one may never be earned by anybody, which is
the point of having it.

| Achievement | Unlocks when | Needs |
|---|---|---|
| Immortalised | A run lands on the hall of fame | — `qualifiesForHallOfFame()` ([3172](../html/index.html#L3172)) |
| World Class | A run lands on the *global* board (#67) | The API's answer — so it can only ever unlock when the network answered, which is worth saying out loud rather than looking like a bug |
| Six Figures | A run ends on 100,000 or more | — `endGame()` ([3134](../html/index.html#L3134)) |
| Cabinet Beaten | The campaign is finished — `victory` | — |
| Untouchable | The campaign is finished without losing a single ball | Iron Ten's counter, unbroken for 100 levels |

Deliberately **not** on the list: anything that rewards losing ("lose ten balls on one level"), which
reads as mockery on the screen #71 just spent effort making feel bad; anything timed against the wall
clock rather than play time; and anything that needs a lifetime counter. That last one is a real
constraint, not squeamishness — see below.

#### Whose they are — decided

> **Decided 2026-08-16: per browser, and nothing more.** No accounts, no server-side set, no sync
> between devices. If this ever needs revisiting, revisit it here rather than discovering it in the
> code.

**There is no per-user anything in this game, and this feature does not add one.** Worth stating
plainly, because "persisted goals" invites the assumption that a player carries them around:

- `localStorage` is per browser profile per origin. That is the same granularity `neonbreak-best-score`
  and the local hall of fame have had since the beginning — phone and laptop are two separate sets,
  two people sharing a profile share one set, and clearing site data destroys it.
- **The name typed at `nameentry` is not an account.** It is free text cleaned per submission
  ([functions/api/scores.js](../functions/api/scores.js)) — anyone can type anyone's name, and
  nothing keys off it.
- **The session token is not identity either.** It is a signed nonce and timestamp that dates one run
  and is single-use. `ip_hash` exists but only to rate-limit, in a table never joined to `scores`,
  and an IP is shared, dynamic and personal data — it must not become a user id.
- **Private browsing loses them silently.** `storageGet`/`storageSet` swallow throws
  ([1455](../html/index.html#L1455)), so unlocks work for the session and are never remembered. That
  is the correct behaviour and needs no special case, but the overlay should not claim otherwise.

**What was weighed and rejected.** A **claim code** — an opaque id generated locally, pasteable on
another device, backing a server row keyed by that code — is the proportionate way to carry a set
around if it is ever wanted: no accounts, no auth, no PII, and anyone holding the code can claim the
set, which for achievements is a non-problem. It stays available as an upgrade path and needs nothing
here designed around it. **Real accounts** were never in proportion: a login flow, session handling
and a privacy surface, against the constraint that the game is one file that plays offline over
`file://`.

**The asymmetry this accepts**, deliberately: the world board is global and permanent (#67), and
these are neither. A score is a claim against other players and has to be defensible; an achievement
is a note to yourself, and losing one costs the player nothing they can be robbed of. That is the
whole argument, and it is why the cheap answer is also the right one here.

#### Direction

- **Counters on `state`, not an event bus.** Every cross-cutting thing in this file is already a
  field on `state` ([1558](../html/index.html#L1558)) read by a per-frame function, and an emitter
  layer would be the only place in the game where control flows the other way. A single
  `checkAchievements()`, called where `updateHud()` already is ([3259](../html/index.html#L3259))
  plus once at level clear and once at `endGame()`, covers every row above. The genuinely transient
  conditions — a six-brick cascade — become a counter the check reads, not an event it subscribes to.
- **Unlocking is presentation, and must stay presentation.** The rule #58, #59 and #60 all hold to:
  nothing here may feed back into the simulation. **No achievement may award points, lives or
  power-ups.** The moment one does, it is a second scoring system and the hall of fame stops meaning
  one thing.
- **A jumped run earns nothing** (#69), exactly as it earns no place on the board and no best score.
  And #72's lesson applies directly: the rule is fine, being silent about it is not — the
  achievements overlay needs the same `run.jumped` line the end screens now carry, or the feature
  looks broken to the one player most likely to be testing it.
- **One persisted array, and no numbers in it.** `ACH_KEY = "neonbreak-achievements"`, alongside the
  four existing keys ([1446](../html/index.html#L1446)) — per browser, per the section above, and
  **`neonbreak-`, not `blokrush-`**: the namespace is asserted by `persistence.js` precisely so it
  does not get tidied up. Everything above
  is either a run counter (thrown away with the run) or an unlocked id, so the file is an array of
  strings and nothing else. That is what keeps lifetime counters off the roster: they would mean
  writing to storage on every silver brick, and the alternative — batching the flush — is a whole
  consistency problem for a feature nobody asked to be exact. Being parsed rather than read raw, it
  needs `loadHallOfFame()`-style shape validation ([1481](../html/index.html#L1481)): an array of
  strings, unknown ids dropped on load, so retiring an achievement later cannot corrupt the file.
- **The display surface is #73's, twice over.** A new `achievements` phase in `PHASE_OVERLAY`
  ([2050](../html/index.html#L2050)) with its own overlay, opened through the `state.returnPhase`
  pattern `viewHallOfFame(from)` ([2234](../html/index.html#L2234)) just generalised, from the start
  screen and both end screens. Locked entries should show their condition rather than a row of
  question marks: a goal nobody can read is not a goal.
- **The toast is `spawnFloatingText()` moved** ([1744](../html/index.html#L1744)) — the same idea
  pinned to a screen position instead of to a brick. Two things it must get right: several
  achievements can unlock in the same frame, so it is a queue rather than overlapping toasts; and it
  respects `prefers-reduced-motion` like every other moving thing (#58).
- **Forty strings, in both tables.** Twenty names and twenty conditions, in `STRINGS.fr`
  ([1299](../html/index.html#L1299)) and `STRINGS.en` ([1357](../html/index.html#L1357)). The `i18n`
  suite fails on any key present in one table and not the other, so this is mechanical — but it is
  most of the work, and it is the reason the estimate moved.

#### Tests

- `#65a` — an achievement unlocks once, not once per frame, and is still unlocked after a reload.
- `#65b` — a jumped run unlocks nothing, and the overlay says why.
- `#65c` — storage holding valid JSON of the wrong shape leaves the game playable with an empty set,
  the way `loadHallOfFame()` already handles it.
- `#65d` — the layer is presentation: same seed and same inputs produce an identical score, brick
  state and drop sequence whether or not anything unlocked.
- `#65e` — every id in the roster has a name and a condition in both language tables, so adding an
  achievement without its strings fails the build rather than shipping a blank row.
- `#65f` — the overlay returns to the phase it was opened from, like `#73a`/`#73b`.
- `#65g` — three unlocking in one frame are all shown, rather than the last one winning.
- `#65h` — with storage throwing on every access (Safari private browsing), unlocks still happen and
  still show; only remembering them fails. `boot({ storageThrows: true })` already sets this up.
