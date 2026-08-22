# Blokrush — Open Findings

Target: [index.html](../html/index.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** 0 open items — every finding from the **second holistic review pass on 2026-08-22**, a
read of the whole repository (`index.html`, `functions/api/scores.js`, the schema, the test harness,
the docs), the same shape as the passes that produced #84–#93 and #95–#101, has shipped: #95–#101
(the first 2026-08-22 pass) live in [done.md](done.md) §J/§K, #102–#107 (the second pass) in §L,
#84–#93 in §I, and every directly-requested feature so far in §H. #47, #50, #56, and #63 sit
unshipped in [feature-ideas.md](feature-ideas.md); #62 was discarded outright rather than fixed.

**When an item here gets fixed:** the established loop (see [testing.md](testing.md)) is regression
test → fix → move the finding's whole entry from this file to [done.md](done.md), prepending a
`> **Fixed <date>.**` note that describes what shipped and keeping the original write-up below it as
the historical record → add an entry to [release-notes.md](release-notes.md).

**Line references, once written, are only valid against the current `index.html`** — the same
re-anchoring discipline applies here as in `done.md`. New review findings go here, keeping the
shared numbering: the next free number is **#108**.
