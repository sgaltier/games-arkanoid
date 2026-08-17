# Blokrush — Open Findings

Target: [index.html](../html/index.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** four items open — #76, #77, #78, #79.

**When an item here gets fixed:** the established loop (see [testing.md](testing.md)) is regression
test → fix → move the finding's whole entry from this file to [done.md](done.md), prepending a
`> **Fixed <date>.**` note that describes what shipped and keeping the original write-up below it as
the historical record → add an entry to [release-notes.md](release-notes.md).

**Line references, once written, are only valid against the current `index.html`** — the same
re-anchoring discipline applies here as in `done.md`.

---

## Correctness

### 76. Hall of fame accepts an empty (or one/two-character) name (S)

`submitHallOfFameName()` ([4562](../html/index.html#L4562)) trims the `#nameentry-input` value and,
if that trim comes back empty, silently substitutes `nameentry.anonymous` (`"???"`) rather than
rejecting the entry — so a blank submission is accepted, it just doesn't look blank. There's no
lower bound at all: a one- or two-character name (`"x"`, `"ab"`) goes straight onto the board as
typed. The upper bound exists but is generous — `CONFIG.hallOfFame.nameMax`
([1415](../html/index.html#L1415)) is `12`, mirrored in the input's `maxlength="12"`
([763](../html/index.html#L763), deliberately kept in sync per the comment at
[1408-1409](../html/index.html#L1408-L1409)).

Requested directly: enforce a **minimum of 3 characters**, raise the maximum to **16** (both
`nameMax` and the markup's `maxlength` need to move together, same as today). A trimmed length below
the minimum should block submission rather than fall back to the anonymous placeholder — needs a
disabled/inert submit state or an inline validation message (`nameentry.*` string, added to every
`STRINGS[lang]` table per the i18n convention) rather than a silent no-op, so the player understands
why Enter/the submit button isn't doing anything. Should also fix the same input's Enter-key handler
([2744](../html/index.html#L2744)), which currently submits whatever `submitHallOfFameName()` would
accept.

### 77. Hall of fame names aren't checked for profanity (M)

Nothing between the player and the board filters what a name actually *says* — `cleanName()` in
[functions/api/scores.js](../functions/api/scores.js#L117) (global board) and
`submitHallOfFameName()` in [index.html](../html/index.html#L4562) (local fallback board) both only
strip control characters, trim, and clamp to `NAME_MAX`/`nameMax`. A slur, a sexual name, or any
other offensive string goes straight onto a board that's shown to every player and — per
[#67](done.md) — **can never be reset**, so there's no cleanup path once one lands.

Requested directly: check the entered name against a profanity/inappropriate-content list (covering
slurs and sexual connotations, not just an exact-match blocklist — leetspeak/spacing tricks like
`"a55"` or `"s e x"` are the usual way these get through a naive filter) and, if it matches, silently
substitute **"Bisounours"** instead of the typed name — same shape as today's empty-name fallback to
`nameentry.anonymous` ([4564](../html/index.html#L4564)), just a different replacement string and a
different trigger condition. Needs to run in **both** places, not just the client: the global board's
`POST /api/scores` is a public endpoint and can be hit directly with an unfiltered name, bypassing
any client-side check.

Open question worth resolving before implementing: what list/library backs the check. A self-hosted
wordlist (bundled with `functions/api/scores.js`, and mirrored into `index.html` for the local-board
path so the two stay in sync — same "restated in both places" trap the boss/preview-env bindings
already have per [CLAUDE.md](../CLAUDE.md)) avoids adding a network dependency to either the Worker
or the single-file game, but needs upkeep and won't catch everything; an external moderation API
covers more but adds a runtime dependency (and a new failure mode) to a backend that's explicitly
allowed to degrade to "the leaderboard is empty" today, not to "the leaderboard rejects everyone."

---

## Gameplay / UX

### 78. Effect bars label active power-ups with a single cryptic letter (S)

The `#effect-bars` strip (`renderEffectBars()`, [4750](../html/index.html#L4750)) shows one bar per
active timed power-up, but the only text on each bar is a one- or two-letter abbreviation taken
straight from the `POWERUPS` table's `label` field ([1246-1253](../html/index.html#L1246-L1253)):
`W`/`N` for widen/narrow, `S`/`F` for slow/fast, `St` for sticky, `L` for laser. Nothing decodes
these for the player — there's no tooltip, no legend, and the strip is `aria-hidden="true"`
([812](../html/index.html#L812)) on top of that, so a new player watching a bar drain has no way to
learn which power-up it represents.

Requested directly: show the power-up's whole name rather than (or alongside) the letter, so players
actually know what's active and about to expire. There's no existing i18n string for any power-up
name today — grep confirms `STRINGS` has no `powerup.*` keys — so this needs new entries added to
**every** `STRINGS[lang]` table per the i18n convention, plus a decision on how to fit a full word
into a 16px-tall bar (see the `.effect-bars` height comment at [228](../html/index.html#L228)): a
`title` tooltip on the bar is the cheap option, but a longer on-bar label (or a label that appears on
hover/focus) reads better for a mostly-mouseless arcade game. `bar-sticky`/`bar-laser` currently hard-code
their letters directly in the markup ([823](../html/index.html#L823),
[827](../html/index.html#L827)) rather than going through `*-label` elements like width/speed do — that
asymmetry would need to go away for both to reach full names through the same code path.

### 79. Boss defeat is an anticlimax: music keeps playing, the blast is generic and silent (M)

Manual playtesting turned up three related gaps in the #74 death beat
(`bossDefeated()`/`updateBossDeathBeat()`, [3937](../html/index.html#L3937)):

- **The main music bed never stops.** `updateMusic()` ([3643](../html/index.html#L3643)) gates purely
  on `state.phase === "playing"`, and the death beat deliberately stays in that phase (the comment at
  [5132-5135](../html/index.html#L5132-L5135) explains why — no paddle/ball to freeze around
  otherwise). But `updateBossDeathBeat()`'s own comment at
  [3931-3933](../html/index.html#L3931-L3933) claims "no music plays during it", which isn't what
  happens: `updateMusic(dt)` is called unconditionally every frame ([5120](../html/index.html#L5120)),
  `inDeathBeat` never guards it, so the level bed keeps looping straight through the explosion and the
  fanfare instead of ducking out to let the fanfare land. Needs `updateMusic()` (or its call site) to
  stop scheduling once `inDeathBeat` is true, resuming normally once `checkLevelClear()` moves the
  level on.
- **The explosion is generic and mis-placed.** Both the escalating pulses and the finishing blast in
  `updateBossDeathBeat()` call `burst(GAME_W / 2, GAME_H / 2, def.color, n)`
  ([3970](../html/index.html#L3970), [3978-3979](../html/index.html#L3978-L3979)) — the center of the
  *screen*, not the boss's own position, so on any boss whose parts aren't centered (or that's still
  mid-arena-drift) the fireworks go off next to it rather than on it. `burst()` itself
  ([2610](../html/index.html#L2610)) is also a single uniform effect — same small square particles,
  same radial-random spread, used everywhere else in the game for ordinary hits — so a boss kill looks
  like one more brick breaking, just bigger. Requested directly: anchor the explosion on the boss's
  actual bounding box (`b.parts` gives x/y/w/h per part — union them, or track the boss's last known
  center, since parts can go `alive: false` before the kill) and give it a distinct look for the
  occasion — a fire-burst (short-lived, warm-colored, faster-fading particles reads as flame) plus a
  lightning element (a jagged multi-segment line/flash rather than another particle radius) rather than
  reusing plain `burst()` as-is.
- **The blast is silent.** Neither `bossDefeated()` nor `updateBossDeathBeat()` calls `beep()`/`tone()`
  or `noise()` — the only audio around the kill is `bossFanfareTone()`
  ([3498](../html/index.html#L3498)) once the fanfare stage starts, so the explosion itself makes no
  sound. Requested directly: a loud, multi-band 8-bit-style explosion — the kind of sound that layers a
  low rumble with a sharper crackle on top, rather than the thin single-band clicks `noise()`
  ([3295](../html/index.html#L3295)) currently produces one call at a time (see how the hi-hat recipe
  at [3590](../html/index.html#L3590) uses it for a sense of scale). Likely two or three overlapping
  `noise()` calls at different `freq`/`filter` settings (a lowpass thump plus a highpass crack, maybe a
  short `tone()` pitch-drop under it) fired once when the finishing blast lands.

---

Every review finding raised so far has shipped, and so have #44 (boss levels), #74 (the boss-kill
celebration built on top of it), and #75 (a follow-on to #37, also already shipped) — see
[done.md](done.md). [feature-ideas.md](feature-ideas.md) still holds proposals not yet promoted.
#76, #77, #78, and #79 above were all requested directly by the user, not surfaced by a
`/code-review` pass.

New items go here, keeping the shared numbering: the next free number is **#80**.
