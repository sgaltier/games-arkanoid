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
moves. Do not reuse these numbers for new review findings. Every number in the range (#44–#66) has
now either been promoted into [todo.md](todo.md) or discarded outright: #45 duplicated finding #41,
already shipped; #48 (a level editor and shareable layouts), #61 (gamepad support), and #66 (ghost
replay of the best run) were dropped from the menu.

**What already exists** (so nothing below duplicates it): a 100-level campaign — 10 hand-authored
levels and 90 generated deterministically from the level number (#41); 4 brick colours
plus silver (2 hp) and indestructible walls; 9 power-ups (`widen`, `narrow`, `slow`, `fast`,
`multi`, `life`, `sticky`, `laser`, `fireball`); a within-level difficulty ramp; a combo score multiplier;
floating score pop-ups; particle bursts; a 10-entry local hall of fame; FR/EN localisation;
a combo-reactive music bed with a voice per brick type (#59); five per-act backdrops with a
parallax star field (#60); mute, pause, and `prefers-reduced-motion` support.

---

## Where everything went

Nothing remains in this file — every reserved number has either been promoted to
[todo.md](todo.md) or discarded outright. Eight items left for `todo.md`: **#44 (boss levels)**,
expanded into a ten-boss roster; **#46 (level select and per-level star ratings)**, the one most
likely to matter for retention, since #41 made a full run 100 levels long; **#47 (daily challenge
seed)**; **#50 (moving bricks)**; **#62 (colourblind-safe brick markers)**; **#63 (difficulty
selection)**; **#64 (resume an interrupted run)**; and **#53–57 (power-ups and ball mechanics)** —
fireball, shield, magnet/bullet-time, paddle spin, and negative-power-up counterplay, expanded
together since they share the same handful of functions. Four were dropped instead: **#45**
(duplicated #41, already shipped), **#48** (a level editor and shareable layouts), **#61** (gamepad
support), and **#66** (ghost replay of the best run).
