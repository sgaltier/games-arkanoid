# Blokrush — Open Findings

Target: [index.html](../html/index.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** two items open — #77, #79.

**When an item here gets fixed:** the established loop (see [testing.md](testing.md)) is regression
test → fix → move the finding's whole entry from this file to [done.md](done.md), prepending a
`> **Fixed <date>.**` note that describes what shipped and keeping the original write-up below it as
the historical record → add an entry to [release-notes.md](release-notes.md).

**Line references, once written, are only valid against the current `index.html`** — the same
re-anchoring discipline applies here as in `done.md`.

---

## Correctness

### 77. Hall of fame names aren't checked for profanity (M)

Nothing between the player and the board filters what a name actually *says* — `cleanName()` in
[functions/api/scores.js](../functions/api/scores.js#L120) (global board) and
`submitHallOfFameName()` in [index.html](../html/index.html#L4601) (local fallback board) both only
strip control characters, trim, and clamp to `NAME_MAX`/`nameMax`. A slur, a sexual name, or any
other offensive string goes straight onto a board that's shown to every player and — per
[#67](done.md) — **can never be reset**, so there's no cleanup path once one lands.

Requested directly: check the entered name against a profanity/inappropriate-content list (covering
slurs and sexual connotations, not just an exact-match blocklist — leetspeak/spacing tricks like
`"a55"` or `"s e x"` are the usual way these get through a naive filter) and, if it matches, silently
substitute **"Bisounours"** instead of the typed name. Since [#76](done.md) an empty or too-short name
is rejected rather than substituted, so this needs its own trigger (profane, not short) and its own
silent substitution, not a reuse of that path. Needs to run in **both** places, not just the client:
the global board's `POST /api/scores` is a public endpoint and can be hit directly with an unfiltered
name, bypassing any client-side check.

Open question worth resolving before implementing: what list/library backs the check. A self-hosted
wordlist (bundled with `functions/api/scores.js`, and mirrored into `index.html` for the local-board
path so the two stay in sync — same "restated in both places" trap the boss/preview-env bindings
already have per [CLAUDE.md](../CLAUDE.md)) avoids adding a network dependency to either the Worker
or the single-file game, but needs upkeep and won't catch everything; an external moderation API
covers more but adds a runtime dependency (and a new failure mode) to a backend that's explicitly
allowed to degrade to "the leaderboard is empty" today, not to "the leaderboard rejects everyone."

---

## Gameplay / UX

### 79. Boss defeat is an anticlimax: music keeps playing, the blast is generic and silent (M)

Manual playtesting turned up three related gaps in the #74 death beat
(`bossDefeated()`/`updateBossDeathBeat()`, [3973](../html/index.html#L3973)):

- **The main music bed never stops.** `updateMusic()` ([3679](../html/index.html#L3679)) gates purely
  on `state.phase === "playing"`, and the death beat deliberately stays in that phase (the comment at
  [5183-5186](../html/index.html#L5183-L5186) explains why — no paddle/ball to freeze around
  otherwise). But `updateBossDeathBeat()`'s own comment at
  [3967-3969](../html/index.html#L3967-L3969) claims "no music plays during it", which isn't what
  happens: `updateMusic(dt)` is called unconditionally every frame ([5171](../html/index.html#L5171)),
  `inDeathBeat` never guards it, so the level bed keeps looping straight through the explosion and the
  fanfare instead of ducking out to let the fanfare land. Needs `updateMusic()` (or its call site) to
  stop scheduling once `inDeathBeat` is true, resuming normally once `checkLevelClear()` moves the
  level on.
- **The explosion is generic and mis-placed.** Both the escalating pulses and the finishing blast in
  `updateBossDeathBeat()` call `burst(GAME_W / 2, GAME_H / 2, def.color, n)`
  ([4006](../html/index.html#L4006), [4014-4015](../html/index.html#L4014-L4015)) — the center of the
  *screen*, not the boss's own position, so on any boss whose parts aren't centered (or that's still
  mid-arena-drift) the fireworks go off next to it rather than on it. `burst()` itself
  ([2644](../html/index.html#L2644)) is also a single uniform effect — same small square particles,
  same radial-random spread, used everywhere else in the game for ordinary hits — so a boss kill looks
  like one more brick breaking, just bigger. Requested directly: anchor the explosion on the boss's
  actual bounding box (`b.parts` gives x/y/w/h per part — union them, or track the boss's last known
  center, since parts can go `alive: false` before the kill) and give it a distinct look for the
  occasion — a fire-burst (short-lived, warm-colored, faster-fading particles reads as flame) plus a
  lightning element (a jagged multi-segment line/flash rather than another particle radius) rather than
  reusing plain `burst()` as-is.
- **The blast is silent.** Neither `bossDefeated()` nor `updateBossDeathBeat()` calls `beep()`/`tone()`
  or `noise()` — the only audio around the kill is `bossFanfareTone()`
  ([3534](../html/index.html#L3534)) once the fanfare stage starts, so the explosion itself makes no
  sound. Requested directly: a loud, multi-band 8-bit-style explosion — the kind of sound that layers a
  low rumble with a sharper crackle on top, rather than the thin single-band clicks `noise()`
  ([3331](../html/index.html#L3331)) currently produces one call at a time (see how the hi-hat recipe
  at [3626](../html/index.html#L3626) uses it for a sense of scale). Likely two or three overlapping
  `noise()` calls at different `freq`/`filter` settings (a lowpass thump plus a highpass crack, maybe a
  short `tone()` pitch-drop under it) fired once when the finishing blast lands.

---

Every review finding raised so far has shipped, and so have #44 (boss levels), #74 (the boss-kill
celebration built on top of it), #75 (a follow-on to #37), #78 (effect-bar names), and #76
(hall-of-fame name validation, also already shipped) — see [done.md](done.md).
[feature-ideas.md](feature-ideas.md) still holds proposals not yet promoted. #77 and #79 above were
both requested directly by the user, not surfaced by a `/code-review` pass.

New items go here, keeping the shared numbering: the next free number is **#80**.
