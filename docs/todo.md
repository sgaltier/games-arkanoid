# Blokrush — Open Findings

Target: [index.html](../html/index.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** one item open — #79.

**When an item here gets fixed:** the established loop (see [testing.md](testing.md)) is regression
test → fix → move the finding's whole entry from this file to [done.md](done.md), prepending a
`> **Fixed <date>.**` note that describes what shipped and keeping the original write-up below it as
the historical record → add an entry to [release-notes.md](release-notes.md).

**Line references, once written, are only valid against the current `index.html`** — the same
re-anchoring discipline applies here as in `done.md`.

---

## Gameplay / UX

### 79. Boss defeat is an anticlimax: music keeps playing, the blast is generic and silent (M)

Manual playtesting turned up three related gaps in the #74 death beat
(`bossDefeated()`/`updateBossDeathBeat()`, [3976](../html/index.html#L3976)):

- **The main music bed never stops.** `updateMusic()` ([3682](../html/index.html#L3682)) gates purely
  on `state.phase === "playing"`, and the death beat deliberately stays in that phase (the comment at
  [5238-5241](../html/index.html#L5238-L5241) explains why — no paddle/ball to freeze around
  otherwise). But `updateBossDeathBeat()`'s own comment at
  [3970-3972](../html/index.html#L3970-L3972) claims "no music plays during it", which isn't what
  happens: `updateMusic(dt)` is called unconditionally every frame ([5226](../html/index.html#L5226)),
  `inDeathBeat` never guards it, so the level bed keeps looping straight through the explosion and the
  fanfare instead of ducking out to let the fanfare land. Needs `updateMusic()` (or its call site) to
  stop scheduling once `inDeathBeat` is true, resuming normally once `checkLevelClear()` moves the
  level on.
- **The explosion is generic and mis-placed.** Both the escalating pulses and the finishing blast in
  `updateBossDeathBeat()` call `burst(GAME_W / 2, GAME_H / 2, def.color, n)`
  ([4009](../html/index.html#L4009), [4017-4018](../html/index.html#L4017-L4018)) — the center of the
  *screen*, not the boss's own position, so on any boss whose parts aren't centered (or that's still
  mid-arena-drift) the fireworks go off next to it rather than on it. `burst()` itself
  ([2647](../html/index.html#L2647)) is also a single uniform effect — same small square particles,
  same radial-random spread, used everywhere else in the game for ordinary hits — so a boss kill looks
  like one more brick breaking, just bigger. Requested directly: anchor the explosion on the boss's
  actual bounding box (`b.parts` gives x/y/w/h per part — union them, or track the boss's last known
  center, since parts can go `alive: false` before the kill) and give it a distinct look for the
  occasion — a fire-burst (short-lived, warm-colored, faster-fading particles reads as flame) plus a
  lightning element (a jagged multi-segment line/flash rather than another particle radius) rather than
  reusing plain `burst()` as-is.
- **The blast is silent.** Neither `bossDefeated()` nor `updateBossDeathBeat()` calls `beep()`/`tone()`
  or `noise()` — the only audio around the kill is `bossFanfareTone()`
  ([3537](../html/index.html#L3537)) once the fanfare stage starts, so the explosion itself makes no
  sound. Requested directly: a loud, multi-band 8-bit-style explosion — the kind of sound that layers a
  low rumble with a sharper crackle on top, rather than the thin single-band clicks `noise()`
  ([3334](../html/index.html#L3334)) currently produces one call at a time (see how the hi-hat recipe
  at [3629](../html/index.html#L3629) uses it for a sense of scale). Likely two or three overlapping
  `noise()` calls at different `freq`/`filter` settings (a lowpass thump plus a highpass crack, maybe a
  short `tone()` pitch-drop under it) fired once when the finishing blast lands.

---

Every review finding raised so far has shipped, and so have #44 (boss levels), #74 (the boss-kill
celebration built on top of it), #75 (a follow-on to #37), #78 (effect-bar names), #76 (hall-of-fame
name validation), and #77 (hall-of-fame profanity filtering, also already shipped) — see
[done.md](done.md). [feature-ideas.md](feature-ideas.md) still holds proposals not yet promoted. #79
above was requested directly by the user, not surfaced by a `/code-review` pass.

New items go here, keeping the shared numbering: the next free number is **#80**.
