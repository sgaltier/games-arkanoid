# Blokrush — Open Findings

Target: [index.html](../html/index.html). This is the **open** half of the project's review backlog —
findings and enhancement ideas surfaced by a `/code-review` pass, found during play, or promoted
from [feature-ideas.md](feature-ideas.md), that haven't shipped yet. Fixed findings live in
[done.md](done.md); numbering is shared across all three files and never reused, so a number here
won't collide with one already in `done.md`.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** 2 open findings.

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
([2335](../html/index.html#L2335)) and `updateMusic()` advances `music.step` modulo it
([2381–2397](../html/index.html#L2381-L2397)), so at `CONFIG.music.tempo` 132 a step is
`60 / 132 / 4` = 0.114 s and the whole loop is **1.8 seconds long**. A single level is minutes of the
same two seconds, and #41 made a full run a hundred levels.

Nothing else varies enough to cover for that:

- **The material never changes.** `MUSIC_VOICES` ([2336–2346](../html/index.html#L2336-L2346)) is
  four fixed voices with fixed `steps` arrays. What combo buys is *which voices sound*
  (`nextIntensity`, [2368–2376](../html/index.html#L2368-L2376)) — four states of the same bar, not
  four different bars.
- **Per-level variation is transposition only.** `musicRoot()` picks a root from ten keys by
  `state.levelIndex % 10` ([2290–2291](../html/index.html#L2290-L2291)), so level 11 is level 1 again
  in the same key, and a 100-level run cycles those ten keys ten times.
- **One scale and one tempo for the entire game** — `MUSIC_SCALE` is a single minor pentatonic
  ([2289](../html/index.html#L2289)) and `tempo` is one number in `CONFIG.music`
  ([1206–1212](../html/index.html#L1206-L1212)).
- **There is no percussion at all.** Four pitched voices carry both the harmony and the pulse, which
  is why the pulse has to be so regular.

#### Direction

Loop *length* is most of the perceived fix, well ahead of harmonic sophistication. Getting from a
1.8-second loop to a phrase of ten or fifteen seconds would do more than any amount of cleverness
inside the current bar. Roughly in order of value for effort:

- **A multi-bar phrase.** Give the loop a bar dimension — a 4- or 8-bar form where a voice's pattern
  is selected per bar, with the last bar carrying a fill. `scheduleStep()`
  ([2352–2366](../html/index.html#L2352-L2366)) already takes the step index and asks each voice
  whether it plays; extending that to `(bar, step)` is a small change to a data table rather than to
  the scheduler.
- **Percussion.** A noise-based kick and hat would carry the groove and let the melodic voices thin
  out, which is what stops a loop sounding like a loop. `tone()` is oscillator-only today
  ([2252–2278](../html/index.html#L2252-L2278)), so this needs a short noise buffer — the one piece
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
([2261–2274](../html/index.html#L2261-L2274)), so a denser arrangement is more allocation per bar. It
is queued in `lookahead` batches rather than per frame, so this is not a per-frame cost, but a
percussion voice on every step is 16 more nodes a bar than the current busiest voice.

#### Tests

`#59`'s cases must keep passing unchanged — the harness already records every note the game
schedules, so the new material is assertable the same way. Worth adding: that the loop is actually
longer than one bar (the same bar index does not recur within N steps), that the arrangement still
responds to combo, and — most importantly — that generating a phrase still consumes no randomness,
extending `#59g` rather than replacing it.

### 71. Losing a ball deserves an animation and a sting (S/M)

Missing the ball is the most consequential thing that happens in the game, and it is the least
dressed. `loseLife()` ([2812–2822](../html/index.html#L2812-L2822)) is four lines: decrement, a
screen shake, `updateHud()`, then straight to `ready` or `endGame()`. Compare what an ordinary brick
gets — a particle burst, a floating score, its own oscillator voice, a paddle squash. The ball
draining off the bottom of the screen gets a 5px rattle
([1225](../html/index.html#L1225)) and, under `prefers-reduced-motion`, literally nothing.

**It is also silent.** Every power-up has a `beep()` ([2466–2486](../html/index.html#L2466-L2486))
and every brick type has a voice through `brickTone()` ([2321](../html/index.html#L2321)), but losing
a ball plays no sound at all. What the player actually hears is the music *stopping* — `updateMusic()`
nulls the bed the moment the phase leaves `playing` ([2381–2384](../html/index.html#L2381-L2384)) — so
the loss reads as the audio cutting out rather than as an event.

#### The structural part: there is no time for an animation

This is the real obstacle, and it is why the item is not simply "call `burst()` in `loseLife()`".
`loseLife()` transitions in the *same frame* the ball left the field: `resetPaddleAndBall()` and
`setPhase("ready")` both run before the next paint, so the ball vanishes and the "Ready?" overlay is
already up. There is nowhere for an animation to happen.

So this needs a short beat between the ball leaving and the next serve — a presentation-only
countdown that `frame()` spends before completing the transition. Two things make that cheaper than
it sounds: particles already keep updating in non-playing phases
([3337–3340](../html/index.html#L3337-L3340)), so a burst spawned at the loss animates without any
new draw path; and `#58`'s `hitStop` is *not* the mechanism to reuse — it freezes everything,
including the animation this wants to show.

#### Direction

- **The beat.** Around 0.6–0.9 s, tunable in `CONFIG.impact` next to the shake it accompanies. It
  should apply to the last life too — the run ending is the moment that most deserves the pause —
  which means `endGame(false)` waits on it as well.
- **The animation.** A burst at the ball's last position, in the ball's own colour, is most of it and
  reuses `burst()` ([1687–1697](../html/index.html#L1687-L1697)) as-is. Worth considering on top: the
  paddle reacting (a slump or a flash, reusing the `paddleSquash` channel), and the lost life's HUD
  dot dimming rather than simply disappearing on the next `updateHud()`.
- **The sting.** A short descending figure, three or four notes, scheduled against the audio clock
  the way `#59` schedules the bed rather than as bare `beep()` calls at frame time. It should be
  pitched from `musicRoot()` like everything else in `#59`, so it lands in the level's key instead of
  beside it — that is the difference between a sting and a buzzer.

#### Constraints

- **`prefers-reduced-motion` must not change the pacing.** `#58`'s discipline is that the whole
  feedback layer can be switched off and the game plays identically; `shakeScreen()` already returns
  early under it ([1718–1719](../html/index.html#L1718-L1719)). Apply that to the visuals only —
  **the delay itself should stay unconditional**, or the game's rhythm would differ between the two
  settings, which is exactly what `#58` avoided. The sting is audio, so reduced motion leaves it
  alone; mute already covers it, since every sound goes through `audioCtx()`
  ([2233–2245](../html/index.html#L2233-L2245)).
- **Nothing here may feed back into simulation.** Same rule as `#58` and `#59`: the delay may hold
  the phase transition, but no physics, scoring or timing may read any of it.
- Rolling for the burst is fine and consistent — every brick burst already does — because it happens
  once on a discrete game event, not per frame in `draw()`. That is the distinction `#58f`/`#59g`
  actually draw.

#### Tests

The delay changes an observable sequence, so existing cases move with it: `state.js`'s "losing the
last ball with lives left returns to ready" and "losing the last life ends the game" both empty
`state.balls` and assert the new phase after a single `frame()`, and several `regressions.js` cases
end a run the same way. They will need to run the beat out first — a helper alongside `clearBricks()`
is probably the right shape, rather than editing a dozen call sites by hand. New cases worth having:
that the transition really is delayed and really does complete; that it completes under
`prefers-reduced-motion` on the same schedule; and that the sting is scheduled once per loss, which
the harness's note recorder (added for `#59`) can already assert.
