# Blokrush — Open Findings

Target: [index.html](../html/index.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** three items open — #75, #76, #77.

**When an item here gets fixed:** the established loop (see [testing.md](testing.md)) is regression
test → fix → move the finding's whole entry from this file to [done.md](done.md), prepending a
`> **Fixed <date>.**` note that describes what shipped and keeping the original write-up below it as
the historical record → add an entry to [release-notes.md](release-notes.md).

**Line references, once written, are only valid against the current `index.html`** — the same
re-anchoring discipline applies here as in `done.md`.

---

## Accessibility / layout

### 75. The power-up timer bars sit in the wrong place on wide viewports (S/M)

`.effect-bars` (`bar-width`/`bar-speed`/`bar-sticky`/`bar-laser` — the widen/narrow, slow/fast,
sticky and laser countdowns) reads correctly on a phone: below the canvas, wrapping horizontally as
slots come and go. On a desktop-width browser it instead sits as an **84px-wide column to the right**
of the canvas — `.play-row` (`display: flex`, [262](../html/index.html#L262)) puts `.screen-wrap`
and `.effect-bars` ([219](../html/index.html#L219)) side by side above the
`@media (max-width: 560px)` breakpoint ([646](../html/index.html#L646)), and only below it does
`.play-row` switch to `flex-direction: column` and `.effect-bars` to a wrapping row — the layout the
phone gets. Reported from play: the sidebar reads as misplaced on a normal window, not as an
intentional alternate layout.

**Not simply an oversight — #37 in [done.md](done.md) put it there on purpose**, and the reason
still holds: `.effect-bar` slots toggle via the `hidden` attribute
(`updateEffectBar()`, [4752](../html/index.html#L4752)), so with the bars stacked as an ordinary
block above the canvas (the pre-#37 layout, which is what a phone still gets today), a slot
appearing or disappearing mid-rally changed that block's height and shoved the canvas — and the
player's aim with it — up or down. The side column fixed that by making `.effect-bars` a flex
sibling of `.screen-wrap` rather than a block above it, so its own height changes never touch the
canvas's position.

**So the fix has to keep that property, not just move the column back below the canvas.** Naively
restoring the phone's stacked-block layout at desktop widths too would reintroduce #37's bug there
instead. The layout that gets both — bars below the canvas *and* a canvas that never shifts — is a
row below `.screen-wrap` with a **reserved, fixed height** regardless of how many slots are
currently visible (sized for all four bars at once, each already a fixed `height: 16px`
([226](../html/index.html#L226)) plus the row's `gap`), so a slot's `hidden` toggle changes what's
painted inside that row without changing the row's own height. That likely means dropping
`.effect-bars`' `flex: 0 0 84px` column basis for a `flex: 0 0 auto` row one reused from the existing
`@media (max-width: 560px)` block ([646-656](../html/index.html#L646-L656)) — applied unconditionally
rather than only below the breakpoint — with the reserved height added rather than left implicit.
Worth confirming `fitCanvas()` (#17) still re-derives the right backing-store size once the canvas's
displayed width changes (it reads live layout, so it should need nothing).

Doing it this way also closes #37's own accepted trade-off for narrow viewports (noted in that
entry as "an accepted trade-off ... rather than a full fix") — the reserved height removes the
canvas-shift on small phones too, not just at desktop widths, for the same reason it fixes the
sidebar there.

---

## Correctness

### 76. Hall of fame accepts an empty (or one/two-character) name (S)

`submitHallOfFameName()` ([4575](../html/index.html#L4575)) trims the `#nameentry-input` value and,
if that trim comes back empty, silently substitutes `nameentry.anonymous` (`"???"`) rather than
rejecting the entry — so a blank submission is accepted, it just doesn't look blank. There's no
lower bound at all: a one- or two-character name (`"x"`, `"ab"`) goes straight onto the board as
typed. The upper bound exists but is generous — `CONFIG.hallOfFame.nameMax`
([1428](../html/index.html#L1428)) is `12`, mirrored in the input's `maxlength="12"`
([776](../html/index.html#L776), deliberately kept in sync per the comment at
[1421-1422](../html/index.html#L1421-L1422)).

Requested directly: enforce a **minimum of 3 characters**, raise the maximum to **16** (both
`nameMax` and the markup's `maxlength` need to move together, same as today). A trimmed length below
the minimum should block submission rather than fall back to the anonymous placeholder — needs a
disabled/inert submit state or an inline validation message (`nameentry.*` string, added to every
`STRINGS[lang]` table per the i18n convention) rather than a silent no-op, so the player understands
why Enter/the submit button isn't doing anything. Should also fix the same input's Enter-key handler
([2757](../html/index.html#L2757)), which currently submits whatever `submitHallOfFameName()` would
accept.

### 77. Hall of fame names aren't checked for profanity (M)

Nothing between the player and the board filters what a name actually *says* — `cleanName()` in
[functions/api/scores.js](../functions/api/scores.js#L117) (global board) and
`submitHallOfFameName()` in [index.html](../html/index.html#L4575) (local fallback board) both only
strip control characters, trim, and clamp to `NAME_MAX`/`nameMax`. A slur, a sexual name, or any
other offensive string goes straight onto a board that's shown to every player and — per
[#67](done.md) — **can never be reset**, so there's no cleanup path once one lands.

Requested directly: check the entered name against a profanity/inappropriate-content list (covering
slurs and sexual connotations, not just an exact-match blocklist — leetspeak/spacing tricks like
`"a55"` or `"s e x"` are the usual way these get through a naive filter) and, if it matches, silently
substitute **"Bisounours"** instead of the typed name — same shape as today's empty-name fallback to
`nameentry.anonymous` ([4577](../html/index.html#L4577)), just a different replacement string and a
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

Every review finding raised so far has shipped, and so have both #44 (boss levels) and #74 (the
boss-kill celebration built on top of it) — see [done.md](done.md). #75 is a follow-on to #37, also
already shipped: its fix works as designed but reads as wrong on a normal window, found during play
rather than promoted from [feature-ideas.md](feature-ideas.md), which still holds proposals not yet
promoted. #76 and #77 above were both requested directly by the user, not surfaced by a
`/code-review` pass.

New items go here, keeping the shared numbering: the next free number is **#78**.
