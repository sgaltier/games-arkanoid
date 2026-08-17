# Blokrush — Open Findings

Target: [index.html](../html/index.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** two items open — #76, #77.

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

Every review finding raised so far has shipped, and so have #44 (boss levels), #74 (the boss-kill
celebration built on top of it), and #75 (a follow-on to #37, also already shipped) — see
[done.md](done.md). [feature-ideas.md](feature-ideas.md) still holds proposals not yet promoted.
#76 and #77 above were both requested directly by the user, not surfaced by a `/code-review` pass.

New items go here, keeping the shared numbering: the next free number is **#78**.
