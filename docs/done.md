# Blokrush — Fixed Findings

Target: [blokrush.html](../html/index.html). This is the **done** half of the project's review backlog —
every finding here has shipped. Open items live in [todo.md](todo.md); what shipped in which commit is
tracked in [release-notes.md](release-notes.md). A finding keeps its original number when it moves
from `todo.md` to here, so numbering is shared across both files and never reused — every number from
1 up belongs to exactly one of the two.

Each entry keeps its original write-up (category, effort estimate, the bug as found) with a
`> **Fixed <date>.**` note prepended describing what shipped — a historical record, not a live TODO.

**Status:** 72 fixed — everything raised so far, review findings and promoted features alike. See
[todo.md](todo.md).

**Line references below are re-anchored after each round of fixes** — they are only valid against the
current `index.html`.

---

## A. Correctness bugs

### 1. ✅ FIXED — No `<!DOCTYPE html>`, no `<meta charset="utf-8">` (S)
> **Fixed 2026-08-12.** The file now opens with `<!doctype html>` / `<html lang="fr">` and a real
> `<head>` carrying `<meta charset="utf-8">`, a viewport meta, and a `<title>`, with the markup
> wrapped in `<body>` — see [1-7](../html/index.html#L1-L7),
> [730](../html/index.html#L730), [6153-6154](../html/index.html#L6153-L6154).

The file previously began directly with `<style>`, with no doctype, `<html>`, `<head>`, `<title>`,
charset, viewport, or `lang` attribute. Two real consequences:

- **Quirks mode.** Without a doctype the browser rendered in quirks mode, changing box-model and
  inline-layout behaviour.
- **Encoding.** The file contains raw UTF-8 accented text (`Détruisez` [791](../html/index.html#L791),
  `Prêt ?` [803](../html/index.html#L803), `Bougez` [804](../html/index.html#L804)). With no charset
  declared, a browser opening this over `file://` or a server that didn't send `charset` would fall
  back to windows-1252 and render `DÃ©truisez`.

### 2. ✅ FIXED — `localStorage` access was unguarded, one throw killed the entire game (S)
> **Fixed 2026-08-12.** Reads and writes now go through `loadBest()` / `saveBest()`
> ([2604-2622](../html/index.html#L2604-L2622)), both wrapped in `try/catch`, with the best score
> degrading to in-memory only. Call sites: [2912](../html/index.html#L2912),
> [5244](../html/index.html#L5244).

`localStorage.getItem(BEST_KEY)` was read at IIFE top level while constructing `state`. In Safari
private browsing, with cookies/site-data disabled, or in some sandboxed `file://` contexts,
`localStorage` access **throws** — which aborted the whole IIFE and rendered a dead canvas with no
error visible to the player.

### 3. ✅ FIXED — Held keys stuck when the window lost focus (S)
> **Fixed 2026-08-12.** A `blur` handler now clears every held key —
> [3301-3307](../html/index.html#L3301-L3307).

`keydown` sets `state.keys[e.code] = true` [3259](../html/index.html#L3259) and only `keyup` cleared it
[3300](../html/index.html#L3300). Alt-tabbing (or hitting a browser shortcut) while holding <kbd>→</kbd>
meant the `keyup` was never delivered — on return the paddle slid into the wall and stayed pinned
until the key was pressed and released again.

### 4. ✅ FIXED — Power-up timers kept running while the game was paused (S)
> **Fixed 2026-08-12.** Effects now carry a `remaining` duration in seconds instead of an absolute
> `until` deadline, and `updateEffects(dt)` decrements it from the frame delta — which the loop only
> feeds while the phase is `playing`. See [4367-4384](../html/index.html#L4367-L4384), the effect
> durations each `remaining` starts from in `CONFIG.effects`
> ([1554-1566](../html/index.html#L1554-L1566), added by #21, since extended by #30), and the call site at
> [6110](../html/index.html#L6110).
> Verified: a `widen` survives a 30-second pause intact, then expires after its full 10 seconds of
> actual play.

`widthEffect` / `speedEffect` stored an absolute `until` timestamp from `performance.now()` and were
compared against the rAF `now`. Pausing for 20 seconds silently burned a 10-second "widen". Counting
in accumulated play time also makes the timers immune to tab-throttling and clock adjustments.

### 5. ✅ FIXED — Game did not auto-pause when the tab was hidden or the window blurred (S)
> **Fixed 2026-08-12.** `autoPause()` ([3309-3317](../html/index.html#L3309-L3317)) pauses whenever the
> phase is `playing`, wired to both `visibilitychange` and the existing `blur` handler from #3
> ([3304-3307](../html/index.html#L3304-L3307)). It deliberately only fires *on* hide/blur, never on
> return, so the player resumes explicitly.

There was no `visibilitychange` handler. `requestAnimationFrame` throttles in a background tab, and
`dt` is clamped to 33 ms [6062](../html/index.html#L6062), so the game didn't *jump* — but it stayed in
the `playing` phase, so power-up timers kept expiring (see #4) and returning to the tab dropped you
straight back into live play with no warm-up.

### 6. ✅ FIXED — `e.preventDefault()` on Space blocked button activation (S)
> **Fixed 2026-08-12.** The Space branch is now guarded by `isButtonFocused()` (renamed to
> `isTypingTarget()` and widened to cover text inputs too by #42, [3244-3248](../html/index.html#L3244-L3248),
> used at [3290](../html/index.html#L3290)): when a `<button>` holds focus the key is handed back to the
> browser, so it activates the button instead of launching the ball.
>
> This needed a companion fix. The deck's pause/mute buttons stay on screen and keep focus after a
> mouse click, so the guard alone would have made Space toggle pause instead of launching. A
> `blurIfPointerClick` helper ([3757-3762](../html/index.html#L3757-L3762)) drops focus after pointer
> clicks only — keyboard activation (`detail === 0`) keeps it, so tab-order navigation is unharmed.
>
> A related gap closed under #26: `showOverlay()` also blurs a stale button focus left over from
> whatever overlay just hid, so `isTypingTarget()` can't get stuck reporting `true` once the new
> overlay has no button of its own. (#33 below was a follow-up gap in that specific fix, since fixed.)

Space was unconditionally `preventDefault`ed. Correct for stopping page scroll, but it also prevented
Space from activating a keyboard-focused `.btn` — a keyboard-only player who tabbed to "Rejouer" could
not press it with Space (Enter still worked).

### 7. ✅ FIXED — Arrow keys scroll the page (S)
> **Fixed 2026-08-13.** The movement branch in the `keydown` handler now calls `e.preventDefault()`
> alongside the existing pointer-release logic — [3282-3289](../html/index.html#L3282-L3289). Applied to
> all four movement codes (`ArrowLeft`/`ArrowRight`/`KeyA`/`KeyD`) rather than singling out the arrow
> keys, since suppressing the letter keys too is harmless and keeps them behaving identically.

`ArrowLeft`/`ArrowRight` are read but never `preventDefault`ed. On a narrow viewport where the cabinet
overflows, steering the paddle also scrolls the document under it.

### 8. ✅ FIXED — `mousedown` launches the ball on any button, including right-click (S)
> **Fixed 2026-08-13.** The handler now takes the event and returns early unless
> `e.button === 0` — [3324-3327](../html/index.html#L3324-L3327).

`canvas.addEventListener("mousedown", handleLaunchOrResume)` had no `e.button` check. Right-clicking
or middle-clicking to open a context menu launched the ball.

### 9. ✅ FIXED — Ball–paddle collision teleported the ball on side hits (M)
> **Fixed 2026-08-13.** The ball's `y` from before the frame's own movement is captured as `prevY`
> [5072](../html/index.html#L5072). A paddle collision is only resolved as a top-face bounce — steering
> by offset and snapping onto the top — when `prevY` was already above the paddle top
> [5115-5123](../html/index.html#L5115-L5123); otherwise it resolves as a side hit that reflects only
> the horizontal component and repositions the ball beside the paddle, the same treatment a brick's
> side face gets [5125-5134](../html/index.html#L5125-L5134). Paddle-velocity spin was left for a
> separate pass — out of scope for the teleport itself.

Any `circleRectCollide` with `dy > 0` snapped `ball.y = pr.y - ball.r - 0.5`, i.e. onto the top of the
paddle. A ball clipping the paddle's *side* while descending past it got warped upward and re-served,
which read as a phantom save.

### 10. ✅ FIXED — Only one brick collision was resolved per ball per frame, chosen by array order (M)
> **Fixed 2026-08-13.** The bricks loop no longer resolves against the first overlap it finds. It now
> scans every alive brick the ball overlaps, scores each with `brickPenetration()`
> [5036-5045](../html/index.html#L5036-L5045) — the smaller of the two axis overlaps, i.e. how shallow
> the intrusion is — and resolves against whichever brick has the smallest penetration
> [5136-5164](../html/index.html#L5136-L5164). Array order no longer has any say in which face gets hit.

The loop broke after the first overlapping brick. Bricks are stored top-row-first, so when a ball
overlapped two adjacent bricks in a corner, it always bounced off the *upper* one regardless of which
face it actually struck. Visible as occasional wrong-direction ricochets in the dense levels 4–5.

### 11. ✅ FIXED — Drop hitbox (8 px) didn't match the drawn capsule (10 px) (S)
> **Fixed 2026-08-13.** `updateDrops`'s hit test now uses the same 10px radius `drawDrops` renders the
> capsule with — [4478-4479](../html/index.html#L4478-L4479) vs. the `arc(0, 0, 10, …)` at
> [5978](../html/index.html#L5978).

`updateDrops` tested `± 8` while `drawDrops` rendered `arc(0,0,10,…)`. Power-ups visually clipped the
paddle without being collected.

### 12. ✅ FIXED — Multi-ball could spawn balls aimed straight down (S)
> **Fixed 2026-08-13.** The clone angle is derived from the source ball's angle mirrored upward when
> it's descending, then spread symmetrically to either side — [4450-4458](../html/index.html#L4450-L4458).
> A source ball travelling straight down used to produce two clones that were also both descending and
> usually lost within a second; now every clone starts with a negative `dy`.

The clone angle was `atan2(base.dy, base.dx) ± 0.6`. If the source ball was descending, both clones
were also descending, making "M" feel like a dud.

### 13. ✅ FIXED — Best score was only persisted at game over (S)
> **Fixed 2026-08-13.** The `state.score > state.best` check and `saveBest()` call are now behind a
> shared `maybeSaveBest()` helper [5217-5225](../html/index.html#L5217-L5225), called from
> `checkLevelClear()` [5261](../html/index.html#L5261) as well as `endGame()`
> [5297](../html/index.html#L5297). Progress is now checkpointed at every level clear, not just at the
> end of the run.

`endGame` was the only caller of `saveBest()`. Closing the tab mid-run — including after clearing four
levels — lost the score entirely.

---

## B. Performance

### 14. ✅ FIXED — `getComputedStyle(document.body)` called per drop, per frame (S)
> **Fixed 2026-08-13.** The font string is now built once into a module-level `DROP_FONT` constant
> [1510](../html/index.html#L1510); `drawDrops` just assigns it — [5981](../html/index.html#L5981). The
> body's font never changes at runtime, so there was nothing to gain from recomputing it 60 times a
> second.

`getComputedStyle(document.body)` was called inside the `drawDrops` loop, once per falling power-up,
per frame. This forced a synchronous style recalculation every frame for every falling power-up — the
single most expensive line in the render path.

### 15. ✅ FIXED — `updateHud()` writes four DOM nodes every frame (S)
> **Fixed 2026-08-13.** A `hudLast` cache [5699](../html/index.html#L5699) records what's currently
> displayed for each of the four HUD fields; `updateHud()` [5700-5711](../html/index.html#L5700-L5711)
> only touches `textContent` for a field whose value actually changed since the last call. The
> unconditional per-frame call [6247](../html/index.html#L6247) stays — it's still what catches
> `state.best` needing a live update against `state.score` — but an idle frame now writes nothing.

`updateHud()` was called unconditionally every frame, in addition to the event-driven calls in
`brickHit`, `applyPowerup`, and `loseLife` — 240 needless `textContent` assignments per second even
while nothing displayed was changing.

### 16. ✅ FIXED — `checkLevelClear()` scans the full brick array every frame (S)
> **Fixed 2026-08-13.** `state.remainingBricks` [2937](../html/index.html#L2937) counts destructible
> bricks still alive; `buildLevel()` seeds it when a level starts
> [3044](../html/index.html#L3044)/[3069](../html/index.html#L3069), and `brickHit()` decrements it at the
> single point a brick actually dies [4977](../html/index.html#L4977). `checkLevelClear()`
> [5248-5288](../html/index.html#L5248-L5288) is now an `O(1)` counter check instead of an `O(n)` scan.

`checkLevelClear()` ran `.some()` over up to 80 bricks every single frame. Cheap in absolute terms, but
trivially replaceable with a counter decremented in `brickHit`.

### 17. ✅ FIXED — Canvas backing store is sized from DPR only, ignoring displayed size (S)
> **Fixed 2026-08-13.** `fitCanvas()` [1085-1099](../html/index.html#L1085-L1099) now reads the canvas's
> actual displayed width via `getBoundingClientRect()` and scales the backing store by
> `dpr * min(1, displayWidth / GAME_W)` — never upsizing past `dpr` (unchanged from before whenever the
> canvas is shown at or above its logical size), but shrinking the allocation when the canvas — styled
> `width: 100%; height: auto` — renders narrower than that, as on a phone.

`fitCanvas` always allocated `480 × 680 × dpr`. On a phone where the canvas displays at ~300 px wide
with `dpr = 3`, that was a 1440×2040 buffer for a 300 px element.

---

## C. Code quality / structure

### 18. ✅ FIXED — Phase transitions bypassed `setPhase()` in three places (S)
> **Fixed 2026-08-13.** `setPhase()` [3599](../html/index.html#L3599) now owns every phase→overlay
> mapping via a `PHASE_OVERLAY` lookup [3503-3535](../html/index.html#L3503-L3535), extended to cover
> `levelclear`/`victory`/`gameover` as well as the phases it already handled. `togglePause`
> [3416](../html/index.html#L3416), `checkLevelClear` [5291](../html/index.html#L5291), and `endGame`
> [4381](../html/index.html#L4381) now all just call `setPhase(...)` instead of duplicating the
> `state.phase` assignment and `showOverlay` call. (#34 below was a follow-up gap — the boot-time
> start screen still bypassed this — since fixed.)

`setPhase` [3599](../html/index.html#L3599) was the intended single entry point, but `togglePause`,
`checkLevelClear`, and `endGame` each assigned `state.phase` *and* called `showOverlay` directly.
That's the kind of duplication that causes an overlay/phase desync the first time someone adds a
state.

### 19. ✅ FIXED — Dead/redundant code (S)
> **Fixed 2026-08-13.**
> - `state.paddle.w` is gone entirely — both the initial field and the `updatePaddle` assignment that
>   nothing ever read; `paddleWidth()` remains the one source of truth.
> - The redundant `updateHud(); drawBackground(); drawBricks(); drawPaddle();` block right before the
>   first `requestAnimationFrame(frame)` call is removed; that first frame already paints the same
>   thing ~16 ms later via `draw()` [6033-6052](../html/index.html#L6033-L6052), and the HUD's own
>   one-time init call [5614](../html/index.html#L5614) already covers the pre-play text.
> - `updateBalls` [5060](../html/index.html#L5060) now declares only the `dt` parameter it uses; the
>   call site [6173](../html/index.html#L6173) no longer passes the unused `now`.

- `state.paddle.w` was assigned in `updatePaddle` but never read — every draw/collision path called
  `paddleWidth()` instead.
- The `updateHud(); drawBackground(); drawBricks(); drawPaddle();` block was redundant; the rAF loop
  paints the same frame ~16 ms later.
- `updateBalls(dt, now)` never used `now`.

### 20. ✅ FIXED — No `AudioContext` resume, and the mute state wasn't persisted (S)
> **Fixed 2026-08-13.** `audioCtx()` [3853](../html/index.html#L3853) — `beep()`'s own body when
> this was written, split out by #59 — now calls `actx.resume()`
> [3871](../html/index.html#L3871) whenever the context is `"suspended"` — cheap and a no-op once
> already running, but it rescues audio for the rest of the session if the very first beep didn't
> happen to fire from inside a user-gesture handler. Separately, `state.muted` now round-trips through
> `loadMuted()`/`saveMuted()` [2630-2631](../html/index.html#L2630-L2631), the same `storageGet`/
> `storageSet` pair [2604-2622](../html/index.html#L2604-L2622) already used for the best score and the
> language preference, written on every toggle [3831](../html/index.html#L3831) and read back into
> `state.muted` at boot [2958](../html/index.html#L2958).

`beep` lazily constructed the context but never called `actx.resume()`. If the context was ever
created outside a user gesture it started `suspended` and the game was silently mute for the rest of
the session. Separately, `state.muted` wasn't saved, so the setting reset on every reload.

### 21. ✅ FIXED — Scattered magic numbers collected into a `CONFIG` block (M)
> **Fixed 2026-08-13.** A single `CONFIG` object [1529-1658](../html/index.html#L1529-L1658) now holds drop
> fall speed, particle gravity, the ball cap, the paddle bounce spread, each power-up's mult/duration
> pair, and — since added by #28/#29/#30 — the difficulty ramp, combo/floating-text, and laser tuning
> too. Every call site reads from it instead of a local literal: drop fall speed
> [4474](../html/index.html#L4474), particle gravity [4873](../html/index.html#L4873), the ball cap in
> both of `applyPowerup`'s multi-ball checks [4445](../html/index.html#L4445)/
> [4452](../html/index.html#L4452), the paddle bounce spread [5119](../html/index.html#L5119), and the
> four original effect branches [4421-4432](../html/index.html#L4421-L4432).

Magic numbers were scattered through the file: drop fall speed `130`, particle gravity `260`, effect
durations `10`/`8` seconds, multipliers `1.6`/`0.6`/`0.7`/`1.4`, ball-cap `5`, paddle bounce spread
`1.05`. Collecting these into one `CONFIG` object makes the game tunable without hunting through the
logic.

---

## D. Accessibility

### 22. ✅ FIXED — Overlay state changes are now announced (S)
> **Fixed 2026-08-13.** All six `.overlay` divs [788-843](../html/index.html#L788-L843) now carry
> `role="status" aria-live="polite"`, with a static `aria-hidden` default matching whether they're the
> one shown at boot. `showOverlay()` [3560-3594](../html/index.html#L3560-L3594) keeps `aria-hidden` in
> sync with the `.show` class on every transition — the overlay actually on screen is the only one
> ever inside the accessibility tree, which is what lets a screen reader announce it as it appears
> rather than the swap happening silently.

Level-clear, game-over, and victory overlays swapped in silently. A screen-reader user got no
notification.

### 23. ✅ FIXED — Toggle buttons now reflect their state (S)
> **Fixed 2026-08-13** (half fixed 2026-08-12 by the bilingual work — see below). Both deck buttons
> default to `aria-pressed="false"` in markup [1058-1059](../html/index.html#L1058-L1059) and are kept in
> sync by their render functions. `renderMuteButton()` [3665-3670](../html/index.html#L3665-L3670) now
> also sets `aria-pressed`; a new `renderPauseButton()`
> [3677-3683](../html/index.html#L3677-L3683) mirrors it for pause, and — since the pause button used to
> show the same "II" icon regardless of whether the game was actually paused — swaps the icon
> (`⏸`/`▶`) and `aria-label` between "pause" and "resume" too, not just `aria-pressed`. It's called
> from both `setPhase()` [3602](../html/index.html#L3602) and `applyLanguage()`
> [3723](../html/index.html#L3723), so it stays correct across phase changes and language switches
> alike. A `.icon-btn[aria-pressed="true"]` rule [706-710](../html/index.html#L706-L710) gives both
> buttons the same visual "pressed" cue the language toggle already had.

> **Half fixed 2026-08-12** by the bilingual work. `renderMuteButton()`
> ([3665-3670](../html/index.html#L3665-L3670)) sets the mute button's `aria-label` from both the
> language and the on/off state, so it no longer claims "Couper le son" while already muted.

Neither toggle exposed `aria-pressed`, and the pause button never changed its label or state when the
game was paused.

### 24. ✅ FIXED — Canvas now points assistive tech at the HUD (S)
> **Fixed 2026-08-13.** The HUD [745-766](../html/index.html#L745-L766) was already reachable — plain,
> unhidden DOM text ahead of the canvas in reading order — so no canvas fallback content was needed;
> what was missing was the connection between the two. The canvas now carries
> `aria-describedby="hud"` [774](../html/index.html#L774), pointing at the HUD container's new
> `id="hud"` [745](../html/index.html#L745), so a screen-reader user who lands directly on the canvas
> (rather than reading the page linearly) is told where the live score/lives text actually lives.

`<canvas>` had an `aria-label` but empty inner content and no live text alternative for score/lives.

### 25. ✅ FIXED — `prefers-reduced-motion` is now read in JS too (S)
> **Fixed 2026-08-13.** `burst()` [3164](../html/index.html#L3164) now scales its particle count down to
> roughly a third (never below 1) whenever `reduceMotion` is true, read from
> `matchMedia("(prefers-reduced-motion: reduce)")` [3157-3161](../html/index.html#L3157-L3161) — live,
> via a `change` listener, rather than once at load, so toggling the OS setting mid-session takes
> effect on the very next burst rather than requiring a reload.

[113-120](../html/index.html#L113-L120) disabled the title flicker, but the canvas particle bursts were
unaffected — the CSS media query can't reach into canvas drawing.

---

## E. Gameplay / UX enhancements

### 26. ✅ FIXED — Keyboard path out of the game-over / victory screens (S)
> **Fixed 2026-08-13.** `showOverlay()` [3560-3594](../html/index.html#L3560-L3594) now focuses the
> overlay's own call-to-action button whenever one appears, looked up from a small
> `OVERLAY_PRIMARY_BTN` map (a separate map at the time; #36 below folded it into `PHASE_OVERLAY`,
> the range linked above) ("ready" has no button and is a no-op). Once that button holds focus,
> `isTypingTarget()` (renamed from `isButtonFocused()` by #42) hands Space back to the browser (see
> #6) and native button activation does the rest — for Enter, which was never suppressed, this was
> already true. The initial start screen gets
> the same treatment: boot now routes through `showOverlay("overlay-start")` instead of leaving it
> purely to the static markup, so "Lancer la partie" is focused from the very first frame, not just
> after a later transition. (At the time, this call bypassed `setPhase()`; #34 below folded it back
> in. Three follow-up gaps found in this fix are tracked separately: #33, #34, #36 — all since fixed.)

`handleLaunchOrResume` [3369](../html/index.html#L3369) only handled `ready` and `paused`. From
`gameover`, `victory`, `levelclear`, or the initial `start` screen, Space did nothing — the player had
to reach for the mouse.

### 27. ✅ FIXED — Touch: the first tap both aimed and launched (S)
> **Fixed 2026-08-13.** Launching moved from `touchstart` to a new `touchend` handler
> [3344-3367](../html/index.html#L3344-L3367); `touchstart`/`touchmove`
> [3332-3343](../html/index.html#L3332-L3343) now only update `pointerX`, aiming the paddle. That gives
> the player a chance to drag into position before committing to serve, instead of the ball launching
> from wherever the finger first landed. The "vertical offset" half of the original fix — tracking the
> paddle's own Y position above the finger — was deliberately dropped: the paddle only ever steers
> horizontally, so moving it vertically during touch play would be a materially bigger change (new
> collision geometry, different feel from mouse/keyboard play) than this finding's effort estimate
> implied, and isn't needed to fix the actual bug (the ball launching prematurely). (#35 below is a
> follow-up gap in the `touchend` handler itself.)

`touchstart` [3332](../html/index.html#L3332) (previously) set `pointerX` and immediately called
`handleLaunchOrResume`. On mobile you could not position the paddle before serving — the ball launched
from wherever your finger first landed.

### 28. ✅ FIXED — Difficulty ramp within a level (M)
> **Fixed 2026-08-13.** `state.difficultyMult` [2956](../html/index.html#L2956) multiplies directly into
> ball velocity [5073](../html/index.html#L5073), alongside the existing power-up speed multiplier. It
> ramps via `bumpDifficulty()` [3034-3036](../html/index.html#L3034-L3036) — cumulative, multiplicative,
> capped at `CONFIG.difficulty.max` — from two classic-Breakout triggers: every top-wall bounce
> [5079-5085](../html/index.html#L5079-L5085), and every `CONFIG.difficulty.brickMilestone` bricks
> destroyed in the current level [4978-4991](../html/index.html#L4978-L4991). `CONFIG.difficulty`
> [1591-1596](../html/index.html#L1591-L1596) holds the tuning; `buildLevel()`
> [3070-3075](../html/index.html#L3070-L3075) resets both the multiplier and the milestone counter at the
> start of every level, so the ramp never carries over from one level — or one difficulty — to the
> next.

Ball speed was fixed per level ([2360](../html/index.html#L2360), `LEVELS[i].speed`). Classic breakout
speeds the ball up after N bricks or on reaching the top wall, which prevents long stalemates on the
last brick.

### 29. ✅ FIXED — Score feedback on the canvas (M)
> **Fixed 2026-08-13.** Destroying a brick now spawns a floating `"+N"` pop-up at its position
> ([3177-3182](../html/index.html#L3177-L3182), rising and fading over `CONFIG.floatingText.life`
> seconds via `updateFloatingTexts()`/`drawFloatingTexts()`
> [4877-4884](../html/index.html#L4877-L4884)/[6016-6031](../html/index.html#L6016-L6031)), wired into
> the frame loop alongside particles [6119](../html/index.html#L6119)/[6126](../html/index.html#L6126)
> and `draw()` [6050](../html/index.html#L6050). Consecutive bricks destroyed without the ball touching
> the paddle also build a combo [4995-5000](../html/index.html#L4995-L5000) that scales the points
> awarded, capped at `CONFIG.combo.max`; any paddle contact — top face or side clip — resets it
> [5103](../html/index.html#L5103). `CONFIG.combo`/`CONFIG.floatingText`
> [1597-1670](../html/index.html#L1597-L1670) hold the tuning. This changes the scoring curve going forward
> — an unbroken combo now scores noticeably more than the same bricks hit in isolation — so existing
> saved best scores are no longer directly comparable to newly-earned ones.

Points were only visible in the HUD, with no combo mechanic for consecutive brick hits without a
paddle touch.

### 30. ✅ FIXED — Sticky paddle and laser power-ups (M)
> **Fixed 2026-08-13.** Both suggested additions are in, slotting into the existing timed-effect
> architecture: `POWERUPS` [1483-1484](../html/index.html#L1483-L1484), `CONFIG.effects.sticky`/
> `CONFIG.effects.laser` [1559-1560](../html/index.html#L1559-L1560), and two new branches in
> `applyPowerup` [4492-4497](../html/index.html#L4492-L4497).
>
> **Sticky** re-attaches a ball on a genuine top-face paddle hit while `stickyEffect` is active
> [5105-5114](../html/index.html#L5105-L5114), capped to one attached ball at a time so multi-ball
> can't stack several on the paddle at once. `updatePaddle()`'s attached-ball tracking, previously
> hardcoded to `balls[0]`, now loops over every ball [4354-4359](../html/index.html#L4354-L4359) since
> sticky can catch any of them, not just the one served at the start of a life.
>
> **Laser** gives the action button a second job during `"playing"`: alongside releasing a stuck ball,
> `handleLaunchOrResume()` [3369-3379](../html/index.html#L3369-L3379) now calls `fireLaser()`
> [3402-3414](../html/index.html#L3402-L3414), which fires classic twin bolts from the paddle on a
> cooldown (`CONFIG.laser` [1570-1575](../html/index.html#L1570-L1575)). `updateLasers()`
> [4489-4865](../html/index.html#L4489-L4865) moves them and reuses `brickHit()` on impact — the same
> scoring/combo/difficulty path a ball hit goes through — and `drawLasers()`
> [5989-6002](../html/index.html#L5989-L6002) renders them. Releasing a sticky ball and firing both
> route through the same action-button entry point used everywhere else (mouse, touch, Space), via a
> new `launchAttachedBalls()` helper [3381-3394](../html/index.html#L3381-L3394) `launchBall()`
> (the "ready" → "playing" serve) now also calls.

The current six were solid, but nothing rewarded skillful play with new tools. **Sticky paddle** (ball
re-attaches, aim the next shot) and **laser** (fire upward on Space) were the suggested natural
additions.

### 31. ✅ FIXED — Active power-up timers are now visible (S)
> **Fixed 2026-08-13.** A depleting bar per effect, under the HUD
> ([1024-1052](../html/index.html#L1024-L1052) markup, [224-285](../html/index.html#L224-L285) CSS). Slots
> are toggled with the `hidden` attribute and resized via the fill's inline width rather than
> created/destroyed — see `updateEffectBar()`/`renderEffectBars()`
> [5639-5668](../html/index.html#L5639-L5668), called after every `applyPowerup()`
> [4468](../html/index.html#L4468) and once per frame [6129](../html/index.html#L6129). `state.widthEffect`/
> `state.speedEffect` don't record which specific powerup produced them, only the resulting `mult`, so
> the bar recovers it from the sign of `mult` — the same trick `drawPaddle()`
> [5928](../html/index.html#L5928) already used for its colour swap.

The paddle changed colour for width effects, but there was no indication of *how long* an effect
lasted, and speed effects had no visual at all.

### 32. ✅ FIXED — Add more levels (M)
> **Fixed 2026-08-13.** Five hand-authored levels added to `LEVELS`
> [1138-1152](../html/index.html#L1138-L1152), taking the game from 5 levels to 10. Went with hand-authored
> over the procedural-generator option: it keeps the existing finite-levels-then-`victory` structure
> intact (`checkLevelClear()`'s `LEVELS.length - 1` win check [4359](../html/index.html#L4359), the HUD's
> `n/LEVELS.length` readout [4865](../html/index.html#L4865), and `level.of`'s `{n}/{total}` string all
> already read `LEVELS.length` generically, so nothing there needed to change) rather than redesigning
> what "winning" means for an endless mode. The new levels lean progressively harder on `#` (walls —
> indestructible, shape the ball's path rather than something to clear) and `S` (silver, 2hp) instead of
> just adding more 1hp rows, continuing levels 1–5's escalation in kind rather than only in ball speed.
>
> Speed still ramps per level, but more gently than levels 1–5's ~10–13% steps (~7% here): level 10's
> speed is capped by the existing "ball cannot tunnel through the paddle at maximum speed" invariant
> (`test/suites/physics.js`) — `baseBallSpeed * LEVELS[i].speed` times the fast-powerup's 1.4x times the
> 33ms clamped max `dt` has to stay under the paddle's thickness plus the ball's diameter, or a ball can
> cross the paddle in a single frame without a collision ever being detected. That ceiling works out to
> a level speed just under `2.25`; level 10 lands at `2.08`, leaving deliberate headroom rather than
> sitting right on the edge.
>
> The static "Niveau 1 / 5" markup fallback (shown for the one frame before `renderDynamicText()` paints
> the real `n/total` from `LEVELS.length`) is updated to "Niveau 1 / 10" to match, at
> [757](../html/index.html#L757) and [770](../html/index.html#L770).

Endless mode past level 5 (a procedural generator) was the other option on the table; not pursued here
— see the fix note above for why hand-authoring won out for this pass. Tracked as its own follow-up in
[todo.md](todo.md) (#41) if endless play is wanted later, no longer under #32.

### 37. ✅ FIXED — The power-up timer bars (#31) reflow the whole cabinet when they appear (M)
> **Fixed 2026-08-13.** `.effect-bars` and `.screen-wrap` became independent flex siblings inside a
> new `.play-row` — the effect-bars markup moved from before `.screen-wrap` to after it, as a sibling
> rather than a fellow child of `.cabinet`'s own flex column [57-65](../html/index.html#L57-L65)
> *(markup: [771](../html/index.html#L771) wraps both; the bars themselves were at
> [1027-1052](../html/index.html#L1027-L1052))*. `.effect-bars` took a fixed `flex: 0 0 84px` column
> instead of wrapping horizontally, so a slot's `hidden` toggle (still the same mechanism from
> #31 — see `updateEffectBar()` [5639-5649](../html/index.html#L5639-L5649)) resized only that
> column's own height, never `.screen-wrap`'s; the canvas inside it didn't move. Below a
> 560px-viewport breakpoint there wasn't width to spare for a side column without squeezing the
> canvas uncomfortably small, so `.play-row` fell back to the pre-#37 stacked layout there — the
> shift came back on small phones, an accepted trade-off noted in the fix itself rather than a full
> fix. `fitCanvas()` (#17) already re-derived the canvas's backing-store size from its *displayed*
> width every resize, so narrowing the canvas to share space with the sidebar needed no JS changes.
>
> **Superseded 2026-08-17 by #75.** The side column read as a misplaced sidebar on any normal-width
> window rather than an intentional layout, so `.effect-bars` [236-248](../html/index.html#L236-L248)
> now sits as a row below `.screen-wrap` at every width instead, keeping this fix's "canvas never
> moves" property a different way — see #75 below for the current layout.

`.effect-bars` sat as an ordinary block between `.hud` and `.screen-wrap` inside `.cabinet`'s flex
column. Each `.effect-bar` slot was toggled with the `hidden` attribute rather than an overlay or
fixed-size placeholder, so the container's rendered height went from `0` to one row (and back) the
instant an effect started or every one currently showing ended. Because `.cabinet` was
`display: flex; flex-direction: column` with a `gap` between children, that height change pushed
every sibling below it — `.screen-wrap`, and with it the `<canvas>` itself — down by the bar's
height, then back up again when the last active effect expired.

Catching a power-up mid-rally is exactly when the player's eyes and mouse/thumb are locked onto
the canvas; having the whole play field hop vertically at that moment (and again on expiry, or a
second time if two effects didn't toggle in the same frame) was disorienting and, for mouse/touch
aim, momentarily desynced the pointer from the paddle until the next `mousemove`/`touchmove`.

---

### 75. ✅ FIXED — The power-up timer bars sit in the wrong place on wide viewports (S/M)
> **Fixed 2026-08-17.** `.effect-bars` [236-248](../html/index.html#L236-L248) now sits as a row
> below `.screen-wrap` at every width instead of a desktop-only side column: `.play-row`
> [291-296](../html/index.html#L291-L296) dropped its row-at-desktop/column-below-560px split for
> `flex-direction: column` unconditionally, and the `@media (max-width: 560px)` fallback that used to
> switch it there is gone outright. `.effect-bars` keeps a **reserved, fixed `height: 38px`** (two
> wrapped rows of the 16px `.effect-bar` plus one gap — the worst-case wrap of all four bars) so a
> slot's `hidden` toggle repaints inside the row without ever resizing it, the same "canvas never
> moves" guarantee #37 gave the desktop sidebar, now held at every width instead of only above the
> breakpoint. `.screen-wrap` [298-308](../html/index.html#L298-L308) picked up an explicit
> `width: 100%` so the canvas keeps filling the row now that it's the row's sole main-axis item
> rather than a `flex: 1 1 auto` sibling growing to fill a shared row with the bars.

`.effect-bars` (`bar-width`/`bar-speed`/`bar-sticky`/`bar-laser` — the widen/narrow, slow/fast,
sticky and laser countdowns) read correctly on a phone: below the canvas, wrapping horizontally as
slots came and went. On a desktop-width browser it instead sat as an **84px-wide column to the
right** of the canvas — `.play-row` put `.screen-wrap` and `.effect-bars` side by side above the
`@media (max-width: 560px)` breakpoint, and only below it did `.play-row` switch to
`flex-direction: column` and `.effect-bars` to a wrapping row — the layout the phone got. Reported
from play: the sidebar read as misplaced on a normal window, not as an intentional alternate layout.

**Not simply an oversight — #37 above put it there on purpose**, and the reason still held:
`.effect-bar` slots toggle via the `hidden` attribute (`updateEffectBar()`,
[5639](../html/index.html#L5639)), so with the bars stacked as an ordinary block above the canvas
(the pre-#37 layout, which is what a phone still got), a slot appearing or disappearing mid-rally
changed that block's height and shoved the canvas — and the player's aim with it — up or down. The
side column fixed that by making `.effect-bars` a flex sibling of `.screen-wrap` rather than a block
above it, so its own height changes never touched the canvas's position.

**So the fix had to keep that property, not just move the column back below the canvas.** Naively
restoring the phone's stacked-block layout at desktop widths too would have reintroduced #37's bug
there instead. The layout that gets both — bars below the canvas *and* a canvas that never shifts —
is a row below `.screen-wrap` with a **reserved, fixed height** regardless of how many slots are
currently visible (sized for all four bars at once, each already a fixed `height: 16px`
([250](../html/index.html#L250)) plus the row's `gap`), so a slot's `hidden` toggle changes what's
painted inside that row without changing the row's own height — dropping `.effect-bars`'
`flex: 0 0 84px` column basis for a `flex: 0 0 auto` row one, applied unconditionally rather than
only below the breakpoint, with the reserved height added rather than left implicit. `fitCanvas()`
(#17) needed no changes: it already re-derives the backing-store size from the canvas's *displayed*
width every resize, which the CSS change alone drives.

This also closes #37's own accepted trade-off for narrow viewports (noted in that entry as "an
accepted trade-off ... rather than a full fix") — the reserved height removes the canvas-shift on
small phones too, not just at desktop widths, for the same reason it fixes the sidebar there.

---

### 78. ✅ FIXED — Effect bars label active power-ups with a single cryptic letter (S)
> **Fixed 2026-08-17.** Went with the full-word option, not a hover-only tooltip: every bar now
> shows the power-up's whole name directly. `updateEffectBar()`
> ([5639-5649](../html/index.html#L5639-L5649)) takes a `name` argument instead of a single-letter
> `label`, writes it into the `*-label` element, and — since a name can be wider than the bar — also
> sets it as the bar's `title` ([5648](../html/index.html#L5648)) as a fallback for whatever the CSS
> ellipsis clips. `.effect-bar-label` ([270-286](../html/index.html#L270-L286)) picked up
> `overflow: hidden`/`white-space: nowrap`/`text-overflow: ellipsis` to clip gracefully rather than
> spill past the bar's rounded corners. `bar-sticky`/`bar-laser` ([1038](../html/index.html#L1038),
> [1042](../html/index.html#L1042)) no longer hard-code their letter in the markup — they route through
> `bar-sticky-label`/`bar-laser-label` elements now, the same as width/speed always did, closing the
> asymmetry the finding called out. Six new `powerup.*` keys
> ([2307-2312](../html/index.html#L2307-L2312) fr, [2451-2456](../html/index.html#L2451-L2456) en)
> name every timed effect the bars can show — widen/narrow/slow/fast/sticky/laser; `multi`/`life`
> have no timer bar, so they got no entry. `#effect-bars` stays `aria-hidden="true"`
> ([1027](../html/index.html#L1027)) — the name is now on-screen as ordinary bar content rather than
> only reachable via hover, but the strip as a whole is still fast-updating and decorative, the same
> reasoning #31 gave it that attribute for in the first place.

The `#effect-bars` strip (`renderEffectBars()`) showed one bar per active timed power-up, but the
only text on each bar was a one- or two-letter abbreviation taken straight from the `POWERUPS`
table's `label` field: `W`/`N` for widen/narrow, `S`/`F` for slow/fast, `St` for sticky, `L` for
laser. Nothing decoded these for the player — there was no tooltip, no legend, and the strip was
`aria-hidden="true"` on top of that, so a new player watching a bar drain had no way to learn which
power-up it represented.

Requested directly: show the power-up's whole name rather than (or alongside) the letter, so players
actually know what's active and about to expire.

---

## F. Regressions surfaced by the #26–29 pass

Found by an `/code-review` pass over commit `bb8ebf1` ("Fix findings #26-#29: overlay focus, touch
aim, difficulty ramp, combo score"). #33–#36 all fixed.

### 33. ✅ FIXED — `showOverlay()` blurs any focused button, not just its own (S)
> **Fixed 2026-08-13.** The blur is now scoped to buttons that actually belong to an overlay. A new
> `OVERLAY_BUTTON_IDS` lookup [3550-3559](../html/index.html#L3550-L3559) is built from
> `PHASE_OVERLAY`'s button entries (from `OVERLAY_PRIMARY_BTN`'s values at the time; #36 below folded
> that map into `PHASE_OVERLAY`), and `showOverlay()` [3583-3586](../html/index.html#L3583-L3586)
> only blurs `document.activeElement` when it's a `BUTTON` whose id is in that set — the deck's
> mute/pause buttons never qualify, so a level clearing or a life being lost no longer yanks focus
> away from one a keyboard user just activated.

The stale-focus guard added under #26 — `if (isButtonFocused()) document.activeElement.blur();` —
ran unconditionally on every phase transition, regardless of *which* button currently held focus.
It was written to drop a stale button focus left over from
the overlay that just hid (see #26), but it didn't check whether the focused element actually
belonged to that overlay.

The deck's mute and language-toggle buttons deliberately keep focus after a keyboard activation
(see #6/#23) so they stay operable. If a keyboard user tabbed to one of those while a level was
still in progress, then the ball fell (`loseLife` → `resetPaddleAndBall` → `setPhase("ready")`) or
the level cleared — events with nothing to do with that button — `showOverlay()` silently blurred
it, yanking focus back to `document.body` with no user action.

### 34. ✅ FIXED — Boot-time overlay focus bypassed `setPhase()` again (S)
> **Fixed 2026-08-13.** `PHASE_OVERLAY` now carries a `start: "overlay-start"` entry
> [3553](../html/index.html#L3553) — `OVERLAY_PRIMARY_BTN` already had the matching
> `"overlay-start": "btn-start"` since #26 [3553](../html/index.html#L3553) — so boot
> [6343](../html/index.html#L6343) now calls `setPhase("start")` instead of `showOverlay(...)`
> directly. `state.phase` already starts as `"start"`, so the call is a no-op on `state.phase`
> itself; what it buys is routing the very first overlay through the same single entry point
> (`setPhase()` → `PHASE_OVERLAY` → `showOverlay()`) every other transition uses, which is what
> focuses "Lancer la partie" on the first frame.

`showOverlay("overlay-start")` was called directly at boot (as it stood before this fix) to focus
"Lancer la partie" on the very first frame (added under #26). That was exactly the pattern #18
fixed and removed — every phase transition going through
`setPhase()`, which owns the phase→overlay mapping via `PHASE_OVERLAY`. That call bypassed it
because `"start"` wasn't a key in `PHASE_OVERLAY` (only
`ready`/`playing`/`paused`/`levelclear`/`victory`/`gameover` were — `state.phase` itself starts as
`"start"` per the initial state object, so there was no natural transition *into* it to route
through `setPhase` in the first place).

### 35. ✅ FIXED — Touch launch fires while a second finger is still down (S)
> **Fixed 2026-08-13.** `touchend`'s handler [3344-3369](../html/index.html#L3344-L3369) now only
> calls `handleLaunchOrResume()` when `e.touches.length === 0` — i.e. no finger is left on the
> canvas. `changedTouches` (the lifted finger) still updates `pointerX` unconditionally, so aiming
> keeps working right up to the moment a second finger is resting; only the launch itself waits for
> every finger to be up.

`touchend`'s `handleLaunchOrResume()` ran off the lifted finger's `changedTouches` entry without
checking whether any other touch was still active on the canvas (`e.touches.length === 0`).

A player resting a second finger on the canvas — easy to do by accident on a phone — while
dragging the primary finger to aim during `"ready"` would launch the ball the moment the *primary*
finger lifted, even though a finger was still down and they hadn't committed to the serve.

### 36. ✅ FIXED — `OVERLAY_PRIMARY_BTN` and `PHASE_OVERLAY` are no longer two hand-synced maps (S/M)
> **Fixed 2026-08-13.** `PHASE_OVERLAY` [3503-3535](../html/index.html#L3503-L3535) is now the only
> map: each phase's entry carries both its overlay id and its button id together (e.g.
> `paused: { overlay: "overlay-pause", button: "btn-resume" }`), or is `null`/has no `button` key
> for `"playing"`/`"ready"`. `OVERLAY_PRIMARY_BTN` is gone; `OVERLAY_BUTTON_IDS`
> [3550-3559](../html/index.html#L3550-L3559) (see #33) and `setPhase()`
> [3599-3607](../html/index.html#L3599-L3607) both derive what they need from `PHASE_OVERLAY` alone,
> so a new phase's overlay+button pair is one entry to add rather than two maps to keep in step.

`PHASE_OVERLAY` mapped phase → overlay id; `OVERLAY_PRIMARY_BTN` separately mapped overlay id →
button id. Nothing tied them together, so they could drift.

If a future phase/overlay were added to `PHASE_OVERLAY` with its own call-to-action button but the
matching `OVERLAY_PRIMARY_BTN` entry was forgotten (or vice versa), the overlay would show but its
button would never get focus — Space/Enter would silently stop working from that screen. Same class
of desync #18 fixed for `state.phase`/`showOverlay`, just one map over.

---

## G. Findings from a `/code-review` pass over commit f47f3e6

Found by an `/code-review` pass over commit `f47f3e6` ("Fix finding #32: add levels 6–10"). All
three fixed.

### 38. ✅ FIXED — Ball can tunnel through the paddle once the difficulty ramp stacks with the fast power-up (M)
> **Fixed 2026-08-14.** A swept paddle-only check now runs in `updateBalls()` right before the
> existing overlap test — [5089-5101](../html/index.html#L5089-L5101). When the ball's start-of-frame
> position was above the paddle top but its end-of-frame position has already cleared the paddle
> bottom (the exact tunneling case: no overlap left for `circleRectCollide` to catch), it's rewound
> to the point where it crossed the paddle's top plane, so the existing `isTopHit` branch just below
> sees a normal top hit and steers it exactly as it always has. Bricks are deliberately exempt — a
> missed brick costs nothing, the ball just continues past it — so this only guards the one collision
> that actually costs the player something. The stale comment in `LEVELS`
> ([1143-1149](../html/index.html#L1143-L1149)) claiming level 10's speed was "kept under the ceiling" is
> corrected too: that ceiling never held once the difficulty ramp was accounted for, and the sweep
> makes level speed a non-issue for this class of bug going forward. The paper-math test in
> `test/suites/physics.js` ("the ball cannot tunnel through the paddle...") is now a behavioural test
> that drives this exact worst case — level 10, `fast`, `difficultyMult` pinned to its cap, one 33ms
> frame — and asserts the ball still bounces; a matching `#38` regression test covers the same ground
> in `test/suites/regressions.js`.

The "cannot tunnel through the paddle at maximum speed" test
([test/suites/physics.js:202–218](../test/suites/physics.js#L202-L218)) only budgets for
`baseBallSpeed * LEVELS[i].speed * fast-powerup's 1.4x`, capped by the 33ms clamped max `dt`
([6062](../html/index.html#L6062)). It never factors in `state.difficultyMult`
([2956](../html/index.html#L2956)), the mid-level ramp (up to `CONFIG.difficulty.max` = `1.6`,
[1595](../html/index.html#L1595)) that's multiplied into the same per-frame displacement at
[5073](../html/index.html#L5073):

```js
var v = ball.speed * mult * state.difficultyMult * dt;
```

The #32 fix note above (this file) and release-notes both call out that the level-10 speed was
tuned to stay under the tunneling test's ceiling — but that ceiling itself is wrong, and
the release-notes entry ([release-notes.md:194–197](../release-notes.md#L194-L197)) already flags the
gap as "worth its own finding later" without one being opened. This finding is that follow-up.

Reproduced directly against the seam: level 10, `fast` power-up applied, `difficultyMult` pinned to
its `1.6` cap, ball parked just above the paddle heading straight down, one 33ms frame:

```
before: y=638.0            paddle spans y 646–658
after : y=676.4  dy=1  phase=playing   ← passed clean through, no bounce
step=38.4px  barrier=26px  (paddle.h=12 + 2*ball.r=14)
```

The ball crosses the paddle with no collision ever detected and is lost on the next frame. Working
back from the real budget, any frame slower than ~22ms triggers this on level 10 with `fast` active
and the ramp maxed — well inside the 33ms clamp, so it's reachable at ordinary frame rates, not just
in a stalled tab. It also predates #32: level 5 at its original speed (`1.48`) already exceeds the
26px barrier at the full 33ms clamp once the ramp and `fast` are both in play.

**Recommended fix:** a swept check for the paddle only (bricks are exempt — a missed brick costs
nothing, the ball just continues), inserted before the existing overlap test at
[5088](../html/index.html#L5088):

```js
// #38: on a slow frame a fast ball (level speed x fast power-up x the
// mid-level difficulty ramp) can travel further in one step than the paddle
// is thick, landing below it with nothing left to overlap. Rewind it to the
// point where it crossed the paddle's top plane so the check below sees a
// normal top hit and steers it as usual.
if (ball.dy > 0 && prevY + ball.r <= pr.y && ball.y - ball.r > pr.y + pr.h) {
  var tCross = (pr.y - ball.r - prevY) / (ball.y - prevY);
  var xCross = ball.x - ball.dx * v * (1 - tCross);
  if (xCross + ball.r > pr.x && xCross - ball.r < pr.x + pw) {
    ball.x = xCross;
    ball.y = pr.y - ball.r + 0.5;  // circleRectCollide uses strict `<`
  }
}
```

`prevY` is untouched, so the existing `isTopHit` check below still sees a genuine top hit and applies
the normal position-based steering — no duplicated bounce logic, one extra comparison per ball per
frame in the common (non-tunneling) case.

Once this lands, the paper-math test at [physics.js:202–218](../test/suites/physics.js#L202-L218)
should be replaced with a behavioural test that drives this exact worst case (level 10, `fast`,
`difficultyMult` at its cap, one 33ms frame) and asserts the ball still bounces, plus a `#38`
regression test in `regressions.js` per the project's fix loop. The level-speed ceiling that
constrained #32's tuning (~2.25) stops being a correctness constraint once the sweep exists; the
comment at [1142-1150](../html/index.html#L1142-L1150) claiming level 10 is "kept under the ceiling" should
be corrected either way, since it's not accurate today.

### 39. ✅ FIXED — Stale "1/5" HUD markup fallback (S)
> **Fixed 2026-08-14.** The markup now reads `<div class="hud-value" id="hud-level">1/10</div>`
> ([730](../html/index.html#L730)), matching the two overlay-eyebrow fallbacks #32 already updated. A
> `#39` regression test in `test/suites/regressions.js` checks the raw source text directly (not the
> post-boot DOM, since `updateHud()` overwrites this on the very first frame regardless of what the
> static markup said) so a future level-count change can't let this one quietly go stale again.

The static HUD counter at [730](../html/index.html#L730) —
`<div class="hud-value" id="hud-level">1/5</div>` — was not updated when #32 took the game to 10
levels, even though the #32 fix explicitly updated the two parallel overlay-eyebrow fallbacks at
[757](../html/index.html#L757) and [770](../html/index.html#L770) for the identical reason (both read
"Niveau 1 / 10" now). `updateHud()` ([4865](../html/index.html#L4865)) overwrites it with the real
`n/LEVELS.length` on the first frame, so this is only visible for the one frame before JS runs — but
that's exactly the case the #32 fix already reasoned about and fixed for the other two instances.

**Recommended fix:** change the markup to `<div class="hud-value" id="hud-level">1/10</div>`. One
character; fold into whatever commit fixes #38 rather than opening its own.

### 40. ✅ FIXED — Physics invariant sweeps don't loop over the levels #32 added (S)
> **Fixed 2026-08-14.** Both sweeps in `test/suites/physics.js` now derive their level bound from
> `boot().T.LEVELS.length` instead of a hard-coded `5`/`3`
> ([:231–274](../test/suites/physics.js#L231-L274) — a level count read once and reused, since a fresh
> `g` isn't in scope until each loop iteration boots its own), so both now exercise all 10 levels.
> Runtime stayed well under the suite's third-of-a-second total, so there was no need to trim
> per-level frame counts to compensate.

Both randomised-run sweeps in `test/suites/physics.js` hard-code a level bound short of
`LEVELS.length`:

- "invariants hold over a long randomised run on every level"
  ([:223](../test/suites/physics.js#L223)): `for (let level = 0; level < 5; level++)`
- "invariants still hold when power-ups are in play"
  ([:246](../test/suites/physics.js#L246)): `for (let level = 0; level < 3; level++)`

Neither was extended when #32 added levels 6–10, so those levels' collision/physics invariants
(no ball resting inside a live brick, no sub-floor `|dy|`, etc.) are never exercised by this suite.
That matters here specifically because levels 6–10 introduce much denser `#`/`S` checkerboards than
levels 1–5 — level 10's rows 1–2 are 100% wall/silver with no empty cells
([1112](../html/index.html#L1112)) — which is exactly the kind of brick-adjacency layout the
smallest-penetration collision resolver (#10) was written to handle, and the new density is untested
territory for it.

The release-notes entry for #32 ([release-notes.md:203–206](../release-notes.md#L203-L206)) states "the
existing suite already asserts level-count-agnostic invariants... in a loop over `LEVELS.length`, so
it exercises all 10 levels automatically" — true for `rules.js`'s loops, not true for these two
sweeps in `physics.js`.

**Recommended fix:** change both bounds to `g.T.LEVELS.length`. The suite runs in well under a second
today; if the second sweep (700 frames × now 10 levels instead of 3) measurably slows the run, trim
its per-level frame count rather than its level coverage — the point of the sweep is breadth across
levels, not depth on any one of them.

---

## H. Requested directly by the user, not surfaced by a `/code-review` pass

### 42. ✅ FIXED — Hall of fame: prompt for a name at game over, show the top 10 (L)
> **Fixed 2026-08-14.** Both phases sketched in the "open design questions" below are in: `nameentry`
> (a text input + submit button, markup at [859-868](../html/index.html#L859-L868)) and `halloffame`
> (the top-10 board + a continue button, [870-876](../html/index.html#L870-L876)), each with its own
> `PHASE_OVERLAY` entry ([3534-3535](../html/index.html#L3534-L3535)) rather than bolting an input onto
> `overlay-victory`/`overlay-gameover` directly. `endGame()` ([5296-5312](../html/index.html#L5296-L5312))
> detours through `nameentry` — remembering which final screen to return to afterward in
> `state.returnPhase` (generalized from a `pendingWon` boolean by #43) — whenever
> `qualifiesForHallOfFame(state.score)`
> ([5341-5343](../html/index.html#L5341-L5343)) is true: strictly greater than 0, and either the board
> has room or the score beats its current lowest entry via `hallOfFameRank()`
> ([5329-5334](../html/index.html#L5329-L5334)) — a tie with the lowest entry does not bump it. The
> board is a capped, sorted `{name, score}` list under a new `neonbreak-hall-of-fame` key
> ([2599](../html/index.html#L2599)), round-tripped through `loadHallOfFame()`/`saveHallOfFame()`
> ([2638-2651](../html/index.html#L2638-L2651)) via the same guarded `storageGet`/`storageSet` pair #2
> already uses — a throw, or corrupted/foreign JSON under that key, degrades to an empty board rather
> than taking the game down.
>
> A submitted name is trimmed, capped to `CONFIG.hallOfFame.nameMax` (12 characters,
> [1679-1697](../html/index.html#L1679-L1697)), and falls back to a translated `"???"` placeholder when
> empty (`submitHallOfFameName()`, [5428-5465](../html/index.html#L5428-L5465)). `renderHallOfFame()`
> ([5472-5498](../html/index.html#L5472-L5498)) rebuilds the board through `innerHTML` rather than
> `textContent` as sketched below — the test harness's DOM stub has no `createElement`/`appendChild`
> to build real nodes with — but every interpolated value (the name; the score too, for uniformity)
> goes through a small `escapeHtml()` helper first ([1118-1120](../html/index.html#L1118-L1120)), so a name
> like `<img src=x onerror=...>` still can't be interpreted as markup. `isButtonFocused()` is renamed
> to `isTypingTarget()` and widened to also cover a focused `<input>`
> ([3245-3248](../html/index.html#L3245-L3248)), so Space still reaches the name field instead of being
> hijacked for launch/laser; Enter submits directly from the field
> ([3295-3297](../html/index.html#L3295-L3297)) since nothing else in this file uses a `<form>`.
>
> Covered by ten `#42a`–`#42j` cases in `regressions.js` — qualification gating including the score-0
> and tie edge cases, sorted insertion, the empty-name fallback, HTML-escaping, the win/loss branch
> back out, Space/Enter handling, and the max-size cap — plus two round-trip cases in `persistence.js`,
> including the `storageThrows` guard. Four existing tests that happened to end a run with a
> qualifying score (`state.js`, `rules.js`, `i18n.js`, `persistence.js`) now seed a full board via the
> `storage` boot option so they keep exercising what they were actually about, not the hall of fame.

Feature request: when a run ends (`endGame()`, [5296](../html/index.html#L5296)) with a score that
qualifies, prompt the player for their name, then show a top-10 leaderboard of name+score pairs.

Today only a single number persists across sessions — `state.best`, round-tripped through
`loadBest()`/`saveBest()` ([2621-2622](../html/index.html#L2621-L2622)) under `BEST_KEY`
([2596](../html/index.html#L2596)), both guarded by `storageGet`/`storageSet`
([2608-2621](../html/index.html#L2608-L2621)) per #2. This replaces "a number" with "a list":
a new `localStorage` key (e.g. `neonbreak-hall-of-fame`) holding a JSON array of `{ name, score }`,
capped at 10, sorted descending, read/written through the same guarded helpers so a throwing
`localStorage` degrades the same way #2 already handles for the best score.

**Where it hooks in:** both `endGame(true)` and `endGame(false)` ([5296](../html/index.html#L5296)) —
a run can end either by winning or by running out of lives, and both should qualify. The natural gate
is "does this score beat the lowest of the current top 10 (or is the list not yet full)?" — most runs
won't qualify, and skipping the prompt entirely for those keeps the existing victory/gameover flow
(`PHASE_OVERLAY` [3503-3535](../html/index.html#L3503-L3535), `overlay-victory`/`overlay-gameover`
markup [825-854](../html/index.html#L825-L854)) untouched for the common case.

**Open design questions, not pre-decided:**
- *New phase(s) vs. extending the existing overlays.* The cleanest fit with the existing
  `state.phase` → `setPhase()` → `PHASE_OVERLAY` → `showOverlay()` pipeline (#18) is one
  or two new phases — `nameentry` (a text input + submit button) and `halloffame` (the top-10 list
  plus a continue/restart button) — each getting its own `PHASE_OVERLAY` entry and `.overlay` div,
  rather than bolting a conditional input onto `overlay-victory`/`overlay-gameover` directly.
- *Name input hygiene.* Trim, cap length (the overlay layout wasn't built for arbitrary-length
  strings), fall back to a placeholder for an empty submission, and render entries with `textContent`
  (never `innerHTML`) when the list is redrawn — the same discipline `applyLanguage()` already uses
  for every other piece of user-facing text, but this is the first *player-supplied* string in the
  game.
- *i18n.* Every new string (the name-entry prompt, its input placeholder, the hall-of-fame title, an
  empty-list message) needs a key in both `STRINGS.fr` and `STRINGS.en` ([2184](../html/index.html#L2184))
  — the `i18n` suite already fails the build if one language's table is missing a key the other has,
  so this is enforced automatically once the keys exist.
- *Keyboard/focus.* The name-entry overlay's input should get focus the way every other overlay's
  primary button does today (`showOverlay()` [3560](../html/index.html#L3560), #26), and
  submitting needs both an Enter-in-the-input path and a click path — mirroring how
  `handleLaunchOrResume()` already serves keyboard, mouse, and touch from one entry point.

**Test coverage this would need:** a `persistence` suite case for the hall-of-fame round-trip
(including the `storageThrows` guard, per #2's test), a `state`/`rules` case for the qualifying-score
gate, and — since this is the first free-text player input — an explicit case asserting a name
containing HTML-special characters renders as literal text, not markup.

### 43. ✅ FIXED — View the hall of fame from the start screen, before playing (S)
> **Fixed 2026-08-14.** A second, lower-emphasis button on `overlay-start`
> ([793-794](../html/index.html#L793-L794), styled with a new `.btn-ghost` modifier
> [452-457](../html/index.html#L452-L457)) opens the board on demand — its handler
> ([3732-3752](../html/index.html#L3732-L3752)) sets `state.returnPhase = "start"` and calls
> `setPhase("halloffame")` directly, never `newGame()`, so score/lives/level are untouched. The
> board itself needed no changes — `renderHallOfFame()` already renders `halloffame.empty` for a
> fresh install with nothing on it yet, exactly as sketched below.
>
> `state.pendingWon` (a `true`/`false`/`null` flag) is generalized into `state.returnPhase`
> (`"start"` / `"victory"` / `"gameover"`, [2976-2987](../html/index.html#L2976-L2987)): `endGame()`
> ([5310](../html/index.html#L5310)) sets it to `won ? "victory" : "gameover"` before the post-game
> detour exactly as `pendingWon` did, and the continue button
> ([3804-3806](../html/index.html#L3804-L3806)) just does `setPhase(state.returnPhase)` — one field
> now serves both entry points into `halloffame` instead of the continue button special-casing
> "opened from the start screen" as a third, unnamed case. `PHASE_OVERLAY`'s `start`/`halloffame`
> entries needed no changes, exactly as anticipated below.
>
> Five `#43a`–`#43e` cases in `regressions.js` cover: the board reachable from `start` without
> playing; the empty-board message actually rendering when viewed that way (the one path no
> existing `#42*` test exercised, since all of them produce or seed an entry first); continue
> returning to `start` rather than `gameover`; opening the board never resetting score/level; and —
> closing a gap #42 itself left, since only the win path had a continue-routing test — a fresh case
> confirming a loss still routes to `gameover` after the `returnPhase` rename. The "view the board
> from `gameover`/`victory` too" question raised below is left open; not attempted here.

Feature request: right now the `halloffame` overlay (#42) is only reachable as a detour `endGame()`
inserts after a qualifying run ends — there's no way to open the board on demand, so a returning
player can't check it (or just admire it) before starting a game. `overlay-start` only has the
"Lancer la partie"/"Start game" button today.

**Where it hooks in:** a second button on `overlay-start`, wired the way `btn-start` already is,
calling `setPhase("halloffame")` directly rather than `newGame()` — no score/lives reset, purely a
view. The board itself needs no changes: `renderHallOfFame()`/`submitHallOfFameName()` already
render from `state.hallOfFame` unconditionally, including the `halloffame.empty` message for a
fresh install with no entries yet — opening the board before ever having played should just show
that message rather than being disabled or hidden.

**The one real wrinkle:** `halloffame`'s continue button currently hard-codes its destination as
`state.pendingWon ? "victory" : "gameover"`, set by `endGame()` right before the detour. Opened from
the start screen, neither `victory` nor `gameover` is correct — continue should go back to `start`.
The `PHASE_OVERLAY` entries for both `start` and `halloffame` already exist and don't need touching;
what needs generalizing is `pendingWon` itself — from a `true`/`false`/`null` flag into something
like a `returnPhase` field (`"start"` / `"victory"` / `"gameover"`) that both entry points (the
post-game detour and this new button) set before calling `setPhase("halloffame")`, with the
continue handler just doing `setPhase(state.returnPhase)`.

**Also worth deciding:** whether a "view the board" link belongs on `overlay-gameover`/
`overlay-victory` too (the ones a non-qualifying run already lands on) as well as `overlay-start` —
same mechanism either way once `returnPhase` exists, just another button wired to the same handler.

**Test coverage this would need:** a case opening the board from `start` with an empty
`state.hallOfFame` and confirming the empty-board message renders (not currently exercised — every
existing `#42*` test seeds or produces at least one entry first); a case confirming continue routes
back to `start`, not `gameover`; and a case confirming the existing post-game routing (`#42g`,
`regressions.js`) still passes unchanged now that `pendingWon` no longer exists under that name.

### 67. ✅ FIXED — One global hall of fame, shared by every player (L)

> **Fixed 2026-08-14.** The board shown is now the world one, served by a Cloudflare Pages Function
> over D1, with the `localStorage` board demoted to an offline fallback rather than removed.
>
> **Server** — [functions/api/scores.js](../functions/api/scores.js), schema in
> [schema.sql](../schema.sql). `GET /api/scores` returns the top 10 *and* a fresh HMAC-signed
> session token; `POST /api/scores` redeems one token for one score. Issuing the token on the same
> call that fetches the board is what lets the run be dated from the server's own clock at both
> ends, so a client cannot claim a long run to justify a large score. `newGame()` re-fetches rather
> than reusing the boot-time token, or a tab left open overnight would submit against a
> falsely-generous elapsed time.
>
> **What the anti-cheat actually is.** Deterrence, not verification — as the write-up below insisted
> it should be described. A patched client can still forge a score inside the plausibility envelope.
> What ships: HMAC-signed tokens (forgery needs the secret); a `UNIQUE` constraint on the token
> nonce, so replaying one submission fails at the database rather than needing a "seen tokens"
> table; a minimum run length and a points-per-second ceiling, both measured against server
> timestamps; a per-IP rate limit over a rolling window; and failing *closed* when `HOF_SECRET` is
> unset, since without a secret a forged token is indistinguishable from a real one. Turnstile was
> considered and not shipped — it needs a third-party script, which the page's self-contained
> constraint and CSP both argue against. Replay validation (the only real verification) remains
> unbuilt and still blocked on a seeded PRNG; see #47.
>
> **Client** — `activeBoard()` is the single place deciding which board the game means; ranking,
> qualification and rendering all read it rather than picking a source. `hallOfFameRank()` was split
> into `rankIn(list, score)` plus a wrapper, because `insertHallOfFameEntry()` had begun taking its
> splice index from a rank computed against the *world* board and would have left the local array
> mis-sorted — caught during implementation and covered by `#67e`.
>
> `state.globalScores` stays `null` (never `[]`) when the API has not answered: an empty array is a
> legitimately empty world board, and conflating the two would hide the fallback. A new `#hof-scope`
> line states which board is on screen, so an offline player does not read local scores as global
> ones.
>
> **Test harness** — `boot()` now stubs `fetch`, offline by default, so every suite written before
> this one keeps exercising the fallback path; a test opts in with `boot({ api })`. `apiCalls`
> records what was submitted and `settle()` flushes the promise chain. `test/run.js` was made async:
> it called `test.fn(assert)` without awaiting, so an async test would have reported PASS while
> asserting nothing.
>
> **Not verified by the suite:** the Function itself has never been executed here — no wrangler, no
> D1 in this environment. Every test exercises the stub, not the endpoint. The HMAC, SQL and error
> paths are unproven until deployed.
>
> **Operational prerequisites** (see [CLAUDE.md](../CLAUDE.md)): a D1 database bound as `DB`,
> `HOF_SECRET` set to at least 16 characters, and `schema.sql` applied. Until then the endpoint
> returns 503 and the game silently uses the local board.

**Requested directly by the user.** Today's board (#42, #43 in [done.md](done.md)) is private to each
browser: it lives in `localStorage` under `neonbreak-hall-of-fame`
([2599](../html/index.html#L2599)), so two players never see each other's scores, and the same person
sees a different board on their phone than on their laptop. It is also per-origin, which means
`blokrush.pages.dev` and `blokrush.sebkiller.com` already keep separate boards.

The ask is a single world-visible leaderboard. **It may be reset freely during implementation, but
once shipped it must never be reset again** — that promise is a design constraint, not an
operational note, and it shapes several choices below.

#### Shape

Cloudflare Pages Functions with KV or D1 behind them, since the site already deploys to Pages: a
`GET /api/scores` returning the top N, and a `POST /api/scores` submitting one. D1 is the better fit
despite KV being simpler — a leaderboard is a sorted query, KV has no ordering, and "never reset"
argues for something with real backups and a migration story rather than a bag of keys.

This introduces a server component to a project whose stated constraint is one self-contained file
with no build step and no dependencies (see [CLAUDE.md](../CLAUDE.md)). That is a genuine
architectural change and the main reason this is L, not M. The local board should stay as the
offline fallback rather than being deleted — the game must still work opened from `file://`, which
the whole test harness depends on.

#### Anti-cheat — read this before designing the endpoint

The game is entirely client-side, so **a determined attacker can always POST an arbitrary score**.
Nothing below changes that; they reduce the number of people who bother. This should be stated
plainly rather than designed around as if solvable:

- *Deterrents, not defences:* Cloudflare rate limiting per IP, a Turnstile challenge on submit, and
  an origin/referer check. Cheap, and they stop casual `curl` submissions.
- *Server-side plausibility:* reject scores inconsistent with the run that supposedly produced them
  — score above the theoretical maximum for the level reached, a run shorter than the minimum time
  to clear that many bricks, impossible combo multipliers. Bounded by `CONFIG` values the server can
  reuse. Stops naive inflation, not a careful forgery.
- *The only real verification:* have the client submit the **input trace** (seed plus per-frame
  paddle positions) and re-run the deterministic simulation server-side, accepting the score only if
  the replay reproduces it. This actually verifies rather than deters. It requires the game to be
  fully deterministic — a seeded PRNG replacing `Math.random()`, the same prerequisite as #47 — and
  the physics to be extractable so a Worker can run it headless. It also shares its recording
  machinery with #66 (ghost replay). Expensive, and worth costing out honestly before committing.

Whatever is chosen, assume some bad entries land: an admin path to remove a single entry is
required, and it must not mean wiping the board.

#### Consequences of "never reset"

- Entries need a schema version from day one, so a later format change migrates instead of forcing a
  reset.
- The D1 database and its bindings must survive project renames and redeploys — the Pages project
  being recreated must not orphan the data. Worth a documented backup (scheduled export) precisely
  because the promise is unconditional.
- Deleting the Cloudflare Pages project would destroy it. That risk should be written down wherever
  deployment is documented.

#### Moderation and safety

Names become world-visible, which they are not today. `renderHallOfFame()` already escapes
interpolated values ([5494-5495](../html/index.html#L5494-L5495)), so XSS is handled, but a public
board needs length limits enforced server-side (not just `CONFIG.hallOfFame.nameMax`), some profanity
handling, and a decision on whether to store any IP or identifier for abuse handling — which carries
its own privacy obligations.

#### Related

#42/#43 (the local board this extends), #47 (a per-day leaderboard would reuse this backend), #66
(shares the input-trace recording), #64 (resumable runs raise the same "is this score legitimate"
question).

### 49. ✅ FIXED — Explosive bricks (S)

> **Fixed 2026-08-14.** A new `X` brick type: 1hp like an ordinary brick, but destroying it damages
> the eight surrounding cells. Seven are placed across levels 3, 5, 6, 8 and 10, introduced singly
> and paired later so the chain reaction is discovered rather than explained.
>
> **Neighbours are found geometrically, not by grid index** — a cell's centre is at most one pitch
> away on each axis, with a 1px tolerance. This survives any change to `COLS`, `BRICK_W`,
> `BRICK_MARGIN` or `FIELD_PAD`, where hardcoded index arithmetic would quietly start addressing the
> wrong cells. `#49b` pins the tolerance against creeping into the second ring.
>
> **The blast deals damage through `brickHit()` rather than clearing cells directly.** That single
> choice is what makes walls stay standing, silver take two blasts, scoring/combo/drops/counters
> stay consistent, and — the point of the type — one explosive set off the next. Killing bricks
> directly would have been shorter and would have silently desynced `state.remainingBricks`, making
> levels end early or become unclearable; `#49f` exists specifically to catch that.
>
> **Termination:** `brickHit()` clears `alive` before calling `explode()`, and the neighbour list is
> re-checked for `alive` as it is walked, so a cascade can never revisit a brick it destroyed. Every
> brick dies at most once, which bounds recursion at the brick count.
>
> Drawn in the hottest colour on the board plus a white core dot — colour alone would leave the one
> brick that behaves differently unreadable to a colourblind player, which is the gap #62 covers for
> the rest of the set.
>
> Six regression cases, each checked against a mutation that should break it: the explosion disabled
> (`#49a`, `#49c`, `#49d`, `#49e` fail), the radius widened to two cells (`#49b` fails), and the
> blast bypassing `brickHit` (`#49f` fails). `#49b` and `#49f` deliberately do not fail on a disabled
> explosion — they guard the opposite mistakes.

A brick that, when destroyed, destroys its immediate neighbours in a small radius and pushes a
particle shockwave outward. It is the most satisfying single brick type in the genre because it
converts a lucky hit into a visible cascade, and it gives level authors a lever for building
deliberate chain reactions. Implementation touches `brickHit()` and the level character map only.

### 51. ✅ FIXED — Regenerating and multi-hit-with-feedback bricks (S)

> **Fixed 2026-08-14.** Both halves shipped: a new `R` brick type that comes back, and a crack
> overlay that makes silver's damage state readable.
>
> **Regenerating bricks.** `R` is a 1hp brick that returns `CONFIG.regen.delay` seconds after being
> destroyed. Six are placed across levels 4, 7, 9 and 10. `updateBricks()` is called from the same
> `playing`-only block as `updateEffects()`, so the timer cannot drain behind the pause screen —
> the bug #4 fixed for power-ups, and the reason the tick did not go somewhere more convenient.
> It also runs *before* `checkLevelClear()` in `frame()`, so a brick returning on the same frame the
> last other brick fell puts the counter back above zero and the level correctly does not clear.
>
> **The counter goes down while the brick is down.** That is what makes the finding's actual
> requirement work — it returns "unless the level is cleared first" — because a level ends the
> moment nothing is standing. The tempting alternative, keeping a pending brick counted so it cannot
> be skipped, would make the level wait for it and quietly contradict the ask; `#51d` is there to
> catch exactly that.
>
> **Returns are capped, and this is not a difficulty knob.** Uncapped, a regenerating brick is an
> unlimited supply of points, and since #67 the leaderboard is global — "farm one brick forever"
> would become the highest-scoring strategy in the game. `CONFIG.regen.max` bounds it at three
> returns without changing how the brick plays across a normal level. Noted here because the cap
> looks arbitrary until you know what it is defending.
>
> A brick on its way back is drawn as an outline that fills as the timer runs down. Without it the
> brick reappears from nowhere and reads as a bug rather than a mechanic, and the player has no
> basis for deciding whether to rush the rest of the level.
>
> **Silver damage.** Damaged silver was signalled only by swapping one grey (`#c3cee0`) for another
> (`#6c7590`) — two shades a player has to have seen side by side to tell apart, and indistinguishable
> to some colourblind players. It now also carries a crack, which reads as damage on its own. `R`
> gets a ring marker for the same reason `X` got a dot in #49.
>
> Six regression cases, each verified against a mutation that should break it and confirmed not to
> fire on the others: regen never scheduled (`#51a`/`b`/`c`/`e`), the timer ticking while paused
> (`#51b`), the counter not restored on return (`#51c`), the cap removed (`#51e`), the crack removed
> (`#51f`), and a downed brick still counting toward level clear (`#51d`).
>
> The `#49` test fixture was generalised to `gridLevel()` and given an `idle()` helper that parks the
> ball before advancing time. Without it these tests were flaky in a way that looked like a product
> bug: the still-live ball knocks a just-regenerated brick straight back down between the tick that
> revives it and the assertion that looks for it.

A brick that returns after a delay unless the level is cleared first, forcing the player to
prioritise. Related and smaller: silver bricks currently signal damage only by a colour swap
(`Sc`) — a crack overlay would make hit points readable at a glance, which matters more as brick
types multiply.

### 52. ✅ FIXED — Mystery bricks (S)

> **Fixed 2026-08-14.** A `?` brick that resolves into a weighted random type on the first hit.
> Eight are placed across levels 2, 5, 7, 9 and 10. `resolveMystery()` runs at the top of
> `brickHit()`, so the hit that revealed the brick then lands on whatever it became — silver takes
> its first damage, an explosive detonates, a wall simply refuses.
>
> **The finding called this a "small change… a resolve step in `brickHit()`". It is not, and the
> reason is a softlock.** `buildLevel()` counts every `?` as clearable, correctly, because at build
> time it has 1hp like anything else. Resolving into `#` makes it permanently unclearable — so
> without a matching `state.remainingBricks -= 1`, a level containing a `?` that turned into a wall
> could never reach zero, and the run would sit in `playing` with nothing left to hit and no way
> out. That one line is the whole reason this entry is longer than the finding.
>
> Weights keep ordinary bricks dominant so the usual reveal is anticlimactic and the rare ones land.
> `#` is rarest, since it is the only outcome that takes something away from the player for good —
> which is also, per the finding, the risk the type exists for.
>
> **A known, accepted residual risk:** a `?` resolving into `#` can in principle wall off a pocket
> of the field and make remaining bricks hard to reach. The level stays *clearable* by the counter,
> and `physics.js`'s invariant sweeps cover the authored layouts, but they cannot cover every
> resolution. Judged acceptable against how rare `#` is; noted here so it is a decision on the
> record rather than something to rediscover.
>
> Five regression cases, each checked against a mutation that should break it: the wall decrement
> removed (`#52b`, `#52c`, `#52e` fail — the softlock), resolution disabled entirely (`#52a`–`d`
> fail), and the reveal consuming the hit instead of landing on the new type (`#52b`, `#52d` fail).
>
> `#52b` and `#52d` depend on a seed producing a wall and a silver respectively, so both assert that
> the interesting case actually occurred. Without that they would keep passing if a future change
> shifted RNG consumption and the seed stopped producing it — checking nothing, silently.
>
> Writing these also corrected a wrong model in the tests themselves: the first version of the
> counter helper treated a brick that is down awaiting regeneration as still "destroyable". It is
> deliberately not counted (#51), so that a level can be cleared while one is away. The helper, not
> the game, was wrong.

A brick whose type is hidden until first struck, then resolves into any other type — including an
indestructible wall, which is the risk that makes it interesting. It is a small change (one new
character in the level map plus a resolve step in `brickHit()`) that adds per-run variance to
hand-authored levels for free.

### 58. ✅ FIXED — Screen shake, hit-stop, and impact scaling (S)

> **Fixed 2026-08-14.** All three, tuned in `CONFIG.impact`
> ([1636-1648](../html/index.html#L1636-L1648)) and driven from three timers on `state`
> ([3003-3008](../html/index.html#L3003-L3008)): a camera shake on an explosion
> ([5025-5026](../html/index.html#L5025-L5026)) and on a lost ball
> ([5307](../html/index.html#L5307)), 55 ms of frozen simulation with the blast, and a paddle squash
> on every steered bounce ([5222](../html/index.html#L5222)). The whole layer lives in one block —
> [3223-3277](../html/index.html#L3223-L3277).
>
> **It is presentation, and the boundary is enforced rather than described.** The shake is a
> `ctx.translate` around the whole scene in `draw()` ([6034-6039](../html/index.html#L6034-L6039)),
> so nothing the game simulates moves because of it, and the squash is applied to the paddle's drawn
> rectangle only ([5932-5942](../html/index.html#L5932-L5942)) — `state.paddle.h` still governs
> collision, so the paddle cannot get easier or harder to hit by flexing.
>
> **The shake offset is derived from its own timer, not `rand()`** — two fast, incommensurable sines.
> Rolling for it inside `draw()` would have made what the game rolls (drop chances, mystery
> resolutions) depend on how many frames it happened to paint, which is a bug that would have
> surfaced as unreproducible seeded tests long after the cause was forgotten. `#58f` pins it.
>
> **Hit-stop is set, never accumulated** ([3203-3208](../html/index.html#L3203-L3208)). Summing it
> across a five-brick explosive chain would put the game to sleep for a third of a second and read as
> a hang. It is also spent from real elapsed time and cleared on a life reset
> ([3109-3111](../html/index.html#L3109-L3111)), so no path leaves the simulation frozen.
>
> `drawBackground()` now bleeds past the play area by the largest possible offset
> ([5710-5718](../html/index.html#L5710-L5718)); an exactly sized fill leaves a strip of the
> previous frame standing along whichever edge the shake moved away from.
>
> Gated on the `reduceMotion` flag #25 already established — under `prefers-reduced-motion` none of
> the three ever starts, which `#58d` asserts against the explosion still happening normally.
>
> Six regression cases, each checked against the mutation that should break it: the shake removed
> (`#58a` fails), the freeze not gating the update block (`#58b`), the squash call removed (`#58c`),
> the reduced-motion guard dropped (`#58d`), hit-stop accumulating instead of being set (`#58e`), and
> `rand()` used for the offset (`#58f`).
>
> One existing fixture needed a line: `gridLevel()`'s `blast()` drives exactly one frame per blast on
> purpose, so it now clears `hitStop` first — otherwise the freeze swallows the second blast in
> `#49d`, which is precisely the behaviour under test everywhere else.

The game already has particles and floating score text; what it lacks is the sub-100ms feedback
layer — a few frames of frozen time on a big hit, a brief camera shake on an explosion, a paddle
squash on ball contact. This is the cheapest possible investment in perceived quality per line of
code, and it must be gated behind the existing `prefers-reduced-motion` handling (see finding #25
above), which is already wired up.

### 59. ✅ FIXED — Music and a richer sound bed (S/M)

> **Fixed 2026-08-15.** All three parts, still on nothing but oscillators — no assets, no library,
> no new UI. `beep()` is now a one-line wrapper over `tone()`
> ([3881-3947](../html/index.html#L3881-L3947)), the single primitive everything audible is built
> from: a note at a scheduled time, optionally gliding to a second frequency (`slide`) or doubled by
> a detuned twin (`detune`).
>
> **The game is in a key.** `noteFreq()`, a minor-pentatonic `MUSIC_SCALE` and one root per level in
> `MUSIC_KEYS` ([4039-4041](../html/index.html#L4039-L4041)) pitch the music, the brick voices and
> the combo ladder from the same place, so a hit lands in tune with the bed rather than beside it —
> and each level sounds like a different level without a single new asset.
>
> **A voice per brick type.** `BRICK_VOICE` ([4094-4105](../html/index.html#L4094-L4105)) gives each
> type its own timbre, register and envelope: a wall thuds low and slides down, silver rings as two
> detuned squares, a mystery brick sparkles upward as it resolves, an explosive drops. Type is the
> only thing that changes what a hit *does* (#49/#51/#52), so it is now also the only thing that
> changes what a hit sounds like. `brickTone()` ([4109-4117](../html/index.html#L4109-L4117))
> replaces the four hand-tuned `beep()` calls that used to be scattered through `brickHit()`
> ([5072-5125](../html/index.html#L5072-L5125)).
>
> **A ladder for streaks.** `ladderSemi()` ([4087-4089](../html/index.html#L4087-L4089)) climbs a
> step of the scale per brick destroyed without a paddle touch, wrapping octaves and holding after
> two — past that the notes stop reading as notes. It is added only when the brick was destroyed,
> because only a destroyed brick builds the combo it counts, and it is read *after* `state.combo` is
> raised ([5100](../html/index.html#L5100)) so a hit sounds on the rung it just earned.
>
> **The bed.** Four voices over a 16-step bar ([4212-4268](../html/index.html#L4212-L4268)), queued
> by `updateMusic()` ([4320-4341](../html/index.html#L4320-L4341)) from `frame()`
> ([6075](../html/index.html#L6075)) and tuned in `CONFIG.music`
> ([1619-1625](../html/index.html#L1619-L1625)). Three things about it are deliberate:
>
> - **Frames decide what, the audio clock decides when.** A note placed at `frame()` time lands
>   wherever the frame fell, which at 60 Hz is up to 16 ms off the beat and audibly so. Frames only
>   queue steps up to `lookahead` ahead of `actx.currentTime`; WebAudio places them.
> - **A stall resyncs rather than catching up** ([4330](../html/index.html#L4330)). A backgrounded
>   tab leaves the audio clock tens of seconds ahead of the bar; without this the next frame would
>   queue every missed step at once — a burst, not music, and an unbounded loop besides. `#59f` pins
>   it.
> - **Voices arrive on the beat they are earned and leave slowly** — `nextIntensity()`
>   ([4307-4314](../html/index.html#L4307-L4314)) rises instantly to whatever `voiceCombo` tier the
>   streak has reached and falls at `voiceDecay` voices per second. Instant decay would flicker the
>   whole arrangement on and off, since a combo dies on *every* paddle touch — several times a level,
>   by design. `intensity` is a float, so a voice fades in and out rather than switching.
>
> Like #58's impact layer, this reads game state and writes none of it, and — same hazard, same fix —
> it takes nothing from the RNG stream (`#59g`): a note chosen by `rand()` would make what the game
> rolls depend on how long it had been playing, and seeded physics runs would stop reproducing.
> Mute needed no change: `audioCtx()` ([3853-3874](../html/index.html#L3853-L3874)) returns null
> while muted, which stops the bed at its source rather than turning it down.
>
> The harness gained a real audio stub. The old one accepted calls and discarded them, which was
> enough for #20's "was resume() called"; sound is now a feature surface, so the stub records every
> scheduled note (`g.notes`: frequency, glide, timbre, detune, time, gain) and its `currentTime`
> tracks the fake frame clock — a context frozen at 0 would let the scheduler queue one lookahead of
> notes and then wait forever. Seven regression cases, each checked against the mutation that should
> break it.

Audio today is `beep()` — bare oscillator tones. A layered synth loop that adds voices as the
combo multiplier climbs, plus distinct sounds per brick type and a rising pitch ladder for
consecutive hits, would do for the ear what the neon palette does for the eye. It stays
dependency-free: everything needed is in the Web Audio API already in use. The existing mute
toggle and its persisted state cover the opt-out.

### 60. ✅ FIXED — Background parallax and per-level themes (S/M)

> **Fixed 2026-08-15.** Five acts of two levels each. `THEMES`
> ([1189-1205](../html/index.html#L1189-L1205)) carries a sky gradient, a grid tint, a horizon tint and
> a star colour per act; `themeFor()` ([1207-1209](../html/index.html#L1207-L1209)) maps the level onto
> it, and `buildLevel()` resolves both the palette and the star field once per level
> ([3076-3077](../html/index.html#L3076-L3077)) rather than per frame.
>
> **Brick colours are deliberately not themed.** A brick's colour *is* its type (#49/#51/#52), so
> re-tinting the field's foreground per act would make the one thing the player has to read at a
> glance the one thing that keeps moving. Only the background changes.
>
> **The parallax is three star layers plus a scrolling horizon**
> ([5690-5707](../html/index.html#L5690-L5707)), all derived from one number — `state.bgScroll`,
> seconds of real time accumulated in `frame()` ([6080](../html/index.html#L6080)). Nearer layers
> drift faster (`STAR_LAYERS`, [1213-1217](../html/index.html#L1213-L1217)), which is the whole effect;
> deriving every offset from the same accumulator is what stops the layers from sliding out of
> register after a stall. Stars are drawn a layer at a time, so the field costs three fill-style
> changes a frame rather than fifty, and the sky gradient is rebuilt only when the act changes
> ([5676-5688](../html/index.html#L5676-L5688)) — `createLinearGradient` allocates.
>
> **The field is generated, not rolled** ([1234-1246](../html/index.html#L1234-L1246)): a Lehmer
> generator seeded from the level index. Two reasons, and both are load-bearing — a level that laid
> out differently on a retry would read as a glitch rather than as a retry, and drawing from
> `Math.random()` would put the paint into the same RNG stream that drop chances and mystery
> resolutions come out of, which is the hazard `#58f` and `#59g` already pin down for the shake and
> the music. `#60c` checks the field is identical under a different seed; `#60d` that entering a
> level and painting it roll nothing at all.
>
> Under `prefers-reduced-motion` the drift stops and the palette stays: an act still looks like its
> own act, it simply holds still. It follows the setting changing mid-session, like #25 and #58d.
>
> The harness needed one addition: the canvas stub answered every method with a counted no-op
> returning `undefined`, which is wrong for `createLinearGradient` — the caller goes on to call
> `addColorStop` on what came back. Methods that return something usable are now defined on the
> proxy's target instead of being answered generically.

Each level currently draws the same background. Giving levels (or groups of levels) a distinct
palette and a slow parallax starfield or grid would make progress visible in the environment rather
than only in the HUD counter, which is how *Shatter* and *Wizorb* sell their act structure.

### 41. ✅ FIXED — A 100-level campaign — 90 generated levels past the authored 10 (L)

> **Fixed 2026-08-15.** The run is now `CONFIG.progression.totalLevels` = 100 levels long, ending in
> the `victory` the game already had. `LEVELS` still authors the first ten; `generateLevel()`
> ([1414-1462](../html/index.html#L1414-L1462)) builds the rest from the level index alone.
>
> **One accessor hides the seam.** `levelDef(idx)` ([1464-1473](../html/index.html#L1464-L1473))
> returns the authored entry or a generated one of the same `{ rows, speed }` shape, memoised a
> single slot deep because `resetPaddleAndBall()` re-reads it on every lost ball. Its two callers are
> `buildLevel()` ([3043](../html/index.html#L3043)) and `resetPaddleAndBall()`
> ([3094](../html/index.html#L3094)), and neither can tell the difference.
> `CONFIG.progression.totalLevels` ([1535-1549](../html/index.html#L1535-L1549)) replaced
> `LEVELS.length` in `checkLevelClear()` ([5394](../html/index.html#L5394)), `renderDynamicText()`
> ([3524](../html/index.html#L3524)) and `updateHud()` ([5705](../html/index.html#L5705)), and the
> HUD's pre-JS fallback became `1/100` ([756](../html/index.html#L756)) — #39's point about a stale
> fallback applies unchanged. Putting the length in `CONFIG` rather than in a bare constant is what
> left the test seam untouched: `CONFIG` was already exposed.
>
> **Deterministic, never from `Math.random()`.** The inline Lehmer generator #60 used for the star
> field is now a shared `seededRandom(seed)` ([1226-1230](../html/index.html#L1226-L1230)), seeded from
> the level index in both places. Level 47 is the same layout for every player and reproducible in a
> test (`#41d`), and rolling from the shared stream would have made drop chances and mystery
> resolutions depend on how many levels had been generated — the hazard `#58f`, `#59g` and `#60d`
> already pin down for the shake, the music and the background (`#41f`).
>
> **Archetypes, not noise.** Per-cell randomness produces mush; the authored levels are patterned.
> One archetype is picked per level from a library of seven — solid bands, checker, columns, pyramid,
> diamond, fortress, arch ([1280-1300](../html/index.html#L1280-L1300)) — and each row is built for the
> left five cells and mirrored. Symmetry is most of what makes a layout read as authored. Type mix
> escalates with depth `d = idx - LEVELS.length`: silver from the start rising to 30% of cells, walls
> from d≥3 capped at 12% and never in the bottom row, 0–3 explosives from d≥2, 1–4 mysteries from
> d≥5, 0–2 regenerating from d≥10. The three budgeted types are scattered *after* the mirror
> ([1376-1394](../html/index.html#L1376-L1394)) so their counts stay what the table asks for rather than
> silently doubling — a few asymmetric accents cost a layout nothing, a doubled explosive budget
> would. Rows grow `6 + floor(d/12)`, capped at the authored maximum of 10.
>
> **Every destructible brick is reachable.** A brick walled off from the ball is a softlock:
> `remainingBricks` never falls to zero and the run is dead with nothing left to hit. `ensureReachable()`
> ([1356-1372](../html/index.html#L1356-L1372)) flood-fills up from the open space below the layout —
> four-neighbour, empty cells and destructible bricks passable (a destructible brick opens its own
> cell once it is gone), `#` solid — and repairs rather than re-rolls, downgrading whichever wall
> faces open space ([1333-1352](../html/index.html#L1333-L1352)) and trying again. Termination is
> guaranteed, since with no walls left everything is reachable, and a repair pass is deterministic,
> so it costs nothing in seed stability. `#41c` asserts the invariant with a flood fill written
> independently in the test rather than by calling the game's own validator.
>
> **Both curves saturate rather than compound** ([1399-1412](../html/index.html#L1399-L1412)), and both
> are anchored on the authored table so they pick up exactly where `LEVELS` leaves off. Speed
> approaches 2.8 from level 10's 2.08 with a ~25-level time constant — 2.32 at 20, 2.65 at 50, 2.78
> at 100 — deliberately modest, because at the cap the ball already crosses ~51px in a worst-case
> 33ms frame once the `fast` power-up and the mid-level ramp stack on it. #38's swept check keeps it
> off the paddle (its regression test now runs at level 100 rather than level 10), but brick
> collision is not swept: **layout carries the back half of the difficulty, not speed.**
> `levelMultiplier(n)` stays exactly `n` through level 10 — the existing scoring tests pin that —
> then saturates toward 20 with a ~30-level constant, replacing the `(state.levelIndex + 1)` factor
> in `brickHit()` ([4997](../html/index.html#L4997)).
>
> **Relief:** three lives across 100 levels is not survivable, so clearing every 10th level hands one
> back, capped at `state.maxLives` ([5285-5291](../html/index.html#L5285-L5291)). Awarded on the way
> to the next level rather than unconditionally, so the last level of the run doesn't hand out one
> nobody gets to spend.
>
> **Two server constants had to move with it.** `functions/api/scores.js` was tuned for a 10-level
> game and would have silently rejected finished 100-level runs — which looks like an empty
> leaderboard, not like an error. `MAX_POINTS_PER_SEC` 500 → 1000: a full run scores ≈1.5M, which at
> 30 s/level is ~504 points per second, over the old ceiling. `TOKEN_MAX_AGE_MS` 6h → 24h: a
> 100-level run is one to two hours with no save and resume (#64), so a lunch break mid-run used to
> invalidate the submission, and the `UNIQUE` constraint on `nonce` is what actually prevents replay.
> **Accepted consequence:** new runs score roughly 30× what the board's existing entries did, and the
> board can never be reset (#67) — old entries stay as history.
>
> The two `rules.js` sweeps and the `physics.js` randomised sweeps were generalised rather than
> duplicated; physics *samples* generated levels (15, 30, 50, 75, 100) on top of the authored ten,
> because sweeping all 90 would have dominated a suite that runs in well under two seconds.

Blokrush ended after 10 hand-authored levels: 15–20 minutes of play. It should run to level 100 and
then the `victory` it already has, with levels 11–100 generated deterministically from the level
number — keeping every existing structure intact (the win condition, the phase machine, one global
hall of fame) and adding a generator behind `LEVELS` rather than a second mode beside it.

**Design decisions, taken 2026-08-15:** 100 levels then victory, no endless mode. One global board,
because bounded play is what keeps a never-resettable board meaningful. Level *n* is the same layout
for every player, seeded from *n*. Brick value saturates instead of growing linearly.

**Known consequences, out of scope:** a full run is one to two hours in one sitting with no way to
save it, which makes #64 (resume an interrupted run) considerably more valuable than it looks in that
list. 100 levels also cycle the five backdrops (#60) ten times; adding a few more `THEMES` entries is
cheap data if that reads as repetitive.

### 68. ✅ FIXED — Level 10 could never be cleared (S)

> **Fixed 2026-08-15.** Level 10's first two rows are now aligned — `"#S#S#S#S#S"` over
> `"#S#S#S#S#S"` — turning the offset checkerboard into alternating full-height wall and silver
> pillars. Same brick types, same counts, same speed; the only difference is that every silver now
> has a destructible brick under it instead of a wall.
>
> `ensureReachable()` (#41) validates generated levels only, so an authored layout has nothing
> catching this. `#68` is that check: the flood fill `#41c` runs over the generated levels now also
> runs over the authored ten, plus a direct assertion on the shape that caused it — no `S` in level
> 10's top row may sit directly on a `#`.
>
> **Superseded 2026-08-17.** Level 10 itself left `LEVELS` when #44 replaced it with a boss
> (`BOSSES[0]`, Sentinel), taking this fix's row data with it — nothing in the current file matches
> `"#S#S#S#S#S"` any more, so the line anchor above is gone rather than left pointing at the wrong
> thing. `#68`'s regression test now checks the general property this fix was really about — every
> authored layout is reachable — rather than the one row shape that used to be broken; see #44.

Level 10's first two rows were `"#S#S#S#S#S"` over `"S#S#S#S#S#"` — offset, so the top row's five
silvers (columns 1, 3, 5, 7, 9) each had a wall to the left, a wall to the right, a wall directly
below, and the ceiling above. Bricks are 43.3 × 20 px with a 3 px margin and the ball has a 7 px
radius, so there is no diagonal squeeze between two wall corners, and no column of row 1 ever opens
a route into the free band above `BRICK_TOP`: those five silvers could not be touched by any means
the game has — ball, explosion (walls are immune) or laser bolt (consumed by the first brick it
meets).

`remainingBricks` therefore never reached zero and **level 10 could never be cleared**. Before #41
that meant the game could not be won; after it, the campaign stopped dead at level 10 with 90
generated levels behind it.

Confirmed by a decision procedure rather than by play: remove every destructible brick (the most
generous case for the player), leaving only `#` walls, grid the ball-*centre* space at 0.25 px, mark
each position free if the ball there clears every wall and the field edges, flood-fill from the
paddle line upward, then ask which bricks any reachable centre touches. Five unreachable before the
fix, none after; the other nine authored levels were clean both ways.

### 69. ✅ FIXED — A level-jump shortcut for the developer (S/M)

> **Fixed 2026-08-15.** Holding **S + E + B** together from any phase opens a prompt for a level
> number and starts it; the run then continues exactly as normal.
>
> **The chord** is one check in the existing `keydown` handler
> ([3274-3279](../html/index.html#L3274-L3279)), reading the `state.keys` set the paddle already
> uses — which is cleared on `blur`, so a chord broken by alt-tab cannot get stuck half-down. Two
> details it turns on. It fires on whichever of the three keys *completes* the chord rather than on
> any keystroke while they happen to be held, or still having them down after a jump would re-open
> the prompt on the next key pressed. And its guard is `isTextEntryTarget()`
> ([3253-3256](../html/index.html#L3253-L3256)), deliberately narrower than the existing
> `isTypingTarget()`: it only has to stand aside for a text field, and since every overlay focuses
> its own button (#26), reusing `isTypingTarget()` would have meant the chord never fired from a
> menu at all — which is most of where it is wanted.
>
> **The prompt is a real phase**, `leveljump` in `PHASE_OVERLAY`
> ([3537](../html/index.html#L3537)), not a modal bolted on beside the phase machine. That is the
> architecture's rule, and it buys three things: the simulation stops while the prompt is up because
> `frame()` only updates on `playing`/`ready`; `showOverlay()` handles `aria-hidden` and focuses the
> field the way `nameentry` does; and its text is ordinary `data-i18n` rather than a special case.
> While it is showing it owns the keyboard — `Enter` submits, `Escape` dismisses, and nothing else in
> the handler gets a look in ([3264-3269](../html/index.html#L3264-L3269)).
>
> `openLevelJump()`/`cancelLevelJump()`/`submitLevelJump()`
> ([3437-3478](../html/index.html#L3437-L3478)) are the whole of it. Cancelling restores the phase
> the prompt interrupted, and **cancelling from `playing` lands on `paused`** — returning to
> `playing` would drop the player back into a live ball the instant the overlay closed, which is the
> reason `autoPause()` exists. Validation is strict rather than `parseInt`: `"12abc"` and `"1e3"` are
> typos, not level numbers, and the bound is `CONFIG.progression.totalLevels`, never a literal 100.
> Arriving needs no new code — `startLevel(n - 1)` already builds the level, resets the paddle and
> ball and lands on `ready`, and the `levelclear` → next-level loop reads `state.levelIndex + 1`.
>
> **A jumped run is out of the running.** `state.jumped` is set by the jump, sticky until
> `newGame()`, and checked in both `endGame()` ([5309](../html/index.html#L5309)) and
> `maybeSaveBest()` ([5224](../html/index.html#L5224)). The world board can never be reset (#67) and
> brick value saturates toward 20× (#41), so jumping straight to level 100 would otherwise be the
> cheapest high score in the game; excluding the local best too stops one test jump parking an
> unbeatable number on the player's own board. The overlay says so in as many words
> ([1022](../html/index.html#L1022)) — this is client-side JavaScript anyone can read, so it is a
> convenience, not a protected mode, and the UI should not pretend otherwise.
>
> Jumping from outside a run (`start`, a finished run, the board opened on demand) resets score and
> lives and refreshes the session token the way `newGame()` does, since there is no run behind it;
> jumping mid-run keeps both. `RUN_PHASES` ([3435](../html/index.html#L3435)) is the distinction.
>
> **One bug this surfaced in existing code.** `showOverlay()` blurred a leftover focused control only
> when it was a `BUTTON` ([3577-3580](../html/index.html#L3577-L3580)). That was harmless while
> `nameentry` was the only input-bearing overlay, because every phase it leads to focuses its own
> button next — but `leveljump` leads straight to `ready`, which has no button, so the jump field
> kept focus and went on swallowing `Space` through `isTypingTarget()`, and the ball could not be
> launched from the keyboard at all. The blur now covers inputs too; `#69d` is the guard.
>
> Also fixed in passing: the `start` and `ready` overlay eyebrows still carried `Niveau 1 / 10` as
> their pre-JS fallback, missed when #41 updated the HUD's. Exactly the staleness #39 is about.

Since #41 the campaign is 100 levels and there is no way to see level 84 without playing to it, which
makes anything past the first few levels effectively untestable by hand. Holding **S + E + B**
together — at any moment, in play, in a menu or on the hall of fame — should open a prompt asking for
a level between 1 and 100, and entering one should start that level directly. From there the run
continues exactly as normal: clearing it goes to `levelclear`, the next button advances to the level
after it, and level 100 still ends in `victory`.

### 65. ✅ FIXED — Achievements (M)

> **Fixed 2026-08-16.** Twenty achievements, four tiers, exactly the roster below — shipped whole
> rather than as a first few.
>
> **The roster is a data table of predicates** ([2520](../html/index.html#L2520)), each a plain read
> of `state`. There is no event bus: every condition is either something state already holds (the
> combo, the lives, the balls in play) or a counter kept in `state.achStats`
> ([2561](../html/index.html#L2561)) by whichever update function owns the event. That is what lets
> `checkAchievements()` ([5509](../html/index.html#L5509)) run from the ordinary per-frame path
> beside `updateHud()` instead of from twenty call sites — plus the three moments a frame cannot
> see: a level cleared, a run ended, a score submitted.
>
> It only ever adds. A predicate that stops being true — a combo that breaks, a streak that ends —
> does not take an unlock back, which is what lets every condition be a read rather than a latch.
>
> **The one genuinely awkward counter is the cascade.** A chain reaction nests, so how big a blast
> was is only known once the outermost `explode()` unwinds; `cascadeDepth`/`cascadeKills` carry it,
> and the initiator counts itself because `brickHit()` cleared it just before the depth went up.
>
> **It is presentation, and `#65d` is the guard.** Same seed and same inputs give an identical score,
> brick state, drop sequence and ball position whether a dozen achievements fire or none do. Nothing
> awards points, lives or power-ups: the moment one did, this would be a second scoring system and
> the hall of fame would stop meaning one thing.
>
> **Per browser, as decided below** — `neonbreak-achievements` ([2600](../html/index.html#L2600))
> holding an array of ids and nothing else, which is what keeps lifetime counters off the roster.
> Everything else is per run and dies with it. `loadAchievements()` ([2657](../html/index.html#L2657))
> drops ids no longer in the roster, so retiring one cannot leave a row nothing can render, and
> storage that throws outright (private browsing) still unlocks and still shows — only remembering
> fails (`#65h`).
>
> **A jumped run earns nothing** (#69), and the screen says so ([880](../html/index.html#L880)) —
> #72's lesson applied before the bug could be written.
>
> **The banner is DOM, not canvas** ([783](../html/index.html#L783)), stacked above the overlays:
> most of the roster lands at a level clear or at the end of a run, which is exactly where a canvas
> banner would sit behind the panel covering the field. It is a queue rather than overlapping
> banners — a cascade that clears a level unlocks three at once — and it is cached like the HUD so an
> idle frame still writes nothing (#15). `aria-live` means it is announced as well as seen, and under
> `prefers-reduced-motion` the slide goes but the banner stays: #58's rule is that the feedback layer
> can be switched off without the game changing, not without the player being told anything.
>
> **Deliberately silent.** An unlock almost always lands in the middle of the combo ladder (#59),
> which is the one sound the player is actually reading, and a sting competing with it costs more
> than it gives.
>
> The two end screens carry a count of what the run unlocked, because a banner during play cannot be
> seen from behind an overlay and an unlock earned on the last brick would otherwise go unmentioned.
>
> **One bug this surfaced in existing code**, caught in a browser and not by the suite: the panel
> opened and could not be closed. `showOverlay()` adds `show` to an overlay by id, but the loop that
> clears it walked `overlays` — a *second*, hand-written list of the same overlays sitting a dozen
> lines above the map whose comment calls itself the single source of truth. The new panel was never
> added to it, so nothing ever took `show` back off. `overlays` is now derived from `PHASE_OVERLAY`,
> the way `OVERLAY_BUTTON_IDS` already was. The tests missed it because they asserted the *phase*,
> which changed correctly — `#65i` now walks every phase in the map and asserts the overlay actually
> on screen, so the next entry cannot repeat it.
>
> Two costs worth recording: 94 new strings across both tables, which is most of the diff and was
> most of the estimate; and the `i18n` suite's `t()` scan now skips a literal ending in a dot —
> `t("ach." + id + ".name")` is the first composed key in the codebase, and `#65e` holds the whole
> roster against both tables rather than leaving those keys unchecked.

Promoted from [feature-ideas.md](feature-ideas.md), where it read, in full: *"A set of named,
persisted goals — clear a level without losing the ball, hit a 10× combo, finish a level using only
the laser, clear the game without a single bad power-up. They need a small event-emitting layer
inside the existing update functions, plus a display surface, plus new strings in every language
table."* That is the idea; below is the roster, which is the part that decides whether the feature is
worth having.

The case for it is that a run is now 100 levels (#41) and the only thing that persists between runs
is a number — the best score, and since #67 a place on the world board. Both reward the same thing:
one very good run. Nothing rewards playing *differently*, and nothing at all acknowledges the parts
of the game a player can go a whole run without noticing — that mystery bricks resolve into
something, that explosives chain, that the laser exists.

**The estimate moved from S/M to M.** Not because any one achievement is hard — most are a
comparison against state the game already keeps — but because twenty of them are forty strings in
two languages, plus an overlay, plus a toast, plus a persisted file that has to survive being
garbage. The roster is the cheap part.

#### The roster

Twenty, in four tiers. The tiers are not shown to the player; they are here because the roster has
to span "you will get this in the first minute" to "nobody may ever get this", or it is either
condescending or discouraging. **Needs** is what has to exist that does not today — the column that
decides the cost.

**I — arrive on their own.** These exist to teach the player that the system is there at all, and
should be unlocked before anyone goes looking for a list.

| Achievement | Unlocks when | Needs |
|---|---|---|
| First Crack | The first brick of the first run comes apart | — `brickHit()` ([4967](../html/index.html#L4967)) |
| Warm Cabinet | Level 10 is cleared | — `checkLevelClear()` ([5248](../html/index.html#L5248)) |
| Full House | You hold `maxLives` lives at once | — `state.lives`, which #41's milestone life feeds |

**II — skill.** The ones a player can aim at.

| Achievement | Unlocks when | Needs |
|---|---|---|
| Untouched Ten | A combo of 10 — ten bricks with no paddle touch between them | — `state.combo` |
| Untouched Twenty-Five | The same at 25 | — |
| Clean Sheet | A level is cleared without losing a ball | Lives at level start, kept for the level |
| Iron Ten | Ten levels in a row cleared without losing a ball | A run counter, reset in `loseLife()` |
| Blitz | A level is cleared in under 45 seconds of play | A per-level play-time accumulator (`dt` while `playing`, so pauses do not count) |

**III — the toys.** Each one names a mechanic a player can otherwise finish the game without ever
having noticed. This is the tier that earns its keep.

| Achievement | Unlocks when | Needs |
|---|---|---|
| Chain Reaction | Six or more bricks go up in a single explosive cascade | A count threaded through `explode()` ([4897](../html/index.html#L4897)) |
| Sharpshooter | 25 bricks destroyed by laser bolts in one run | A run counter on the laser hit path ([3405](../html/index.html#L3405)) |
| Three at Once | Three or more balls in play at the same moment | — `state.balls.length` |
| Whack-a-Brick | A regenerating brick is destroyed after coming back at least once | The brick's `regenLeft` against its starting value ([4967](../html/index.html#L4967)) |
| Curiosity | 25 mystery bricks resolved in one run | A run counter in `resolveMystery()` ([4950](../html/index.html#L4950)) |
| Silver Service | 50 silver bricks destroyed in one run | A run counter |
| Discerning | Five levels in a row cleared without catching `narrow` or `fast` | A counter reset in `applyPowerup()` ([4419](../html/index.html#L4419)) |

**IV — the long tail.** Rare by construction. The last one may never be earned by anybody, which is
the point of having it.

| Achievement | Unlocks when | Needs |
|---|---|---|
| Immortalised | A run lands on the hall of fame | — `qualifiesForHallOfFame()` ([5341](../html/index.html#L5341)) |
| World Class | A run lands on the *global* board (#67) | The API's answer — so it can only ever unlock when the network answered, which is worth saying out loud rather than looking like a bug |
| Six Figures | A run ends on 100,000 or more | — `endGame()` ([5296](../html/index.html#L5296)) |
| Cabinet Beaten | The campaign is finished — `victory` | — |
| Untouchable | The campaign is finished without losing a single ball | Iron Ten's counter, unbroken for 100 levels |

Deliberately **not** on the list: anything that rewards losing ("lose ten balls on one level"), which
reads as mockery on the screen #71 just spent effort making feel bad; anything timed against the wall
clock rather than play time; and anything that needs a lifetime counter. That last one is a real
constraint, not squeamishness — see below.

#### Whose they are — decided

> **Decided 2026-08-16: per browser, and nothing more.** No accounts, no server-side set, no sync
> between devices. If this ever needs revisiting, revisit it here rather than discovering it in the
> code.

**There is no per-user anything in this game, and this feature does not add one.** Worth stating
plainly, because "persisted goals" invites the assumption that a player carries them around:

- `localStorage` is per browser profile per origin. That is the same granularity `neonbreak-best-score`
  and the local hall of fame have had since the beginning — phone and laptop are two separate sets,
  two people sharing a profile share one set, and clearing site data destroys it.
- **The name typed at `nameentry` is not an account.** It is free text cleaned per submission
  ([functions/api/scores.js](../functions/api/scores.js)) — anyone can type anyone's name, and
  nothing keys off it.
- **The session token is not identity either.** It is a signed nonce and timestamp that dates one run
  and is single-use. `ip_hash` exists but only to rate-limit, in a table never joined to `scores`,
  and an IP is shared, dynamic and personal data — it must not become a user id.
- **Private browsing loses them silently.** `storageGet`/`storageSet` swallow throws
  ([2608](../html/index.html#L2608)), so unlocks work for the session and are never remembered. That
  is the correct behaviour and needs no special case, but the overlay should not claim otherwise.

**What was weighed and rejected.** A **claim code** — an opaque id generated locally, pasteable on
another device, backing a server row keyed by that code — is the proportionate way to carry a set
around if it is ever wanted: no accounts, no auth, no PII, and anyone holding the code can claim the
set, which for achievements is a non-problem. It stays available as an upgrade path and needs nothing
here designed around it. **Real accounts** were never in proportion: a login flow, session handling
and a privacy surface, against the constraint that the game is one file that plays offline over
`file://`.

**The asymmetry this accepts**, deliberately: the world board is global and permanent (#67), and
these are neither. A score is a claim against other players and has to be defensible; an achievement
is a note to yourself, and losing one costs the player nothing they can be robbed of. That is the
whole argument, and it is why the cheap answer is also the right one here.

#### Direction

- **Counters on `state`, not an event bus.** Every cross-cutting thing in this file is already a
  field on `state` ([2906](../html/index.html#L2906)) read by a per-frame function, and an emitter
  layer would be the only place in the game where control flows the other way. A single
  `checkAchievements()`, called where `updateHud()` already is ([5602](../html/index.html#L5602))
  plus once at level clear and once at `endGame()`, covers every row above. The genuinely transient
  conditions — a six-brick cascade — become a counter the check reads, not an event it subscribes to.
- **Unlocking is presentation, and must stay presentation.** The rule #58, #59 and #60 all hold to:
  nothing here may feed back into the simulation. **No achievement may award points, lives or
  power-ups.** The moment one does, it is a second scoring system and the hall of fame stops meaning
  one thing.
- **A jumped run earns nothing** (#69), exactly as it earns no place on the board and no best score.
  And #72's lesson applies directly: the rule is fine, being silent about it is not — the
  achievements overlay needs the same `run.jumped` line the end screens now carry, or the feature
  looks broken to the one player most likely to be testing it.
- **One persisted array, and no numbers in it.** `ACH_KEY = "neonbreak-achievements"`, alongside the
  four existing keys ([2596](../html/index.html#L2596)) — per browser, per the section above, and
  **`neonbreak-`, not `blokrush-`**: the namespace is asserted by `persistence.js` precisely so it
  does not get tidied up. Everything above
  is either a run counter (thrown away with the run) or an unlocked id, so the file is an array of
  strings and nothing else. That is what keeps lifetime counters off the roster: they would mean
  writing to storage on every silver brick, and the alternative — batching the flush — is a whole
  consistency problem for a feature nobody asked to be exact. Being parsed rather than read raw, it
  needs `loadHallOfFame()`-style shape validation ([2638](../html/index.html#L2638)): an array of
  strings, unknown ids dropped on load, so retiring an achievement later cannot corrupt the file.
- **The display surface is #73's, twice over.** A new `achievements` phase in `PHASE_OVERLAY`
  ([3503](../html/index.html#L3503)) with its own overlay, opened through the `state.returnPhase`
  pattern `viewHallOfFame(from)` ([3739](../html/index.html#L3739)) just generalised, from the start
  screen and both end screens. Locked entries should show their condition rather than a row of
  question marks: a goal nobody can read is not a goal.
- **The toast is `spawnFloatingText()` moved** ([3177](../html/index.html#L3177)) — the same idea
  pinned to a screen position instead of to a brick. Two things it must get right: several
  achievements can unlock in the same frame, so it is a queue rather than overlapping toasts; and it
  respects `prefers-reduced-motion` like every other moving thing (#58).
- **Forty strings, in both tables.** Twenty names and twenty conditions, in `STRINGS.fr`
  ([2185](../html/index.html#L2185)) and `STRINGS.en` ([2329](../html/index.html#L2329)). The `i18n`
  suite fails on any key present in one table and not the other, so this is mechanical — but it is
  most of the work, and it is the reason the estimate moved.

#### Tests

- `#65a` — an achievement unlocks once, not once per frame, and is still unlocked after a reload.
- `#65b` — a jumped run unlocks nothing, and the overlay says why.
- `#65c` — storage holding valid JSON of the wrong shape leaves the game playable with an empty set,
  the way `loadHallOfFame()` already handles it.
- `#65d` — the layer is presentation: same seed and same inputs produce an identical score, brick
  state and drop sequence whether or not anything unlocked.
- `#65e` — every id in the roster has a name and a condition in both language tables, so adding an
  achievement without its strings fails the build rather than shipping a blank row.
- `#65f` — the overlay returns to the phase it was opened from, like `#73a`/`#73b`.
- `#65g` — three unlocking in one frame are all shown, rather than the last one winning.
- `#65h` — with storage throwing on every access (Safari private browsing), unlocks still happen and
  still show; only remembering them fails. `boot({ storageThrows: true })` already sets this up.

### 70. ✅ FIXED — The music is too repetitive (M)

> **Fixed 2026-08-16.** The bed was one 16-step bar looped forever — 1.8 seconds, under a level that
> lasts minutes. It is now an eight-bar phrase with a pulse under it, and its material belongs to the
> act rather than to the game.
>
> **The phrase.** `MUSIC_BARS` is 8 and a voice no longer has one pattern but several, with `form`
> saying which it plays in each bar — a tracker's order list
> ([4203-4245](../html/index.html#L4203-L4245)). Eight bars is ~15 seconds against 1.8, which is most
> of the perceived fix on its own. `MUSIC_FORM` ([4207](../html/index.html#L4207)) is the other half:
> one degree of the act's scale per bar, transposing every voice together, so the phrase has harmony
> and not just rhythm. `scheduleStep()` took a `bar` argument
> ([4281-4303](../html/index.html#L4281-L4303)) and is otherwise the function it was — the change is
> to the data table, exactly as the write-up below predicted.
>
> **Percussion.** A kick on every bar whatever the combo, and a hat bought with the first combo tier
> ([4252-4268](../html/index.html#L4252-L4268)). That is what lets the melodic voices drop out of a
> bar without the bed falling apart, which is what stops a loop sounding like a loop. The kick is a
> pitch drop and so is still an oscillator; the hat is filtered noise, and `noise()`
> ([3972](../html/index.html#L3972)) over a cached buffer ([3959](../html/index.html#L3959)) is the
> one piece of genuinely new audio machinery here. The buffer is filled from `seededRandom()`, never
> `Math.random()` — see below.
>
> **Material per act.** `MUSIC_ACTS` ([4014-4025](../html/index.html#L4014-L4025)) gives each of #60's
> five acts its own scale, its own tempo and its own timbre for every voice, keyed off the same
> `THEME_LEVELS` the backdrop uses — so the score turns over exactly when the field does. Act I is the
> bed #59 shipped, unchanged. `CONFIG.music.tempo` stays the single knob that moves everything: an act
> scales it rather than replacing it ([4030](../html/index.html#L4030)). Every scale is five notes, so
> the combo ladder is the same length in all of them ([4036](../html/index.html#L4036)) — it now reads
> the act's scale too, which is what keeps a brick hit in tune with the bed behind it.
>
> **`musicBar` lives outside `music`** ([4279](../html/index.html#L4279)). The bed stops on every
> serve, every level break and every lost ball; a phrase that restarted each time would leave a player
> who dies often hearing bar 1 and nothing else. The step does restart, which puts the re-entry on a
> bar line rather than mid-bar.
>
> **Both constraints hold.** `#70d` extends `#59g` over the phrase *and* the noise buffer: still not
> one call into the shared RNG stream, so drop chances and mystery resolutions do not depend on how
> long the music has been playing. And the bed is still presentation — `updateMusic()` reads
> `state.phase` and `state.combo` and writes neither, mute still covers all of it including the hat,
> and every one of `#59`'s cases passes unchanged.
>
> Two things this cost elsewhere: the test seam grew `MUSIC_STEPS`/`MUSIC_BARS`, without which "the
> same bar does not come back round for eight of them" is not a statement a test can make; and the
> harness's `AudioContext` grew a buffer path, recording a noise burst with `freq: 0` so the suites
> that isolate a sound effect as "notes above 220 Hz" do not start picking up hi-hats.

#59 shipped a music bed and it works, but it wears out fast. The reason is arithmetic rather than
taste: the bed is **one 16-step bar looped forever**. `MUSIC_STEPS` is 16
([4203](../html/index.html#L4203)) and `updateMusic()` advances `music.step` modulo it
([4320-4340](../html/index.html#L4320-L4340)), so at `CONFIG.music.tempo` 132 a step is
`60 / 132 / 4` = 0.114 s and the whole loop is **1.8 seconds long**. A single level is minutes of the
same two seconds, and #41 made a full run a hundred levels.

Nothing else varies enough to cover for that:

- **The material never changes.** `MUSIC_VOICES` ([4212-4245](../html/index.html#L4212-L4245)) is
  four fixed voices with fixed `steps` arrays. What combo buys is *which voices sound*
  (`nextIntensity`, [4307-4314](../html/index.html#L4307-L4314)) — four states of the same bar, not
  four different bars.
- **Per-level variation is transposition only.** `musicRoot()` picks a root from ten keys by
  `state.levelIndex % 10` ([4001-4002](../html/index.html#L4001-L4002)), so level 11 is level 1 again
  in the same key, and a 100-level run cycles those ten keys ten times.
- **One scale and one tempo for the entire game** — `MUSIC_SCALE` is a single minor pentatonic
  ([4016](../html/index.html#L4016)) and `tempo` is one number in `CONFIG.music`
  ([1619-1625](../html/index.html#L1619-L1625)).
- **There is no percussion at all.** Four pitched voices carry both the harmony and the pulse, which
  is why the pulse has to be so regular.

Loop *length* is most of the perceived fix, well ahead of harmonic sophistication. Getting from a
1.8-second loop to a phrase of ten or fifteen seconds would do more than any amount of cleverness
inside the current bar.

Also worth watching: `scheduleStep()` creates a gain node and an oscillator per note
([3926-3939](../html/index.html#L3926-L3939)), so a denser arrangement is more allocation per bar. It
is queued in `lookahead` batches rather than per frame, so this is not a per-frame cost, but a
percussion voice on every step is 16 more nodes a bar than the current busiest voice.

### 71. ✅ FIXED — Losing a ball deserves an animation and a sting (S/M)

> **Fixed 2026-08-15.** The ball draining off the bottom now bursts, sounds, and — the part that made
> the rest possible — takes a moment.
>
> **The beat.** `loseLife()` ([5178-5201](../html/index.html#L5178-L5201)) no longer transitions; it
> sets `state.lifeLost = {remaining, ended}` and moves to a new `lifelost` phase
> ([3527](../html/index.html#L3527)), which `frame()` spends a frame at a time
> ([6101-6104](../html/index.html#L6101-L6104)) before calling `finishLifeLost()`
> ([5206-5215](../html/index.html#L5206-L5215)) — the other half of the old function, serving again or
> ending the run. `CONFIG.impact.lifeLostBeat` is 0.7 s
> ([1651](../html/index.html#L1651)). Making it a phase rather than a counter checked beside the
> phase machine is what keeps the rest honest: `lifelost` shows no overlay (so the field stays
> visible), nothing simulates during it because `frame()` only runs the update block on `playing`,
> and the transition still goes through `setPhase()`.
>
> `ended` is decided when the ball is lost, not when the beat runs out, so a life spent on the last
> ball still ends the run even if something else changes `state.lives` in between.
>
> **The burst** is two calls ([5192-5193](../html/index.html#L5192-L5193)): white for the ball coming
> apart, the way every brick burst is its own colour, and red for the life indicator that just went
> out — which is the part the player actually has to read. It is pinned to the bottom edge at the
> ball's last x ([5168](../html/index.html#L5168)), because by the time `loseLife()` runs the ball is
> already 30 px below the canvas and a burst down there is a burst nobody sees. Particles already
> keep updating outside `playing`, so this needed no new draw path.
>
> **The sting** ([4085-4104](../html/index.html#L4085-L4104)) is four notes falling through the
> level's own scale, pitched from `musicRoot()` like everything else in #59 — that is the difference
> between a sting and a buzzer — and placed against the audio clock rather than fired as four
> `beep()`s at frame time, which would put each note wherever its frame happened to fall. The last
> note is a long sawtooth sliding a fifth under the others, and it rings on past the beat into the
> "Ready?" screen. `audioCtx()` returns null when muted, which is the whole guard.
>
> **`prefers-reduced-motion` changes the visuals and not the pacing.** The shake stays suppressed and
> `burst()` thins itself out as it already did, but the beat is deliberately *not* conditional
> ([1644-1651](../html/index.html#L1644-L1651)): it is pacing, not motion, and #58's rule is that the
> feedback layer can be switched off without the game changing — a beat that vanished under the
> setting would make the game's rhythm depend on it. `#71b` asserts the burst thins, the shake stays
> off, and the beat lasts exactly as many frames either way.
>
> **The harness grew two helpers, not thirty edits.** A lost ball no longer resolving in one frame
> moved about thirty existing assertions across six suites, all of the shape "empty `state.balls`,
> frame once, check the phase". `boot()` now offers `loseBall()` (drain, frame, spend the beat) and
> `runLossBeat()` for the two cases that could not use it — one wraps its frame in
> `a.doesNotThrow()`, the other places a real ball past the floor. Both are bounded loops rather than
> `while`, so a bug that never leaves `lifelost` fails a test instead of hanging the run.

Missing the ball is the most consequential thing that happens in the game, and it is the least
dressed. `loseLife()` is four lines: decrement, a screen shake, `updateHud()`, then straight to
`ready` or `endGame()`. Compare what an ordinary brick gets — a particle burst, a floating score, its
own oscillator voice, a paddle squash.

It is also silent. Every power-up has a `beep()` and every brick type has a voice through
`brickTone()`, but losing a ball plays no sound at all. What the player actually hears is the music
*stopping*, since `updateMusic()` nulls the bed the moment the phase leaves `playing` — so the loss
reads as the audio cutting out rather than as an event.

The structural obstacle is that there is no time for an animation: `loseLife()` transitions in the
same frame the ball left the field, so the ball vanishes and the "Ready?" overlay is already up.

### 72. ✅ FIXED — A jumped run is disqualified silently (S)

> **Fixed 2026-08-16.** The exclusion is now stated on the screen where it bites. `victory` and
> `gameover` each carry a `.run-flag` line ([832](../html/index.html#L832),
> [848](../html/index.html#L848)) filled from one new string, `run.jumped`
> ([2212](../html/index.html#L2212), [2356](../html/index.html#L2356)), which says both halves of it:
> the run is out of the hall of fame, and playing again gives an eligible one.
>
> It is written in `renderDynamicText()` ([3636-3638](../html/index.html#L3636-L3638)) rather than in
> `endGame()`, which is where every other conditional string is already rebuilt from state — so it
> also follows a mid-game language switch, and `newGame()` clearing `state.jumped` clears the line
> with it without anyone having to remember to. Both overlays get it because a jumped run that clears
> level 100 reaches `victory`, not `gameover`. Empty on an ordinary run, and `.run-flag:empty`
> ([431](../html/index.html#L431)) takes the element out of the layout entirely so the end screens are
> unchanged for everyone else.
>
> **The prompt's warning now reads as one.** `.jump-warn` ([488](../html/index.html#L488)) was 11px
> dim grey — the least prominent thing on the overlay it was warning about. It is now the same amber
> and the same size as the end-of-run line, which is the point: one message, stated twice, looking
> the same both times.
>
> **The rule itself is untouched** — `#69e` passes unchanged. This was never about relaxing the
> exclusion, and #73 (shipped alongside) gives the jumped run the only route it has to the board.
>
> **No HUD marker.** The write-up floats one as a nice-to-have; it would have to be a bare glyph next
> to the level counter, and a marker that cannot explain itself in the space available is worse than
> the silence it replaces. The end screens say it in full instead. `#72a`–`#72c` are the guards.

Reported as "entering a name does not display the hall of fame". It isn't: name entry works, and a
full playthrough in a real browser reaches `nameentry`, accepts a name and lands on the board exactly
as it should. What actually happened is #69's exclusion rule firing without saying so.

`state.jumped` is set by the level jump and gates `endGame()`
([5309](../html/index.html#L5309)) and `maybeSaveBest()` ([5224](../html/index.html#L5224)). The
effect, on two runs identical apart from the shortcut:

| | Without S+E+B | With S+E+B |
|---|---|---|
| Score at death | 30 | 30 |
| What the player gets | `nameentry` → `halloffame` | `gameover`, immediately |

**The rule stays** — the world board can never be reset (#67) and brick value saturates toward 20×
(#41), so jumping to level 90 would otherwise be the cheapest high score in the game. The defect is
that nothing says it happened. The only notice is one line of 11px dim text on the jump prompt
([1019](../html/index.html#L1019), `.jump-warn` at [488](../html/index.html#L488)), read once, several
minutes before it matters. By the time the run ends the player has forgotten it — and the observed
behaviour is indistinguishable from the hall of fame being broken, which is exactly how it got
reported.

It is also the developer's own testing tool that disables the feature they are most likely testing.

### 73. ✅ FIXED — A "high scores" button on the end screens (S)

> **Fixed 2026-08-16.** `overlay-victory` and `overlay-gameover` each gained a secondary
> `btn-ghost` button beside the restart one ([838](../html/index.html#L838),
> [851](../html/index.html#L851)), so the board is reachable from the screen a run just ended on
> instead of costing a restart that replaces the score you wanted to compare against.
>
> The three entry points now share `viewHallOfFame(from)` ([3739-3743](../html/index.html#L3739-L3743))
> rather than repeating #43's three lines twice more. That is what keeps `state.returnPhase`
> honest: it is only ever meaningful because every route into `halloffame` sets it, and a route that
> forgot would send `setPhase(null)`. Re-rendering before the transition is not decoration either —
> the run that just ended may have changed the board, and the world list can have been swapped in
> underneath it (#67).
>
> **Restart stays the primary control.** `PHASE_OVERLAY` ([3572-3573](../html/index.html#L3572-L3573))
> still focuses `btn-restart` / `btn-restart-win`, per #26's rule that each overlay focuses its own
> call to action; `#73a`/`#73b` assert the new button does not take it.
>
> **`start.viewHof` became `hof.view`** ([2196](../html/index.html#L2196),
> [2340](../html/index.html#L2340)) across both tables and all three markup sites. The text was
> already right for all three screens — the key was the part that would have gone stale, naming one
> screen while appearing on three.

Losing a run leaves only "Rejouer". The board is reachable from the start screen (#43,
[794](../html/index.html#L794)) but not from the two screens where a player has just finished a run
and most wants to see where it landed — so checking costs a restart, and the score you wanted to
compare against is the one you just replaced on screen.

Add a secondary button to `overlay-gameover` ([843-854](../html/index.html#L843-L854)) and
`overlay-victory` ([825-841](../html/index.html#L825-L841)) beside the existing restart button.

Who it is actually for: a *qualifying* run already passes through the board on the way out, since
`endGame()` detours through `nameentry` → `halloffame`. So the button mostly serves runs that did not
qualify, plus anyone wanting a second look after the detour — and it is the only route to the board
for a jumped run (#69/#72), which never gets the detour at all.

### 44. ✅ FIXED — Ten boss levels, one at every level ending in 0 (L)

> **Fixed 2026-08-17.** Levels 10, 20, … 100 are no longer brick grids — each is one of ten bosses
> (`BOSSES`, [1811-2140](../html/index.html#L1811-L2140)), fought inside the ordinary `playing` phase
> rather than a new one. `isBossLevel(idx)` ([1263](../html/index.html#L1263)) and `bossDefIndex(idx)`
> ([1265](../html/index.html#L1265)) are the two predicates everything else is built from;
> `levelDef()` ([1465](../html/index.html#L1465)) routes a boss level through `bossLevelDef()`
> ([1457](../html/index.html#L1457)), which returns the same `{ rows, speed }` shape every other
> source does, plus a `boss` field — so `buildLevel()` ([3042](../html/index.html#L3042)) and
> `resetPaddleAndBall()` ([3084](../html/index.html#L3084)) needed only a few lines each, and no
> other caller learned what a boss is.
>
> **A boss is one or more rectangular "parts."** Almost always the whole visible body; Carapace's six
> plates and core, Gemini's two halves and Omega's three phases are the exceptions. A part is exactly
> the `{x,y,w,h}` shape a brick or the paddle already is, so collision reuses
> `circleRectCollide`/`brickPenetration`/`resolveBrickCollision` unchanged — `updateBalls()`'s brick
> loop just gained an `else` branch (`hitTestBossPart`, [4692](../html/index.html#L4692)) for when no
> ordinary brick was hit. Damage goes through `bossPartHit()`
> ([4723](../html/index.html#L4723)): a hit on a part that is solid but not currently vulnerable
> (Aegis' deflector up, a Carapace/Omega plate still guarding the core) bounces the ball and reads on
> screen without scoring, the same way Phantom's fade skips collision entirely instead
> (`part.solid = false`).
>
> **Two hazard shapes.** `spawnBossShot()`/`updateBossShots()`
> ([4795](../html/index.html#L4795)) is a small projectile system aimed at the paddle instead of up
> from it — reusing the same `onPaddle` effect names (`narrow`, `narrow5`, `life`) `applyBossHazard()`
> ([4775](../html/index.html#L4775)) applies through the existing `widthEffect`/`lives` state every
> other hazard already goes through. `spawnMinion()`/`updateMinions()`
> ([4886-4921](../html/index.html#L4886-L4921)) is a small enemy the ball can destroy in flight,
> kept as its own array rather than flagged bricks (the original sketch in `feature-ideas.md`) —
> `brickHit()`'s combo/score/drop/achievement bookkeeping does not apply to a minion, and duplicating
> it inline would have been the second scoring system #65 explicitly rules out.
>
> **The boss is the only thing that gates level completion on one of these levels.**
> `buildLevel()`'s brick loop never counts an arena's cover bricks toward `remainingBricks` when
> `def.boss` is set, so `checkLevelClear()` ([5248](../html/index.html#L5248)) only needed one added
> branch — `if (state.boss) { if (!state.boss.dead) return; }` — ahead of its existing
> `remainingBricks` check, and #16's "a counter, not a scan" invariant holds for both. Boss hit points
> live on `state.boss`, untouched by `resetPaddleAndBall()`, so they survive a lost ball exactly as
> planned; only `state.bossShots`/`state.minions` clear per life, alongside drops and lasers.
>
> **Arenas are ordinary levels.** `bossArena()` ([1802](../html/index.html#L1802)) prepends four blank
> rows to whatever cover bricks a boss wants — four rather than the two first tried, because Carapace's
> core (bottom `y=130`) and Omega's descent both overshoot a two-row band, and a full-width cover row
> that physically overlaps the boss silently wins the collision the boss was supposed to. The escalation
> from empty arenas to full fields matches the roster below.
>
> **Omega is the composite**, not a fourth new mechanic: `spawnOmegaPhase()`
> ([2144-2173](../html/index.html#L2144-L2173)) rebuilds `b.parts` for whichever of Carapace's
> plates-and-core, blinking Aegis-lite halves, or a tracking-and-descending body is next, and
> `onDepleted()` gates the transition behind a 1.5s invulnerable roar (`b.transition`, ticked centrally
> in `updateBoss()`, [4572](../html/index.html#L4572)) rather than a new phase-machine entry — #18's
> lesson applied rather than relearned. The third phase's defeat reaches `bossDefeated()`
> ([4700](../html/index.html#L4700)) exactly like every other boss's, so `checkLevelClear()` needed no
> special case for the campaign's last level.
>
> **Score parity via one constant, not per-boss tuning.** Every vulnerable hit scores
> `BOSS_HIT_BASE` ([1790](../html/index.html#L1790)) × `levelMultiplier(n)` × the same combo
> multiplier `brickHit()` uses — a boss hit continues the existing combo streak — plus a flat
> `killBonus` per boss (400 → 4000) on defeat.
>
> **Retiring the authored level 10.** `LEVELS` ([1134](../html/index.html#L1134)) dropped from ten
> entries to nine; `levelSpeed()`/`levelMultiplier()` re-anchor on it automatically since both already
> read `LEVELS.length` rather than a literal. `generateLevel()`'s escalation counter needed
> `layoutIndex(idx)` ([1275](../html/index.html#L1275)) — the ordinal of a level among the non-boss
> ones alone — so a boss cadence between two generated levels does not eat one of their difficulty
> steps; the seed a layout is drawn from stays keyed on the real level index, so no layout moved.
> `#68`'s regression test pinned the old level 10's specific row shape directly and had to be
> re-pointed at the general property it was really guarding — see #68's own updated entry above.
>
> **Three achievements** (`bossSlayer`, `flawlessBoss`, `tenHeads`) slot into the existing roster —
> presentation only, per #65's rule, reading `achStats.bossesBeaten`/`flawlessBoss` set by
> `bossDefeated()`.
>
> **Simplified from the original sketch, on purpose.** No intro card or held-ball beat: a fight starts
> the instant `playing` does, with a `CONFIG.boss.fireGrace` ([1690](../html/index.html#L1690))
> delaying only the first hazard — the name-and-hp strip `drawBoss()`
> ([5851](../html/index.html#L5851)) draws every frame is what tells the player this level is
> different, immediately, with no extra state to add. No dedicated death beat either; a boss's last
> part reaching zero hit points ends the fight in the same frame, the way a brick reaching zero always
> has.
>
> New `boss` suite ([test/suites/boss.js](../test/suites/boss.js)): the roster's shape and its i18n
> parity, level identification, damage and defeat (including Omega's phase transition), a boss
> surviving a lost ball while its hazards do not, both hazard kinds, and the achievements a defeat
> feeds. `regressions.js`'s `clearBricks()` helper grew a boss branch so every pre-existing test that
> forces a level clear (`#41a`, `#41h`, `#42g`, `#72b`, `#73b`) keeps working unmodified past it.

Promoted from [feature-ideas.md](feature-ideas.md) and expanded into a ten-boss roster before being
built — see the promotion commit for the full write-up. In short: every polished breakout in the
genre eventually gives the player something that fights back, and Blokrush had a hundred levels of
wall. Ten bosses, one at every level ending in 0, each adding exactly one new idea to the fight and
inheriting the ones before it: the entity itself, dodging, a vulnerability window, two targets,
rhythm and positioning, crowd control, prediction, a boss that reacts to the player, a soft timer,
and finally the composite of all nine.

### 74. ✅ FIXED — A boss kill deserves more than a shake (S/M)

> **Fixed 2026-08-17.** A first pass at this shipped and was reverted the same day: it scaled the
> burst and shake and added a fanfare, but scored both in parallel with `checkLevelClear()` — the
> level cleared the instant the boss died, the fanfare raced the "level cleared" overlay rather than
> preceding it, and manual testing caught it immediately. This entry is the corrected version:
> sequenced, not parallel.
>
> **`bossDefeated()`** ([4700](../html/index.html#L4700)) no longer clears the level itself — it
> starts `state.boss.deathBeat` and returns. **`updateBossDeathBeat()`**
> ([4722-4754](../html/index.html#L4722-L4754)) drives everything from there, in two stages:
>
> - **`"explode"`** ([4697](../html/index.html#L4697): `BOSS_EXPLODE_DURATION`, 0.9s) — silent.
>   Escalating particle pulses (bigger and more frequent for a bigger boss, via `b.defIdx`) every
>   0.12s, ending in one big finishing blast — two layered `burst()` calls (the boss's colour, then a
>   white flash) and a shake, both scaled with `b.defIdx` exactly as the reverted attempt already had
>   right. That blast is also where the fanfare starts.
> - **`"fanfare"`** ([4698](../html/index.html#L4698): `BOSS_FANFARE_DURATION`, 5.0s) — holds until
>   the fanfare finishes, then clears `deathBeat` and calls `checkLevelClear()` itself, which is what
>   actually shows "level cleared".
>
> **`checkLevelClear()`** ([5368](../html/index.html#L5368)) gained one more clause in its existing
> boss guard — `if (!state.boss.dead || state.boss.deathBeat) return;` — defensive rather than the
> only thing enforcing the order, since `frame()` never calls it while a beat is running in the first
> place (below).
>
> **`frame()` freezes the field while the beat plays**, the same idea #71's lost-ball beat already
> applies to a shorter pause: `inDeathBeat` ([6215](../html/index.html#L6215)) skips
> `updatePaddle`/`updateBricks`/`updateBoss`/`updateBalls`/`updateDrops`/`updateLasers`/
> `updateBossShots`/`updateMinions` entirely and runs `updateBossDeathBeat()` plus particles/floating
> text instead — the paddle stops answering, the ball stops moving, and nothing is left to hit
> anyway. That is also what makes "silent" literal: nothing schedules a note until the fanfare's own
> call does.
>
> **The fanfare itself: 5 seconds, not 10, and several instruments rather than one melodic line.**
> `BOSS_FANFARE` ([4126-4174](../html/index.html#L4126-L4174)) plays a rising call twice (an octave
> apart), a quick descending flourish, then a four-note chord that rings out — but every "call" hit
> now layers three things at once: the sawtooth melody, the same call doubled an octave down
> (`withBass`) for weight, and a triangle third above (`withPad`, detuned for shimmer) for harmony —
> plus the exact kick (`freq:110, slide:38, sine`) and hat (`noise({freq:7000})`) recipes
> `MUSIC_DRUMS` already uses for the ordinary bed, so the fanfare sounds like it belongs to the same
> score rather than a separate jingle landing on top of it. `scaleSemi()`
> ([4041](../html/index.html#L4041), factored out of `ladderSemi()`) still keeps every pitch in tune
> with whichever act's scale the level sits in.
>
> **Presentation only**, same rule #58 and #65 both hold to — the death beat holds the *transition*,
> not the outcome: `bossDefeated()` already settled the score, the kill bonus, and the achievement
> stats before `deathBeat` even starts, so a seeded fight produces an identical result whether the
> beat is watched in full or the tab loses focus partway through it.
>
> Four `boss` suite tests replace the two the reverted attempt shipped: the full sequence (silent
> explosion, `deathBeat.stage` flips to `"fanfare"`, only then `"levelclear"`), that nothing but the
> beat itself runs while it plays (paddle and ball provably frozen), the burst/shake scaling (now
> read from the moment `"explode"` hands off to `"fanfare"`, since `finishBoss()`'s own fast-forward
> outlives every particle it made), and the fanfare's length/instrumentation/mute behaviour.

### 76. ✅ FIXED — Hall of fame accepts an empty (or one/two-character) name (S)
> **Fixed 2026-08-18.** `submitHallOfFameName()` ([5428-5465](../html/index.html#L5428-L5465)) now
> rejects a trimmed name shorter than `CONFIG.hallOfFame.nameMin` (3,
> [1679-1684](../html/index.html#L1679-L1684)) outright instead of substituting the `"???"`
> placeholder — the phase stays on `nameentry`, nothing is written to either board, and an inline
> message (`nameentry.error`, [863-866](../html/index.html#L863-L866) for the markup) explains why,
> the same shape #69's level-jump prompt already established for a rejected entry. The maximum moved
> from 12 to 16 characters, `nameMax` and the input's `maxlength` kept in sync as before, and `NAME_MAX`
> in [functions/api/scores.js](../functions/api/scores.js#L21) was raised to match — it re-clamps
> independently of the client and had silently stayed at 12, which would have truncated a 13-16
> character name on the global board while showing it in full on the local one.
>
> The submit button and the input's Enter handler ([3295](../html/index.html#L3295)) both route
> through `submitHallOfFameName()`, so fixing validation there closes both paths at once — no separate
> Enter-key fix was needed. `state.nameEntryError`
> ([2989-2992](../html/index.html#L2989-L2992)) is the flag driving the message, reset whenever
> `endGame()` opens the prompt ([5311](../html/index.html#L5311)) so a stale rejection from a previous
> run never carries over. The now-unreachable `nameentry.anonymous` placeholder string was removed from
> both language tables rather than left dead.
>
> Five new `#76a`–`#76e` cases in `regressions.js` cover the rejection (empty and two-character),
> acceptance at the 3-character minimum, truncation at the 16-character maximum, and that a rejected
> submission clears once a valid name is resubmitted. The prior `#42e` case, which asserted the old
> placeholder fallback, is superseded by `#76a`. Five existing tests that submitted a hall-of-fame name
> without first typing one into the field (`#42g`, `#42j`, `#43e`, `#67d`, and a `persistence.js` case)
> now set a valid name first, since an empty submission no longer advances past `nameentry`.

### 77. ✅ FIXED — Hall of fame names aren't checked for profanity (M)
> **Fixed 2026-08-18.** A self-hosted word list was chosen over an external moderation API — the open
> question the write-up below left unresolved — for the reason already on record for the rest of this
> backend: it adds no network dependency to either the single-file game or the Worker, which is allowed
> to degrade to "the leaderboard is empty" but not to "the leaderboard rejects everyone" if a moderation
> API were ever down. `PROFANITY_LIST`/`normalizeForProfanity()`/`isProfaneName()`
> ([5374-5420](../html/index.html#L5374-L5420)) are new in `index.html`, and `PROFANITY_LIST`/
> `normalizeForProfanity()`/`filterProfanity()` ([133-192](../functions/api/scores.js#L133-L192)) mirror
> them in `functions/api/scores.js` — the same "restated in both places" arrangement `NAME_MAX` already
> has per #76, since the global board's `POST /api/scores` is a public endpoint a client-side-only check
> can't reach. Normalizing folds leetspeak look-alikes to their letter (`a55` → `ass`) and then drops
> everything left that isn't `a`-`z`, so spacing tricks (`s e x` → `sex`) can't split a word across the
> match boundary either; what remains is checked as a plain substring against the list, root words only
> (`ass` catches `asshole` for free) rather than an exhaustive one. The list itself covers both languages
> the game ships in — a name is free text regardless of `lang` — so folding also handles French accented
> letters (`nègre` → `negre`), which would otherwise dodge the filter entirely: `[^a-z]` strips an
> unfolded accented character just like it strips punctuation.
>
> A match is a silent substitution, not a rejection: `submitHallOfFameName()`
> ([5428-5465](../html/index.html#L5428-L5465)) swaps the name for
> `CONFIG.hallOfFame.fallbackName` (`"Bisounours"`, [1677-1684](../html/index.html#L1677-L1684)) after
> the #76 length check passes, so the player sees no error and the substituted name is what reaches both
> `insertHallOfFameEntry()` and `submitGlobalScore()` — one check covers the name that lands on both
> boards. The server does the same at the equivalent point in `onRequestPost()`
> ([251-253](../functions/api/scores.js#L251-L253)), between `cleanName()` and the insert, so a name
> posted directly to the endpoint is filtered exactly like one typed into the game.
>
> Six new `#77a`–`#77f` cases in `regressions.js` cover a straightforwardly profane name, the two
> evasions named in the original write-up (`a55`, `s e x`), that an ordinary name is left alone, a
> French profanity, and an accented evasion (`nègre`). The server-side mirror in
> `functions/api/scores.js` has no automated coverage — consistent with the
> rest of that file, which the test suite doesn't reach at all (see CLAUDE.md: verify it by checking
> `/api/scores` directly).

### 79. ✅ FIXED — Boss defeat is an anticlimax: music keeps playing, the blast is generic and silent (M)

> **Fixed 2026-08-18.** All three gaps closed together, since all three fire off the same moment —
> `bossDefeated()`/`updateBossDeathBeat()` ([4775](../html/index.html#L4775)/
> [4801](../html/index.html#L4801)).
>
> **The bed actually stops.** `updateMusic()` ([4391](../html/index.html#L4391)) now gates on
> `state.phase === "playing" && !inDeathBeat` instead of the phase alone, computing `inDeathBeat`
> itself rather than trusting a caller to pass it — the death beat deliberately stays in `"playing"`
> (no paddle/ball to freeze around otherwise), and that was exactly the gap the old single-condition
> gate fell through.
>
> **The explosion is anchored on the boss, not the screen.** `bossBounds(b)`
> ([4759-4767](../html/index.html#L4759-L4767)) unions every part's `{x,y,w,h}` regardless of `alive`
> — a dead part keeps its geometry, only its flags change — and `bossDefeated()` snapshots it once
> into `deathBeat.bounds`, valid for the whole beat since `updateBoss()` does not run while it plays.
> Both the escalating pulses and the finishing blast in `updateBossDeathBeat()` scatter across that
> box instead of `GAME_W / 2, GAME_H / 2`.
>
> **A distinct look for the occasion.** `fireBurst()` ([3180-3192](../html/index.html#L3180-L3192)) is
> `burst()`'s warm-flame counterpart — a fixed warm palette instead of the caller's color, shorter
> life, and a `glow` flag `drawParticles()` ([6107-6121](../html/index.html#L6107-L6121)) picks up as
> a shadow-blur halo — used for both the pulses and the finishing blast in place of a plain `burst()`
> call. `spawnLightning()`/`drawLightning()`
> ([3199-3210](../html/index.html#L3199-L3210)/[6126-6142](../html/index.html#L6126-L6142)) add a
> handful of jagged, multi-segment bolts (more for a bigger boss) radiating from the boss's center on
> the finishing blast only — the midpoints are displaced off the straight line between the two ends,
> tapering to none at the ends, so a bolt still lands on its target rather than reading as a laser.
>
> **The blast has its own sound.** `bossExplosionSound()`
> ([4237-4244](../html/index.html#L4237-L4244)) layers a lowpass rumble, a highpass crack and a short
> sawtooth pitch-drop — the same "stack `noise()` at different bands for a sense of scale" trick the
> hi-hat recipe already uses — fired once, alongside `bossFanfareTone()`, when the finishing blast
> lands.
>
> Three new `#79` cases in `boss.js` (alongside the existing `#74` ones) cover each gap: that no
> music-bed notes are queued while the death beat holds the field, that a death-beat particle lands up
> near the boss rather than at screen center, and that the finishing blast queues both a low
> (`filterFreq < 200`) and a high (`filterFreq > 1000`) noise burst. All three were confirmed failing
> against the unfixed code before the fix landed.

### 53. ✅ FIXED — Fireball / through-ball (S)

> **Fixed 2026-08-19.** `state.fireballEffect` ([2938](../html/index.html#L2938)) is a fifth timed
> effect alongside `widthEffect`/`speedEffect`/`stickyEffect`/`laserEffect` — the same `{remaining}`
> shape as `laserEffect`, decayed in `updateEffects()` ([4453-4455](../html/index.html#L4453-L4455)),
> cleared on every fresh life in `resetPaddleAndBall()` ([3090](../html/index.html#L3090)), and granted
> by a new `fireball` row in `POWERUPS` ([1485](../html/index.html#L1485), weight 2 like `laser`'s) and
> a branch in `applyPowerup()` ([4505-4507](../html/index.html#L4505-L4507)).
>
> The single-hit-per-frame rule (#10) turned out not to need reworking, just a branch inside it. The
> existing pick-the-least-penetrated-brick loop in `updateBalls()`
> ([5251-5273](../html/index.html#L5251-L5273)) now short-circuits per iteration: while
> `fireballEffect` is active, any alive brick the ball overlaps that isn't an indestructible `"#"` wall
> goes straight to `brickHit()` and is skipped, never entered into the `hitPenetration` comparison — so
> `resolveBrickCollision()` never runs for it and the ball keeps going, while every other brick it also
> overlaps this frame gets the same treatment. A `"#"` wall is the only type that still feeds
> `hitPenetration`, so it's unaffected either way and still bounces the ball exactly as before; so is a
> boss part, since `hitTestBossPart()`/`bossPartHit()` further down only run when nothing set
> `hitBrick`, and fireball changes nothing about what can set it to a boss part. With `fireballEffect`
> inactive the new branch's condition is always false, so the loop's behaviour for every existing case —
> including two adjacent bricks overlapping near a corner — is unchanged.
>
> The one purely cosmetic addition: `drawBalls()` ([6053-6070](../html/index.html#L6053-L6070)) reads
> `state.fireballEffect` once per frame and swaps every ball's fill/glow to a flame palette while it's
> active, so a fireball ball reads as different from an ordinary one even mid-bounce. A fifth
> `.effect-bar` slot (`bar-fireball`, [1044-1046](../html/index.html#L1044-L1046)) and its
> `updateEffectBar()` call in `renderEffectBars()` ([5806-5807](../html/index.html#L5806-L5807)) show
> the timer; `.effect-bars`' reserved `height` ([236-248](../html/index.html#L236-L248)) grew from 38px
> (two wrapped rows, the worst case for four bars) to 60px (three wrapped rows, the worst case for
> five — the narrowest supported viewport only fits two 90px-basis bars per row). `powerup.fireball` was
> added to both `STRINGS` tables ([2313](../html/index.html#L2313) fr,
> [2457](../html/index.html#L2457) en).
>
> Two new `#53a`/`#53b` cases in `regressions.js` cover the two halves: three bricks stacked in the
> ball's path all die in one frame with no bounce, and — with a control confirming fireball is actually
> live in that same run, so the case doesn't trivially pass because fireball doesn't exist yet — the
> ball still bounces off both an indestructible wall and a boss part while fireball is active. Both were
> confirmed failing against the unfixed code before the fix landed.
>
> Left for later, along with the rest of the batch it was promoted with: `magnet`/bullet-time (#55),
> paddle spin (#56), and laser-vs-bad-drop counterplay (#57) — see [todo.md](todo.md). The safety-net
> shield (#54) and the `.effect-bars` capacity/i18n/weight bookkeeping those share with this one still
> need re-deriving against whichever of them ships next; this fix only accounted for its own slot.

### 80. ✅ FIXED — Music intensity driven by level progress, not combo (S/M)

> **Fixed 2026-08-19.** `nextIntensity()` ([4364-4373](../html/index.html#L4364-L4373)) now computes
> `progress = 1 - state.remainingBricks / state.levelBrickTotal` and walks
> `CONFIG.music.voiceProgress` ([1622](../html/index.html#L1622)) — `[0.4, 0.7, 0.9]` — instead of
> reading `state.combo` against combo-count thresholds, so the arrangement builds toward the last few
> bricks whether or not the player is on a streak. `buildLevel()` keeps the starting count in a new
> `state.levelBrickTotal` alongside the live `state.remainingBricks`
> ([3070-3075](../html/index.html#L3070-L3075)), set once per level and never touched again — the
> denominator progress reads. `voiceDecay` is unchanged: a voice still arrives the instant progress
> earns it and leaves only that fast, so a brick regenerating (`R`) eases the arrangement back down
> over a second or so rather than yanking a voice out the moment `remainingBricks` ticks up.
>
> **Boss levels read `state.boss` instead.** `spawnBoss()`
> ([4622-4637](../html/index.html#L4622-L4637)) now snapshots the fight's starting hp into
> `b.hpTotal`, summed over the parts `spawn()` just built. `bossProgress()`
> ([4644-4651](../html/index.html#L4644-L4651)) reads that against the parts currently standing —
> `1 - (sum of remaining hp) / hpTotal` — and `nextIntensity()` branches on `state.boss` before
> falling back to the brick-based fraction, the same guard `checkLevelClear()` already uses to treat a
> boss level as a special case. Taking `hpTotal` as a fixed snapshot rather than a running total means
> a boss whose fight adds parts mid-way (a split enemy pushing two new ones onto `b.parts`) dips
> progress the same way a regenerating brick does, eased back up by the same decay rather than jumping
> the target.
>
> **`musicIntensity()`** ([4379](../html/index.html#L4379)) is a new one-line seam accessor, added
> because `music` itself is reassigned wholesale by `updateMusic()` on every serve and level break — a
> `globalThis.__seam` object literal capturing it once at boot would go stale the first time that
> happened, so a function reading it live was the only way to make `music.intensity` observable to
> tests directly rather than only through the notes it queues.
>
> Four new `#80a`-`#80d` cases in `regressions.js` replace the old `#59b` (combo climbing/breaking):
> breaking bricks toward the end of a level raises intensity with combo held at 0 throughout; a fresh
> level starts at the lowest intensity despite a high combo carried in; a brick regenerating eases
> intensity back down rather than cutting a voice on the next tick; and a boss level's intensity climbs
> as its parts take damage while `remainingBricks` stays pinned at 0. All four were confirmed failing
> against the unfixed code before the fix landed. Four existing `#70` cases that used to buy the full
> arrangement with a maxed-out combo were updated to pin `remainingBricks` near zero instead, since
> combo no longer has any effect on the bed.

### 81. ✅ FIXED — A short fanfare on level clear (S/M)

> **Fixed 2026-08-19.** `LEVEL_CLEAR_FANFARE` ([4238-4277](../html/index.html#L4238-L4277)) reuses
> #74's `BOSS_FANFARE` machinery directly — the same `addMelody(at, step, dur, vol, withBass, withPad)`
> layering a sawtooth call with an octave-down bass note and a third-above triangle pad, plus
> `addKick`/`addHat` reusing the ordinary bed's kick/hat recipes — trimmed to one rising call instead
> of two and no flourish, ending in a short ringing chord: ~2s in total instead of `BOSS_FANFARE`'s
> ~5.5s. `levelClearFanfareTone()` schedules it against `ctxA.currentTime` and resolves every step
> through `scaleSemi()`, the same pattern `bossFanfareTone()` already established, so it stays in the
> level's own scale/act rather than a fixed pitch. Like `LOSS_STING` and `BOSS_FANFARE`, it's always
> the same figure — nothing about it reads `state.combo`, score, or difficulty.
>
> `checkLevelClear()`'s non-boss branch ([5464](../html/index.html#L5464)) calls it right before
> `setPhase("levelclear")`, guarded by `!isBossLevel(state.levelIndex)` — a boss kill already gets its
> own, longer celebration (`bossFanfareTone()` + `bossExplosionSound()`, fired from
> `updateBossDeathBeat()`) before `checkLevelClear()` ever reaches that branch for a boss level, so
> without the guard the two fanfares would stack.
>
> `#81a`/`#81c` (`regressions.js`) cover a non-boss clear scheduling the fanfare's notes and the figure
> staying fixed across different combo/difficulty values; `#81b` (`boss.js`, alongside the existing #74
> cases) covers a boss level's own fanfare not also triggering this one on the frame the death beat
> hands off to `checkLevelClear()`. All three were confirmed failing against the unfixed code first.

An ordinary (non-boss) level clear had no sound of its own — `checkLevelClear()`'s non-boss branch
went straight to `setPhase("levelclear")` with nothing played. Wanted a ~2-second fanfare:
multi-instrument and epic in the way #74's `BOSS_FANFARE` already is, in the spirit of the classic
*Final Fantasy* victory fanfare — a brassy, triumphant fixed figure, not a single beep.

### 54. ✅ FIXED — Safety net / shield (S)

> **Fixed 2026-08-20.** `state.shieldEffect` ([2939-2943](../html/index.html#L2939-L2943)) is a plain
> armed/not flag, not a `{remaining}` object like every other timed effect — a shield decays by use,
> not by time, so it never enters `updateEffects()`'s countdown loop and has no `CONFIG.effects` entry
> of its own. Granted by a new `shield` row in `POWERUPS` ([1486](../html/index.html#L1486), weight 2
> like `laser`/`fireball`) and a branch in `applyPowerup()`
> ([4591-4593](../html/index.html#L4591-L4593)).
>
> **The save is a single guard** in `updateBalls()`'s existing bottom-loss check
> ([5345-5363](../html/index.html#L5345-L5363)): while `state.shieldEffect` is armed, the ball that
> would have been spliced out is bounced back instead — `ball.y` pinned to the floor, `ball.dy`
> reflected, `state.combo` reset the same way a real paddle touch resets it — and the shield is
> consumed. Only the first ball the `bi` loop (counting down from `state.balls.length - 1`) reaches
> this frame gets saved; any other ball crossing the floor the same frame falls through to the ordinary
> splice below it, the forgiving-but-not-free reading the finding asked for. `resetPaddleAndBall()`
> ([3091](../html/index.html#L3091)) nulls it on every fresh life alongside the other effects, so an
> unused shield never carries over.
>
> **A static badge, not a duration bar.** There is nothing to shrink, so it doesn't reuse
> `.effect-bars`/`renderEffectBars()`. A small shield emoji (`#shield-badge`,
> [761-764](../html/index.html#L761-L764), styled at [209-222](../html/index.html#L209-L222)) sits
> absolutely positioned in the corner of the lives HUD cell, toggled by `updateHud()`
> ([5808-5809](../html/index.html#L5808-L5809)) reading `!!state.shieldEffect` — absolute rather than
> in normal flow so its hidden/shown toggle never changes `.hud-cell.lives`'s height, which the shared
> grid row would otherwise pass on to the other three cells. `powerup.shield` was added to both
> `STRINGS` tables ([2314](../html/index.html#L2314) fr, [2458](../html/index.html#L2458) en) for its
> title/aria-label.
>
> `#54a`/`#54b` in `regressions.js` cover a ball that would have cost a life bouncing instead while a
> shield is armed (checking the ball, the shield, the combo, and the life count afterward), and an
> unused shield not surviving `resetPaddleAndBall()`. Both were confirmed failing against the unfixed
> code first.
>
> **Side effect on an unrelated seeded test.** Adding a `shield` row reweights every boundary
> `rollPowerup()` draws against, which perturbed a downstream test: `#52d`'s `mysteryBoard(999)` — 40
> seconds of real play against a board of mystery bricks — stopped landing on a run that resolves any
> silver bricks, because the reweighted table sends the same raw `Math.random()` draws to different
> power-up types partway through the run, changing which bricks the ball happens to hit and when. Its
> seed moved to 998; a comment at the call site now says why, since the next new power-up type is
> likely to force choosing another.
>
> Left for later, along with the rest of the batch: magnet/bullet-time (#55), paddle spin (#56), and
> laser-vs-bad-drop counterplay (#57) — see [todo.md](todo.md). The `.effect-bars` capacity/i18n/weight
> bookkeeping those share still needs re-deriving against whichever of them ships next; this fix left
> `.effect-bars` itself untouched, since the shield's badge deliberately isn't one of its slots.

A one-shot barrier that turns the next ball reaching the bottom into a bounce instead of a life — the
most forgiving pickup in the genre, and the only one aimed at keeping a losing run alive rather than at
score.

**Where it hooks in.** `updateBalls()`'s bottom-loss check is a single guard per ball:
`if (ball.y - ball.r > GAME_H) { lostAtX = ball.x; state.balls.splice(bi, 1); }`. A shield check goes
immediately before it — if `state.shieldEffect` is armed, consume it (`state.shieldEffect = null`),
reflect the ball back up (`ball.dy = -Math.abs(ball.dy)`, `ball.y = GAME_H - ball.r`) and reset
`state.combo` the way a real paddle touch does, instead of splicing the ball out. Nothing else in
`updateBalls()` — the paddle-collision block above it, `loseLife()` below — needs to know the save
happened.

**Not a duration.** Every existing effect in `CONFIG.effects` decays by `remaining -= dt` in
`updateEffects()`; a shield decays by *use*, not by time, so it doesn't belong in that loop or on the
duration-based `.effect-bar` (`updateEffectBar()` assumes a `remaining`/`duration` ratio to drive a
shrinking fill — there is nothing to shrink here). It wants its own small "armed" indicator — a static
icon, not a bar — which is new UI, not a reuse of `renderEffectBars()`.

**Clears with everything else on a lost life.** `resetPaddleAndBall()` already nulls
`widthEffect`/`speedEffect`/`stickyEffect`/`laserEffect` on every fresh life; `shieldEffect` joins that
list. An *unused* shield is deliberately not carried forward — the alternative (hoarding one
indefinitely across many lives, waiting for the worst possible moment) is a strictly better play than
using it promptly, which would make every other timed pickup look bad by comparison.

**Multi-ball interaction, decided rather than left ambiguous:** one shield saves exactly one ball —
whichever the `bi` loop (counting down from `state.balls.length - 1`) reaches first this frame — even
if several balls cross the floor in the same frame. That's a rare edge case (near-simultaneous losses
only really happen with `multi` active and balls launched close together), and catching only one of
them is the correct forgiving-but-not-free reading of "one-shot."

**Tests:**
- `#54a` — a ball that would have cost a life bounces instead while a shield is armed, and the shield
  is gone afterward.
- `#54b` — an unused shield does not survive `resetPaddleAndBall()`.

### 55. ✅ FIXED — Magnet paddle and hold-to-slow bullet time (S each)

> **Fixed 2026-08-20.** Both landed together, sharing a `magnet` slot in `POWERUPS`
> ([1487](../html/index.html#L1487), weight 2 like `laser`/`fireball`/`shield`) but otherwise
> independent of each other, as planned.
>
> **Magnet.** `state.magnetEffect` ([2944](../html/index.html#L2944)) is a normal `{remaining}` timed
> effect — granted in `applyPowerup()` ([4595](../html/index.html#L4595)), counted down in
> `updateEffects()` ([4513-4516](../html/index.html#L4513-L4516)), cleared per life in
> `resetPaddleAndBall()` ([3092](../html/index.html#L3092)) — with its own `.effect-bar` slot
> ([1048-1051](../html/index.html#L1048-L1051), wired into `renderEffectBars()`
> [5873-5874](../html/index.html#L5873-L5874)) since, unlike #54's shield, it decays by time and has
> something to shrink. The bend itself is a new block at the top of `updateBalls()`'s per-ball loop
> ([5226-5241](../html/index.html#L5226-L5241)), gated on `ball.dy > 0` so it only ever touches a
> falling ball: convert the current `dx`/`dy` to an angle with `Math.atan2`, compute the angle toward
> the paddle centre the same way, clamp the difference between them to
> `CONFIG.effects.magnet.turnRate * dt` radians, and convert back with `Math.cos`/`Math.sin` — which
> is what keeps `dx*dx + dy*dy == 1` by construction rather than by discipline, exactly the
> renormalisation the finding called out as the one thing this had to get right.
>
> **Hold-to-slow.** Landed as its own always-available resource rather than folded into
> `updateEffects()` as first sketched — `state.slowMeter`/`slowPointerHeld`/`bulletTimeActive`
> ([2944-2954](../html/index.html#L2944-L2954)) and a dedicated `updateBulletTime()`
> ([4524-4539](../html/index.html#L4524-L4539)), called right before `updateBalls()`
> ([6296](../html/index.html#L6296)) so `ballSpeedMult()` ([3026-3031](../html/index.html#L3026-L3031))
> sees this frame's result. Held via `ShiftLeft`/`ShiftRight` (read directly off `state.keys`, the same
> way `updatePaddle()` already reads the arrow keys) ORed with `state.slowPointerHeld`, which a new
> on-screen button (`#btn-slow`, [1064-1068](../html/index.html#L1064-L1068)) sets on
> mousedown/touchstart and clears on mouseup/mouseleave/touchend/touchcancel
> ([3883-3908](../html/index.html#L3883-L3908)) — and on `window`'s existing `blur` handler
> ([3345](../html/index.html#L3345)), the same alt-tab safety net `state.keys` already gets. The
> button's own fill doubles as the always-visible meter ([712-725](../html/index.html#L712-L725),
> [3911-3917](../html/index.html#L3911-L3917)) rather than a separate element, since nothing else
> needed a second piece of UI just to show the same number.
>
> **A flicker `updateBulletTime()` caught at its own floor.** The first cut gated `held` on
> `state.slowMeter > 0` as well as the raw input, so the instant the meter hit exactly 0 while still
> pressed, `held` read `false` for one frame — sneaking in a fraction of a frame's recharge — before
> reading `true` again the next frame and draining it straight back down, forever oscillating between
> `0` and one frame's worth of recharge for as long as the button stayed down. `#55c`, written to
> assert the meter lands on exactly `0`, caught it immediately. The fix keeps `held` (drain-or-recharge)
> and `active` (whether `ballSpeedMult()` is actually reduced this frame) as two separate reads:
> draining is gated on the raw input alone, so it can only ever go one direction while the button is
> down, and `active` — the only one `ballSpeedMult()` sees — is what turns the slow-down off once the
> meter is actually spent.
>
> `#55a`/`#55b` cover the magnet: the direction vector stays unit length while it bends toward the
> paddle, and a rising ball is left untouched. `#55c`/`#55d` cover bullet time: holding drains the
> meter and slows the ball without ever going negative, and releasing stops the slow-down immediately
> and lets the meter recharge back up without overshooting its cap. All four were confirmed failing
> against the unfixed code first — `#55c` twice over, once before the feature existed and once against
> the flicker above.
>
> Left for later: paddle spin (#56) and laser-vs-bad-drop counterplay (#57) — see [todo.md](todo.md).
> The `.effect-bars` capacity comment now says six bars/still 60px/3 rows rather than five, since two
> bars still fit each wrapped row; `powerup.magnet` and `btn.slow.title`/`btn.slow.aria` were added to
> both `STRINGS` tables.

Two skill-reward effects, bundled here because they're both small and both aimed at the same gap —
giving the player agency during the long, do-nothing descent after a top-wall bounce — not because
they share implementation.

**Magnet.** While `state.magnetEffect` is active, the descending ball's angle bends gently toward
the paddle's centre each frame, rather than being purely a function of where it lands.

The one thing this must get right: `ball.dx`/`ball.dy` are a **unit direction vector** — every
existing write to them (`Math.cos(angle)`/`Math.sin(angle)` at spawn, at the paddle bounce, at every
wall reflection) keeps `dx*dx + dy*dy == 1`, and `updateBalls()`'s per-frame step
(`v = ball.speed * mult * state.difficultyMult * dt; ball.x += ball.dx * v`) relies on that being
true — it's what makes `ball.speed` the actual px/s. A magnet can't just nudge `ball.dx` by some
px/s²-shaped constant; it has to convert to an angle, rotate the angle a small step toward the
paddle centre, and convert back — the same move the paddle-bounce code already makes. Skipping the
renormalisation would silently speed the ball up every frame it curves, a bug that wouldn't show up
until someone actually clocks the ball's speed against the level's nominal one.

**Hold-to-slow.** A held input (a dedicated key, plus an on-screen button for touch, alongside the
existing launch/pause controls) that drops `ballSpeedMult()` — today the one-line
`state.speedEffect ? state.speedEffect.mult : 1` — while held, drawn from a meter that depletes on
hold and recharges when released, rather than a pickup-granted duration. This is new state
(`state.slowMeter`, refilled alongside `updateEffects()`) and a new always-visible meter UI, not
another `.effect-bar` — it's player-triggered and available from the start of a run, not something
collected.

Both are additive to the existing `slow`/`fast` power-up (`state.speedEffect`): magnet changes
angle, not speed; bullet time is its own multiplier stacked into `ballSpeedMult()`'s product, not a
replacement for it.

**Tests:**
- `#55a` — a magnet-curved ball's `dx`/`dy` stay unit length every frame (`dx*dx + dy*dy ≈ 1`).
- `#55b` — magnet leaves a rising ball alone.
- `#55c` — holding bullet time drains the meter and slows the ball, and the meter never drains past
  zero.
- `#55d` — releasing bullet time stops the slow-down immediately and lets the meter recharge.

### 46. ✅ FIXED — Level select (S/M)

> **Fixed 2026-08-21.** `LEVELS_KEY = "neonbreak-levels"` ([2601](../html/index.html#L2601)) —
> `neonbreak-`, not the `blokrush-` the write-up below anticipated: #82 (the rename) hasn't shipped
> yet, so this follows the namespace `persistence.js` actually asserts today rather than the one a
> still-open finding promises. `loadLevelProgress()`/`saveLevelProgress()`
> ([2686-2705](../html/index.html#L2686-L2705)) store one `{level}` record per level ever cleared —
> not just the highest — following `loadAchievements()`'s guard pattern exactly: anything that isn't
> valid JSON, isn't an array, or holds a non-integer `level` is dropped rather than thrown. `#83`
> later added a `stars` field to the same records, exactly this way, without a second key.
>
> **The unlock rule** lives in `highestClearedLevel()`/`isLevelUnlocked()`
> ([2709-2723](../html/index.html#L2709-L2723)): level 1 is always open, and any other level is open
> once its predecessor has a record. `recordLevelClear()` ([2744-2756](../html/index.html#L2744-L2756))
> is called from `checkLevelClear()` ([5457](../html/index.html#L5457)) right where the level's clear
> is already settled — before the win/level-clear branch, so the campaign's last level unlocks too —
> and is a no-op if the level already has a record, so replaying an unlocked level never grows a
> second one.
>
> **The overlay is 100 real `<button>` elements, not an `innerHTML`-rendered list** like
> `.hof-list`/`.ach-list` are. The dom-stub test harness never parses `innerHTML` into queryable
> elements — see [dom-stub.js](../test/dom-stub.js) — so a per-row click handler needs a real,
> individually-addressable node to be testable at all. `overlay-levelselect`
> ([895-1001](../html/index.html#L895-L1001)) authors `level-row-1`..`level-row-100` statically (each a
> plain numbered button, `data-level` for reference), and a single loop wires all 100 once at startup
> ([3808-3820](../html/index.html#L3808-L3820)) rather than re-wiring them on every render.
> `renderLevelSelect()` ([5769-5780](../html/index.html#L5769-L5780)) toggles each row's `textContent`
> (plain number, or a lock glyph in front of it) and native `disabled` state on open — a real disabled
> button rather than a styled-to-look-inert one, so a locked row is also out of tab order and reads as
> unavailable to a screen reader. It is not re-run on a language switch: a row's content isn't
> translatable.
>
> **Reuses #69's boundary rather than inventing one.** `submitLevelJump()` was split to share a new
> `jumpToLevel(idx, preserveRun)` ([3511-3521](../html/index.html#L3511-L3521)) with the new
> `selectLevel()`/`viewLevelSelect()` ([3790-3801](../html/index.html#L3790-L3801)): both set
> `state.jumped = true` and call `startLevel()`, differing only in how `idx` is chosen (free-typed vs.
> bounded by `isLevelUnlocked()`) and whether a run already in progress keeps its score/lives. Level
> select only ever reaches `jumpToLevel` with `preserveRun = false`, since its three entry points
> (`start`/`victory`/`gameover`, mirroring `btn-view-hof`/`btn-view-ach`) are never mid-run. `newGame()`
> is untouched — the start screen's primary button still always begins at level 1.
>
> `#46a`-`#46d` in `regressions.js` cover persistence and the no-op on a re-clear, malformed-storage
> recovery, the `jumped`/hall-of-fame exclusion, and the unlock bound plus reachability from all three
> screens. All four were confirmed failing against the unfixed code first.
>
> **Housekeeping.** Inserting ~280 lines ahead of most of the file's existing `index.html#L*` anchors
> shifted nearly all of them; every anchor in this file was re-derived from the diff rather than
> hand-edited. One, in `#73`'s entry, turned out to already be wrong before this change — pointing at
> `submitLevelJump()`'s old reset lines under a `PHASE_OVERLAY` label — and was corrected to
> `PHASE_OVERLAY`'s real `victory`/`gameover` lines while the tool was out.
>
> **Follow-up 2026-08-21.** The initial cut capped `.levelselect-list` at `max-height: 46%` with
> `overflow-y: auto`, matching `.ach-list` — which meant 100 rows in an `auto-fill` grid needed a
> scrollbar to see the levels past the fold. Replaced with a fixed 10-column grid
> ([591-603](../html/index.html#L591-L603)) sized to show all 100 at once with no scrolling: cells
> shrink with the available width instead of wrapping into an eleventh row.

Today a run always starts at `startLevel(0)` via `newGame()`; the only way to reach a later level
directly is `submitLevelJump()` behind the `S`+`E`+`B` developer chord (`openLevelJump()`), which is
unrestricted (any level 1–100) and always sets `state.jumped = true`, permanently excluding that run
from the hall of fame (#69). This entry is the player-facing, *earned* version of the same mechanism:
a level unlocks once cleared, and revisiting it doesn't pretend to be a full run. Rating those cleared
levels with stars is a separate, follow-on item — see **#83** — layered on top of the persistence and
UI this entry builds; nothing here depends on #83 shipping.

**Persistence: a new key, same defensive shape as the others.** Add `LEVELS_KEY =
"blokrush-levels"` (keeping the `^blokrush-` namespace `persistence.js` asserts, per #82) storing
per-level progress — at minimum the highest level index ever cleared. `loadLevelProgress()`/
`saveLevelProgress()` should follow `loadAchievements()`'s pattern exactly: guard against
valid-JSON-but-wrong-shape data (an object instead of an array, non-numeric entries) and drop anything
that doesn't parse rather than throwing — `storageGet`/`storageSet` already swallow the *access*
throwing (Safari private-browsing), but a corrupt *value* is a separate failure mode neither of those
functions catches. #83 extends this same record with a per-level star field rather than introducing a
second key, so the shape here is worth choosing with that in mind (e.g. an array of per-level objects,
not a bare array of cleared indices, even though only the index is populated yet).

**Where the unlock actually happens.** `checkLevelClear()` is the single place a level's clear is
already settled — it increments `state.achStats.levelsCleared` and runs `checkAchievements()` before
branching on whether the run is over. Recording the unlock belongs right there, using
`state.levelIndex` (the level just finished, not the one about to start), before the
`endGame(true)` / `setPhase("levelclear")` branch, so the campaign's last level unlocks too.

**The level-select screen is a new overlay, not a repurposed one.** The closest existing precedent
is `overlay-achievements` (#65): a pure list view reached from the start screen and from both
end-of-run screens, populated in JS (`ol.ach-list`), with `state.returnPhase` telling `Continuer`
where to go back to. A new `overlay-levelselect` should follow the same shape — a scrollable list of
the 100 levels, each row showing whether it's unlocked or a lock glyph past the highest cleared index
— wired into `PHASE_OVERLAY`/`showOverlay()` like every other phase, and reached via a new ghost
button next to `btn-view-hof`/`btn-view-ach` on `overlay-start` (and their `-win`/`-over` twins, for
consistency with how those two are already offered on all three screens). #83 adds a star rating to
each unlocked row later; this entry's rows only need the lock/unlock state.

**Starting from a selected level has to reuse #69's hall-of-fame boundary, not invent a new one.**
`RUN_PHASES` and `state.jumped` already exist to answer exactly this question for the developer jump:
a run that didn't start at level 1 doesn't get to submit to the board (#67's "one global board still
means something" only holds if a score reflects the levels it claims to). Selecting a level should
call the same `startLevel(n - 1)` / `state.jumped = true` path `submitLevelJump()` uses, rather than
adding a second, parallel notion of "this run doesn't count" — the only difference is that level
select's `n` is bounded by the player's own unlock progress, not free-typed. This does mean the
feature is for practice, not for grinding the world board from a late level, which is the intended
boundary here, not an oversight to fix later.

**Interaction with `newGame()`.** `newGame()` should keep always calling `startLevel(0)` — the start
screen's primary button stays a clean, hall-of-fame-eligible run. Level select is reached only
through the new secondary button, mirroring how `btn-view-hof`/`btn-view-ach` are secondary too.

#### Tests

- `#46a` — clearing a level for the first time persists it (highest-cleared index advances, the
  storage key is namespaced `blokrush-`), and re-clearing an already-unlocked level is a no-op on that
  record.
- `#46b` — `loadLevelProgress()` recovers to an empty/default state from malformed storage (missing
  key, non-JSON, JSON that isn't an array) instead of throwing.
- `#46c` — starting a run from level select sets `state.jumped` the same way `submitLevelJump()`
  does, and such a run is excluded from hall-of-fame submission exactly as a developer-jumped run is.

### 83. ✅ FIXED — Per-level star ratings (S)

> **Fixed 2026-08-21.** `startLevel()` ([3127](../html/index.html#L3127)) captures
> `state.levelStartScore = state.score` right after resetting `state.achStats`'s per-level
> counters — the baseline `starsForClear()` ([2731-2737](../html/index.html#L2731-L2737)) measures a
> clear against, isolating what the level just finished actually earned
> (`state.score - state.levelStartScore`) from the run's cumulative total. Thresholds live in
> `CONFIG.progression.starThresholds` ([1542-1548](../html/index.html#L1542-L1548)), `[250, 500]`,
> each read as a multiple of `levelMultiplier()` rather than an absolute number, exactly as the
> write-up below asked for: 2 and 3 stars need progressively more of it, and a bare clear (below
> both) is still 1 star, never 0.
>
> **`recordLevelClear()`** ([2744-2756](../html/index.html#L2744-L2756)) now takes the computed
> rating as a second argument and folds it into the same `{level}` record `#46` already persists
> under `LEVELS_KEY`, raising a level's stored `stars` only if the new rating is higher — a worse
> replay never erases a better one already on record. `loadLevelProgress()`
> ([2686-2705](../html/index.html#L2686-L2705)) normalizes every loaded entry to carry a valid
> `stars` (0-3), so records saved before this field existed degrade to an unrated `0` rather than
> being dropped or throwing. `checkLevelClear()`'s call site
> ([5457](../html/index.html#L5457)) computes the rating right where the level's clear is already
> settled, the same place `#46`'s unlock already happens.
>
> **Display** is `starsForLevel()`/`starGlyphs()`/`renderLevelSelect()`
> ([5749-5780](../html/index.html#L5749-L5780)): an unlocked, ever-cleared row gets `"★"`/`"☆"`
> appended after its number, repeated per star out of 3 — the same plain-glyph convention as the
> `?`/`X`/`R` brick markers elsewhere, rather than a new icon. A row that's unlocked but never
> cleared shows no stars at all, distinct from a legacy `0`-star record.
>
> `#83a`-`#83c` in `regressions.js` cover the "never lowers, a better replay raises it" rule, the
> `levelMultiplier()` scaling (the same absolute score earns fewer stars late than early), and that a
> first clear is rated on the level's own earned score rather than the run's cumulative one. All
> three were confirmed failing against the unfixed code first.
>
> **Housekeeping.** This change's insertions shifted most of the file's `index.html#L*` anchors by a
> handful of lines each; every anchor in this file (not just the ones this entry touches) was
> re-derived from the diff rather than left to drift, the same bulk pass `#46`'s entry describes
> doing when its own, much larger insertion did the same thing.
>
> **Follow-up 2026-08-21 (#94).** The rating computed above wasn't shown anywhere at the moment it was
> earned — only later, in level select. See `#94` for the levelclear-overlay display added on top of
> this entry's `state.lastLevelStars`/`starGlyphs()`.

Raised directly, split out of what was originally one item (#46) covering both level select and star
ratings. This entry is the rating half: once a level is unlocked (#46), grade how well it was
cleared, 1–3 stars, and show that rating wherever the level is listed. It builds on #46's persistence
and level-select overlay rather than duplicating either — #46 is a prerequisite in practice (there's
nowhere to display a star rating without a level-select list), though nothing here requires #46 to
land in the same change if the two are picked up separately; a rating with no list to show it in is
still worth persisting, just not visibly useful yet.

**Extends #46's stored record, not a second key.** #46's `LEVELS_KEY` persists at least the highest
cleared index; this entry adds a 1–3 star field to that same per-level record via
`loadLevelProgress()`/`saveLevelProgress()`, rather than introducing a parallel store that the two
features would have to keep in sync. Re-clearing an already-rated level should only ever raise its
stored rating, never lower it — a worse replay of a level already mastered shouldn't erase that
level's best showing.

**Star thresholds have to scale with the level, not be fixed.** `CONFIG.progression.scoreCap`/
`scoreTau` already grow the per-brick score multiplier through `levelMultiplier()` as the campaign
progresses (#41), so a fixed point threshold that means "3 stars" on level 3 would be trivial on
level 80. Nothing today tracks score *per level* — `state.score` is cumulative for the whole run —
so this needs a small addition: capture `state.levelStartScore = state.score` in `startLevel()`
(next to where it already resets `state.achStats.levelTime`), and rate stars at clear time off
`state.score - state.levelStartScore` against thresholds expressed as a multiple of that level's
`levelMultiplier()`, not an absolute number.

**Display is a small addition to #46's list, not a new screen.** `overlay-levelselect`'s rows already
show lock/unlock state (#46); an unlocked row additionally renders its stored star count (a glyph
repeated per star, matching how `?`/`X`/`R` already render non-colour brick markers elsewhere in the
canvas rather than inventing a new icon convention). No new overlay, no new entry point.

#### Tests

- `#83a` — re-clearing an already-unlocked level never lowers a star rating already earned, and a
  better replay raises it.
- `#83b` — star thresholds scale with `levelMultiplier()`: the same absolute per-level score earns
  fewer stars on a late level than on an early one.
- `#83c` — a level cleared for the first time is rated using only the score earned *during that
  level* (`state.score - state.levelStartScore`), not cumulative run score.

### 94. ✅ FIXED — The star rating a level just earned was never shown at level-clear (S)

> **Fixed 2026-08-21.** Requested directly by the user: `#83` computed and stored a 1-3 star rating
> the instant a level cleared, but the only place that rating was ever shown was level select — the
> `overlay-levelclear` screen shown right when it's earned said nothing about it. `checkLevelClear()`
> ([5450-5457](../html/index.html#L5450-L5457)) now stashes the computed rating in
> `state.lastLevelStars`, a display-only field (not persisted, not part of `RESUME_FIELDS` — a
> resumed run never re-shows a past `levelclear` overlay, so there's nothing to reconstruct).
> `renderDynamicText()` ([3672](../html/index.html#L3672)) writes it into a new
> `#levelclear-stars` paragraph ([820-821](../html/index.html#L820-L821)) via the same `starGlyphs()`
> level select already uses, so the two never draw a rating two different ways. Styled gold
> (`.overlay-stars`, [409-419](../html/index.html#L409-L419)) via the existing `--neon-amber` token —
> the same accent the HUD's level counter and every other "golden" readout already use — with a glow
> and a larger size than the score/best lines below it, since here it's the payoff the screen exists
> to show, not a secondary readout.
>
> `#94` in `regressions.js` clears a level for 3 stars and asserts the overlay reads `"★★★"`, then
> clears the next level for 1 star and asserts it updates to `"★☆☆"` rather than leaving a stale
> reading from the level before — confirmed failing against the unfixed code first (the element
> didn't exist at all).

#### Tests

- `#94` — the levelclear overlay's star line matches the rating `#83` just computed for the level
  that cleared, and updates on the next level's clear rather than holding the previous rating.

### 82. ✅ FIXED — Rename `neonbreak-*` to `blokrush-*` (S)

> **Fixed 2026-08-21.** The six `localStorage` keys (`BEST_KEY`, `LANG_KEY`, `MUTED_KEY`, `HOF_KEY`,
> `ACH_KEY`, `LEVELS_KEY` — [2596-2601](../html/index.html#L2596-L2601)) now read `blokrush-*`.
> `persistence.js`'s `^neonbreak-` namespace assertion became `^blokrush-`, and every test file that
> seeded or asserted a literal `neonbreak-*` key (`persistence.js`, `i18n.js`, `rules.js`, `state.js`,
> `boss.js`, `regressions.js`) was updated to match — `git grep -in neonbreak` comes back clean now
> outside this entry and the historical write-ups elsewhere in this file that describe what shipped
> under the old name, which is deliberately left alone (see the write-up below).
> [CLAUDE.md](../CLAUDE.md)'s Persistence section and [docs/testing.md](testing.md)'s example snippet
> were reworded to describe the namespace as it stands now, rather than telling a future session to
> leave `neonbreak-*` alone.
>
> **Test coverage landed as one combined test rather than the two originally sketched.** `#82a` (in
> `regressions.js`) drives a single session through every code path that writes to storage — a
> language switch, a mute toggle, an achievement unlock, a level clear, and a hall-of-fame-qualifying
> game over — and asserts every key the session wrote matches `/^blokrush-/` and none matches
> `/^neonbreak-/`. The originally-sketched `#82b` (a standalone guard on `persistence.js`'s own regex)
> turned out to be redundant with that: `persistence.js` already has a "storage keys are namespaced to
> the game" test that runs that exact regex against real keys written during play, so if the assertion
> were ever left on `^neonbreak-` while the keys moved to a new prefix, that behavioural test — not a
> meta-test reading the test file's own source — is what would catch it.

[CLAUDE.md](../CLAUDE.md)'s persistence section currently says to leave the four/five `localStorage`
keys (`BEST_KEY`, `LANG_KEY`, `MUTED_KEY`, `HOF_KEY`, `ACH_KEY` — `html/index.html` around L2377-2381)
named `neonbreak-*`, because renaming them would orphan an existing player's save. That reasoning no
longer holds: the game has not been released to production, so there is no installed base to strand.
Renaming the namespace to `blokrush-*` is now purely a cleanup, not a compatibility break worth
avoiding — do it.

**This isn't just the five key literals.** `persistence.js` (the test suite) asserts the namespace
structurally, not just by example — a `^neonbreak-` regex, presumably in `test/suites/persistence.js`
near where it walks every persisted key — so the assertion itself has to flip to `^blokrush-` in the
same change, or the suite would fail the moment the keys move. Every test file that boots against a
seeded `storage: { "neonbreak-...": ... }` fixture needs the same string updated — `persistence.js`,
`i18n.js`, `rules.js`, `state.js`, `boss.js`, and `regressions.js` all currently seed or assert against
literal `neonbreak-*` keys (`git grep -in neonbreak` is the way to find every call site, since new
ones get added as tests are written — safer than trusting this list to stay exhaustive).

**[CLAUDE.md](../CLAUDE.md) itself needs its wording changed, not just the code.** The Persistence
section's "The keys are still named `neonbreak-*` from before the rename to Blokrush. **Leave
them.**" paragraph is the thing that would otherwise contradict this fix on the next read — it has to
be rewritten to describe the *new* namespace and the fact that the rename already happened, or the
project's own guidance would tell a future session to leave what this finding just changed.
[docs/testing.md](testing.md)'s example snippet (`storage: { "neonbreak-best-score": "500" }`) needs
the same update so a copy-pasted example still works.

**`docs/done.md` is history, not live documentation — leave its existing entries alone.** Past
`✅ FIXED` write-ups (e.g. the hall-of-fame and achievements entries) describe what shipped *at the
time*, under the name that was then current; rewriting them to say `blokrush-*` would misdescribe what
actually happened in that commit. This finding's own entry, once it moves to `done.md`, is what
records the rename — earlier entries don't need touching.

#### Tests

- `#82a` — a single session drives every code path that persists to storage (language, mute, an
  achievement, a level clear, a hall-of-fame-qualifying game over) and asserts every key the session
  wrote matches `/^blokrush-/`, and none matches `/^neonbreak-/`.

---

### 64. ✅ FIXED — Resume an interrupted run (S/M)

> **Fixed 2026-08-21.** Shipped essentially as the write-up below planned it, with `#82` already
> landed so `RESUME_KEY = "blokrush-resume"` ([2602](../html/index.html#L2602)) needed no namespace
> deviation the way `#46`'s did.
>
> **The snapshot.** `RESUME_FIELDS` ([2768-2774](../html/index.html#L2768-L2774)) lists the plain-data
> slice — `levelIndex`/`score`/`lives`/`jumped`/`combo`/`difficultyMult`/`bricksDestroyed`/
> `remainingBricks`/`levelBrickTotal`/`baseBallSpeed`/`slowMeter`, the seven effect fields, `balls`,
> `bricks`, `achStats`, `boss`, `sessionToken` — plus `paddle.x`/`paddle.baseW` handled separately since
> only two of that object's fields are wanted. `saveResume()`/`loadResume()`/`clearResume()`
> ([2783-2808](../html/index.html#L2783-L2808)) follow `loadAchievements()`'s defensive shape-check
> exactly: malformed or wrong-shape JSON degrades to `null` rather than throwing. `restoreFromResume()`
> ([2813-2832](../html/index.html#L2813-L2832)) reassigns the slice onto `state` and recomputes
> `theme`/`stars` from `levelIndex` rather than storing them a second time.
>
> **Two things the write-up's own reasoning missed.** First: `JSON.stringify` has no representation
> for `Infinity`, and an indestructible ("#") brick's `hp` *is* `Infinity` (see `buildLevel`) — it
> would otherwise round-trip through `localStorage` as `null` and start decrementing like an ordinary
> brick the instant it was next hit. `resumeReplacer`/`resumeReviver`
> ([2776-2781](../html/index.html#L2776-L2781)), passed to `JSON.stringify`/`JSON.parse` as the
> replacer/reviver, encode it as a sentinel string across the storage boundary instead. Second:
> `state.boss` isn't quite "no special case beyond `defIdx`" either — two of the ten bosses (Carapace,
> and Omega's phase 0) alias a part rather than just listing it: `spawnBoss()`'s `b.core` is the *same
> object* as one entry in `b.parts`, so their `update()` can drift the core and have both the hit-test
> and the draw loop (which walk `parts`) see it move. A JSON round-trip breaks that aliasing too — the
> core would stop tracking its own `sineDrift` after a resume. `restoreFromResume()` re-links it by
> finding the `parts` entry with `kind === "core"` ([2822-2831](../html/index.html#L2822-L2831)) — the
> only boss-shape special case the feature actually needed.
>
> **Save-on-pause is the `setPhase()` guard the write-up describes, checked against the outgoing phase**
> ([3646](../html/index.html#L3646)) — `p === "paused" && RUN_PHASES[state.phase]`, evaluated before
> `state.phase` is overwritten. That reuse is what keeps the boot-restore path from re-saving over the
> snapshot it just loaded for free: boot calls `setPhase("paused")` from `"start"`, which isn't a
> `RUN_PHASES` entry, so nothing re-fires. A `pagehide` listener ([3358-3364](../html/index.html#L3358-L3364))
> is the second line of defense, saving directly rather than depending on `autoPause()` having already
> run.
>
> **The token is carried through unchanged.** Boot's restore branch ([6331-6336](../html/index.html#L6331-L6336))
> calls `restoreFromResume()`/`setPhase("paused")` and skips `fetchGlobalBoard()` entirely — the branch
> that *does* call it is the plain `"start"` path, now in an `else`. `TOKEN_MAX_AGE_MS` needed no code
> change: a token-expired submission already fails silently through `submitGlobalScore()`'s existing
> "no `data`" branch, the same path an unreachable API takes — see `apiFetch()`'s "every network
> problem collapses to the same signal" comment.
>
> **The pause overlay's second button** — `btn-pause-newgame` ([813](../html/index.html#L813)),
> `.btn-ghost` like `btn-leveljump-cancel` — is hidden by default and shown only while
> `state.resumedFromSave` is true, toggled in `renderDynamicText()`
> ([3703](../html/index.html#L3703)). That flag is set only by the boot-restore branch and cleared by
> `resume()` ([3459-3462](../html/index.html#L3459-L3462)) the moment the restored run is actually
> continued, so it never leaks onto an ordinary pause later in the same session. Its handler
> ([3823-3827](../html/index.html#L3823-L3827)) is `clearResume()` then `newGame()`, exactly as
> planned. `newGame()` ([3133](../html/index.html#L3133)) and `endGame()`
> ([5477](../html/index.html#L5477)) both call `clearResume()` unconditionally.
>
> **Housekeeping.** Inserting ~120 lines ahead of most of the file's existing `index.html#L*` anchors
> shifted the majority of them; every anchor in this file was re-derived mechanically from the diff
> hunks (a pure line-offset remap, since every hunk here was an insertion or a same-size replacement)
> rather than hand-edited, the same discipline `#46`'s entry used.
>
> `#64a`-`#64e` in `regressions.js` cover the snapshot round-trip (damaged brick hp, an indestructible
> brick's `hp` surviving as `Infinity` rather than `null`, an active effect, the live ball's exact
> position/velocity), the literal token surviving a boot that must not re-fetch, malformed-storage
> recovery, `jumped` staying `false` through a restore, and both `newGame()`/`endGame()` clearing the
> snapshot. All five were confirmed failing against the unfixed code first (`#64c` alone already
> passed, since "no resume key" degrading to an ordinary boot needs no feature code to be true).

Since #41 a full campaign is 100 levels — one to two hours in a single sitting — so today, closing
the tab or letting the OS kill a backgrounded one doesn't cost a few minutes, it costs the whole run:
nothing survives past `state`, which lives only in memory. `autoPause()` already freezes the
simulation on `visibilitychange`/`blur` (`frame()` only advances on `playing`/`ready`), but freezing
in memory and surviving a reload are different problems — this entry is the second one.

**What actually needs serializing is a snapshot, not the whole `state` object.** Most of `state` is
either reconstructible or disposable: `state.stars`/`state.theme` come back identical from
`buildStars(idx)`/`themeFor(idx)` since both are pure functions of the level index (the same
determinism #47's write-up leans on), and `state.particles`/`state.floatingTexts`/`state.lightning`
are purely cosmetic — losing whatever was mid-flight when the tab was hidden is invisible, since
`autoPause()` already stops rendering them at that instant anyway. `state.drops`/`state.lasers`/
`state.bossShots`/`state.minions` are gameplay-live but transient hazards; discarding them on resume
is the same trade `resetPaddleAndBall()` already makes on every ordinary serve, just extended to "the
tab came back", so a resumed run starts each life's hazards clean rather than needing to save and
rehydrate in-flight geometry for objects that were, at most, one paused frame old.

**What's left is a small, plain-data slice, because every field involved already is plain data.**
`levelIndex`, `score`, `lives`, `jumped`, `combo`, `difficultyMult`, `bricksDestroyed`,
`remainingBricks`, `levelBrickTotal`, `baseBallSpeed`, `slowMeter`, the seven effect fields
(`widthEffect`/`speedEffect`/`stickyEffect`/`laserEffect`/`fireballEffect`/`shieldEffect`/
`magnetEffect`, each already either `null` or a `{mult, remaining}`/`{remaining}` literal), `paddle`
(`x`, `baseW`), `balls`, `bricks`, `achStats`, and — see below — `sessionToken`. `state.boss` looks
like it would be the hard case, but `spawnBoss()` builds it as a plain object too (`defIdx`, `t`,
`hitsTaken`, `parts`, `dead`, `transition`, `fireGrace`, `hpTotal`); `updateBoss()` looks up
`BOSSES[b.defIdx]` fresh every frame rather than closing over a function reference, so a boss fight
serializes and restores exactly like an ordinary level's bricks do, with no special case beyond
carrying `defIdx` through. `bricks` has to be the *live* array, not a call to `buildLevel(idx)` — a
generated level is deterministic in its starting layout, but not in what survives a level partway
through, so regenerating from `idx` would silently resurrect every brick already destroyed.

**Save on every transition into `paused`, not on a separate timer.** `setPhase(p)` is already the one
place every phase change flows through (per the note at `PHASE_OVERLAY`); a `p === "paused" &&
RUN_PHASES[state.phase]`-style guard there is the natural single call site for `saveResume()`, and it
already fires on every path that matters — manual pause, `autoPause()` on `visibilitychange`/`blur`,
and `openLevelJump()`'s "paused" `jumpReturn`. A `pagehide` listener calling the same function as a
second line of defense costs one more `addEventListener` and covers the rare case (some in-app
browser shells) where `visibilitychange` doesn't fire before teardown.

**The session token has to be carried through unchanged, not refreshed.** `fetchGlobalBoard()` is
what dates a run — it hands back a fresh, server-signed `state.sessionToken` timestamped "now", which
is exactly right at `newGame()`/boot but exactly wrong here: refreshing the token on resume would
re-date the run from the moment it was resumed rather than when it actually started, undermining the
`age`-based checks in `functions/api/scores.js` that a resumed run should still be measured against.
The saved snapshot has to include the literal token string and restore it verbatim, and boot's
`setPhase("start")` → `fetchGlobalBoard()` sequence (module init, near the bottom of the file) must
not clobber a restored token with its own boot-time fetch when a resume is in play.

**`TOKEN_MAX_AGE_MS` (24h, `functions/api/scores.js`) is a real ceiling this feature makes reachable
for the first time, not a new one to add.** Before #64, nobody could pause for 24 hours — the tab
closing lost the run outright, and a tab merely left open in the background doesn't advance the
token's age any differently than one in active use. After #64 it's an actual outcome: a player who
pauses, closes the laptop, and resumes two days later has a snapshot that restores fine client-side,
but the eventual score submission gets `bad_session_age`'d by the server exactly as a same-length
single sitting already would. Nothing needs to change about that check — it's the correct backstop —
but it deserves a decision here rather than being discovered as a bug report: **a token-expired
submission should fail the same way a network-unreachable one already does**, silently, via whatever
`submitGlobalScore()`'s existing rejection path is, not a special error surfaced to the player, since
from their side nothing looks different than any other API hiccup.

**A resumed run is hall-of-fame eligible — the open design question the original write-up flagged.**
#69's `state.jumped` exists to exclude a run that skipped levels it didn't earn; pausing and resuming
skips nothing. The fix here does not add a new exclusion flag alongside `jumped` the way #63 has to
for difficulty — it simply never touches `jumped`, and a saved-and-restored run reaches
`endGame()`/`qualifiesForHallOfFame()` through the exact same, unmodified gate every uninterrupted run
already does.

**Boot needs a resume affordance, and the cheapest one is the existing pause overlay, not a new
one.** Landing a restored run straight into `setPhase("paused")` instead of `"start"` reuses
`overlay-pause` and its `btn-resume` verbatim — the player sees the same screen they would have left
behind, and `resume()` already does the right thing. The one gap: `overlay-pause` today has no way to
decline and start fresh (there's never been a reason for one — abandoning progress mid-run from an
ordinary pause is a destructive action this overlay has deliberately never offered). A second,
secondary button on that overlay — visible only when the pause was reached via a restored save, not
during an ordinary mid-run pause — covers it: a new `state.resumedFromSave` flag set only by the boot
restore path gates its visibility, and its handler is just `clearResume()` (drop the saved snapshot)
followed by `newGame()`.

**Persistence follows the established shape.** A new `RESUME_KEY = "blokrush-resume"` (namespaced
like every other key `persistence.js` asserts), `loadResume()`/`saveResume()`/`clearResume()`
following `loadAchievements()`'s defensive pattern — guard against valid-JSON-but-wrong-shape data and
return `null` rather than throwing, since a corrupt snapshot should fall back to an ordinary boot, not
break one. `saveResume()` is called from `setPhase()` and the `pagehide` listener; `clearResume()` is
called from `newGame()` (a fresh run has nothing to resume back to) and from `endGame()` (the run is
over either way).

#### Tests

- `#64a` — pausing a run with damaged bricks, an active effect, and a mid-flight ball, then
  simulating a fresh boot against the saved storage, restores `state.bricks` (including a brick
  already at reduced hp), the active effect, and the ball's exact position/velocity — not a fresh
  `startLevel()`.
- `#64b` — the restored run's `sessionToken` is the literal string saved at pause time, not a new one
  fetched at boot.
- `#64c` — `loadResume()` recovers to `null` from malformed storage (missing key, non-JSON, JSON that
  isn't the expected shape) instead of throwing, and boot falls through to the ordinary `"start"`
  phase in that case.
- `#64d` — a run restored from a save reaches `nameentry`/hall-of-fame submission the same as an
  uninterrupted run of the same score would (`state.jumped` stays `false` through a save/restore
  round-trip).
- `#64e` — `newGame()` and `endGame()` both clear any saved snapshot (`loadResume()` afterward returns
  `null`).

---

## I. Findings from a full-codebase review on 2026-08-21

Raised by a read of the whole repository — `index.html`, `functions/api/scores.js`, the schema and
the CI workflow — rather than by a `/code-review` pass over a diff, which is what §G was. Ten
findings came out of it, #84–#93, all of them below — the security/backend half (#90–#93) finished
last, with #93 closing it out.

### 84. ✅ FIXED — Gemini's split halves are indexed off by one (M)

> **Fixed 2026-08-21.** `update` ([1898-1909](../html/index.html#L1898-L1909)) now drives
> `b.parts[1]`/`b.parts[2]`, matching the indexing `fire`
> ([1918-1928](../html/index.html#L1918-L1928)) already used. That was the option the write-up below
> argued for over splicing the spent body out of `parts`: `bossBounds()`
> ([4815-4823](../html/index.html#L4815-L4823)) deliberately unions over dead parts, so #79's death
> beat is anchored on geometry that would disappear with it, and `fire` would have needed the same
> change in the opposite direction. The guard shape is unchanged, just moved up one index and applied
> to both halves symmetrically — they are pushed in a single statement, so either both exist or
> neither does.
>
> The fight now plays as its own comment describes: the halves spawn at `x = 10` and `x = 415` and
> oscillate in opposition inside their own lanes (`[10, 181]` and `[244, 415]`), instead of both
> ending up in the right quarter of the field with one of them frozen.
>
> Two tests in `regressions.js`, both confirmed failing first — `#84a` (`x=244 !<= 240`: the left half
> jumping the midpoint on its first frame) and `#84b` (`expected "1,2", got "1"`: only one part
> moving). `#84a` splits the boss through the real `bossPartHit()`/`onPartDown()` path and then
> asserts lane containment every frame for two seconds, plus that **both** halves actually moved —
> the second half of that is what catches the frozen one, which lane containment alone would not.
> `#84b` is the structural guard: it collects the parts `update()` moves and the parts `fire()` shoots
> from and asserts they are the same set, so re-introducing the skew in one function and not the other
> fails even if both are individually self-consistent. The shared `splitGemini()` helper is at the top
> of the file with the other fixtures.
>
> Nothing else in the fight needed touching. `b.hpTotal` is still snapshotted at spawn over the single
> body, so #80's music progress still dips when the split adds parts — that is the documented
> behaviour at `spawnBoss()`, not a second bug this uncovered.

`onPartDown` ([1910-1917](../html/index.html#L1910-L1917)) pushes the two halves onto the array the
dead body is still in, leaving `b.parts === [body, left, right]` — but `update`
([1898-1909](../html/index.html#L1898-L1909)) drives `b.parts[0]` and `b.parts[1]` as if they were
the two halves. `b.parts[0]` is the dead body, so its `sideToSide` call is skipped by the `alive`
guard; `b.parts[1]` is the **left** half, and it gets the **right** half's bounds
(`mid + 4 … GAME_W - FIELD_PAD - w`); `b.parts[2]`, the right half, is never updated at all.

Observed against the current file: the halves spawn at `x = 10` and `x = 415`, and two seconds later
sit at `x ≈ 407` and `x = 415` — both crammed into the right quarter of the field, one of them
frozen for the whole fight. "Two half-width bodies moving in opposition", which is the entire idea
of the fight and what the comment at [1887-1888](../html/index.html#L1887-L1888) promises, never
happens.

**The fix is one line, but pick the shape deliberately.** `fire`
([1918-1928](../html/index.html#L1918-L1928)) already reads `b.parts[1]`/`b.parts[2]` and is
therefore correct — so correcting `update`'s indices to match is the smaller change and keeps the
dead body in `parts`, which `bossBounds()` ([4815-4823](../html/index.html#L4815-L4823)) unions over
deliberately (see its comment: a dead part keeps its geometry, and #79's death beat is anchored on
it). Splicing the body out instead would break that and would also have to be mirrored in `fire`.
Omega's phase 1 is the model for what correct looks like — `spawnOmegaPhase()` replaces `b.parts`
wholesale, so its `[0]`/`[1]` really are the two halves.

#### Tests

- `#84a` — after Gemini splits, the left half stays left of the field midpoint and the right half
  right of it, and both move (each half's `x` changes over a second of frames).
- `#84b` — `fire`'s alternating shooter and `update`'s movement address the same two parts (a
  regression guard against re-introducing the index skew in one function and not the other).

### 85. ✅ FIXED — Every boss is drawn with the previous shape's colour — `BOSSES` has no `color`/`glow` (M)

> **Fixed 2026-08-21.** Each of the ten entries now carries a `color`/`glow` pair
> ([1804-1810](../html/index.html#L1804-L1810) for the note that says why they cannot be optional),
> which is the shape the write-up below argued for: the seven draw sites were left alone, since a
> defensive fallback at each of them would only have picked one arbitrary colour for all ten fights.
> Hues are spread across the wheel rather than themed to the act — Sentinel cyan, Salvo orange,
> Carapace jade, Gemini violet, Aegis gold, Hive chartreuse, Phantom pale lilac (washed out on
> purpose: it fades in and out), Mirage magenta, Leviathan deep blue, Omega red — so the boss body,
> its hp strip, its hit bursts and #79's death-beat lightning all read as that fight's colour, and
> the neon glow the rest of the game is built on is finally on the entity that most needs it.
>
> Two tests in `regressions.js`, both confirmed failing first. `#85a` is the data guard (every entry
> has a non-empty `color`/`glow`, no two share a `color`). `#85b` reads the draw path itself: it
> records the canvas ops of one frame of the Sentinel fight, finds the `fillRect` that painted the
> body, and asserts a fill and a shadow colour were actually set for it and that they are the ones
> the roster defines. That needed a new seam in the harness — `handle.recordCanvas()`
> ([dom-stub.js](../test/dom-stub.js)), off unless a test asks for it, since a single frame appends
> hundreds of ops. Note the stub is stricter than a browser here: assigning `undefined` to
> `fillStyle` leaves it `undefined` in the log, where a real canvas silently keeps the previous fill
> — hence `#85b` asserting a fill was set at all, and then which one.

Six sites read `def.color` and one reads `def.glow`, and no entry in `BOSSES`
([1811](../html/index.html#L1811)) defines either — every one of the ten is
`{id, killBonus, arena, spawn, update, fire}` plus the occasional hook. Assigning `undefined` to
`ctx.fillStyle`/`ctx.shadowColor` is not an error, it is silently ignored, so the canvas keeps
whatever was last set:

- `drawBoss()` ([6011-6046](../html/index.html#L6011-L6046)) paints a vulnerable part
  ([6022](../html/index.html#L6022)) and the hp strip ([6043](../html/index.html#L6043)) in whatever
  fill `drawBricks()` left behind on the way past — in practice one of its marker colours, e.g. the
  `rgba(255,255,255,0.9)` of a `?` glyph. An *in*vulnerable part is the only one that reads
  correctly, because `"#3d4463"` is a literal. `shadowColor = def.glow`
  ([6019](../html/index.html#L6019)) never takes either, so the neon glow the rest of the game is
  built on is missing from the one entity that most needs to stand out.
- `bossPartHit()`'s three bursts ([4784](../html/index.html#L4784),
  [4796](../html/index.html#L4796), [4802](../html/index.html#L4802)) store `undefined` as the
  particle colour, which `drawParticles()` then hands to `fillStyle` with the same result.
- #79's death-beat lightning ([4884](../html/index.html#L4884)) does the same to `strokeStyle`.

**The fix is data, not code: give each entry a `color`/`glow` pair**, the way `BRICK_COLOR`
([1161-1178](../html/index.html#L1161-L1178)) and `POWERUPS`
([1478-1490](../html/index.html#L1478-L1490)) already do, rather than making the seven call sites
defensive. Ten fights that currently cannot be told apart by colour is also most of #62's argument
in miniature — a distinct hue per boss is the cheap half of making a fight readable.

#### Tests

- `#85a` — every entry of `BOSSES` defines a non-empty `color` and `glow`, and no two share a
  `color`.
- `#85b` — `drawBoss()` sets a defined `fillStyle` (and `shadowColor`) for a vulnerable part rather
  than inheriting the previous one, read off the recorded canvas ops of a real frame.

### 86. ✅ FIXED — A life lost to a boss hazard was invisible to the achievement roster (S/M)

> **Fixed 2026-08-21.** `applyBossHazard`'s `"life"` branch
> ([4919-4943](../html/index.html#L4919-L4943)) now increments `achStats.ballsLost` and
> `achStats.levelLosses` right alongside `state.lives`, the same pair `loseLife()` increments — the
> smaller of the two shapes the write-up below weighed, and the one that leaves `loseLife()` itself,
> and the field names, untouched. The branch still calls `endGame(false)` directly rather than
> routing through `loseLife()`, exactly as before: there is no ball for #71's `lifelost` beat to hold
> for, so that path stays its own thing.
>
> Two tests in `regressions.js`, both confirmed failing first. `#86a` drives a Leviathan `"life"`
> shot into the paddle and asserts both counters rise by exactly one. `#86b` goes one step further —
> the same hazard, then a real kill through `bossPartHit()`/`bossDefeated()` — and asserts
> `achStats.flawlessBoss` stays `false`, closing the gap that let "Untouchable" and "Flawless
> Victory" survive a hazard built to cost a whole life.

`applyBossHazard("life")` ([4919-4943](../html/index.html#L4919-L4943)) decrements `state.lives`
directly and never touches `state.achStats`. `loseLife()`
([5371-5394](../html/index.html#L5371-L5394)) — the only other thing that takes a life — increments
`ballsLost` and `levelLosses` right at the top, and those two counters are what four achievements
read: "Untouchable" (`won && ballsLost === 0`), "Flawless Victory"
(`bossDefeated()`'s `levelLosses === 0`), and "Clean Sheet"/"Iron Ten" via `cleanStreak` in
`checkLevelClear()`.

Confirmed against the current file: one Leviathan beam takes `state.lives` from 3 to 2 while
`achStats.ballsLost` and `achStats.levelLosses` both stay at `0`. So the one hazard in the game that
costs a whole life is also the one that a "flawless" run is allowed to eat — including on level 90,
whose boss is the only one that fires it, and including all the way to "Untouchable", the roster's
hardest tier-4 entry.

**Where the two counters belong is the decision to make, not whether to add them.** `ballsLost` is
literally "balls lost" and no ball was lost here, but every predicate reading it means "lives spent",
which is why `loseLife()` is where it lives; renaming the field is a larger change than this warrants
and would orphan nothing (it is per-run and never persisted — see `freshAchStats()`), so the smaller
fix is to increment both from `applyBossHazard`'s `"life"` branch and leave the names alone. Note
this branch also calls `endGame(false)` directly when the life was the last one, bypassing #71's
`lifelost` beat — deliberate (there is no ball to hold a beat for), but it means the fix cannot just
be "route this through `loseLife()`".

#### Tests

- `#86a` — a `"life"` boss hazard raises `achStats.ballsLost` and `achStats.levelLosses` by exactly
  one, the same as `loseLife()`.
- `#86b` — a boss beaten after taking a `"life"` hazard that fight does not set
  `achStats.flawlessBoss`.

### 87. ✅ FIXED — Minions detonated on the paddle *line*, not on the paddle (S/M)

> **Fixed 2026-08-21.** `updateMinions()` ([4993-5022](../html/index.html#L4993-L5022)) now tests both
> axes, the same shape `updateBossShots()` ([4945-4974](../html/index.html#L4945-L4974)) already used
> for the other hazard: a minion only detonates `narrow` when it overlaps the paddle's rect, not
> merely its height. The write-up below left open whether a clean dodge should still cost something;
> the answer picked is no — a minion that clears the paddle line without overlapping it just despawns
> silently, the "fell past the paddle" branch the write-up called for, with no effect and no sound.
> Dodging a minion is now actually possible, which is the entire point of drawing them as objects that
> drift on their own `vx` rather than as an unavoidable timer.
>
> One test in `boss.js`, confirmed failing first (`got {"mult":0.6,"remaining":8}` — `narrow` applied
> from 200px away). It parks a minion off to the side, falling, and freezes the ball on the paddle
> (`attached = true`) so a lost life can't clear the minions out from under the assertion for the
> wrong reason; it then runs frames until the minion despawns on its own and asserts no score and no
> `widthEffect`. The existing positive-case test (a minion actually over the paddle still detonates)
> was updated to place the minion over the paddle explicitly, since it previously relied on the bug
> to pass — a minion 200px away used to detonate too.

`updateMinions()` ([5008-5013](../html/index.html#L5008-L5013)) tests `m.y + m.r >= state.paddle.y`
and nothing else, so a minion reaching the paddle's height anywhere across the field applies
`narrow` — confirmed with the paddle parked at `x = 400` and a minion crossing at `x = 5`. The
paddle narrows regardless.

`updateBossShots()` ([4963-4971](../html/index.html#L4963-L4971)) gets this right for the other
hazard shape, testing both axes. The asymmetry is what makes this read as an oversight rather than a
design choice: `spawnMinion()`'s own comment
([4976-4979](../html/index.html#L4976-L4979)) calls a minion "a small enemy the ball can destroy in
flight" whose reaching the paddle line "detonates it (narrow) rather than costing a life outright" —
which describes the code, but the whole point of drawing minions as dodgeable objects that drift on
their own `vx` ([4993-4999](../html/index.html#L4993-L4999)) is that dodging is a thing a player can
do. Today it isn't: Hive's pairs, Phantom's explosives and Omega's third phase all land their
`narrow` unconditionally, and the ball is the only counterplay.

**Adding the x test is the fix; whether the penalty should survive a clean dodge is the question it
forces.** If a missed minion should still cost something, that belongs in an explicit "fell past the
paddle" branch (splice it, no effect, maybe a sound), not in a hit test that pretends to be one.

#### Tests

- `#87` — a minion crossing the paddle line away from the paddle despawns without applying `narrow`
  or scoring; the existing case of a minion actually over the paddle still detonates it.

### 88. ✅ FIXED — Leviathan's telegraph is invisible (S)

> **Fixed 2026-08-21.** `drawBossShots()` ([6062-6082](../html/index.html#L6062-L6082)) now computes
> `warn = s.telegraph > 0` once, above the `kind` branch, and the `else` (non-`beam`) branch applies
> it the same way the `beam` branch already did — `globalAlpha` drops to `0.35` while a shot is still
> in its telegraph window, back to full once it's live. That's the minimal fix the write-up below
> argued for: reusing the beam's own warning treatment rather than inventing a second visual
> vocabulary for "not yet armed".
>
> One test in `regressions.js`, confirmed failing first (`a shot still inside its telegraph window
> must draw at warning alpha (0.35)`, unmet on the unfixed `else` branch). `#88a` parks a `kind:
> "drop"` shot with `telegraph: 1.0`, records one frame's canvas ops, and asserts a `fill` was logged
> at `globalAlpha === 0.35` and none at `1` — reusing `handle.recordCanvas()`, the seam #85b already
> added.

`spawnBossShot`'s `telegraph` ([4912](../html/index.html#L4912)) holds a hazard still before it
starts moving, and `updateBossShots` honours it for every kind
([4948](../html/index.html#L4948)). But `drawBossShots()` only *renders* the warning state inside
its `kind === "beam"` branch ([6067-6070](../html/index.html#L6067-L6070)) — the `else` branch draws
a plain red circle whatever `s.telegraph` holds.

Aegis's beam is a beam, so it is fine. Leviathan's shot
([2057-2063](../html/index.html#L2057-L2063)) is a `drop` with `telegraph: 1.0`, and it is the only
hazard in the game that costs a life outright — the comment above the fight
([2037-2040](../html/index.html#L2037-L2040)) says it is "telegraphed so that always reads as fair
rather than a surprise", and it isn't: for that whole second it is pixel-identical to a live
incoming shot that merely happens not to be moving yet.

**Hoisting `var warn = s.telegraph > 0` above the branch and reusing the beam's own treatment** (the
`#ff3b3b`/`0.35`-alpha pair) is the minimal fix and keeps one visual vocabulary for "not yet armed"
across both hazard shapes.

#### Tests

- `#88a` — a shot still inside its `telegraph` window draws in the warning treatment, not the live
  one, for `kind: "drop"` as well as `kind: "beam"`.

### 89. ✅ FIXED — The profanity filter renames ordinary people (M)

> **Fixed 2026-08-21.** `isProfaneName()` ([5595-5597](../html/index.html#L5595-L5597)) now tests
> `PROFANITY_RE` ([5590-5594](../html/index.html#L5590-L5594)), a single alternation built from
> `PROFANITY_LIST` where each root must land on a letter boundary — string start/end, or any
> non-letter — on both sides, so it can only match a whole run of letters rather than a substring
> straddling part of one word and part of another. `normalizeForProfanity()`
> ([5575-5582](../html/index.html#L5575-L5582)) still folds leetspeak and accents the way #77 left it,
> but no longer strips spaces and punctuation outright — they survive as the very separators the
> boundary check relies on, and an optional `[^a-z]*` between a root's own letters keeps #77's
> spacing/leetspeak evasions (`s e x`, `a55`) matching as a single word. The cost the write-up below
> flagged: symmetric boundaries drop the "for free" suffix/plural coverage a bare substring match had,
> so `PROFANITY_LIST` ([5552-5561](../html/index.html#L5552-L5561)) now lists `asses`/`asshole` next to
> `ass` explicitly rather than relying on the root to catch them by accident. The mirror in
> [functions/api/scores.js](../functions/api/scores.js) — `normalizeForProfanity()`/`filterProfanity()`
> ([133-192](../functions/api/scores.js#L133-L192)) — got the identical change, and `#89c` now asserts
> the two lists stay word-for-word equal instead of that being trusted by inspection.
>
> The substitution stays silent, exactly as #77 shipped it. The write-up below called that "probably"
> worth revisiting too, but it is a separate, UX-shaped question from the false positives this finding
> is about, so it was left alone.
>
> Three new `#89a`–`#89c` cases in `regressions.js`, `#89a` and `#89b` both confirmed failing first.
> `#89a` submits the six ordinary names held against the list below (`Computer`, `Cassandra`,
> `Hitchcock`, `Dickens`, `Essex`, `Analyst`) and asserts each lands on the board under its own name.
> `#89b` re-submits #77's own evasions (`a55`, `s e x`, `nègre`, a plain profanity) plus a suffixed
> root (`asshole`) and asserts all five still get swapped for the fallback name. `#89c` extracts both
> `PROFANITY_LIST` array literals as text and asserts they are identical, word-for-word and in order.

`isProfaneName()` ([5595-5597](../html/index.html#L5595-L5597)) matched every entry of
`PROFANITY_LIST` ([5552-5561](../html/index.html#L5552-L5561)) as a plain substring of the normalised
name, and `normalizeForProfanity()` ([5575-5582](../html/index.html#L5575-L5582)) first stripped
everything that wasn't `a`-`z` — including the spaces and punctuation that would otherwise have marked
a word boundary. #77 chose that deliberately, to catch `asshole` from `ass` and `s e x` from `sex`. The
cost was never written down: three-and-four-letter roots in a boundary-free substring match are the
Scunthorpe problem in its textbook form — `Computer`, `Cassandra`, `Hitchcock`, `Dickens`, `Essex` and
`Analyst` (among others) were all silently renamed `"Bisounours"` for containing `pute`, `ass`, `cock`,
`dick`, `sex` and `anal` respectively, with nothing on screen explaining why.

**Word-boundary matching is the fix, and it had to land in both copies at once.** The list is mirrored
verbatim in `functions/api/scores.js` because `POST /api/scores` is public and reachable by `curl`; a
fix on one side only would have made the two boards judge the same name differently, which is
precisely the trap CLAUDE.md flags for `NAME_MAX` and the preview bindings. The shape chosen keeps the
fold (leetspeak and accents) but stops deleting non-letters outright — they become the separators the
boundary check itself relies on — then matches each root with a boundary-anchored pattern, filler
allowed between the root's own letters so a spacing/leetspeak evasion still matches as one contiguous
root, while a root sitting inside an unrelated word no longer fires.

#### Tests

- `#89a` — `Computer`, `Cassandra`, `Hitchcock`, `Dickens`, `Essex` and `Analyst` all survive
  `isProfaneName()` unchanged.
- `#89b` — the #77 cases still fail it: `a55`, `s e x`, `nègre`, and a plain profanity, plus a
  suffixed root (`asshole`).
- `#89c` — `PROFANITY_LIST` in `index.html` and in `functions/api/scores.js` are identical, asserted
  structurally rather than by example.

### 90. ✅ FIXED — The scoring-rate ceiling stops binding after ~2h47m (M)

> **Fixed 2026-08-21.** [functions/api/scores.js](../functions/api/scores.js) adds
> `RATE_CHECK_MAX_AGE_MS` ([39-47](../functions/api/scores.js#L39-L47)), the age at which
> `ABSOLUTE_MAX_SCORE / MAX_POINTS_PER_SEC` cross (10,000s = 2h47m with the current constants), and
> the rate check ([247-249](../functions/api/scores.js#L247-L249)) now clamps the age it feeds into
> the formula to that cap: `Math.min(age, RATE_CHECK_MAX_AGE_MS)`. `TOKEN_MAX_AGE_MS` — and with it
> the 24h redemption window #64 will make reachable — is untouched, per the write-up's own
> preference for capping the age over shortening the window.
>
> A new `#90` case in `regressions.js` reads the three constants and the new cap out of
> `scores.js`'s source text (it cannot `require()` the file directly — it's an ES module, and the
> repo has no build step to transpile it), confirms the rate check now references
> `RATE_CHECK_MAX_AGE_MS`, and asserts the oldest redeemable token's threshold lands exactly on
> `ABSOLUTE_MAX_SCORE` rather than sailing past it. Confirmed failing first (`RATE_CHECK_MAX_AGE_MS`
> doesn't exist on the unfixed file).

`onRequestPost` rejects a submission when `score > (age / 1000) * MAX_POINTS_PER_SEC`, and
independently when `score > ABSOLUTE_MAX_SCORE`. With the current constants those two cross at
`10_000_000 / 1000 = 10_000` seconds — 2 h 47 m. `TOKEN_MAX_AGE_MS` is 24 h. So for any token
between ~2.8 h and 24 h old, the rate check permits more than the absolute cap already does and is
therefore dead code: the envelope collapses to the flat 10 M ceiling.

The comment on `TOKEN_MAX_AGE_MS` says stockpiling tokens to age them is pointless because the
`UNIQUE` constraint on `nonce` prevents replay. That is true of *replay* and not of *aging*: one
`GET` costs nothing, tokens are handed out unrate-limited, and holding one for three hours converts
the per-second ceiling into no ceiling at all. A real 100-level run scores roughly 1.5 M, so the gap
between what play produces and what the endpoint accepts is about 6×.

**Two ways to close it, and they are not equivalent.** Capping the age used in the rate check
(`Math.min(age, SOME_CAP)`) keeps the 24 h redemption window #64 will make reachable — that window
exists so a run interrupted for a lunch break can still be submitted, which is a real requirement —
while making the rate ceiling bind for the whole of it. Shortening `TOKEN_MAX_AGE_MS` instead would
close this too but would take #64's resume-after-a-day case with it. The first is the one to pick;
either way the two constants' relationship deserves a comment, because "these two checks cross at
2 h 47 m" is not visible from reading either line.

#### Tests

- `#90` — extracts `MAX_POINTS_PER_SEC`, `ABSOLUTE_MAX_SCORE`, `TOKEN_MAX_AGE_MS` and
  `RATE_CHECK_MAX_AGE_MS` from `scores.js`'s source, confirms the rate check references the new cap,
  and asserts the cap doesn't exceed the token's redemption window and that the oldest redeemable
  token's rate-check threshold equals `ABSOLUTE_MAX_SCORE` exactly.

### 91. ✅ FIXED — `submissions` is never pruned, and is written after the score it counts (M)

> **Fixed 2026-08-21.** [functions/api/scores.js](../functions/api/scores.js)'s `onRequestPost`
> ([259-291](../functions/api/scores.js#L259-L291)) now opens the same `try` block with
> `DELETE FROM submissions WHERE created_at < ?`, bound to `now - RATE_WINDOW_MS` — no cron, no
> second entry point, just every request that already touches the table trimming it back to real
> traffic, the reasoning the write-up below asked for. The two inserts are also swapped: `submissions`
> is written before `scores`, so a failure between them — the `UNIQUE`-constraint replay rejection on
> `nonce` included — now costs the submitting IP a rate-limit slot instead of skipping the limiter
> entirely.
>
> A new `#91` case in `regressions.js` reads `scores.js`'s source text the same way `#90`'s does
> (no build step to `require()` an ES module through), confirms the `DELETE FROM submissions` prune
> exists, and asserts the `submissions` insert's source position precedes the `scores` insert's.
> Confirmed failing first (neither statement existed on the unfixed file).

[schema.sql](../schema.sql) creates `submissions` with the note that its rows "may be pruned
freely" — and nothing anywhere prunes them. Every accepted score appends a row that only the
10-minute rate-limit window will ever read again, and `idx_submissions_window` grows with it. On a
never-reset database (#67) that is unbounded growth against D1's row and storage limits, for data
whose useful life is ten minutes.

Second, smaller problem in the same block: the `INSERT` into `submissions` ran *after* the `INSERT`
into `scores`. Anything that failed between them — and the `catch` below explicitly expects failures
there, since that is where `already_submitted` is detected — stored a score without counting it
against the submitting IP. The rate limiter is meant to be the backstop for the case where the token
scheme is defeated, so it should be the thing that cannot be skipped.

#### Tests

- `#91` — confirms `onRequestPost` prunes expired `submissions` rows on every request (regex over the
  source for the `DELETE FROM submissions WHERE created_at < ?` statement) and that the `submissions`
  insert's source position precedes the `scores` insert's.

### 92. ✅ FIXED — Endpoint and CI hardening (S)

> **Fixed 2026-08-21.** All three, in [functions/api/scores.js](../functions/api/scores.js) and
> [.github/workflows/test.yml](../.github/workflows/test.yml):
>
> - `onRequestPost` now rejects any request whose `content-type` doesn't start with
>   `application/json` before it even attempts `request.json()`
>   ([228-237](../functions/api/scores.js#L228-L237)) — blocking the plain-form-POST shape that let a
>   cross-origin page drive a visitor's browser into submitting under that visitor's IP with no CORS
>   preflight involved.
> - The rate-limit count and its insert are now one D1 statement instead of a
>   `SELECT COUNT(*)` followed by a separate `INSERT`
>   ([279-296](../functions/api/scores.js#L279-L296)): `INSERT INTO submissions ... SELECT ?, ? WHERE
>   (SELECT COUNT(*) FROM submissions WHERE ip_hash = ? AND created_at > ?) < ?`, gated on
>   `rateInsert.meta.changes` rather than a separately-read count. Two POSTs from the same IP arriving
>   together can no longer both read the same count and both pass — the row only lands if the live
>   count is still under the limit at insert time.
> - `test.yml` now declares `permissions: contents: read` at the workflow level
>   ([9-10](../.github/workflows/test.yml#L9-L10)), the standard hardening for a workflow with a
>   `pull_request` trigger that otherwise gets the repository's default `GITHUB_TOKEN` permissions.
>
> Three new `#92` cases in `regressions.js` follow `#90`/`#91`'s source-text pattern (still no runtime
> harness for `scores.js`, per that entry's own note): one confirms the content-type check exists,
> one confirms the combined `INSERT ... SELECT ... WHERE ... COUNT(*)` statement exists and the old
> two-step `SELECT COUNT(*) AS n` is gone, one confirms `test.yml` declares the permissions block.
> Confirmed failing first against the unfixed files.

Three small ones, none of them exploitable on their own, grouped because each is a two-line change:

- **`POST /api/scores` checks nothing about where the request came from.** There is no
  `content-type` check and no `Origin` check, so a cross-origin page can drive a visitor's browser
  into submitting a score under that visitor's IP. The attacker cannot read the response (no CORS
  headers — correctly, and that should stay), and they can mint their own tokens anyway, so the only
  thing this buys is burning someone else's rate-limit budget and putting a name of the attacker's
  choosing on the board attributed to that IP. Requiring `content-type: application/json` blocks the
  form-POST shape that makes this reachable without CORS at all.
- **The rate-limit check and its insert are not atomic.** Two POSTs from one IP arriving together
  both read the same `COUNT(*)` and both pass. D1 has no transaction across the two statements here;
  the practical fix is to accept the slack (it is bounded by concurrency, not by attacker effort) and
  say so in the comment, or to move the count and the insert into one statement.
- **[.github/workflows/test.yml](../.github/workflows/test.yml) declares no `permissions:` block**,
  so `GITHUB_TOKEN` gets the repository default. The job only runs `node test/run.js`; adding
  `permissions: contents: read` at the workflow level costs one line and is the standard hardening
  for a workflow with a `pull_request` trigger.

#### Tests

`functions/api/scores.js` still has no automated coverage against a real Worker runtime, a D1
binding, or the network — that gap is unchanged, and #77's entry in [done.md](done.md) already notes
it as policy (CLAUDE.md: "check `/api/scores` directly rather than trusting the UI"). #90 and #91
turned out to be reachable anyway, as source-text checks over module-level constants and statement
order respectively. #92 reuses the same shortcut for its three checks:

- `#92` (content-type) — confirms the source contains a content-type check requiring
  `application/json`.
- `#92` (atomic rate limit) — confirms the combined `INSERT ... SELECT ... WHERE ... COUNT(*)`
  statement exists and the old two-step `SELECT COUNT(*) AS n` is gone.
- `#92` (CI permissions) — confirms `test.yml` declares `permissions: contents: read` at the
  workflow level.

### 93. ✅ FIXED — Omega's phase-2 blink never actually teleports (S)

> **Fixed 2026-08-21.** `cycleBlink()` ([1769-1777](../html/index.html#L1769-L1777)) takes a new
> `teleport` argument, defaulting to on (Phantom's call is unchanged); Omega's phase 2
> ([2088-2099](../html/index.html#L2088-L2099)) now passes `false`, since the opposed `sideToSide`
> calls immediately below are that phase's actual motion — a random teleport on top of them was only
> ever getting clamped back to whichever lane edge was nearest, the "reappears at a lane edge instead
> of somewhere new" bug the write-up below describes. `cycleBlink`'s solid/vulnerable return value is
> unaffected, so both halves still blink in and out together, in time with each other, exactly as
> before.
>
> One new `#93` case in `regressions.js`: it drives Omega's `onDepleted()` into phase 2, clears
> `b.transition` to skip the roar beat, then runs `update()` for 5 simulated seconds (more than two
> 2.4s blink cycles) and asserts neither half's `x` ever moves more than `sideToSide`'s own per-frame
> budget in a single frame, and that neither ever leaves its lane. Confirmed failing first — before
> the fix, the left half jumps ~125px in one frame at the first blink cycle boundary, the clamp
> catching the teleport rather than the half sliding.

Filed last because it is cosmetic and arguably intentional, but it is a documented behaviour that
does not happen. `cycleBlink()` exists to teleport a part "to a new x each time it comes back", and
Phantom (level 70) gets exactly that. Omega's phase 1 calls it and then immediately runs `sideToSide`
on the same part with half-field bounds, which clamps the teleport away in the same frame — so
`b.parts[0]` reappears at one of its two lane edges every cycle instead of somewhere new, and
`b.parts[1]` is never passed to `cycleBlink` at all, so it never teleports even in principle.

**Decide which of the two mechanics phase 2 is actually for.** If it is the blink, the halves should
be teleported *within* their own lanes (`rand(minX, maxX)` per part, both parts) instead of across
the whole field; if it is the opposed sliding, the `cycleBlink` call should keep only its
solid/vulnerable return value and stop pretending to move anything. Doing neither leaves a call whose
comment describes something the fight does not do.

The opposed sliding was already the phase's more distinctive mechanic — Phantom already owns the
teleport-and-blink identity, and phase 2 giving both halves smooth, continuous, opposed motion reads
more clearly on screen than a jump-cut would have. `cycleBlink` keeps its teleport as the default so
Phantom's call needed no change; Omega's is the one opt-out.

#### Tests

- `#93` — Omega phase 2's halves never move more than `sideToSide`'s per-frame budget in a single
  frame across several blink-cycle boundaries, and never leave their own half of the field.

### 57. ✅ FIXED — Negative power-up counterplay (S)

> **Fixed 2026-08-21.** `updateLasers()` ([4640-4687](../html/index.html#L4640-L4687)) gained the
> third pass the write-up called for, after the brick and boss-part checks and gated the same way a
> bolt is already consumed by either of those: a bolt that reached neither sweeps `state.drops` for
> the first `!d.def.good` drop within the same ±10px box `updateDrops()` uses against the paddle, and
> on a hit splices the drop, bursts in the drop's own colour, plays a downward-sliding "denied" tone
> distinct from any existing beep, and splices the bolt — no score, no branch into `applyPowerup()`.
> A bolt that finds nothing to hit falls through untouched, same as before.
>
> `#57a`/`#57b` isolate the pass from the brick sweep ahead of it (`state.bricks = []`) and place a
> bolt and a drop close enough together that both survive the frame's own movement — `updateDrops()`
> runs first each frame and nudges the drop down before `updateLasers()` moves the bolt up — and
> assert a `narrow` drop is destroyed with the bolt consumed, while a `widen` drop is left standing.
> Both confirmed failing (the drop untouched, bolt still in flight) against the unfixed code first.

`narrow` and `fast` currently just happen to you — they land in `state.drops`, fall, and either miss
the paddle or apply themselves with no decision on the player's part. The concrete, cheap version of
"give the player an out": **let a laser bolt destroy a falling bad capsule before it lands.**

`updateLasers()` already sweeps every bolt against `state.bricks` and, failing that, against
`state.boss`; it needs a third pass, against `state.drops`, using the same hit-test shape
`updateDrops()` already uses for the paddle (`d.x`/`d.y` ± the drawn 10px radius). Restricted to
`!d.def.good` drops only — a bolt should never be able to snipe a `widen` or a `life` out of the
air; that would make good drops a liability near a laser-holding player, the opposite of the intent.
On a hit: splice the drop, a small burst at its position, a distinct tone so it reads as "denied"
rather than "collected," and no score — this is defence, not offence, and awarding points would make
`laser` strictly better at farming than at its existing job.

**Two small consequences worth deciding rather than discovering:** it only exists while
`state.laserEffect` is active (no laser, no counterplay — same as every other laser interaction),
and it stacks with #53's fireball for free if that ships too, since both are read-only additions to
functions that already loop over their respective collections once per frame.

**Left out of this pass, deliberately:** the feature-ideas entry's second option, a standalone
"cleanse" pickup that clears whatever bad effect is currently active (`state.widthEffect.mult < 1` /
`state.speedEffect.mult > 1`, nulled the same way `resetPaddleAndBall()` already does). It's a
natural follow-up — a new `POWERUPS` row plus a branch in `applyPowerup()`, genuinely S on its own —
but doing both at once is what would push this above S, and the laser version alone already converts
the frustration into a decision for anyone who picked up `laser` in the first place.

#### Tests

- `#57a` — a laser bolt destroys a falling `narrow` drop and the drop never reaches the paddle.
- `#57b` — a laser bolt passes through a falling `widen` drop untouched.

---

## J. Findings from a holistic review on 2026-08-22

The same shape as §I, a day later: a read of the whole repository — `index.html`,
`functions/api/scores.js`, the schema, the docs — rather than a `/code-review` pass over a diff.
Seven findings came out of it, #95–#101, split in [todo.md](todo.md) into a correctness
half (§J, `index.html`) and a security/backend half (§K, `functions/api/scores.js`); they collect
here as they ship, in whatever order that happens.

### 95. ✅ FIXED — Resuming a run saved on the level-clear screen awards that level a second time (M)

> **Fixed 2026-08-22.** The second of the two shapes the write-up below argued between: `RUN_PHASES`
> ([3477](../html/index.html#L3477)) keeps `levelclear` and keeps answering the level-jump
> preserve-the-run question it always did, and a second set `SNAPSHOT_PHASES`
> ([3479-3489](../html/index.html#L3479-L3489)) — the same list minus `levelclear` — is what the
> `pagehide` handler ([3362-3364](../html/index.html#L3362-L3364)) and `setPhase()`'s save guard
> ([3646](../html/index.html#L3646)) consult instead. That is the "two named sets rather than one"
> the write-up asked for: the two uses had drifted apart in meaning, and this splits them rather
> than picking a winner.
>
> Persisting the outgoing phase instead was the alternative, and it was not taken: it needs its own
> resume path (`btn-resume` leads to `"playing"`), a `phase` field outside `RESUME_FIELDS`, a
> boot-time branch, and it would have to reverse the deliberate "not persisted, not resumed"
> decision on `state.lastLevelStars` to render the restored overlay correctly — four touch points
> against three lines, to save a screen that costs the player nothing to lose.
>
> Two tests in `regressions.js`, both confirmed failing first (`2 !<= 1` and `5 !<= 4`). Both drive
> the real gesture — clear the level, `pagehide`, boot from the resulting store — and then assert
> against an upper bound rather than an exact value, deliberately: whether a snapshot is written at
> all is the fix's business, while "the same clear must never be counted twice" is the finding's,
> and a test that fixed the former would have to be rewritten by anyone revisiting the choice above.
>
> **One residual, stated rather than fixed.** A snapshot taken at an *earlier* pause in the same run
> now survives the level-clear screen instead of being overwritten by it, so a player who paused
> mid-level, cleared two more levels and then closed the tab on "Niveau clair !" resumes at the older
> point rather than the newer one. That is an ordinary stale-snapshot rewind — they replay the
> levels — not the free award this finding is about, and clearing the snapshot on level-clear to
> avoid it would throw away a still-valid resume point for a case that only arises when `pagehide`
> lands on exactly that screen.

`RUN_PHASES` ([3477](../html/index.html#L3477)) counts `levelclear` as a phase with a live run behind
it — correctly, since a level jump out of it should keep the run's score and lives. The `pagehide`
handler ([3362-3364](../html/index.html#L3362-L3364)) therefore snapshots a run whose level has
**already been cleared**: `state.remainingBricks === 0` (or `state.boss.dead`), all bricks down, the
levelclear overlay up.

The snapshot does not carry `state.phase` — `RESUME_FIELDS` ([2768-2774](../html/index.html#L2768-L2774))
deliberately omits it and the boot path ([6331-6335](../html/index.html#L6331-L6335)) always lands on
`"paused"` instead. So resuming re-enters `"playing"` with a cleared field, and the next frame's
`checkLevelClear()` ([5424-5474](../html/index.html#L5424-L5474)) runs the level's whole verdict a
second time for the same level.

Reproduced against the current file (clear level 1, fire `pagehide`, boot from the resulting store,
click resume, one frame):

```
g1: levelsCleared 1  cleanStreak 1
g2: levelsCleared 2  cleanStreak 2
```

and on a milestone level (level 10, where `(levelIndex + 1) % extraLifeEvery === 0`) the same gesture
hands out the milestone life twice — `lives 4` before the snapshot, `lives 5` after resuming. The
level-clear fanfare replays too, and `recordLevelClear()` re-rates the level (harmless on its own,
since stars only ever rise).

`state.score` is *not* double-counted — nothing in that block adds points — so this is an achievement
and lives bug, not a scoring one. But `levelsCleared` feeds "Warm Cabinet", `cleanStreak` feeds "Iron
Ten", and a free life every time the tab is closed on the level-clear screen of level 10, 20, 30 … is
a real economy leak. It is easy to hit by accident: closing the tab on "Niveau clair !" is exactly the
interruption #64 exists to survive.

**Two candidate shapes, and they are not equivalent.** Either persist the outgoing phase in the
snapshot and restore `levelclear` (which then needs its own resume path, since `btn-resume` leads to
`"playing"`), or — smaller, and probably right — do not snapshot from `levelclear` at all: drop it
from the set `pagehide` and `setPhase()`'s save guard ([3646](../html/index.html#L3646)) consult,
keeping `RUN_PHASES` itself intact for the level-jump/preserve-run question it also answers. Losing a
level-clear screen to a closed tab costs the player nothing — the level is already recorded by
`recordLevelClear()` — whereas replaying it costs correctness. Note the two uses of `RUN_PHASES` have
drifted apart in meaning and this finding is the consequence; whichever shape is picked, they should
end up as two named sets rather than one.

#### Tests

- `#95a` — a snapshot taken (via `pagehide`) while the levelclear overlay is up does not raise
  `achStats.levelsCleared`/`cleanStreak` a second time when the run is resumed.
- `#95b` — the same gesture on a milestone level (level 10) does not award the extra life twice.

---

## Verification

There is no test infrastructure in the repo, so verification is manual. After any selected change:

1. Open `html/index.html` in a browser (both `file://` and via a local server — the two differ for
   items #1 and #2).
2. Confirm accented French text renders correctly on both (`Détruisez`, `Prêt`, `Meilleur`).
3. Full playthrough: start → launch → clear level 1 → level 2 → lose all lives → restart.
4. Pause mid-effect, wait 15 s, resume — confirm the power-up survives (#4).
5. Alt-tab while holding an arrow key, return — confirm the paddle stops and the game is paused (#3, #5).
6. Test with DevTools device emulation for touch behaviour (#27) and DPR scaling (#17).
7. Open DevTools Performance and confirm no per-frame style recalc from `drawDrops` (#14).
8. Tab through the page with the keyboard only; confirm every overlay button is reachable and
   activatable with both Space and Enter (#6, #26).
9. Turn on "reduce motion" in OS accessibility settings (or emulate it via DevTools' rendering pane)
   and confirm brick-hit bursts visibly thin out without a reload (#25).
10. With a screen reader running, clear a level and lose a life; confirm both the overlay change (#22)
    and the pause/mute buttons' pressed state (#23) are announced.
11. On a touch device (or DevTools touch emulation), tap-drag to aim before releasing to serve, and
    confirm the ball only launches on release (#27).
12. Play a level to the last couple of bricks without losing the ball; confirm the ball is visibly
    faster than at the start (#28), and that combo streaks show a rising floating score (#29).
13. Catch a "sticky" drop and confirm the next paddle touch holds the ball, aimable via the paddle,
    released on Space/click/tap; catch "laser" and confirm the same action button fires twin bolts
    that destroy bricks (#30). Watch the new bars under the HUD deplete for every active effect,
    including sticky and laser (#31).

Items #4–#6 were additionally checked with a throwaway headless harness that stubs the DOM, loads the
real script, and drives `frame()` directly — 18 assertions covering timer suspension across a pause,
both auto-pause triggers, and the Space/focus interaction. It is not committed; see the note in the
project history if it needs recreating.

As of #14–#31, this manual checklist is backed by an automated suite — see
[testing.md](testing.md) — but the steps above remain useful as an end-to-end sanity pass.
