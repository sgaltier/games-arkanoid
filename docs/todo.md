# Blokrush — Open Findings

Target: [index.html](../html/index.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** 0 open items — every finding of the 2026-08-22 holistic review pass (§K; #95, #96, #97,
#98, #99, #100, and #101) has shipped. #47, #50, #56, and #63 — previously promoted here from
[feature-ideas.md](feature-ideas.md) — have been moved back there as unshipped proposals; see that
file for their write-ups. #46 from the old §A batch, #53, #54, #55, and #57 from the old §C batch,
#82 (raised directly), #83 (raised directly), #84–#93 (the full 2026-08-21 review pass), #64
(promoted from the old §D), #94 (raised directly), #95, #96, #97, #98, #99, #100, and #101 have
shipped (see [done.md](done.md)).
#62 (promoted from the old §D) was discarded outright rather than fixed.

**When an item here gets fixed:** the established loop (see [testing.md](testing.md)) is regression
test → fix → move the finding's whole entry from this file to [done.md](done.md), prepending a
`> **Fixed <date>.**` note that describes what shipped and keeping the original write-up below it as
the historical record → add an entry to [release-notes.md](release-notes.md).

**Line references, once written, are only valid against the current `index.html`** — the same
re-anchoring discipline applies here as in `done.md`. Unlike the feature entries this file used to
carry, the ones below describe code that exists today, so they **do** carry line anchors and those
anchors go stale the moment the file is edited.

---

Every directly-requested feature raised so far has shipped — #44 (boss levels), #74 (the boss-kill
celebration built on top of it), #75 (a follow-on to #37), #78 (effect-bar names), #76 (hall-of-fame
name validation), #77 (hall-of-fame profanity filtering), #79 (the boss-kill death beat's
music/explosion/sound gaps), #80 (level-progress-driven music intensity), #81 (the level-clear
fanfare), #46 (level select), #53 (the fireball power-up), #54 (the safety-net shield), #55 (magnet
paddle / hold-to-slow bullet time), #82 (the `neonbreak-*` → `blokrush-*` rename), #83 (per-level star
ratings), #64 (resume an interrupted run), and #94 (showing #83's star rating on the levelclear
overlay) — see [done.md](done.md). #47 (daily challenge seed), #50 (moving bricks), #56 (paddle
spin), and #63 (difficulty selection) sit unshipped in [feature-ideas.md](feature-ideas.md). The ten
findings raised by the 2026-08-21 review (#84–#93) are all shipped — see [done.md](done.md) §I.

All seven findings of the **holistic review on 2026-08-22** — a read of the whole repository
(`index.html`, `functions/api/scores.js`, the schema, the docs), the same shape as the pass that
produced #84–#93 — have shipped; §J/§K live in [done.md](done.md). New review findings go here,
keeping the shared numbering: the next free number is **#102**.
