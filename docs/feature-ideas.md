# Blokrush — Feature Ideas

A menu of features Blokrush does **not** have yet, drawn from what the genre's best-regarded
entries do — *Arkanoid* / *Arkanoid DS*, *Shatter*, *Ricochet Infinity*, *Wizorb*, *DX-Ball 2*,
*Block Breaker Deluxe*, *Brick Rage*, and the various modern mobile breakouts.

**Provenance:** the genre comparisons below come from model training knowledge, not from a web
search performed for this document. Treat specific claims about how a named commercial game
behaves as "roughly how that game is remembered", not as verified fact — worth a quick check
before any of it is used as a design reference.

**Status:** proposals only. Nothing here is committed, scheduled, or estimated beyond the rough
S / M / L effort marks. This is a sibling of [todo.md](todo.md) — the difference is that `todo.md`
holds findings from review passes (things arguably *wrong*), while this file holds net-new
capability (things merely *absent*).

**Numbering:** entries reserve numbers **44–66** in the shared sequence used by
[todo.md](todo.md) and [done.md](done.md), so an idea promoted from here keeps its number when it
moves. Do not reuse these numbers for new review findings. Numbers missing below (#44, #49, #51,
#52, #58, #59, #60, #65) have already been promoted into [todo.md](todo.md).

**What already exists** (so nothing below duplicates it): a 100-level campaign — 10 hand-authored
levels and 90 generated deterministically from the level number (#41); 4 brick colours
plus silver (2 hp) and indestructible walls; 8 power-ups (`widen`, `narrow`, `slow`, `fast`,
`multi`, `life`, `sticky`, `laser`); a within-level difficulty ramp; a combo score multiplier;
floating score pop-ups; particle bursts; a 10-entry local hall of fame; FR/EN localisation;
a combo-reactive music bed with a voice per brick type (#59); five per-act backdrops with a
parallax star field (#60); mute, pause, and `prefers-reduced-motion` support.

---

## A. Content and progression

### 45. Procedural levels past the authored 10 (M)

Already logged as finding #41 in [todo.md](todo.md); repeated here only so this menu is complete.
The design question this entry used to leave open — what "winning" means once `LEVELS.length` stops
being the boundary — has since been answered there: not an endless mode but a 100-level campaign,
10 authored plus 90 generated, ending in the `victory` the game already has, with layouts seeded
deterministically from the level number so one global board still means something.

### 46. Level select and per-level star ratings (S/M)

Right now a run always starts at level 1, so seeing level 8 means clearing seven levels first —
punishing for a player who just wants to revisit a favourite layout, and awkward for anyone
testing a late level. A level-select screen would unlock levels as they are first cleared
(persisted in `localStorage` alongside the existing keys) and show a 1–3 star rating per level
based on score thresholds. Stars give the completionist player a reason to replay a cleared level,
which is most of what carries mobile breakouts past their first hour.

### 47. Daily challenge seed (M)

One generated level per calendar day, identical for every player because the RNG is seeded from
the date, with its own small leaderboard. This is the cheapest known way to convert a
play-once arcade game into something a player opens repeatedly, and it composes well with #45 —
the same generator serves both. It requires the game's randomness to be routed through a seedable
PRNG rather than `Math.random()` directly, which the test harness would benefit from anyway (it
already stubs RNG).

### 48. A level editor and shareable layouts (L)

`LEVELS` is already a plain array of 10-character row strings — the format is human-writable by
design, which makes an editor unusually cheap for what it delivers. A grid UI that paints brick
types, plus encoding a layout into a URL fragment or a copyable string, would let players build and
trade levels with no server involved. *Ricochet Infinity*'s community level packs are the reference
point for how far this can carry a game.

---

## B. New brick types

### 50. Moving bricks (M)

Rows that slide horizontally, or individual bricks that oscillate, wrapping or reversing at the
field edge. This is the cheapest way to make a layout feel alive and to raise difficulty without
raising ball speed — which matters, because ball speed is already carrying that load via the
difficulty ramp and is bounded by tunnelling concerns (see finding #38 in [done.md](done.md)).
Collision already resolves per-frame against brick rectangles, so moving them is mostly a matter
of updating `x` and being careful about a brick sweeping into a ball.

---

## C. Power-ups and ball mechanics

### 53. Fireball / through-ball (S)

A timed effect where the ball ploughs through bricks without bouncing, destroying everything in a
column. It is the classic power fantasy of the genre and the natural "big" reward to sit above the
current table's `multi`. The implementation is a flag checked in `resolveBrickCollision()` — skip
the bounce, keep the damage.

### 54. Safety net / shield (S)

A one-shot barrier across the bottom of the field that bounces the ball back once instead of
costing a life. It is the most forgiving power-up in the genre and the one most likely to keep a
struggling player in a run, which makes it a good difficulty-smoothing tool that does not require
touching the difficulty curve itself.

### 55. Magnet paddle and ball-slow-on-demand (S each)

Two small ball-control effects that reward skill rather than luck: a magnet that subtly curves the
ball toward the paddle's centre while active, and a hold-to-slow bullet-time button on a cooldown.
Both give the player agency during the moments the current game gives them none — the long
descent after a top-wall bounce.

### 56. Paddle spin / English on the ball (M)

Letting paddle *movement* at the moment of contact impart sideways momentum, rather than deriving
the bounce angle purely from hit position as `updateBalls()` does today. This is the single change
most likely to make the game feel skill-expressive to an experienced player, because it turns the
paddle from a mirror into an instrument. It is marked M rather than S because it interacts with the
tunnelling-prevention sweep and needs care not to let a player pin the ball into a horizontal
stalemate.

### 57. Negative power-up counterplay (S)

`narrow` and `fast` currently just happen to you. Giving the player an out — a brief window to
shoot a falling bad capsule with the laser, or a "cleanse" pickup that clears active negatives —
converts a frustration into a decision. Small change, disproportionate effect on how the bad drops
feel.

---

## D. Input, accessibility, and platform

### 61. Gamepad support (S)

The Gamepad API is a short polling loop in `frame()` that maps a stick axis to paddle position and
a face button to launch/fire, reusing the input paths that already exist for keyboard and pointer.
For a game whose core input is one axis and one button, this is close to free.

### 62. Colourblind-safe palette option (S)

Brick identity is currently carried almost entirely by hue — cyan, magenta, amber, lime — which is
exactly the failure mode for deuteranopia and protanopia. An alternate palette, or an optional
per-type shape/pattern marker inside the brick, would make type readable without colour. Given the
project's existing accessibility work (findings #22–#25 in [done.md](done.md)), this is the most
conspicuous remaining gap.

### 63. Difficulty selection (S)

An explicit easy / normal / hard choice at the start screen, adjusting starting lives, base ball
speed, and the drop rate of bad power-ups. The tuning surface for this already exists and is
centralised in `CONFIG` — most of the work is the UI, the persistence, and keeping the hall of fame
honest about which difficulty a score was set on.

### 64. Resume an interrupted run (S/M)

Serialising enough of `state` to `localStorage` on pause or page-hide, and offering "continue" on
the next visit. Since #41 a full run is 100 levels — one to two hours in a single sitting — so
closing the tab does not lose a few minutes, it loses the whole run. The main design question is
what to do about scores: a resumed run should probably still be hall-of-fame eligible, but that is a
decision, not an accident.

---

## E. Competition and replayability

### 66. Ghost replay of the best run (M)

Recording paddle positions per frame during the best-scoring run and replaying that as a faint
translucent paddle on subsequent attempts. It is a self-competition mechanic that costs nothing in
network or infrastructure — the input trace for a level is small — and it makes the existing local
hall of fame feel like an opponent rather than a list.

---

## Suggested first cuts

Of what remains in this file, the cheapest high-impact items are **#53 (fireball)** and **#54
(safety net)** — both S, both touching code paths that already exist. **#56 (paddle spin)** is the
one small-to-medium change most likely to raise the game's skill ceiling. The item that changed what
kind of game this is has left the file: **#44 (boss levels)** is now in [todo.md](todo.md), expanded
into a ten-boss roster.
