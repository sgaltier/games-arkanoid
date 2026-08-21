# Blokrush — Fixed Findings

Target: [blokrush.html](../html/index.html). This is the **done** half of the project's review backlog —
every finding here has shipped. Open items live in [todo.md](todo.md); what shipped in which commit is
tracked in [release-notes.md](release-notes.md). A finding keeps its original number when it moves
from `todo.md` to here, so numbering is shared across both files and never reused — every number from
1 up belongs to exactly one of the two.

Each entry keeps its original write-up (category, effort estimate, the bug as found) with a
`> **Fixed <date>.**` note prepended describing what shipped — a historical record, not a live TODO.

**Status:** 68 fixed — everything raised so far, review findings and promoted features alike. See
[todo.md](todo.md).

**Line references below are re-anchored after each round of fixes** — they are only valid against the
current `index.html`.

---

## A. Correctness bugs

### 1. ✅ FIXED — No `<!DOCTYPE html>`, no `<meta charset="utf-8">` (S)
> **Fixed 2026-08-12.** The file now opens with `<!doctype html>` / `<html lang="fr">` and a real
> `<head>` carrying `<meta charset="utf-8">`, a viewport meta, and a `<title>`, with the markup
> wrapped in `<body>` — see [1-7](../html/index.html#L1-L7),
> [718](../html/index.html#L718), [5864-5865](../html/index.html#L5864-L5865).

The file previously began directly with `<style>`, with no doctype, `<html>`, `<head>`, `<title>`,
charset, viewport, or `lang` attribute. Two real consequences:

- **Quirks mode.** Without a doctype the browser rendered in quirks mode, changing box-model and
  inline-layout behaviour.
- **Encoding.** The file contains raw UTF-8 accented text (`Détruisez` [779](../html/index.html#L779),
  `Prêt ?` [791](../html/index.html#L791), `Bougez` [792](../html/index.html#L792)). With no charset
  declared, a browser opening this over `file://` or a server that didn't send `charset` would fall
  back to windows-1252 and render `DÃ©truisez`.

### 2. ✅ FIXED — `localStorage` access was unguarded, one throw killed the entire game (S)
> **Fixed 2026-08-12.** Reads and writes now go through `loadBest()` / `saveBest()`
> ([2546-2560](../html/index.html#L2546-L2560)), both wrapped in `try/catch`, with the best score
> degrading to in-memory only. Call sites: [2743](../html/index.html#L2743),
> [4993](../html/index.html#L4993).

`localStorage.getItem(BEST_KEY)` was read at IIFE top level while constructing `state`. In Safari
private browsing, with cookies/site-data disabled, or in some sandboxed `file://` contexts,
`localStorage` access **throws** — which aborted the whole IIFE and rendered a dead canvas with no
error visible to the player.

### 3. ✅ FIXED — Held keys stuck when the window lost focus (S)
> **Fixed 2026-08-12.** A `blur` handler now clears every held key —
> [3120-3126](../html/index.html#L3120-L3126).

`keydown` sets `state.keys[e.code] = true` [3078](../html/index.html#L3078) and only `keyup` cleared it
[3119](../html/index.html#L3119). Alt-tabbing (or hitting a browser shortcut) while holding <kbd>→</kbd>
meant the `keyup` was never delivered — on return the paddle slid into the wall and stayed pinned
until the key was pressed and released again.

### 4. ✅ FIXED — Power-up timers kept running while the game was paused (S)
> **Fixed 2026-08-12.** Effects now carry a `remaining` duration in seconds instead of an absolute
> `until` deadline, and `updateEffects(dt)` decrements it from the frame delta — which the loop only
> feeds while the phase is `playing`. See [4146-4163](../html/index.html#L4146-L4163), the effect
> durations each `remaining` starts from in `CONFIG.effects`
> ([1530-1542](../html/index.html#L1530-L1542), added by #21, since extended by #30), and the call site at
> [5821](../html/index.html#L5821).
> Verified: a `widen` survives a 30-second pause intact, then expires after its full 10 seconds of
> actual play.

`widthEffect` / `speedEffect` stored an absolute `until` timestamp from `performance.now()` and were
compared against the rAF `now`. Pausing for 20 seconds silently burned a 10-second "widen". Counting
in accumulated play time also makes the timers immune to tab-throttling and clock adjustments.

### 5. ✅ FIXED — Game did not auto-pause when the tab was hidden or the window blurred (S)
> **Fixed 2026-08-12.** `autoPause()` ([3128-3136](../html/index.html#L3128-L3136)) pauses whenever the
> phase is `playing`, wired to both `visibilitychange` and the existing `blur` handler from #3
> ([3123-3126](../html/index.html#L3123-L3126)). It deliberately only fires *on* hide/blur, never on
> return, so the player resumes explicitly.

There was no `visibilitychange` handler. `requestAnimationFrame` throttles in a background tab, and
`dt` is clamped to 33 ms [5774](../html/index.html#L5774), so the game didn't *jump* — but it stayed in
the `playing` phase, so power-up timers kept expiring (see #4) and returning to the tab dropped you
straight back into live play with no warm-up.

### 6. ✅ FIXED — `e.preventDefault()` on Space blocked button activation (S)
> **Fixed 2026-08-12.** The Space branch is now guarded by `isButtonFocused()` (renamed to
> `isTypingTarget()` and widened to cover text inputs too by #42, [3063-3067](../html/index.html#L3063-L3067),
> used at [3109](../html/index.html#L3109)): when a `<button>` holds focus the key is handed back to the
> browser, so it activates the button instead of launching the ball.
>
> This needed a companion fix. The deck's pause/mute buttons stay on screen and keep focus after a
> mouse click, so the guard alone would have made Space toggle pause instead of launching. A
> `blurIfPointerClick` helper ([3542-3547](../html/index.html#L3542-L3547)) drops focus after pointer
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
> alongside the existing pointer-release logic — [3101-3108](../html/index.html#L3101-L3108). Applied to
> all four movement codes (`ArrowLeft`/`ArrowRight`/`KeyA`/`KeyD`) rather than singling out the arrow
> keys, since suppressing the letter keys too is harmless and keeps them behaving identically.

`ArrowLeft`/`ArrowRight` are read but never `preventDefault`ed. On a narrow viewport where the cabinet
overflows, steering the paddle also scrolls the document under it.

### 8. ✅ FIXED — `mousedown` launches the ball on any button, including right-click (S)
> **Fixed 2026-08-13.** The handler now takes the event and returns early unless
> `e.button === 0` — [3143-3146](../html/index.html#L3143-L3146).

`canvas.addEventListener("mousedown", handleLaunchOrResume)` had no `e.button` check. Right-clicking
or middle-clicking to open a context menu launched the ball.

### 9. ✅ FIXED — Ball–paddle collision teleported the ball on side hits (M)
> **Fixed 2026-08-13.** The ball's `y` from before the frame's own movement is captured as `prevY`
> [4821](../html/index.html#L4821). A paddle collision is only resolved as a top-face bounce — steering
> by offset and snapping onto the top — when `prevY` was already above the paddle top
> [4864-4872](../html/index.html#L4864-L4872); otherwise it resolves as a side hit that reflects only
> the horizontal component and repositions the ball beside the paddle, the same treatment a brick's
> side face gets [4874-4883](../html/index.html#L4874-L4883). Paddle-velocity spin was left for a
> separate pass — out of scope for the teleport itself.

Any `circleRectCollide` with `dy > 0` snapped `ball.y = pr.y - ball.r - 0.5`, i.e. onto the top of the
paddle. A ball clipping the paddle's *side* while descending past it got warped upward and re-served,
which read as a phantom save.

### 10. ✅ FIXED — Only one brick collision was resolved per ball per frame, chosen by array order (M)
> **Fixed 2026-08-13.** The bricks loop no longer resolves against the first overlap it finds. It now
> scans every alive brick the ball overlaps, scores each with `brickPenetration()`
> [4785-4794](../html/index.html#L4785-L4794) — the smaller of the two axis overlaps, i.e. how shallow
> the intrusion is — and resolves against whichever brick has the smallest penetration
> [4885-4913](../html/index.html#L4885-L4913). Array order no longer has any say in which face gets hit.

The loop broke after the first overlapping brick. Bricks are stored top-row-first, so when a ball
overlapped two adjacent bricks in a corner, it always bounced off the *upper* one regardless of which
face it actually struck. Visible as occasional wrong-direction ricochets in the dense levels 4–5.

### 11. ✅ FIXED — Drop hitbox (8 px) didn't match the drawn capsule (10 px) (S)
> **Fixed 2026-08-13.** `updateDrops`'s hit test now uses the same 10px radius `drawDrops` renders the
> capsule with — [4257-4258](../html/index.html#L4257-L4258) vs. the `arc(0, 0, 10, …)` at
> [5690](../html/index.html#L5690).

`updateDrops` tested `± 8` while `drawDrops` rendered `arc(0,0,10,…)`. Power-ups visually clipped the
paddle without being collected.

### 12. ✅ FIXED — Multi-ball could spawn balls aimed straight down (S)
> **Fixed 2026-08-13.** The clone angle is derived from the source ball's angle mirrored upward when
> it's descending, then spread symmetrically to either side — [4229-4237](../html/index.html#L4229-L4237).
> A source ball travelling straight down used to produce two clones that were also both descending and
> usually lost within a second; now every clone starts with a negative `dy`.

The clone angle was `atan2(base.dy, base.dx) ± 0.6`. If the source ball was descending, both clones
were also descending, making "M" feel like a dud.

### 13. ✅ FIXED — Best score was only persisted at game over (S)
> **Fixed 2026-08-13.** The `state.score > state.best` check and `saveBest()` call are now behind a
> shared `maybeSaveBest()` helper [4966-4974](../html/index.html#L4966-L4974), called from
> `checkLevelClear()` [5010](../html/index.html#L5010) as well as `endGame()`
> [5046](../html/index.html#L5046). Progress is now checkpointed at every level clear, not just at the
> end of the run.

`endGame` was the only caller of `saveBest()`. Closing the tab mid-run — including after clearing four
levels — lost the score entirely.

---

## B. Performance

### 14. ✅ FIXED — `getComputedStyle(document.body)` called per drop, per frame (S)
> **Fixed 2026-08-13.** The font string is now built once into a module-level `DROP_FONT` constant
> [1493](../html/index.html#L1493); `drawDrops` just assigns it — [5693](../html/index.html#L5693). The
> body's font never changes at runtime, so there was nothing to gain from recomputing it 60 times a
> second.

`getComputedStyle(document.body)` was called inside the `drawDrops` loop, once per falling power-up,
per frame. This forced a synchronous style recalculation every frame for every falling power-up — the
single most expensive line in the render path.

### 15. ✅ FIXED — `updateHud()` writes four DOM nodes every frame (S)
> **Fixed 2026-08-13.** A `hudLast` cache [5433](../html/index.html#L5433) records what's currently
> displayed for each of the four HUD fields; `updateHud()` [5434-5445](../html/index.html#L5434-L5445)
> only touches `textContent` for a field whose value actually changed since the last call. The
> unconditional per-frame call [5958](../html/index.html#L5958) stays — it's still what catches
> `state.best` needing a live update against `state.score` — but an idle frame now writes nothing.

`updateHud()` was called unconditionally every frame, in addition to the event-driven calls in
`brickHit`, `applyPowerup`, and `loseLife` — 240 needless `textContent` assignments per second even
while nothing displayed was changing.

### 16. ✅ FIXED — `checkLevelClear()` scans the full brick array every frame (S)
> **Fixed 2026-08-13.** `state.remainingBricks` [2768](../html/index.html#L2768) counts destructible
> bricks still alive; `buildLevel()` seeds it when a level starts
> [2869](../html/index.html#L2869)/[2894](../html/index.html#L2894), and `brickHit()` decrements it at the
> single point a brick actually dies [4733](../html/index.html#L4733). `checkLevelClear()`
> [4997-5037](../html/index.html#L4997-L5037) is now an `O(1)` counter check instead of an `O(n)` scan.

`checkLevelClear()` ran `.some()` over up to 80 bricks every single frame. Cheap in absolute terms, but
trivially replaceable with a counter decremented in `brickHit`.

### 17. ✅ FIXED — Canvas backing store is sized from DPR only, ignoring displayed size (S)
> **Fixed 2026-08-13.** `fitCanvas()` [1068-1082](../html/index.html#L1068-L1082) now reads the canvas's
> actual displayed width via `getBoundingClientRect()` and scales the backing store by
> `dpr * min(1, displayWidth / GAME_W)` — never upsizing past `dpr` (unchanged from before whenever the
> canvas is shown at or above its logical size), but shrinking the allocation when the canvas — styled
> `width: 100%; height: auto` — renders narrower than that, as on a phone.

`fitCanvas` always allocated `480 × 680 × dpr`. On a phone where the canvas displays at ~300 px wide
with `dpr = 3`, that was a 1440×2040 buffer for a 300 px element.

---

## C. Code quality / structure

### 18. ✅ FIXED — Phase transitions bypassed `setPhase()` in three places (S)
> **Fixed 2026-08-13.** `setPhase()` [3396](../html/index.html#L3396) now owns every phase→overlay
> mapping via a `PHASE_OVERLAY` lookup [3300-3332](../html/index.html#L3300-L3332), extended to cover
> `levelclear`/`victory`/`gameover` as well as the phases it already handled. `togglePause`
> [3228](../html/index.html#L3228), `checkLevelClear` [5040](../html/index.html#L5040), and `endGame`
> [4160](../html/index.html#L4160) now all just call `setPhase(...)` instead of duplicating the
> `state.phase` assignment and `showOverlay` call. (#34 below was a follow-up gap — the boot-time
> start screen still bypassed this — since fixed.)

`setPhase` [3396](../html/index.html#L3396) was the intended single entry point, but `togglePause`,
`checkLevelClear`, and `endGame` each assigned `state.phase` *and* called `showOverlay` directly.
That's the kind of duplication that causes an overlay/phase desync the first time someone adds a
state.

### 19. ✅ FIXED — Dead/redundant code (S)
> **Fixed 2026-08-13.**
> - `state.paddle.w` is gone entirely — both the initial field and the `updatePaddle` assignment that
>   nothing ever read; `paddleWidth()` remains the one source of truth.
> - The redundant `updateHud(); drawBackground(); drawBricks(); drawPaddle();` block right before the
>   first `requestAnimationFrame(frame)` call is removed; that first frame already paints the same
>   thing ~16 ms later via `draw()` [5745-5764](../html/index.html#L5745-L5764), and the HUD's own
>   one-time init call [5348](../html/index.html#L5348) already covers the pre-play text.
> - `updateBalls` [4809](../html/index.html#L4809) now declares only the `dt` parameter it uses; the
>   call site [5884](../html/index.html#L5884) no longer passes the unused `now`.

- `state.paddle.w` was assigned in `updatePaddle` but never read — every draw/collision path called
  `paddleWidth()` instead.
- The `updateHud(); drawBackground(); drawBricks(); drawPaddle();` block was redundant; the rAF loop
  paints the same frame ~16 ms later.
- `updateBalls(dt, now)` never used `now`.

### 20. ✅ FIXED — No `AudioContext` resume, and the mute state wasn't persisted (S)
> **Fixed 2026-08-13.** `audioCtx()` [3632](../html/index.html#L3632) — `beep()`'s own body when
> this was written, split out by #59 — now calls `actx.resume()`
> [3650](../html/index.html#L3650) whenever the context is `"suspended"` — cheap and a no-op once
> already running, but it rescues audio for the rest of the session if the very first beep didn't
> happen to fire from inside a user-gesture handler. Separately, `state.muted` now round-trips through
> `loadMuted()`/`saveMuted()` [2568-2569](../html/index.html#L2568-L2569), the same `storageGet`/
> `storageSet` pair [2546-2560](../html/index.html#L2546-L2560) already used for the best score and the
> language preference, written on every toggle [3610](../html/index.html#L3610) and read back into
> `state.muted` at boot [2789](../html/index.html#L2789).

`beep` lazily constructed the context but never called `actx.resume()`. If the context was ever
created outside a user gesture it started `suspended` and the game was silently mute for the rest of
the session. Separately, `state.muted` wasn't saved, so the setting reset on every reload.

### 21. ✅ FIXED — Scattered magic numbers collected into a `CONFIG` block (M)
> **Fixed 2026-08-13.** A single `CONFIG` object [1512-1634](../html/index.html#L1512-L1634) now holds drop
> fall speed, particle gravity, the ball cap, the paddle bounce spread, each power-up's mult/duration
> pair, and — since added by #28/#29/#30 — the difficulty ramp, combo/floating-text, and laser tuning
> too. Every call site reads from it instead of a local literal: drop fall speed
> [4253](../html/index.html#L4253), particle gravity [4635](../html/index.html#L4635), the ball cap in
> both of `applyPowerup`'s multi-ball checks [4224](../html/index.html#L4224)/
> [4231](../html/index.html#L4231), the paddle bounce spread [4868](../html/index.html#L4868), and the
> four original effect branches [4200-4211](../html/index.html#L4200-L4211).

Magic numbers were scattered through the file: drop fall speed `130`, particle gravity `260`, effect
durations `10`/`8` seconds, multipliers `1.6`/`0.6`/`0.7`/`1.4`, ball-cap `5`, paddle bounce spread
`1.05`. Collecting these into one `CONFIG` object makes the game tunable without hunting through the
logic.

---

## D. Accessibility

### 22. ✅ FIXED — Overlay state changes are now announced (S)
> **Fixed 2026-08-13.** All six `.overlay` divs [776-826](../html/index.html#L776-L826) now carry
> `role="status" aria-live="polite"`, with a static `aria-hidden` default matching whether they're the
> one shown at boot. `showOverlay()` [3357-3391](../html/index.html#L3357-L3391) keeps `aria-hidden` in
> sync with the `.show` class on every transition — the overlay actually on screen is the only one
> ever inside the accessibility tree, which is what lets a screen reader announce it as it appears
> rather than the swap happening silently.

Level-clear, game-over, and victory overlays swapped in silently. A screen-reader user got no
notification.

### 23. ✅ FIXED — Toggle buttons now reflect their state (S)
> **Fixed 2026-08-13** (half fixed 2026-08-12 by the bilingual work — see below). Both deck buttons
> default to `aria-pressed="false"` in markup [1041-1042](../html/index.html#L1041-L1042) and are kept in
> sync by their render functions. `renderMuteButton()` [3454-3459](../html/index.html#L3454-L3459) now
> also sets `aria-pressed`; a new `renderPauseButton()`
> [3465-3471](../html/index.html#L3465-L3471) mirrors it for pause, and — since the pause button used to
> show the same "II" icon regardless of whether the game was actually paused — swaps the icon
> (`⏸`/`▶`) and `aria-label` between "pause" and "resume" too, not just `aria-pressed`. It's called
> from both `setPhase()` [3399](../html/index.html#L3399) and `applyLanguage()`
> [3508](../html/index.html#L3508), so it stays correct across phase changes and language switches
> alike. A `.icon-btn[aria-pressed="true"]` rule [694-698](../html/index.html#L694-L698) gives both
> buttons the same visual "pressed" cue the language toggle already had.

> **Half fixed 2026-08-12** by the bilingual work. `renderMuteButton()`
> ([3454-3459](../html/index.html#L3454-L3459)) sets the mute button's `aria-label` from both the
> language and the on/off state, so it no longer claims "Couper le son" while already muted.

Neither toggle exposed `aria-pressed`, and the pause button never changed its label or state when the
game was paused.

### 24. ✅ FIXED — Canvas now points assistive tech at the HUD (S)
> **Fixed 2026-08-13.** The HUD [733-754](../html/index.html#L733-L754) was already reachable — plain,
> unhidden DOM text ahead of the canvas in reading order — so no canvas fallback content was needed;
> what was missing was the connection between the two. The canvas now carries
> `aria-describedby="hud"` [762](../html/index.html#L762), pointing at the HUD container's new
> `id="hud"` [733](../html/index.html#L733), so a screen-reader user who lands directly on the canvas
> (rather than reading the page linearly) is told where the live score/lives text actually lives.

`<canvas>` had an `aria-label` but empty inner content and no live text alternative for score/lives.

### 25. ✅ FIXED — `prefers-reduced-motion` is now read in JS too (S)
> **Fixed 2026-08-13.** `burst()` [2983](../html/index.html#L2983) now scales its particle count down to
> roughly a third (never below 1) whenever `reduceMotion` is true, read from
> `matchMedia("(prefers-reduced-motion: reduce)")` [2976-2980](../html/index.html#L2976-L2980) — live,
> via a `change` listener, rather than once at load, so toggling the OS setting mid-session takes
> effect on the very next burst rather than requiring a reload.

[113-120](../html/index.html#L113-L120) disabled the title flicker, but the canvas particle bursts were
unaffected — the CSS media query can't reach into canvas drawing.

---

## E. Gameplay / UX enhancements

### 26. ✅ FIXED — Keyboard path out of the game-over / victory screens (S)
> **Fixed 2026-08-13.** `showOverlay()` [3357-3391](../html/index.html#L3357-L3391) now focuses the
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

`handleLaunchOrResume` [3181](../html/index.html#L3181) only handled `ready` and `paused`. From
`gameover`, `victory`, `levelclear`, or the initial `start` screen, Space did nothing — the player had
to reach for the mouse.

### 27. ✅ FIXED — Touch: the first tap both aimed and launched (S)
> **Fixed 2026-08-13.** Launching moved from `touchstart` to a new `touchend` handler
> [3163-3179](../html/index.html#L3163-L3179); `touchstart`/`touchmove`
> [3151-3162](../html/index.html#L3151-L3162) now only update `pointerX`, aiming the paddle. That gives
> the player a chance to drag into position before committing to serve, instead of the ball launching
> from wherever the finger first landed. The "vertical offset" half of the original fix — tracking the
> paddle's own Y position above the finger — was deliberately dropped: the paddle only ever steers
> horizontally, so moving it vertically during touch play would be a materially bigger change (new
> collision geometry, different feel from mouse/keyboard play) than this finding's effort estimate
> implied, and isn't needed to fix the actual bug (the ball launching prematurely). (#35 below is a
> follow-up gap in the `touchend` handler itself.)

`touchstart` [3151](../html/index.html#L3151) (previously) set `pointerX` and immediately called
`handleLaunchOrResume`. On mobile you could not position the paddle before serving — the ball launched
from wherever your finger first landed.

### 28. ✅ FIXED — Difficulty ramp within a level (M)
> **Fixed 2026-08-13.** `state.difficultyMult` [2787](../html/index.html#L2787) multiplies directly into
> ball velocity [4822](../html/index.html#L4822), alongside the existing power-up speed multiplier. It
> ramps via `bumpDifficulty()` [2859-2861](../html/index.html#L2859-L2861) — cumulative, multiplicative,
> capped at `CONFIG.difficulty.max` — from two classic-Breakout triggers: every top-wall bounce
> [4828-4834](../html/index.html#L4828-L4834), and every `CONFIG.difficulty.brickMilestone` bricks
> destroyed in the current level [4734-4747](../html/index.html#L4734-L4747). `CONFIG.difficulty`
> [1567-1572](../html/index.html#L1567-L1572) holds the tuning; `buildLevel()`
> [2895-2900](../html/index.html#L2895-L2900) resets both the multiplier and the milestone counter at the
> start of every level, so the ramp never carries over from one level — or one difficulty — to the
> next.

Ball speed was fixed per level ([2303](../html/index.html#L2303), `LEVELS[i].speed`). Classic breakout
speeds the ball up after N bricks or on reaching the top wall, which prevents long stalemates on the
last brick.

### 29. ✅ FIXED — Score feedback on the canvas (M)
> **Fixed 2026-08-13.** Destroying a brick now spawns a floating `"+N"` pop-up at its position
> ([2996-3001](../html/index.html#L2996-L3001), rising and fading over `CONFIG.floatingText.life`
> seconds via `updateFloatingTexts()`/`drawFloatingTexts()`
> [4639-4646](../html/index.html#L4639-L4646)/[5728-5743](../html/index.html#L5728-L5743)), wired into
> the frame loop alongside particles [5830](../html/index.html#L5830)/[5837](../html/index.html#L5837)
> and `draw()` [5762](../html/index.html#L5762). Consecutive bricks destroyed without the ball touching
> the paddle also build a combo [4751-4756](../html/index.html#L4751-L4756) that scales the points
> awarded, capped at `CONFIG.combo.max`; any paddle contact — top face or side clip — resets it
> [4852](../html/index.html#L4852). `CONFIG.combo`/`CONFIG.floatingText`
> [1573-1646](../html/index.html#L1573-L1646) hold the tuning. This changes the scoring curve going forward
> — an unbroken combo now scores noticeably more than the same bricks hit in isolation — so existing
> saved best scores are no longer directly comparable to newly-earned ones.

Points were only visible in the HUD, with no combo mechanic for consecutive brick hits without a
paddle touch.

### 30. ✅ FIXED — Sticky paddle and laser power-ups (M)
> **Fixed 2026-08-13.** Both suggested additions are in, slotting into the existing timed-effect
> architecture: `POWERUPS` [1466-1467](../html/index.html#L1466-L1467), `CONFIG.effects.sticky`/
> `CONFIG.effects.laser` [1535-1536](../html/index.html#L1535-L1536), and two new branches in
> `applyPowerup` [4271-4276](../html/index.html#L4271-L4276).
>
> **Sticky** re-attaches a ball on a genuine top-face paddle hit while `stickyEffect` is active
> [4854-4863](../html/index.html#L4854-L4863), capped to one attached ball at a time so multi-ball
> can't stack several on the paddle at once. `updatePaddle()`'s attached-ball tracking, previously
> hardcoded to `balls[0]`, now loops over every ball [4133-4138](../html/index.html#L4133-L4138) since
> sticky can catch any of them, not just the one served at the start of a life.
>
> **Laser** gives the action button a second job during `"playing"`: alongside releasing a stuck ball,
> `handleLaunchOrResume()` [3181-3191](../html/index.html#L3181-L3191) now calls `fireLaser()`
> [3214-3226](../html/index.html#L3214-L3226), which fires classic twin bolts from the paddle on a
> cooldown (`CONFIG.laser` [1546-1551](../html/index.html#L1546-L1551)). `updateLasers()`
> [4268-4627](../html/index.html#L4268-L4627) moves them and reuses `brickHit()` on impact — the same
> scoring/combo/difficulty path a ball hit goes through — and `drawLasers()`
> [5701-5714](../html/index.html#L5701-L5714) renders them. Releasing a sticky ball and firing both
> route through the same action-button entry point used everywhere else (mouse, touch, Space), via a
> new `launchAttachedBalls()` helper [3193-3206](../html/index.html#L3193-L3206) `launchBall()`
> (the "ready" → "playing" serve) now also calls.

The current six were solid, but nothing rewarded skillful play with new tools. **Sticky paddle** (ball
re-attaches, aim the next shot) and **laser** (fire upward on Space) were the suggested natural
additions.

### 31. ✅ FIXED — Active power-up timers are now visible (S)
> **Fixed 2026-08-13.** A depleting bar per effect, under the HUD
> ([1007-1035](../html/index.html#L1007-L1035) markup, [224-285](../html/index.html#L224-L285) CSS). Slots
> are toggled with the `hidden` attribute and resized via the fill's inline width rather than
> created/destroyed — see `updateEffectBar()`/`renderEffectBars()`
> [5373-5402](../html/index.html#L5373-L5402), called after every `applyPowerup()`
> [4247](../html/index.html#L4247) and once per frame [5840](../html/index.html#L5840). `state.widthEffect`/
> `state.speedEffect` don't record which specific powerup produced them, only the resulting `mult`, so
> the bar recovers it from the sign of `mult` — the same trick `drawPaddle()`
> [5640](../html/index.html#L5640) already used for its colour swap.

The paddle changed colour for width effects, but there was no indication of *how long* an effect
lasted, and speed effects had no visual at all.

### 32. ✅ FIXED — Add more levels (M)
> **Fixed 2026-08-13.** Five hand-authored levels added to `LEVELS`
> [1121-1135](../html/index.html#L1121-L1135), taking the game from 5 levels to 10. Went with hand-authored
> over the procedural-generator option: it keeps the existing finite-levels-then-`victory` structure
> intact (`checkLevelClear()`'s `LEVELS.length - 1` win check [4138](../html/index.html#L4138), the HUD's
> `n/LEVELS.length` readout [4627](../html/index.html#L4627), and `level.of`'s `{n}/{total}` string all
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
> [745](../html/index.html#L745) and [758](../html/index.html#L758).

Endless mode past level 5 (a procedural generator) was the other option on the table; not pursued here
— see the fix note above for why hand-authoring won out for this pass. Tracked as its own follow-up in
[todo.md](todo.md) (#41) if endless play is wanted later, no longer under #32.

### 37. ✅ FIXED — The power-up timer bars (#31) reflow the whole cabinet when they appear (M)
> **Fixed 2026-08-13.** `.effect-bars` and `.screen-wrap` became independent flex siblings inside a
> new `.play-row` — the effect-bars markup moved from before `.screen-wrap` to after it, as a sibling
> rather than a fellow child of `.cabinet`'s own flex column [57-65](../html/index.html#L57-L65)
> *(markup: [759](../html/index.html#L759) wraps both; the bars themselves were at
> [1010-1035](../html/index.html#L1010-L1035))*. `.effect-bars` took a fixed `flex: 0 0 84px` column
> instead of wrapping horizontally, so a slot's `hidden` toggle (still the same mechanism from
> #31 — see `updateEffectBar()` [5373-5383](../html/index.html#L5373-L5383)) resized only that
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
[5373](../html/index.html#L5373)), so with the bars stacked as an ordinary block above the canvas
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
> ([5373-5383](../html/index.html#L5373-L5383)) takes a `name` argument instead of a single-letter
> `label`, writes it into the `*-label` element, and — since a name can be wider than the bar — also
> sets it as the bar's `title` ([5382](../html/index.html#L5382)) as a fallback for whatever the CSS
> ellipsis clips. `.effect-bar-label` ([270-286](../html/index.html#L270-L286)) picked up
> `overflow: hidden`/`white-space: nowrap`/`text-overflow: ellipsis` to clip gracefully rather than
> spill past the bar's rounded corners. `bar-sticky`/`bar-laser` ([1021](../html/index.html#L1021),
> [1025](../html/index.html#L1025)) no longer hard-code their letter in the markup — they route through
> `bar-sticky-label`/`bar-laser-label` elements now, the same as width/speed always did, closing the
> asymmetry the finding called out. Six new `powerup.*` keys
> ([2251-2256](../html/index.html#L2251-L2256) fr, [2394-2399](../html/index.html#L2394-L2399) en)
> name every timed effect the bars can show — widen/narrow/slow/fast/sticky/laser; `multi`/`life`
> have no timer bar, so they got no entry. `#effect-bars` stays `aria-hidden="true"`
> ([1010](../html/index.html#L1010)) — the name is now on-screen as ordinary bar content rather than
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
> `OVERLAY_BUTTON_IDS` lookup [3347-3356](../html/index.html#L3347-L3356) is built from
> `PHASE_OVERLAY`'s button entries (from `OVERLAY_PRIMARY_BTN`'s values at the time; #36 below folded
> that map into `PHASE_OVERLAY`), and `showOverlay()` [3380-3383](../html/index.html#L3380-L3383)
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
> [3350](../html/index.html#L3350) — `OVERLAY_PRIMARY_BTN` already had the matching
> `"overlay-start": "btn-start"` since #26 [3350](../html/index.html#L3350) — so boot
> [6042](../html/index.html#L6042) now calls `setPhase("start")` instead of `showOverlay(...)`
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
> **Fixed 2026-08-13.** `touchend`'s handler [3163-3181](../html/index.html#L3163-L3181) now only
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
> **Fixed 2026-08-13.** `PHASE_OVERLAY` [3300-3332](../html/index.html#L3300-L3332) is now the only
> map: each phase's entry carries both its overlay id and its button id together (e.g.
> `paused: { overlay: "overlay-pause", button: "btn-resume" }`), or is `null`/has no `button` key
> for `"playing"`/`"ready"`. `OVERLAY_PRIMARY_BTN` is gone; `OVERLAY_BUTTON_IDS`
> [3347-3356](../html/index.html#L3347-L3356) (see #33) and `setPhase()`
> [3396-3404](../html/index.html#L3396-L3404) both derive what they need from `PHASE_OVERLAY` alone,
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
> existing overlap test — [4838-4850](../html/index.html#L4838-L4850). When the ball's start-of-frame
> position was above the paddle top but its end-of-frame position has already cleared the paddle
> bottom (the exact tunneling case: no overlap left for `circleRectCollide` to catch), it's rewound
> to the point where it crossed the paddle's top plane, so the existing `isTopHit` branch just below
> sees a normal top hit and steers it exactly as it always has. Bricks are deliberately exempt — a
> missed brick costs nothing, the ball just continues past it — so this only guards the one collision
> that actually costs the player something. The stale comment in `LEVELS`
> ([1126-1132](../html/index.html#L1126-L1132)) claiming level 10's speed was "kept under the ceiling" is
> corrected too: that ceiling never held once the difficulty ramp was accounted for, and the sweep
> makes level speed a non-issue for this class of bug going forward. The paper-math test in
> `test/suites/physics.js` ("the ball cannot tunnel through the paddle...") is now a behavioural test
> that drives this exact worst case — level 10, `fast`, `difficultyMult` pinned to its cap, one 33ms
> frame — and asserts the ball still bounces; a matching `#38` regression test covers the same ground
> in `test/suites/regressions.js`.

The "cannot tunnel through the paddle at maximum speed" test
([test/suites/physics.js:202–218](../test/suites/physics.js#L202-L218)) only budgets for
`baseBallSpeed * LEVELS[i].speed * fast-powerup's 1.4x`, capped by the 33ms clamped max `dt`
([5774](../html/index.html#L5774)). It never factors in `state.difficultyMult`
([2787](../html/index.html#L2787)), the mid-level ramp (up to `CONFIG.difficulty.max` = `1.6`,
[1571](../html/index.html#L1571)) that's multiplied into the same per-frame displacement at
[4822](../html/index.html#L4822):

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
[4837](../html/index.html#L4837):

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
comment at [1125-1133](../html/index.html#L1125-L1133) claiming level 10 is "kept under the ceiling" should
be corrected either way, since it's not accurate today.

### 39. ✅ FIXED — Stale "1/5" HUD markup fallback (S)
> **Fixed 2026-08-14.** The markup now reads `<div class="hud-value" id="hud-level">1/10</div>`
> ([718](../html/index.html#L718)), matching the two overlay-eyebrow fallbacks #32 already updated. A
> `#39` regression test in `test/suites/regressions.js` checks the raw source text directly (not the
> post-boot DOM, since `updateHud()` overwrites this on the very first frame regardless of what the
> static markup said) so a future level-count change can't let this one quietly go stale again.

The static HUD counter at [718](../html/index.html#L718) —
`<div class="hud-value" id="hud-level">1/5</div>` — was not updated when #32 took the game to 10
levels, even though the #32 fix explicitly updated the two parallel overlay-eyebrow fallbacks at
[745](../html/index.html#L745) and [758](../html/index.html#L758) for the identical reason (both read
"Niveau 1 / 10" now). `updateHud()` ([4627](../html/index.html#L4627)) overwrites it with the real
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
([1095](../html/index.html#L1095)) — which is exactly the kind of brick-adjacency layout the
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
> (a text input + submit button, markup at [842-851](../html/index.html#L842-L851)) and `halloffame`
> (the top-10 board + a continue button, [853-859](../html/index.html#L853-L859)), each with its own
> `PHASE_OVERLAY` entry ([3331-3332](../html/index.html#L3331-L3332)) rather than bolting an input onto
> `overlay-victory`/`overlay-gameover` directly. `endGame()` ([5045-5061](../html/index.html#L5045-L5061))
> detours through `nameentry` — remembering which final screen to return to afterward in
> `state.returnPhase` (generalized from a `pendingWon` boolean by #43) — whenever
> `qualifiesForHallOfFame(state.score)`
> ([5090-5092](../html/index.html#L5090-L5092)) is true: strictly greater than 0, and either the board
> has room or the score beats its current lowest entry via `hallOfFameRank()`
> ([5078-5083](../html/index.html#L5078-L5083)) — a tie with the lowest entry does not bump it. The
> board is a capped, sorted `{name, score}` list under a new `neonbreak-hall-of-fame` key
> ([2542](../html/index.html#L2542)), round-tripped through `loadHallOfFame()`/`saveHallOfFame()`
> ([2576-2589](../html/index.html#L2576-L2589)) via the same guarded `storageGet`/`storageSet` pair #2
> already uses — a throw, or corrupted/foreign JSON under that key, degrades to an empty board rather
> than taking the game down.
>
> A submitted name is trimmed, capped to `CONFIG.hallOfFame.nameMax` (12 characters,
> [1655-1673](../html/index.html#L1655-L1673)), and falls back to a translated `"???"` placeholder when
> empty (`submitHallOfFameName()`, [5177-5210](../html/index.html#L5177-L5210)). `renderHallOfFame()`
> ([5217-5242](../html/index.html#L5217-L5242)) rebuilds the board through `innerHTML` rather than
> `textContent` as sketched below — the test harness's DOM stub has no `createElement`/`appendChild`
> to build real nodes with — but every interpolated value (the name; the score too, for uniformity)
> goes through a small `escapeHtml()` helper first ([1101-1103](../html/index.html#L1101-L1103)), so a name
> like `<img src=x onerror=...>` still can't be interpreted as markup. `isButtonFocused()` is renamed
> to `isTypingTarget()` and widened to also cover a focused `<input>`
> ([3064-3067](../html/index.html#L3064-L3067)), so Space still reaches the name field instead of being
> hijacked for launch/laser; Enter submits directly from the field
> ([3114-3116](../html/index.html#L3114-L3116)) since nothing else in this file uses a `<form>`.
>
> Covered by ten `#42a`–`#42j` cases in `regressions.js` — qualification gating including the score-0
> and tie edge cases, sorted insertion, the empty-name fallback, HTML-escaping, the win/loss branch
> back out, Space/Enter handling, and the max-size cap — plus two round-trip cases in `persistence.js`,
> including the `storageThrows` guard. Four existing tests that happened to end a run with a
> qualifying score (`state.js`, `rules.js`, `i18n.js`, `persistence.js`) now seed a full board via the
> `storage` boot option so they keep exercising what they were actually about, not the hall of fame.

Feature request: when a run ends (`endGame()`, [5045](../html/index.html#L5045)) with a score that
qualifies, prompt the player for their name, then show a top-10 leaderboard of name+score pairs.

Today only a single number persists across sessions — `state.best`, round-tripped through
`loadBest()`/`saveBest()` ([2559-2560](../html/index.html#L2559-L2560)) under `BEST_KEY`
([2539](../html/index.html#L2539)), both guarded by `storageGet`/`storageSet`
([2550-2559](../html/index.html#L2550-L2559)) per #2. This replaces "a number" with "a list":
a new `localStorage` key (e.g. `neonbreak-hall-of-fame`) holding a JSON array of `{ name, score }`,
capped at 10, sorted descending, read/written through the same guarded helpers so a throwing
`localStorage` degrades the same way #2 already handles for the best score.

**Where it hooks in:** both `endGame(true)` and `endGame(false)` ([5045](../html/index.html#L5045)) —
a run can end either by winning or by running out of lives, and both should qualify. The natural gate
is "does this score beat the lowest of the current top 10 (or is the list not yet full)?" — most runs
won't qualify, and skipping the prompt entirely for those keeps the existing victory/gameover flow
(`PHASE_OVERLAY` [3300-3332](../html/index.html#L3300-L3332), `overlay-victory`/`overlay-gameover`
markup [808-837](../html/index.html#L808-L837)) untouched for the common case.

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
  empty-list message) needs a key in both `STRINGS.fr` and `STRINGS.en` ([2129](../html/index.html#L2129))
  — the `i18n` suite already fails the build if one language's table is missing a key the other has,
  so this is enforced automatically once the keys exist.
- *Keyboard/focus.* The name-entry overlay's input should get focus the way every other overlay's
  primary button does today (`showOverlay()` [3357](../html/index.html#L3357), #26), and
  submitting needs both an Enter-in-the-input path and a click path — mirroring how
  `handleLaunchOrResume()` already serves keyboard, mouse, and touch from one entry point.

**Test coverage this would need:** a `persistence` suite case for the hall-of-fame round-trip
(including the `storageThrows` guard, per #2's test), a `state`/`rules` case for the qualifying-score
gate, and — since this is the first free-text player input — an explicit case asserting a name
containing HTML-special characters renders as literal text, not markup.

### 43. ✅ FIXED — View the hall of fame from the start screen, before playing (S)
> **Fixed 2026-08-14.** A second, lower-emphasis button on `overlay-start`
> ([781-782](../html/index.html#L781-L782), styled with a new `.btn-ghost` modifier
> [440-445](../html/index.html#L440-L445)) opens the board on demand — its handler
> ([3517-3537](../html/index.html#L3517-L3537)) sets `state.returnPhase = "start"` and calls
> `setPhase("halloffame")` directly, never `newGame()`, so score/lives/level are untouched. The
> board itself needed no changes — `renderHallOfFame()` already renders `halloffame.empty` for a
> fresh install with nothing on it yet, exactly as sketched below.
>
> `state.pendingWon` (a `true`/`false`/`null` flag) is generalized into `state.returnPhase`
> (`"start"` / `"victory"` / `"gameover"`, [2807-2812](../html/index.html#L2807-L2812)): `endGame()`
> ([5059](../html/index.html#L5059)) sets it to `won ? "victory" : "gameover"` before the post-game
> detour exactly as `pendingWon` did, and the continue button
> ([3589-3591](../html/index.html#L3589-L3591)) just does `setPhase(state.returnPhase)` — one field
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
([2542](../html/index.html#L2542)), so two players never see each other's scores, and the same person
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
interpolated values ([5238-5239](../html/index.html#L5238-L5239)), so XSS is handled, but a public
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
> ([1612-1624](../html/index.html#L1612-L1624)) and driven from three timers on `state`
> ([2828-2833](../html/index.html#L2828-L2833)): a camera shake on an explosion
> ([4774-4775](../html/index.html#L4774-L4775)) and on a lost ball
> ([5056](../html/index.html#L5056)), 55 ms of frozen simulation with the blast, and a paddle squash
> on every steered bounce ([4971](../html/index.html#L4971)). The whole layer lives in one block —
> [3042-3096](../html/index.html#L3042-L3096).
>
> **It is presentation, and the boundary is enforced rather than described.** The shake is a
> `ctx.translate` around the whole scene in `draw()` ([5746-5751](../html/index.html#L5746-L5751)),
> so nothing the game simulates moves because of it, and the squash is applied to the paddle's drawn
> rectangle only ([5644-5654](../html/index.html#L5644-L5654)) — `state.paddle.h` still governs
> collision, so the paddle cannot get easier or harder to hit by flexing.
>
> **The shake offset is derived from its own timer, not `rand()`** — two fast, incommensurable sines.
> Rolling for it inside `draw()` would have made what the game rolls (drop chances, mystery
> resolutions) depend on how many frames it happened to paint, which is a bug that would have
> surfaced as unreproducible seeded tests long after the cause was forgotten. `#58f` pins it.
>
> **Hit-stop is set, never accumulated** ([3022-3027](../html/index.html#L3022-L3027)). Summing it
> across a five-brick explosive chain would put the game to sleep for a third of a second and read as
> a hang. It is also spent from real elapsed time and cleared on a life reset
> ([2934-2936](../html/index.html#L2934-L2936)), so no path leaves the simulation frozen.
>
> `drawBackground()` now bleeds past the play area by the largest possible offset
> ([5444-5452](../html/index.html#L5444-L5452)); an exactly sized fill leaves a strip of the
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
> ([3660-3726](../html/index.html#L3660-L3726)), the single primitive everything audible is built
> from: a note at a scheduled time, optionally gliding to a second frequency (`slide`) or doubled by
> a detuned twin (`detune`).
>
> **The game is in a key.** `noteFreq()`, a minor-pentatonic `MUSIC_SCALE` and one root per level in
> `MUSIC_KEYS` ([3818-3820](../html/index.html#L3818-L3820)) pitch the music, the brick voices and
> the combo ladder from the same place, so a hit lands in tune with the bed rather than beside it —
> and each level sounds like a different level without a single new asset.
>
> **A voice per brick type.** `BRICK_VOICE` ([3873-3884](../html/index.html#L3873-L3884)) gives each
> type its own timbre, register and envelope: a wall thuds low and slides down, silver rings as two
> detuned squares, a mystery brick sparkles upward as it resolves, an explosive drops. Type is the
> only thing that changes what a hit *does* (#49/#51/#52), so it is now also the only thing that
> changes what a hit sounds like. `brickTone()` ([3888-3896](../html/index.html#L3888-L3896))
> replaces the four hand-tuned `beep()` calls that used to be scattered through `brickHit()`
> ([4821-4874](../html/index.html#L4821-L4874)).
>
> **A ladder for streaks.** `ladderSemi()` ([3866-3868](../html/index.html#L3866-L3868)) climbs a
> step of the scale per brick destroyed without a paddle touch, wrapping octaves and holding after
> two — past that the notes stop reading as notes. It is added only when the brick was destroyed,
> because only a destroyed brick builds the combo it counts, and it is read *after* `state.combo` is
> raised ([4849](../html/index.html#L4849)) so a hit sounds on the rung it just earned.
>
> **The bed.** Four voices over a 16-step bar ([3991-4047](../html/index.html#L3991-L4047)), queued
> by `updateMusic()` ([4099-4120](../html/index.html#L4099-L4120)) from `frame()`
> ([5786](../html/index.html#L5786)) and tuned in `CONFIG.music`
> ([1595-1601](../html/index.html#L1595-L1601)). Three things about it are deliberate:
>
> - **Frames decide what, the audio clock decides when.** A note placed at `frame()` time lands
>   wherever the frame fell, which at 60 Hz is up to 16 ms off the beat and audibly so. Frames only
>   queue steps up to `lookahead` ahead of `actx.currentTime`; WebAudio places them.
> - **A stall resyncs rather than catching up** ([4109](../html/index.html#L4109)). A backgrounded
>   tab leaves the audio clock tens of seconds ahead of the bar; without this the next frame would
>   queue every missed step at once — a burst, not music, and an unbounded loop besides. `#59f` pins
>   it.
> - **Voices arrive on the beat they are earned and leave slowly** — `nextIntensity()`
>   ([4086-4093](../html/index.html#L4086-L4093)) rises instantly to whatever `voiceCombo` tier the
>   streak has reached and falls at `voiceDecay` voices per second. Instant decay would flicker the
>   whole arrangement on and off, since a combo dies on *every* paddle touch — several times a level,
>   by design. `intensity` is a float, so a voice fades in and out rather than switching.
>
> Like #58's impact layer, this reads game state and writes none of it, and — same hazard, same fix —
> it takes nothing from the RNG stream (`#59g`): a note chosen by `rand()` would make what the game
> rolls depend on how long it had been playing, and seeded physics runs would stop reproducing.
> Mute needed no change: `audioCtx()` ([3632-3653](../html/index.html#L3632-L3653)) returns null
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
> ([1172-1188](../html/index.html#L1172-L1188)) carries a sky gradient, a grid tint, a horizon tint and
> a star colour per act; `themeFor()` ([1190-1192](../html/index.html#L1190-L1192)) maps the level onto
> it, and `buildLevel()` resolves both the palette and the star field once per level
> ([2901-2902](../html/index.html#L2901-L2902)) rather than per frame.
>
> **Brick colours are deliberately not themed.** A brick's colour *is* its type (#49/#51/#52), so
> re-tinting the field's foreground per act would make the one thing the player has to read at a
> glance the one thing that keeps moving. Only the background changes.
>
> **The parallax is three star layers plus a scrolling horizon**
> ([5424-5441](../html/index.html#L5424-L5441)), all derived from one number — `state.bgScroll`,
> seconds of real time accumulated in `frame()` ([5791](../html/index.html#L5791)). Nearer layers
> drift faster (`STAR_LAYERS`, [1196-1200](../html/index.html#L1196-L1200)), which is the whole effect;
> deriving every offset from the same accumulator is what stops the layers from sliding out of
> register after a stall. Stars are drawn a layer at a time, so the field costs three fill-style
> changes a frame rather than fifty, and the sky gradient is rebuilt only when the act changes
> ([5410-5422](../html/index.html#L5410-L5422)) — `createLinearGradient` allocates.
>
> **The field is generated, not rolled** ([1217-1229](../html/index.html#L1217-L1229)): a Lehmer
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
> ([1397-1445](../html/index.html#L1397-L1445)) builds the rest from the level index alone.
>
> **One accessor hides the seam.** `levelDef(idx)` ([1447-1456](../html/index.html#L1447-L1456))
> returns the authored entry or a generated one of the same `{ rows, speed }` shape, memoised a
> single slot deep because `resetPaddleAndBall()` re-reads it on every lost ball. Its two callers are
> `buildLevel()` ([2868](../html/index.html#L2868)) and `resetPaddleAndBall()`
> ([2919](../html/index.html#L2919)), and neither can tell the difference.
> `CONFIG.progression.totalLevels` ([1518-1525](../html/index.html#L1518-L1525)) replaced
> `LEVELS.length` in `checkLevelClear()` ([5143](../html/index.html#L5143)), `renderDynamicText()`
> ([3321](../html/index.html#L3321)) and `updateHud()` ([5439](../html/index.html#L5439)), and the
> HUD's pre-JS fallback became `1/100` ([744](../html/index.html#L744)) — #39's point about a stale
> fallback applies unchanged. Putting the length in `CONFIG` rather than in a bare constant is what
> left the test seam untouched: `CONFIG` was already exposed.
>
> **Deterministic, never from `Math.random()`.** The inline Lehmer generator #60 used for the star
> field is now a shared `seededRandom(seed)` ([1209-1213](../html/index.html#L1209-L1213)), seeded from
> the level index in both places. Level 47 is the same layout for every player and reproducible in a
> test (`#41d`), and rolling from the shared stream would have made drop chances and mystery
> resolutions depend on how many levels had been generated — the hazard `#58f`, `#59g` and `#60d`
> already pin down for the shake, the music and the background (`#41f`).
>
> **Archetypes, not noise.** Per-cell randomness produces mush; the authored levels are patterned.
> One archetype is picked per level from a library of seven — solid bands, checker, columns, pyramid,
> diamond, fortress, arch ([1263-1283](../html/index.html#L1263-L1283)) — and each row is built for the
> left five cells and mirrored. Symmetry is most of what makes a layout read as authored. Type mix
> escalates with depth `d = idx - LEVELS.length`: silver from the start rising to 30% of cells, walls
> from d≥3 capped at 12% and never in the bottom row, 0–3 explosives from d≥2, 1–4 mysteries from
> d≥5, 0–2 regenerating from d≥10. The three budgeted types are scattered *after* the mirror
> ([1359-1377](../html/index.html#L1359-L1377)) so their counts stay what the table asks for rather than
> silently doubling — a few asymmetric accents cost a layout nothing, a doubled explosive budget
> would. Rows grow `6 + floor(d/12)`, capped at the authored maximum of 10.
>
> **Every destructible brick is reachable.** A brick walled off from the ball is a softlock:
> `remainingBricks` never falls to zero and the run is dead with nothing left to hit. `ensureReachable()`
> ([1339-1355](../html/index.html#L1339-L1355)) flood-fills up from the open space below the layout —
> four-neighbour, empty cells and destructible bricks passable (a destructible brick opens its own
> cell once it is gone), `#` solid — and repairs rather than re-rolls, downgrading whichever wall
> faces open space ([1316-1335](../html/index.html#L1316-L1335)) and trying again. Termination is
> guaranteed, since with no walls left everything is reachable, and a repair pass is deterministic,
> so it costs nothing in seed stability. `#41c` asserts the invariant with a flood fill written
> independently in the test rather than by calling the game's own validator.
>
> **Both curves saturate rather than compound** ([1382-1395](../html/index.html#L1382-L1395)), and both
> are anchored on the authored table so they pick up exactly where `LEVELS` leaves off. Speed
> approaches 2.8 from level 10's 2.08 with a ~25-level time constant — 2.32 at 20, 2.65 at 50, 2.78
> at 100 — deliberately modest, because at the cap the ball already crosses ~51px in a worst-case
> 33ms frame once the `fast` power-up and the mid-level ramp stack on it. #38's swept check keeps it
> off the paddle (its regression test now runs at level 100 rather than level 10), but brick
> collision is not swept: **layout carries the back half of the difficulty, not speed.**
> `levelMultiplier(n)` stays exactly `n` through level 10 — the existing scoring tests pin that —
> then saturates toward 20 with a ~30-level constant, replacing the `(state.levelIndex + 1)` factor
> in `brickHit()` ([4753](../html/index.html#L4753)).
>
> **Relief:** three lives across 100 levels is not survivable, so clearing every 10th level hands one
> back, capped at `state.maxLives` ([5034-5040](../html/index.html#L5034-L5040)). Awarded on the way
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
> ([3093-3098](../html/index.html#L3093-L3098)), reading the `state.keys` set the paddle already
> uses — which is cleared on `blur`, so a chord broken by alt-tab cannot get stuck half-down. Two
> details it turns on. It fires on whichever of the three keys *completes* the chord rather than on
> any keystroke while they happen to be held, or still having them down after a jump would re-open
> the prompt on the next key pressed. And its guard is `isTextEntryTarget()`
> ([3072-3075](../html/index.html#L3072-L3075)), deliberately narrower than the existing
> `isTypingTarget()`: it only has to stand aside for a text field, and since every overlay focuses
> its own button (#26), reusing `isTypingTarget()` would have meant the chord never fired from a
> menu at all — which is most of where it is wanted.
>
> **The prompt is a real phase**, `leveljump` in `PHASE_OVERLAY`
> ([3334](../html/index.html#L3334)), not a modal bolted on beside the phase machine. That is the
> architecture's rule, and it buys three things: the simulation stops while the prompt is up because
> `frame()` only updates on `playing`/`ready`; `showOverlay()` handles `aria-hidden` and focuses the
> field the way `nameentry` does; and its text is ordinary `data-i18n` rather than a special case.
> While it is showing it owns the keyboard — `Enter` submits, `Escape` dismisses, and nothing else in
> the handler gets a look in ([3083-3088](../html/index.html#L3083-L3088)).
>
> `openLevelJump()`/`cancelLevelJump()`/`submitLevelJump()`
> ([3249-3287](../html/index.html#L3249-L3287)) are the whole of it. Cancelling restores the phase
> the prompt interrupted, and **cancelling from `playing` lands on `paused`** — returning to
> `playing` would drop the player back into a live ball the instant the overlay closed, which is the
> reason `autoPause()` exists. Validation is strict rather than `parseInt`: `"12abc"` and `"1e3"` are
> typos, not level numbers, and the bound is `CONFIG.progression.totalLevels`, never a literal 100.
> Arriving needs no new code — `startLevel(n - 1)` already builds the level, resets the paddle and
> ball and lands on `ready`, and the `levelclear` → next-level loop reads `state.levelIndex + 1`.
>
> **A jumped run is out of the running.** `state.jumped` is set by the jump, sticky until
> `newGame()`, and checked in both `endGame()` ([5058](../html/index.html#L5058)) and
> `maybeSaveBest()` ([4973](../html/index.html#L4973)). The world board can never be reset (#67) and
> brick value saturates toward 20× (#41), so jumping straight to level 100 would otherwise be the
> cheapest high score in the game; excluding the local best too stops one test jump parking an
> unbeatable number on the player's own board. The overlay says so in as many words
> ([1005](../html/index.html#L1005)) — this is client-side JavaScript anyone can read, so it is a
> convenience, not a protected mode, and the UI should not pretend otherwise.
>
> Jumping from outside a run (`start`, a finished run, the board opened on demand) resets score and
> lives and refreshes the session token the way `newGame()` does, since there is no run behind it;
> jumping mid-run keeps both. `RUN_PHASES` ([3247](../html/index.html#L3247)) is the distinction.
>
> **One bug this surfaced in existing code.** `showOverlay()` blurred a leftover focused control only
> when it was a `BUTTON` ([3374-3377](../html/index.html#L3374-L3377)). That was harmless while
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
> **The roster is a data table of predicates** ([2463](../html/index.html#L2463)), each a plain read
> of `state`. There is no event bus: every condition is either something state already holds (the
> combo, the lives, the balls in play) or a counter kept in `state.achStats`
> ([2504](../html/index.html#L2504)) by whichever update function owns the event. That is what lets
> `checkAchievements()` ([5253](../html/index.html#L5253)) run from the ordinary per-frame path
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
> **Per browser, as decided below** — `neonbreak-achievements` ([2543](../html/index.html#L2543))
> holding an array of ids and nothing else, which is what keeps lifetime counters off the roster.
> Everything else is per run and dies with it. `loadAchievements()` ([2595](../html/index.html#L2595))
> drops ids no longer in the roster, so retiring one cannot leave a row nothing can render, and
> storage that throws outright (private browsing) still unlocks and still shows — only remembering
> fails (`#65h`).
>
> **A jumped run earns nothing** (#69), and the screen says so ([863](../html/index.html#L863)) —
> #72's lesson applied before the bug could be written.
>
> **The banner is DOM, not canvas** ([771](../html/index.html#L771)), stacked above the overlays:
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
| First Crack | The first brick of the first run comes apart | — `brickHit()` ([4723](../html/index.html#L4723)) |
| Warm Cabinet | Level 10 is cleared | — `checkLevelClear()` ([4997](../html/index.html#L4997)) |
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
| Chain Reaction | Six or more bricks go up in a single explosive cascade | A count threaded through `explode()` ([4659](../html/index.html#L4659)) |
| Sharpshooter | 25 bricks destroyed by laser bolts in one run | A run counter on the laser hit path ([3217](../html/index.html#L3217)) |
| Three at Once | Three or more balls in play at the same moment | — `state.balls.length` |
| Whack-a-Brick | A regenerating brick is destroyed after coming back at least once | The brick's `regenLeft` against its starting value ([4723](../html/index.html#L4723)) |
| Curiosity | 25 mystery bricks resolved in one run | A run counter in `resolveMystery()` ([4706](../html/index.html#L4706)) |
| Silver Service | 50 silver bricks destroyed in one run | A run counter |
| Discerning | Five levels in a row cleared without catching `narrow` or `fast` | A counter reset in `applyPowerup()` ([4198](../html/index.html#L4198)) |

**IV — the long tail.** Rare by construction. The last one may never be earned by anybody, which is
the point of having it.

| Achievement | Unlocks when | Needs |
|---|---|---|
| Immortalised | A run lands on the hall of fame | — `qualifiesForHallOfFame()` ([5090](../html/index.html#L5090)) |
| World Class | A run lands on the *global* board (#67) | The API's answer — so it can only ever unlock when the network answered, which is worth saying out loud rather than looking like a bug |
| Six Figures | A run ends on 100,000 or more | — `endGame()` ([5045](../html/index.html#L5045)) |
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
  ([2550](../html/index.html#L2550)), so unlocks work for the session and are never remembered. That
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
  field on `state` ([2739](../html/index.html#L2739)) read by a per-frame function, and an emitter
  layer would be the only place in the game where control flows the other way. A single
  `checkAchievements()`, called where `updateHud()` already is ([5336](../html/index.html#L5336))
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
  four existing keys ([2539](../html/index.html#L2539)) — per browser, per the section above, and
  **`neonbreak-`, not `blokrush-`**: the namespace is asserted by `persistence.js` precisely so it
  does not get tidied up. Everything above
  is either a run counter (thrown away with the run) or an unlocked id, so the file is an array of
  strings and nothing else. That is what keeps lifetime counters off the roster: they would mean
  writing to storage on every silver brick, and the alternative — batching the flush — is a whole
  consistency problem for a feature nobody asked to be exact. Being parsed rather than read raw, it
  needs `loadHallOfFame()`-style shape validation ([2576](../html/index.html#L2576)): an array of
  strings, unknown ids dropped on load, so retiring an achievement later cannot corrupt the file.
- **The display surface is #73's, twice over.** A new `achievements` phase in `PHASE_OVERLAY`
  ([3300](../html/index.html#L3300)) with its own overlay, opened through the `state.returnPhase`
  pattern `viewHallOfFame(from)` ([3524](../html/index.html#L3524)) just generalised, from the start
  screen and both end screens. Locked entries should show their condition rather than a row of
  question marks: a goal nobody can read is not a goal.
- **The toast is `spawnFloatingText()` moved** ([2996](../html/index.html#L2996)) — the same idea
  pinned to a screen position instead of to a brick. Two things it must get right: several
  achievements can unlock in the same frame, so it is a queue rather than overlapping toasts; and it
  respects `prefers-reduced-motion` like every other moving thing (#58).
- **Forty strings, in both tables.** Twenty names and twenty conditions, in `STRINGS.fr`
  ([2130](../html/index.html#L2130)) and `STRINGS.en` ([2273](../html/index.html#L2273)). The `i18n`
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
> ([3982-4024](../html/index.html#L3982-L4024)). Eight bars is ~15 seconds against 1.8, which is most
> of the perceived fix on its own. `MUSIC_FORM` ([3986](../html/index.html#L3986)) is the other half:
> one degree of the act's scale per bar, transposing every voice together, so the phrase has harmony
> and not just rhythm. `scheduleStep()` took a `bar` argument
> ([4060-4082](../html/index.html#L4060-L4082)) and is otherwise the function it was — the change is
> to the data table, exactly as the write-up below predicted.
>
> **Percussion.** A kick on every bar whatever the combo, and a hat bought with the first combo tier
> ([4031-4047](../html/index.html#L4031-L4047)). That is what lets the melodic voices drop out of a
> bar without the bed falling apart, which is what stops a loop sounding like a loop. The kick is a
> pitch drop and so is still an oscillator; the hat is filtered noise, and `noise()`
> ([3751](../html/index.html#L3751)) over a cached buffer ([3738](../html/index.html#L3738)) is the
> one piece of genuinely new audio machinery here. The buffer is filled from `seededRandom()`, never
> `Math.random()` — see below.
>
> **Material per act.** `MUSIC_ACTS` ([3793-3804](../html/index.html#L3793-L3804)) gives each of #60's
> five acts its own scale, its own tempo and its own timbre for every voice, keyed off the same
> `THEME_LEVELS` the backdrop uses — so the score turns over exactly when the field does. Act I is the
> bed #59 shipped, unchanged. `CONFIG.music.tempo` stays the single knob that moves everything: an act
> scales it rather than replacing it ([3809](../html/index.html#L3809)). Every scale is five notes, so
> the combo ladder is the same length in all of them ([3815](../html/index.html#L3815)) — it now reads
> the act's scale too, which is what keeps a brick hit in tune with the bed behind it.
>
> **`musicBar` lives outside `music`** ([4058](../html/index.html#L4058)). The bed stops on every
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
([3982](../html/index.html#L3982)) and `updateMusic()` advances `music.step` modulo it
([4099-4119](../html/index.html#L4099-L4119)), so at `CONFIG.music.tempo` 132 a step is
`60 / 132 / 4` = 0.114 s and the whole loop is **1.8 seconds long**. A single level is minutes of the
same two seconds, and #41 made a full run a hundred levels.

Nothing else varies enough to cover for that:

- **The material never changes.** `MUSIC_VOICES` ([3991-4024](../html/index.html#L3991-L4024)) is
  four fixed voices with fixed `steps` arrays. What combo buys is *which voices sound*
  (`nextIntensity`, [4086-4093](../html/index.html#L4086-L4093)) — four states of the same bar, not
  four different bars.
- **Per-level variation is transposition only.** `musicRoot()` picks a root from ten keys by
  `state.levelIndex % 10` ([3780-3781](../html/index.html#L3780-L3781)), so level 11 is level 1 again
  in the same key, and a 100-level run cycles those ten keys ten times.
- **One scale and one tempo for the entire game** — `MUSIC_SCALE` is a single minor pentatonic
  ([3795](../html/index.html#L3795)) and `tempo` is one number in `CONFIG.music`
  ([1595-1601](../html/index.html#L1595-L1601)).
- **There is no percussion at all.** Four pitched voices carry both the harmony and the pulse, which
  is why the pulse has to be so regular.

Loop *length* is most of the perceived fix, well ahead of harmonic sophistication. Getting from a
1.8-second loop to a phrase of ten or fifteen seconds would do more than any amount of cleverness
inside the current bar.

Also worth watching: `scheduleStep()` creates a gain node and an oscillator per note
([3705-3718](../html/index.html#L3705-L3718)), so a denser arrangement is more allocation per bar. It
is queued in `lookahead` batches rather than per frame, so this is not a per-frame cost, but a
percussion voice on every step is 16 more nodes a bar than the current busiest voice.

### 71. ✅ FIXED — Losing a ball deserves an animation and a sting (S/M)

> **Fixed 2026-08-15.** The ball draining off the bottom now bursts, sounds, and — the part that made
> the rest possible — takes a moment.
>
> **The beat.** `loseLife()` ([4927-4950](../html/index.html#L4927-L4950)) no longer transitions; it
> sets `state.lifeLost = {remaining, ended}` and moves to a new `lifelost` phase
> ([3324](../html/index.html#L3324)), which `frame()` spends a frame at a time
> ([5812-5815](../html/index.html#L5812-L5815)) before calling `finishLifeLost()`
> ([4955-4964](../html/index.html#L4955-L4964)) — the other half of the old function, serving again or
> ending the run. `CONFIG.impact.lifeLostBeat` is 0.7 s
> ([1627](../html/index.html#L1627)). Making it a phase rather than a counter checked beside the
> phase machine is what keeps the rest honest: `lifelost` shows no overlay (so the field stays
> visible), nothing simulates during it because `frame()` only runs the update block on `playing`,
> and the transition still goes through `setPhase()`.
>
> `ended` is decided when the ball is lost, not when the beat runs out, so a life spent on the last
> ball still ends the run even if something else changes `state.lives` in between.
>
> **The burst** is two calls ([4941-4942](../html/index.html#L4941-L4942)): white for the ball coming
> apart, the way every brick burst is its own colour, and red for the life indicator that just went
> out — which is the part the player actually has to read. It is pinned to the bottom edge at the
> ball's last x ([4917](../html/index.html#L4917)), because by the time `loseLife()` runs the ball is
> already 30 px below the canvas and a burst down there is a burst nobody sees. Particles already
> keep updating outside `playing`, so this needed no new draw path.
>
> **The sting** ([3864-3883](../html/index.html#L3864-L3883)) is four notes falling through the
> level's own scale, pitched from `musicRoot()` like everything else in #59 — that is the difference
> between a sting and a buzzer — and placed against the audio clock rather than fired as four
> `beep()`s at frame time, which would put each note wherever its frame happened to fall. The last
> note is a long sawtooth sliding a fifth under the others, and it rings on past the beat into the
> "Ready?" screen. `audioCtx()` returns null when muted, which is the whole guard.
>
> **`prefers-reduced-motion` changes the visuals and not the pacing.** The shake stays suppressed and
> `burst()` thins itself out as it already did, but the beat is deliberately *not* conditional
> ([1620-1627](../html/index.html#L1620-L1627)): it is pacing, not motion, and #58's rule is that the
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
> `gameover` each carry a `.run-flag` line ([815](../html/index.html#L815),
> [831](../html/index.html#L831)) filled from one new string, `run.jumped`
> ([2156](../html/index.html#L2156), [2299](../html/index.html#L2299)), which says both halves of it:
> the run is out of the hall of fame, and playing again gives an eligible one.
>
> It is written in `renderDynamicText()` ([3433-3435](../html/index.html#L3433-L3435)) rather than in
> `endGame()`, which is where every other conditional string is already rebuilt from state — so it
> also follows a mid-game language switch, and `newGame()` clearing `state.jumped` clears the line
> with it without anyone having to remember to. Both overlays get it because a jumped run that clears
> level 100 reaches `victory`, not `gameover`. Empty on an ordinary run, and `.run-flag:empty`
> ([419](../html/index.html#L419)) takes the element out of the layout entirely so the end screens are
> unchanged for everyone else.
>
> **The prompt's warning now reads as one.** `.jump-warn` ([476](../html/index.html#L476)) was 11px
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
([5058](../html/index.html#L5058)) and `maybeSaveBest()` ([4973](../html/index.html#L4973)). The
effect, on two runs identical apart from the shortcut:

| | Without S+E+B | With S+E+B |
|---|---|---|
| Score at death | 30 | 30 |
| What the player gets | `nameentry` → `halloffame` | `gameover`, immediately |

**The rule stays** — the world board can never be reset (#67) and brick value saturates toward 20×
(#41), so jumping to level 90 would otherwise be the cheapest high score in the game. The defect is
that nothing says it happened. The only notice is one line of 11px dim text on the jump prompt
([1002](../html/index.html#L1002), `.jump-warn` at [476](../html/index.html#L476)), read once, several
minutes before it matters. By the time the run ends the player has forgotten it — and the observed
behaviour is indistinguishable from the hall of fame being broken, which is exactly how it got
reported.

It is also the developer's own testing tool that disables the feature they are most likely testing.

### 73. ✅ FIXED — A "high scores" button on the end screens (S)

> **Fixed 2026-08-16.** `overlay-victory` and `overlay-gameover` each gained a secondary
> `btn-ghost` button beside the restart one ([821](../html/index.html#L821),
> [834](../html/index.html#L834)), so the board is reachable from the screen a run just ended on
> instead of costing a restart that replaces the score you wanted to compare against.
>
> The three entry points now share `viewHallOfFame(from)` ([3524-3528](../html/index.html#L3524-L3528))
> rather than repeating #43's three lines twice more. That is what keeps `state.returnPhase`
> honest: it is only ever meaningful because every route into `halloffame` sets it, and a route that
> forgot would send `setPhase(null)`. Re-rendering before the transition is not decoration either —
> the run that just ended may have changed the board, and the world list can have been swapped in
> underneath it (#67).
>
> **Restart stays the primary control.** `PHASE_OVERLAY` ([3369-3370](../html/index.html#L3369-L3370))
> still focuses `btn-restart` / `btn-restart-win`, per #26's rule that each overlay focuses its own
> call to action; `#73a`/`#73b` assert the new button does not take it.
>
> **`start.viewHof` became `hof.view`** ([2141](../html/index.html#L2141),
> [2284](../html/index.html#L2284)) across both tables and all three markup sites. The text was
> already right for all three screens — the key was the part that would have gone stale, naming one
> screen while appearing on three.

Losing a run leaves only "Rejouer". The board is reachable from the start screen (#43,
[782](../html/index.html#L782)) but not from the two screens where a player has just finished a run
and most wants to see where it landed — so checking costs a restart, and the score you wanted to
compare against is the one you just replaced on screen.

Add a secondary button to `overlay-gameover` ([826-837](../html/index.html#L826-L837)) and
`overlay-victory` ([808-824](../html/index.html#L808-L824)) beside the existing restart button.

Who it is actually for: a *qualifying* run already passes through the board on the way out, since
`endGame()` detours through `nameentry` → `halloffame`. So the button mostly serves runs that did not
qualify, plus anyone wanting a second look after the detour — and it is the only route to the board
for a jumped run (#69/#72), which never gets the detour at all.

### 44. ✅ FIXED — Ten boss levels, one at every level ending in 0 (L)

> **Fixed 2026-08-17.** Levels 10, 20, … 100 are no longer brick grids — each is one of ten bosses
> (`BOSSES`, [1776-2085](../html/index.html#L1776-L2085)), fought inside the ordinary `playing` phase
> rather than a new one. `isBossLevel(idx)` ([1246](../html/index.html#L1246)) and `bossDefIndex(idx)`
> ([1248](../html/index.html#L1248)) are the two predicates everything else is built from;
> `levelDef()` ([1448](../html/index.html#L1448)) routes a boss level through `bossLevelDef()`
> ([1440](../html/index.html#L1440)), which returns the same `{ rows, speed }` shape every other
> source does, plus a `boss` field — so `buildLevel()` ([2867](../html/index.html#L2867)) and
> `resetPaddleAndBall()` ([2909](../html/index.html#L2909)) needed only a few lines each, and no
> other caller learned what a boss is.
>
> **A boss is one or more rectangular "parts."** Almost always the whole visible body; Carapace's six
> plates and core, Gemini's two halves and Omega's three phases are the exceptions. A part is exactly
> the `{x,y,w,h}` shape a brick or the paddle already is, so collision reuses
> `circleRectCollide`/`brickPenetration`/`resolveBrickCollision` unchanged — `updateBalls()`'s brick
> loop just gained an `else` branch (`hitTestBossPart`, [4454](../html/index.html#L4454)) for when no
> ordinary brick was hit. Damage goes through `bossPartHit()`
> ([4485](../html/index.html#L4485)): a hit on a part that is solid but not currently vulnerable
> (Aegis' deflector up, a Carapace/Omega plate still guarding the core) bounces the ball and reads on
> screen without scoring, the same way Phantom's fade skips collision entirely instead
> (`part.solid = false`).
>
> **Two hazard shapes.** `spawnBossShot()`/`updateBossShots()`
> ([4557](../html/index.html#L4557)) is a small projectile system aimed at the paddle instead of up
> from it — reusing the same `onPaddle` effect names (`narrow`, `narrow5`, `life`) `applyBossHazard()`
> ([4537](../html/index.html#L4537)) applies through the existing `widthEffect`/`lives` state every
> other hazard already goes through. `spawnMinion()`/`updateMinions()`
> ([4648-4683](../html/index.html#L4648-L4683)) is a small enemy the ball can destroy in flight,
> kept as its own array rather than flagged bricks (the original sketch in `feature-ideas.md`) —
> `brickHit()`'s combo/score/drop/achievement bookkeeping does not apply to a minion, and duplicating
> it inline would have been the second scoring system #65 explicitly rules out.
>
> **The boss is the only thing that gates level completion on one of these levels.**
> `buildLevel()`'s brick loop never counts an arena's cover bricks toward `remainingBricks` when
> `def.boss` is set, so `checkLevelClear()` ([4997](../html/index.html#L4997)) only needed one added
> branch — `if (state.boss) { if (!state.boss.dead) return; }` — ahead of its existing
> `remainingBricks` check, and #16's "a counter, not a scan" invariant holds for both. Boss hit points
> live on `state.boss`, untouched by `resetPaddleAndBall()`, so they survive a lost ball exactly as
> planned; only `state.bossShots`/`state.minions` clear per life, alongside drops and lasers.
>
> **Arenas are ordinary levels.** `bossArena()` ([1774](../html/index.html#L1774)) prepends four blank
> rows to whatever cover bricks a boss wants — four rather than the two first tried, because Carapace's
> core (bottom `y=130`) and Omega's descent both overshoot a two-row band, and a full-width cover row
> that physically overlaps the boss silently wins the collision the boss was supposed to. The escalation
> from empty arenas to full fields matches the roster below.
>
> **Omega is the composite**, not a fourth new mechanic: `spawnOmegaPhase()`
> ([2089-2118](../html/index.html#L2089-L2118)) rebuilds `b.parts` for whichever of Carapace's
> plates-and-core, blinking Aegis-lite halves, or a tracking-and-descending body is next, and
> `onDepleted()` gates the transition behind a 1.5s invulnerable roar (`b.transition`, ticked centrally
> in `updateBoss()`, [4351](../html/index.html#L4351)) rather than a new phase-machine entry — #18's
> lesson applied rather than relearned. The third phase's defeat reaches `bossDefeated()`
> ([4462](../html/index.html#L4462)) exactly like every other boss's, so `checkLevelClear()` needed no
> special case for the campaign's last level.
>
> **Score parity via one constant, not per-boss tuning.** Every vulnerable hit scores
> `BOSS_HIT_BASE` ([1762](../html/index.html#L1762)) × `levelMultiplier(n)` × the same combo
> multiplier `brickHit()` uses — a boss hit continues the existing combo streak — plus a flat
> `killBonus` per boss (400 → 4000) on defeat.
>
> **Retiring the authored level 10.** `LEVELS` ([1117](../html/index.html#L1117)) dropped from ten
> entries to nine; `levelSpeed()`/`levelMultiplier()` re-anchor on it automatically since both already
> read `LEVELS.length` rather than a literal. `generateLevel()`'s escalation counter needed
> `layoutIndex(idx)` ([1258](../html/index.html#L1258)) — the ordinal of a level among the non-boss
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
> the instant `playing` does, with a `CONFIG.boss.fireGrace` ([1666](../html/index.html#L1666))
> delaying only the first hazard — the name-and-hp strip `drawBoss()`
> ([5563](../html/index.html#L5563)) draws every frame is what tells the player this level is
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
> **`bossDefeated()`** ([4462](../html/index.html#L4462)) no longer clears the level itself — it
> starts `state.boss.deathBeat` and returns. **`updateBossDeathBeat()`**
> ([4484-4516](../html/index.html#L4484-L4516)) drives everything from there, in two stages:
>
> - **`"explode"`** ([4459](../html/index.html#L4459): `BOSS_EXPLODE_DURATION`, 0.9s) — silent.
>   Escalating particle pulses (bigger and more frequent for a bigger boss, via `b.defIdx`) every
>   0.12s, ending in one big finishing blast — two layered `burst()` calls (the boss's colour, then a
>   white flash) and a shake, both scaled with `b.defIdx` exactly as the reverted attempt already had
>   right. That blast is also where the fanfare starts.
> - **`"fanfare"`** ([4460](../html/index.html#L4460): `BOSS_FANFARE_DURATION`, 5.0s) — holds until
>   the fanfare finishes, then clears `deathBeat` and calls `checkLevelClear()` itself, which is what
>   actually shows "level cleared".
>
> **`checkLevelClear()`** ([5117](../html/index.html#L5117)) gained one more clause in its existing
> boss guard — `if (!state.boss.dead || state.boss.deathBeat) return;` — defensive rather than the
> only thing enforcing the order, since `frame()` never calls it while a beat is running in the first
> place (below).
>
> **`frame()` freezes the field while the beat plays**, the same idea #71's lost-ball beat already
> applies to a shorter pause: `inDeathBeat` ([5926](../html/index.html#L5926)) skips
> `updatePaddle`/`updateBricks`/`updateBoss`/`updateBalls`/`updateDrops`/`updateLasers`/
> `updateBossShots`/`updateMinions` entirely and runs `updateBossDeathBeat()` plus particles/floating
> text instead — the paddle stops answering, the ball stops moving, and nothing is left to hit
> anyway. That is also what makes "silent" literal: nothing schedules a note until the fanfare's own
> call does.
>
> **The fanfare itself: 5 seconds, not 10, and several instruments rather than one melodic line.**
> `BOSS_FANFARE` ([3905-3953](../html/index.html#L3905-L3953)) plays a rising call twice (an octave
> apart), a quick descending flourish, then a four-note chord that rings out — but every "call" hit
> now layers three things at once: the sawtooth melody, the same call doubled an octave down
> (`withBass`) for weight, and a triangle third above (`withPad`, detuned for shimmer) for harmony —
> plus the exact kick (`freq:110, slide:38, sine`) and hat (`noise({freq:7000})`) recipes
> `MUSIC_DRUMS` already uses for the ordinary bed, so the fanfare sounds like it belongs to the same
> score rather than a separate jingle landing on top of it. `scaleSemi()`
> ([3820](../html/index.html#L3820), factored out of `ladderSemi()`) still keeps every pitch in tune
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
> **Fixed 2026-08-18.** `submitHallOfFameName()` ([5177-5210](../html/index.html#L5177-L5210)) now
> rejects a trimmed name shorter than `CONFIG.hallOfFame.nameMin` (3,
> [1655-1660](../html/index.html#L1655-L1660)) outright instead of substituting the `"???"`
> placeholder — the phase stays on `nameentry`, nothing is written to either board, and an inline
> message (`nameentry.error`, [846-849](../html/index.html#L846-L849) for the markup) explains why,
> the same shape #69's level-jump prompt already established for a rejected entry. The maximum moved
> from 12 to 16 characters, `nameMax` and the input's `maxlength` kept in sync as before, and `NAME_MAX`
> in [functions/api/scores.js](../functions/api/scores.js#L21) was raised to match — it re-clamps
> independently of the client and had silently stayed at 12, which would have truncated a 13-16
> character name on the global board while showing it in full on the local one.
>
> The submit button and the input's Enter handler ([3114](../html/index.html#L3114)) both route
> through `submitHallOfFameName()`, so fixing validation there closes both paths at once — no separate
> Enter-key fix was needed. `state.nameEntryError`
> ([2814-2817](../html/index.html#L2814-L2817)) is the flag driving the message, reset whenever
> `endGame()` opens the prompt ([5060](../html/index.html#L5060)) so a stale rejection from a previous
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
> ([5123-5169](../html/index.html#L5123-L5169)) are new in `index.html`, and `PROFANITY_LIST`/
> `normalizeForProfanity()`/`filterProfanity()` ([124-166](../functions/api/scores.js#L124-L166)) mirror
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
> ([5177-5210](../html/index.html#L5177-L5210)) swaps the name for
> `CONFIG.hallOfFame.fallbackName` (`"Bisounours"`, [1653-1660](../html/index.html#L1653-L1660)) after
> the #76 length check passes, so the player sees no error and the substituted name is what reaches both
> `insertHallOfFameEntry()` and `submitGlobalScore()` — one check covers the name that lands on both
> boards. The server does the same at the equivalent point in `onRequestPost()`
> ([223-225](../functions/api/scores.js#L223-L225)), between `cleanName()` and the insert, so a name
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
> `bossDefeated()`/`updateBossDeathBeat()` ([4537](../html/index.html#L4537)/
> [4563](../html/index.html#L4563)).
>
> **The bed actually stops.** `updateMusic()` ([4170](../html/index.html#L4170)) now gates on
> `state.phase === "playing" && !inDeathBeat` instead of the phase alone, computing `inDeathBeat`
> itself rather than trusting a caller to pass it — the death beat deliberately stays in `"playing"`
> (no paddle/ball to freeze around otherwise), and that was exactly the gap the old single-condition
> gate fell through.
>
> **The explosion is anchored on the boss, not the screen.** `bossBounds(b)`
> ([4521-4529](../html/index.html#L4521-L4529)) unions every part's `{x,y,w,h}` regardless of `alive`
> — a dead part keeps its geometry, only its flags change — and `bossDefeated()` snapshots it once
> into `deathBeat.bounds`, valid for the whole beat since `updateBoss()` does not run while it plays.
> Both the escalating pulses and the finishing blast in `updateBossDeathBeat()` scatter across that
> box instead of `GAME_W / 2, GAME_H / 2`.
>
> **A distinct look for the occasion.** `fireBurst()` ([2999-3011](../html/index.html#L2999-L3011)) is
> `burst()`'s warm-flame counterpart — a fixed warm palette instead of the caller's color, shorter
> life, and a `glow` flag `drawParticles()` ([5818-5832](../html/index.html#L5818-L5832)) picks up as
> a shadow-blur halo — used for both the pulses and the finishing blast in place of a plain `burst()`
> call. `spawnLightning()`/`drawLightning()`
> ([3018-3029](../html/index.html#L3018-L3029)/[5837-5853](../html/index.html#L5837-L5853)) add a
> handful of jagged, multi-segment bolts (more for a bigger boss) radiating from the boss's center on
> the finishing blast only — the midpoints are displaced off the straight line between the two ends,
> tapering to none at the ends, so a bolt still lands on its target rather than reading as a laser.
>
> **The blast has its own sound.** `bossExplosionSound()`
> ([4016-4023](../html/index.html#L4016-L4023)) layers a lowpass rumble, a highpass crack and a short
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

> **Fixed 2026-08-19.** `state.fireballEffect` ([2769](../html/index.html#L2769)) is a fifth timed
> effect alongside `widthEffect`/`speedEffect`/`stickyEffect`/`laserEffect` — the same `{remaining}`
> shape as `laserEffect`, decayed in `updateEffects()` ([4232-4234](../html/index.html#L4232-L4234)),
> cleared on every fresh life in `resetPaddleAndBall()` ([2915](../html/index.html#L2915)), and granted
> by a new `fireball` row in `POWERUPS` ([1468](../html/index.html#L1468), weight 2 like `laser`'s) and
> a branch in `applyPowerup()` ([4284-4286](../html/index.html#L4284-L4286)).
>
> The single-hit-per-frame rule (#10) turned out not to need reworking, just a branch inside it. The
> existing pick-the-least-penetrated-brick loop in `updateBalls()`
> ([5000-5022](../html/index.html#L5000-L5022)) now short-circuits per iteration: while
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
> The one purely cosmetic addition: `drawBalls()` ([5765-5781](../html/index.html#L5765-L5781)) reads
> `state.fireballEffect` once per frame and swaps every ball's fill/glow to a flame palette while it's
> active, so a fireball ball reads as different from an ordinary one even mid-bounce. A fifth
> `.effect-bar` slot (`bar-fireball`, [1027-1029](../html/index.html#L1027-L1029)) and its
> `updateEffectBar()` call in `renderEffectBars()` ([5518-5519](../html/index.html#L5518-L5519)) show
> the timer; `.effect-bars`' reserved `height` ([236-248](../html/index.html#L236-L248)) grew from 38px
> (two wrapped rows, the worst case for four bars) to 60px (three wrapped rows, the worst case for
> five — the narrowest supported viewport only fits two 90px-basis bars per row). `powerup.fireball` was
> added to both `STRINGS` tables ([2257](../html/index.html#L2257) fr,
> [2400](../html/index.html#L2400) en).
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

> **Fixed 2026-08-19.** `nextIntensity()` ([4143-4152](../html/index.html#L4143-L4152)) now computes
> `progress = 1 - state.remainingBricks / state.levelBrickTotal` and walks
> `CONFIG.music.voiceProgress` ([1598](../html/index.html#L1598)) — `[0.4, 0.7, 0.9]` — instead of
> reading `state.combo` against combo-count thresholds, so the arrangement builds toward the last few
> bricks whether or not the player is on a streak. `buildLevel()` keeps the starting count in a new
> `state.levelBrickTotal` alongside the live `state.remainingBricks`
> ([2895-2900](../html/index.html#L2895-L2900)), set once per level and never touched again — the
> denominator progress reads. `voiceDecay` is unchanged: a voice still arrives the instant progress
> earns it and leaves only that fast, so a brick regenerating (`R`) eases the arrangement back down
> over a second or so rather than yanking a voice out the moment `remainingBricks` ticks up.
>
> **Boss levels read `state.boss` instead.** `spawnBoss()`
> ([4401-4416](../html/index.html#L4401-L4416)) now snapshots the fight's starting hp into
> `b.hpTotal`, summed over the parts `spawn()` just built. `bossProgress()`
> ([4423-4430](../html/index.html#L4423-L4430)) reads that against the parts currently standing —
> `1 - (sum of remaining hp) / hpTotal` — and `nextIntensity()` branches on `state.boss` before
> falling back to the brick-based fraction, the same guard `checkLevelClear()` already uses to treat a
> boss level as a special case. Taking `hpTotal` as a fixed snapshot rather than a running total means
> a boss whose fight adds parts mid-way (a split enemy pushing two new ones onto `b.parts`) dips
> progress the same way a regenerating brick does, eased back up by the same decay rather than jumping
> the target.
>
> **`musicIntensity()`** ([4158](../html/index.html#L4158)) is a new one-line seam accessor, added
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

> **Fixed 2026-08-19.** `LEVEL_CLEAR_FANFARE` ([4017-4056](../html/index.html#L4017-L4056)) reuses
> #74's `BOSS_FANFARE` machinery directly — the same `addMelody(at, step, dur, vol, withBass, withPad)`
> layering a sawtooth call with an octave-down bass note and a third-above triangle pad, plus
> `addKick`/`addHat` reusing the ordinary bed's kick/hat recipes — trimmed to one rising call instead
> of two and no flourish, ending in a short ringing chord: ~2s in total instead of `BOSS_FANFARE`'s
> ~5.5s. `levelClearFanfareTone()` schedules it against `ctxA.currentTime` and resolves every step
> through `scaleSemi()`, the same pattern `bossFanfareTone()` already established, so it stays in the
> level's own scale/act rather than a fixed pitch. Like `LOSS_STING` and `BOSS_FANFARE`, it's always
> the same figure — nothing about it reads `state.combo`, score, or difficulty.
>
> `checkLevelClear()`'s non-boss branch ([5209](../html/index.html#L5209)) calls it right before
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

> **Fixed 2026-08-20.** `state.shieldEffect` ([2770-2774](../html/index.html#L2770-L2774)) is a plain
> armed/not flag, not a `{remaining}` object like every other timed effect — a shield decays by use,
> not by time, so it never enters `updateEffects()`'s countdown loop and has no `CONFIG.effects` entry
> of its own. Granted by a new `shield` row in `POWERUPS` ([1469](../html/index.html#L1469), weight 2
> like `laser`/`fireball`) and a branch in `applyPowerup()`
> ([4370-4372](../html/index.html#L4370-L4372)).
>
> **The save is a single guard** in `updateBalls()`'s existing bottom-loss check
> ([5094-5112](../html/index.html#L5094-L5112)): while `state.shieldEffect` is armed, the ball that
> would have been spliced out is bounced back instead — `ball.y` pinned to the floor, `ball.dy`
> reflected, `state.combo` reset the same way a real paddle touch resets it — and the shield is
> consumed. Only the first ball the `bi` loop (counting down from `state.balls.length - 1`) reaches
> this frame gets saved; any other ball crossing the floor the same frame falls through to the ordinary
> splice below it, the forgiving-but-not-free reading the finding asked for. `resetPaddleAndBall()`
> ([2916](../html/index.html#L2916)) nulls it on every fresh life alongside the other effects, so an
> unused shield never carries over.
>
> **A static badge, not a duration bar.** There is nothing to shrink, so it doesn't reuse
> `.effect-bars`/`renderEffectBars()`. A small shield emoji (`#shield-badge`,
> [749-752](../html/index.html#L749-L752), styled at [209-222](../html/index.html#L209-L222)) sits
> absolutely positioned in the corner of the lives HUD cell, toggled by `updateHud()`
> ([5520-5521](../html/index.html#L5520-L5521)) reading `!!state.shieldEffect` — absolute rather than
> in normal flow so its hidden/shown toggle never changes `.hud-cell.lives`'s height, which the shared
> grid row would otherwise pass on to the other three cells. `powerup.shield` was added to both
> `STRINGS` tables ([2258](../html/index.html#L2258) fr, [2401](../html/index.html#L2401) en) for its
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
> ([1470](../html/index.html#L1470), weight 2 like `laser`/`fireball`/`shield`) but otherwise
> independent of each other, as planned.
>
> **Magnet.** `state.magnetEffect` ([2775](../html/index.html#L2775)) is a normal `{remaining}` timed
> effect — granted in `applyPowerup()` ([4374](../html/index.html#L4374)), counted down in
> `updateEffects()` ([4292-4295](../html/index.html#L4292-L4295)), cleared per life in
> `resetPaddleAndBall()` ([2917](../html/index.html#L2917)) — with its own `.effect-bar` slot
> ([1031-1034](../html/index.html#L1031-L1034), wired into `renderEffectBars()`
> [5585-5586](../html/index.html#L5585-L5586)) since, unlike #54's shield, it decays by time and has
> something to shrink. The bend itself is a new block at the top of `updateBalls()`'s per-ball loop
> ([4975-4990](../html/index.html#L4975-L4990)), gated on `ball.dy > 0` so it only ever touches a
> falling ball: convert the current `dx`/`dy` to an angle with `Math.atan2`, compute the angle toward
> the paddle centre the same way, clamp the difference between them to
> `CONFIG.effects.magnet.turnRate * dt` radians, and convert back with `Math.cos`/`Math.sin` — which
> is what keeps `dx*dx + dy*dy == 1` by construction rather than by discipline, exactly the
> renormalisation the finding called out as the one thing this had to get right.
>
> **Hold-to-slow.** Landed as its own always-available resource rather than folded into
> `updateEffects()` as first sketched — `state.slowMeter`/`slowPointerHeld`/`bulletTimeActive`
> ([2775-2785](../html/index.html#L2775-L2785)) and a dedicated `updateBulletTime()`
> ([4303-4318](../html/index.html#L4303-L4318)), called right before `updateBalls()`
> ([6007](../html/index.html#L6007)) so `ballSpeedMult()` ([2851-2856](../html/index.html#L2851-L2856))
> sees this frame's result. Held via `ShiftLeft`/`ShiftRight` (read directly off `state.keys`, the same
> way `updatePaddle()` already reads the arrow keys) ORed with `state.slowPointerHeld`, which a new
> on-screen button (`#btn-slow`, [1047-1051](../html/index.html#L1047-L1051)) sets on
> mousedown/touchstart and clears on mouseup/mouseleave/touchend/touchcancel
> ([3662-3687](../html/index.html#L3662-L3687)) — and on `window`'s existing `blur` handler
> ([3164](../html/index.html#L3164)), the same alt-tab safety net `state.keys` already gets. The
> button's own fill doubles as the always-visible meter ([700-713](../html/index.html#L700-L713),
> [3690-3696](../html/index.html#L3690-L3696)) rather than a separate element, since nothing else
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

> **Fixed 2026-08-21.** `LEVELS_KEY = "neonbreak-levels"` ([2544](../html/index.html#L2544)) —
> `neonbreak-`, not the `blokrush-` the write-up below anticipated: #82 (the rename) hasn't shipped
> yet, so this follows the namespace `persistence.js` actually asserts today rather than the one a
> still-open finding promises. `loadLevelProgress()`/`saveLevelProgress()`
> ([2623-2636](../html/index.html#L2623-L2636)) store one `{level}` record per level ever cleared —
> not just the highest — following `loadAchievements()`'s guard pattern exactly: anything that isn't
> valid JSON, isn't an array, or holds a non-integer `level` is dropped rather than thrown. `#83`
> (still open) can add a `stars` field to the same records later without a second key.
>
> **The unlock rule** lives in `highestClearedLevel()`/`isLevelUnlocked()`
> ([2640-2654](../html/index.html#L2640-L2654)): level 1 is always open, and any other level is open
> once its predecessor has a record. `recordLevelClear()` ([2659-2665](../html/index.html#L2659-L2665))
> is called from `checkLevelClear()` ([5202](../html/index.html#L5202)) right where the level's clear
> is already settled — before the win/level-clear branch, so the campaign's last level unlocks too —
> and is a no-op if the level already has a record, so replaying an unlocked level never grows a
> second one.
>
> **The overlay is 100 real `<button>` elements, not an `innerHTML`-rendered list** like
> `.hof-list`/`.ach-list` are. The dom-stub test harness never parses `innerHTML` into queryable
> elements — see [dom-stub.js](../test/dom-stub.js) — so a per-row click handler needs a real,
> individually-addressable node to be testable at all. `overlay-levelselect`
> ([878-984](../html/index.html#L878-L984)) authors `level-row-1`..`level-row-100` statically (each a
> plain numbered button, `data-level` for reference), and a single loop wires all 100 once at startup
> ([3593-3605](../html/index.html#L3593-L3605)) rather than re-wiring them on every render.
> `renderLevelSelect()` ([5484-5492](../html/index.html#L5484-L5492)) toggles each row's `textContent`
> (plain number, or a lock glyph in front of it) and native `disabled` state on open — a real disabled
> button rather than a styled-to-look-inert one, so a locked row is also out of tab order and reads as
> unavailable to a screen reader. It is not re-run on a language switch: a row's content isn't
> translatable.
>
> **Reuses #69's boundary rather than inventing one.** `submitLevelJump()` was split to share a new
> `jumpToLevel(idx, preserveRun)` ([3308-3318](../html/index.html#L3308-L3318)) with the new
> `selectLevel()`/`viewLevelSelect()` ([3575-3586](../html/index.html#L3575-L3586)): both set
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
> ([579-591](../html/index.html#L579-L591)) sized to show all 100 at once with no scrolling: cells
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

### 82. ✅ FIXED — Rename `neonbreak-*` to `blokrush-*` (S)

> **Fixed 2026-08-21.** The six `localStorage` keys (`BEST_KEY`, `LANG_KEY`, `MUTED_KEY`, `HOF_KEY`,
> `ACH_KEY`, `LEVELS_KEY` — [2539-2544](../html/index.html#L2539-L2544)) now read `blokrush-*`.
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
