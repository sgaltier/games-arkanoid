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
#52, #53, #54, #55, #56, #57, #58, #59, #60, #65) have already been promoted into
[todo.md](todo.md).

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

Of what remains in this file, the cheapest items are **#61 (gamepad)** and **#63 (difficulty
selection)** — both S, both touching config/input surfaces that already exist. **#46 (level select)**
is the one most likely to matter for retention, since #41 made a full run 100 levels long. Two items
have left the file for [todo.md](todo.md): **#44 (boss levels)**, expanded into a ten-boss roster,
and **#53–57 (power-ups and ball mechanics)** — fireball, shield, magnet/bullet-time, paddle spin,
and negative-power-up counterplay, expanded together since they share the same handful of functions.
