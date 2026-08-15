# Blokrush — Open Findings

Target: [index.html](../html/index.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** 1 open finding.

**When an item here gets fixed:** the established loop (see [testing.md](testing.md)) is regression
test → fix → move the finding's whole entry from this file to [done.md](done.md), prepending a
`> **Fixed <date>.**` note that describes what shipped and keeping the original write-up below it as
the historical record → add an entry to [release-notes.md](release-notes.md).

**Line references, once written, are only valid against the current `index.html`** — the same
re-anchoring discipline applies here as in `done.md`.

---

## Gameplay / UX enhancements

### 70. The music is too repetitive (M)

#59 shipped a music bed and it works, but it wears out fast. The reason is arithmetic rather than
taste: the bed is **one 16-step bar looped forever**. `MUSIC_STEPS` is 16
([2378](../html/index.html#L2378)) and `updateMusic()` advances `music.step` modulo it
([2424–2440](../html/index.html#L2424-L2440)), so at `CONFIG.music.tempo` 132 a step is
`60 / 132 / 4` = 0.114 s and the whole loop is **1.8 seconds long**. A single level is minutes of the
same two seconds, and #41 made a full run a hundred levels.

Nothing else varies enough to cover for that:

- **The material never changes.** `MUSIC_VOICES` ([2379–2357](../html/index.html#L2379-L2357)) is
  four fixed voices with fixed `steps` arrays. What combo buys is *which voices sound*
  (`nextIntensity`, [2411–2373](../html/index.html#L2411-L2373)) — four states of the same bar, not
  four different bars.
- **Per-level variation is transposition only.** `musicRoot()` picks a root from ten keys by
  `state.levelIndex % 10` ([2304–2305](../html/index.html#L2304-L2305)), so level 11 is level 1 again
  in the same key, and a 100-level run cycles those ten keys ten times.
- **One scale and one tempo for the entire game** — `MUSIC_SCALE` is a single minor pentatonic
  ([2303](../html/index.html#L2303)) and `tempo` is one number in `CONFIG.music`
  ([1206–1212](../html/index.html#L1206-L1212)).
- **There is no percussion at all.** Four pitched voices carry both the harmony and the pulse, which
  is why the pulse has to be so regular.

#### Direction

Loop *length* is most of the perceived fix, well ahead of harmonic sophistication. Getting from a
1.8-second loop to a phrase of ten or fifteen seconds would do more than any amount of cleverness
inside the current bar. Roughly in order of value for effort:

- **A multi-bar phrase.** Give the loop a bar dimension — a 4- or 8-bar form where a voice's pattern
  is selected per bar, with the last bar carrying a fill. `scheduleStep()`
  ([2395–2409](../html/index.html#L2395-L2409)) already takes the step index and asks each voice
  whether it plays; extending that to `(bar, step)` is a small change to a data table rather than to
  the scheduler.
- **Percussion.** A noise-based kick and hat would carry the groove and let the melodic voices thin
  out, which is what stops a loop sounding like a loop. `tone()` is oscillator-only today
  ([2266–2292](../html/index.html#L2266-L2292)), so this needs a short noise buffer — the one piece
  of genuinely new audio machinery here.
- **Material per act, not just a new key per level.** #60 already groups levels into acts with their
  own palette. Tying scale, tempo and voice types to the act would make the score turn over when the
  backdrop does, which is both more variety and better structure than a key change nobody can hear
  across a level break.
- **Tempo that is not one constant.** Even a modest per-act tempo, or a small lift as `levelSpeed()`
  climbs, changes the character of the same material.

#### Two constraints this must not break

- **The bed rolls no dice.** `#59g` asserts the music consumes no randomness, for the same reason
  `#58f` and `#60d` do for the shake and the background: `Math.random()` in the audio path would make
  drop chances and mystery resolutions depend on how long the music had been playing. Any variation
  has to be a function of bar/step/level or come from the seeded `seededRandom()` helper (#41), never
  from the shared stream. This is the single easiest thing to get wrong here.
- **The bed stays presentation.** `updateMusic()` reads `state.phase` and `state.combo` and writes
  neither, so the game plays identically with sound off. Nothing added here may feed back into
  simulation, and the existing mute button must keep covering all of it.

Also worth watching: `scheduleStep()` creates a gain node and an oscillator per note
([2275–2288](../html/index.html#L2275-L2288)), so a denser arrangement is more allocation per bar. It
is queued in `lookahead` batches rather than per frame, so this is not a per-frame cost, but a
percussion voice on every step is 16 more nodes a bar than the current busiest voice.

#### Tests

`#59`'s cases must keep passing unchanged — the harness already records every note the game
schedules, so the new material is assertable the same way. Worth adding: that the loop is actually
longer than one bar (the same bar index does not recur within N steps), that the arrangement still
responds to combo, and — most importantly — that generating a phrase still consumes no randomness,
extending `#59g` rather than replacing it.
