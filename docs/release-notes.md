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

52 of 52 findings fixed. See [todo.md](todo.md) for what's still open, and
[feature-ideas.md](feature-ideas.md) for proposals not yet promoted to the backlog.

---

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
