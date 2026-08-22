# Blokrush — Open Findings

Target: [index.html](../html/index.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** 1 open item — the last unshipped finding of the **second holistic review pass on
2026-08-22**, a read of the whole repository (`index.html`, `functions/api/scores.js`, the schema,
the test harness, the docs), the same shape as the passes that produced #84–#93 and #95–#101. It is
grouped into §M (security and backend); §L (correctness) is now fully shipped. It was reproduced
against the current file before being written up; the reproduction is quoted in the entry. Everything
else from earlier passes has shipped: #95–#101 (the first 2026-08-22 pass) live in [done.md](done.md)
§J/§K, #102–#106 (the first five of this second pass) in §L, #84–#93 in §I, and every directly-requested
feature so far in §H. #47, #50, #56, and #63 sit unshipped in [feature-ideas.md](feature-ideas.md);
#62 was discarded outright rather than fixed.

**When an item here gets fixed:** the established loop (see [testing.md](testing.md)) is regression
test → fix → move the finding's whole entry from this file to [done.md](done.md), prepending a
`> **Fixed <date>.**` note that describes what shipped and keeping the original write-up below it as
the historical record → add an entry to [release-notes.md](release-notes.md).

**Line references, once written, are only valid against the current `index.html`** — the same
re-anchoring discipline applies here as in `done.md`. New review findings go here, keeping the
shared numbering: the next free number is **#108**.

---

## M. Security and backend

Raised by the same pass. In [functions/api/scores.js](../functions/api/scores.js) and its
`index.html` mirror.

### 107. Bidi isolates and other invisible characters survive `cleanName()`'s strip (S)

#100 strips control characters, bidi *overrides* and zero-width characters from hall-of-fame names —
the class `U+0000–U+001F, U+007F, U+200B–U+200F, U+202A–U+202E` in `cleanName()`
([functions/api/scores.js:131-140](../functions/api/scores.js#L131-L140)) and its mirror
`cleanHofName()` ([5732-5737](../html/index.html#L5732-L5737)) — on the stated goal that a name
"cannot be used to visually reorder or hide characters on a permanent, world-visible board". The
range misses the characters that still can:

```
U+2066 LRI: SURVIVES | U+2067 RLI: SURVIVES | U+2069 PDI: SURVIVES | U+202E RLO: stripped
U+FEFF: SURVIVES | U+2060 WJ: SURVIVES | U+00AD SHY: SURVIVES | U+061C ALM: SURVIVES
```

The **bidi isolates** U+2066–U+2069 (LRI/RLI/FSI/PDI) reorder rendered text exactly the way the
stripped U+202A–U+202E embeddings/overrides do — they are the *newer* mechanism, introduced to
replace the old one — so the current strip closes the legacy door and leaves the modern one open. A
name like `abc<RLI>fed<PDI>` renders reordered on every player's board, permanently (#67's board is
never reset). U+FEFF (zero-width no-break space), U+2060–U+2064 (word joiner and invisible
operators), U+00AD (soft hyphen) and U+061C (Arabic letter mark) are invisible padding: a "name" of
mostly invisibles renders as a near-blank row while passing the server's non-empty check. None of
them helps evade the profanity filter — the survivors just count as the `[^a-z]*` filler
PROFANITY_RE already allows — so this is display integrity, not filter evasion.

**Fix: widen the class in both copies at once** (they must stay mirrored, per the #100/#89c rule) —
add `U+00AD, U+061C, U+2060–U+2064, U+2066–U+2069, U+FEFF` — or replace the blocklist with the
positive rule it is approximating: strip anything in Unicode categories Cf/Cc
(`/[\p{Cf}\p{Cc}]/gu`, supported in every runtime this ships to). Note the client mirror also feeds
the *local* board, so the fix lands in `index.html` even for offline play. A migration on rows
already stored is out of scope — the board is never reset, and no such name is known to be on it.

#### Tests

- `#107a` (game side) — a name containing U+2067/U+FEFF submitted through `cleanHofName()` lands on
  the local board with those characters gone.
- `#107b` — the two strip patterns in `index.html` and `functions/api/scores.js` are identical (the
  same structural assertion the profanity lists already get).
