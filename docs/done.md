# Blokrush — Fixed Findings

Target: [blokrush.html](../html/index.html). This is the **done** half of the project's review backlog —
every finding here has shipped. Open items live in [todo.md](todo.md); what shipped in which commit is
tracked in [release-notes.md](release-notes.md). A finding keeps its original number when it moves
from `todo.md` to here, so numbering is shared across both files and never reused — every number from
1 up belongs to exactly one of the two.

Each entry keeps its original write-up (category, effort estimate, the bug as found) with a
`> **Fixed <date>.**` note prepended describing what shipped — a historical record, not a live TODO.

**Status:** 56 findings fixed — every finding raised so far. See [todo.md](todo.md).

**Line references below are re-anchored after each round of fixes** — they are only valid against the
current `index.html`.

---

## A. Correctness bugs

### 1. ✅ FIXED — No `<!DOCTYPE html>`, no `<meta charset="utf-8">` (S)
> **Fixed 2026-08-12.** The file now opens with `<!doctype html>` / `<html lang="fr">` and a real
> `<head>` carrying `<meta charset="utf-8">`, a viewport meta, and a `<title>`, with the markup
> wrapped in `<body>` — see [1–7](../html/index.html#L1-L7),
> [578–579](../html/index.html#L578-L579), [3654–3655](../html/index.html#L3654-L3655).

The file previously began directly with `<style>`, with no doctype, `<html>`, `<head>`, `<title>`,
charset, viewport, or `lang` attribute. Two real consequences:

- **Quirks mode.** Without a doctype the browser rendered in quirks mode, changing box-model and
  inline-layout behaviour.
- **Encoding.** The file contains raw UTF-8 accented text (`Détruisez` [623](../html/index.html#L623),
  `Prêt ?` [631](../html/index.html#L631), `Bougez` [632](../html/index.html#L632)). With no charset
  declared, a browser opening this over `file://` or a server that didn't send `charset` would fall
  back to windows-1252 and render `DÃ©truisez`.

### 2. ✅ FIXED — `localStorage` access was unguarded, one throw killed the entire game (S)
> **Fixed 2026-08-12.** Reads and writes now go through `loadBest()` / `saveBest()`
> ([1451–1465](../html/index.html#L1451-L1465)), both wrapped in `try/catch`, with the best score
> degrading to in-memory only. Call sites: [1562](../html/index.html#L1562),
> [3113](../html/index.html#L3113).

`localStorage.getItem(BEST_KEY)` was read at IIFE top level while constructing `state`. In Safari
private browsing, with cookies/site-data disabled, or in some sandboxed `file://` contexts,
`localStorage` access **throws** — which aborted the whole IIFE and rendered a dead canvas with no
error visible to the player.

### 3. ✅ FIXED — Held keys stuck when the window lost focus (S)
> **Fixed 2026-08-12.** A `blur` handler now clears every held key —
> [1868–1874](../html/index.html#L1868-L1874).

`keydown` sets `state.keys[e.code] = true` [1826](../html/index.html#L1826) and only `keyup` cleared it
[1867](../html/index.html#L1867). Alt-tabbing (or hitting a browser shortcut) while holding <kbd>→</kbd>
meant the `keyup` was never delivered — on return the paddle slid into the wall and stayed pinned
until the key was pressed and released again.

### 4. ✅ FIXED — Power-up timers kept running while the game was paused (S)
> **Fixed 2026-08-12.** Effects now carry a `remaining` duration in seconds instead of an absolute
> `until` deadline, and `updateEffects(dt)` decrements it from the frame delta — which the loop only
> feeds while the phase is `playing`. See [2669–2680](../html/index.html#L2669-L2680), the effect
> durations each `remaining` starts from in `CONFIG.effects`
> ([1187–1194](../html/index.html#L1187-L1194), added by #21, since extended by #30), and the call site at
> [3617](../html/index.html#L3617).
> Verified: a `widen` survives a 30-second pause intact, then expires after its full 10 seconds of
> actual play.

`widthEffect` / `speedEffect` stored an absolute `until` timestamp from `performance.now()` and were
compared against the rAF `now`. Pausing for 20 seconds silently burned a 10-second "widen". Counting
in accumulated play time also makes the timers immune to tab-throttling and clock adjustments.

### 5. ✅ FIXED — Game did not auto-pause when the tab was hidden or the window blurred (S)
> **Fixed 2026-08-12.** `autoPause()` ([1876–1884](../html/index.html#L1876-L1884)) pauses whenever the
> phase is `playing`, wired to both `visibilitychange` and the existing `blur` handler from #3
> ([1871–1874](../html/index.html#L1871-L1874)). It deliberately only fires *on* hide/blur, never on
> return, so the player resumes explicitly.

There was no `visibilitychange` handler. `requestAnimationFrame` throttles in a background tab, and
`dt` is clamped to 33 ms [3583](../html/index.html#L3583), so the game didn't *jump* — but it stayed in
the `playing` phase, so power-up timers kept expiring (see #4) and returning to the tab dropped you
straight back into live play with no warm-up.

### 6. ✅ FIXED — `e.preventDefault()` on Space blocked button activation (S)
> **Fixed 2026-08-12.** The Space branch is now guarded by `isButtonFocused()` (renamed to
> `isTypingTarget()` and widened to cover text inputs too by #42, [1811–1815](../html/index.html#L1811-L1815),
> used at [1857](../html/index.html#L1857)): when a `<button>` holds focus the key is handed back to the
> browser, so it activates the button instead of launching the ball.
>
> This needed a companion fix. The deck's pause/mute buttons stay on screen and keep focus after a
> mouse click, so the guard alone would have made Space toggle pause instead of launching. A
> `blurIfPointerClick` helper ([2243–2248](../html/index.html#L2243-L2248)) drops focus after pointer
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
> alongside the existing pointer-release logic — [1849–1856](../html/index.html#L1849-L1856). Applied to
> all four movement codes (`ArrowLeft`/`ArrowRight`/`KeyA`/`KeyD`) rather than singling out the arrow
> keys, since suppressing the letter keys too is harmless and keeps them behaving identically.

`ArrowLeft`/`ArrowRight` are read but never `preventDefault`ed. On a narrow viewport where the cabinet
overflows, steering the paddle also scrolls the document under it.

### 8. ✅ FIXED — `mousedown` launches the ball on any button, including right-click (S)
> **Fixed 2026-08-13.** The handler now takes the event and returns early unless
> `e.button === 0` — [1891–1894](../html/index.html#L1891-L1894).

`canvas.addEventListener("mousedown", handleLaunchOrResume)` had no `e.button` check. Right-clicking
or middle-clicking to open a context menu launched the ball.

### 9. ✅ FIXED — Ball–paddle collision teleported the ball on side hits (M)
> **Fixed 2026-08-13.** The ball's `y` from before the frame's own movement is captured as `prevY`
> [2972](../html/index.html#L2972). A paddle collision is only resolved as a top-face bounce — steering
> by offset and snapping onto the top — when `prevY` was already above the paddle top
> [3015–3023](../html/index.html#L3015-L3023); otherwise it resolves as a side hit that reflects only
> the horizontal component and repositions the ball beside the paddle, the same treatment a brick's
> side face gets [3025–3033](../html/index.html#L3025-L3033). Paddle-velocity spin was left for a
> separate pass — out of scope for the teleport itself.

Any `circleRectCollide` with `dy > 0` snapped `ball.y = pr.y - ball.r - 0.5`, i.e. onto the top of the
paddle. A ball clipping the paddle's *side* while descending past it got warped upward and re-served,
which read as a phantom save.

### 10. ✅ FIXED — Only one brick collision was resolved per ball per frame, chosen by array order (M)
> **Fixed 2026-08-13.** The bricks loop no longer resolves against the first overlap it finds. It now
> scans every alive brick the ball overlaps, scores each with `brickPenetration()`
> [2936–2945](../html/index.html#L2936-L2945) — the smaller of the two axis overlaps, i.e. how shallow
> the intrusion is — and resolves against whichever brick has the smallest penetration
> [3036–3054](../html/index.html#L3036-L3054). Array order no longer has any say in which face gets hit.

The loop broke after the first overlapping brick. Bricks are stored top-row-first, so when a ball
overlapped two adjacent bricks in a corner, it always bounced off the *upper* one regardless of which
face it actually struck. Visible as occasional wrong-direction ricochets in the dense levels 4–5.

### 11. ✅ FIXED — Drop hitbox (8 px) didn't match the drawn capsule (10 px) (S)
> **Fixed 2026-08-13.** `updateDrops`'s hit test now uses the same 10px radius `drawDrops` renders the
> capsule with — [2768–2769](../html/index.html#L2768-L2769) vs. the `arc(0, 0, 10, …)` at
> [3506](../html/index.html#L3506).

`updateDrops` tested `± 8` while `drawDrops` rendered `arc(0,0,10,…)`. Power-ups visually clipped the
paddle without being collected.

### 12. ✅ FIXED — Multi-ball could spawn balls aimed straight down (S)
> **Fixed 2026-08-13.** The clone angle is derived from the source ball's angle mirrored upward when
> it's descending, then spread symmetrically to either side — [2744–2748](../html/index.html#L2744-L2748).
> A source ball travelling straight down used to produce two clones that were also both descending and
> usually lost within a second; now every clone starts with a negative `dy`.

The clone angle was `atan2(base.dy, base.dx) ± 0.6`. If the source ball was descending, both clones
were also descending, making "M" feel like a dud.

### 13. ✅ FIXED — Best score was only persisted at game over (S)
> **Fixed 2026-08-13.** The `state.score > state.best` check and `saveBest()` call are now behind a
> shared `maybeSaveBest()` helper [3103–3111](../html/index.html#L3103-L3111), called from
> `checkLevelClear()` [3119](../html/index.html#L3119) as well as `endGame()`
> [3135](../html/index.html#L3135). Progress is now checkpointed at every level clear, not just at the
> end of the run.

`endGame` was the only caller of `saveBest()`. Closing the tab mid-run — including after clearing four
levels — lost the score entirely.

---

## B. Performance

### 14. ✅ FIXED — `getComputedStyle(document.body)` called per drop, per frame (S)
> **Fixed 2026-08-13.** The font string is now built once into a module-level `DROP_FONT` constant
> [1150](../html/index.html#L1150); `drawDrops` just assigns it — [3509](../html/index.html#L3509). The
> body's font never changes at runtime, so there was nothing to gain from recomputing it 60 times a
> second.

`getComputedStyle(document.body)` was called inside the `drawDrops` loop, once per falling power-up,
per frame. This forced a synchronous style recalculation every frame for every falling power-up — the
single most expensive line in the render path.

### 15. ✅ FIXED — `updateHud()` writes four DOM nodes every frame (S)
> **Fixed 2026-08-13.** A `hudLast` cache [3258](../html/index.html#L3258) records what's currently
> displayed for each of the four HUD fields; `updateHud()` [3259–3270](../html/index.html#L3259-L3270)
> only touches `textContent` for a field whose value actually changed since the last call. The
> unconditional per-frame call [3625](../html/index.html#L3625) stays — it's still what catches
> `state.best` needing a live update against `state.score` — but an idle frame now writes nothing.

`updateHud()` was called unconditionally every frame, in addition to the event-driven calls in
`brickHit`, `applyPowerup`, and `loseLife` — 240 needless `textContent` assignments per second even
while nothing displayed was changing.

### 16. ✅ FIXED — `checkLevelClear()` scans the full brick array every frame (S)
> **Fixed 2026-08-13.** `state.remainingBricks` [1579](../html/index.html#L1579) counts destructible
> bricks still alive; `buildLevel()` seeds it when a level starts
> [1645](../html/index.html#L1645)/[1666](../html/index.html#L1666), and `brickHit()` decrements it at the
> single point a brick actually dies [2894](../html/index.html#L2894). `checkLevelClear()`
> [3117–3126](../html/index.html#L3117-L3126) is now an `O(1)` counter check instead of an `O(n)` scan.

`checkLevelClear()` ran `.some()` over up to 80 bricks every single frame. Cheap in absolute terms, but
trivially replaceable with a counter decremented in `brickHit`.

### 17. ✅ FIXED — Canvas backing store is sized from DPR only, ignoring displayed size (S)
> **Fixed 2026-08-13.** `fitCanvas()` [757–771](../html/index.html#L757-L771) now reads the canvas's
> actual displayed width via `getBoundingClientRect()` and scales the backing store by
> `dpr * min(1, displayWidth / GAME_W)` — never upsizing past `dpr` (unchanged from before whenever the
> canvas is shown at or above its logical size), but shrinking the allocation when the canvas — styled
> `width: 100%; height: auto` — renders narrower than that, as on a phone.

`fitCanvas` always allocated `480 × 680 × dpr`. On a phone where the canvas displays at ~300 px wide
with `dpr = 3`, that was a 1440×2040 buffer for a 300 px element.

---

## C. Code quality / structure

### 18. ✅ FIXED — Phase transitions bypassed `setPhase()` in three places (S)
> **Fixed 2026-08-13.** `setPhase()` [2120](../html/index.html#L2120) now owns every phase→overlay
> mapping via a `PHASE_OVERLAY` lookup [2050–2064](../html/index.html#L2050-L2064), extended to cover
> `levelclear`/`victory`/`gameover` as well as the phases it already handled. `togglePause`
> [1975](../html/index.html#L1975), `checkLevelClear` [3129](../html/index.html#L3129), and `endGame`
> [2677](../html/index.html#L2677) now all just call `setPhase(...)` instead of duplicating the
> `state.phase` assignment and `showOverlay` call. (#34 below was a follow-up gap — the boot-time
> start screen still bypassed this — since fixed.)

`setPhase` [2120](../html/index.html#L2120) was the intended single entry point, but `togglePause`,
`checkLevelClear`, and `endGame` each assigned `state.phase` *and* called `showOverlay` directly.
That's the kind of duplication that causes an overlay/phase desync the first time someone adds a
state.

### 19. ✅ FIXED — Dead/redundant code (S)
> **Fixed 2026-08-13.**
> - `state.paddle.w` is gone entirely — both the initial field and the `updatePaddle` assignment that
>   nothing ever read; `paddleWidth()` remains the one source of truth.
> - The redundant `updateHud(); drawBackground(); drawBricks(); drawPaddle();` block right before the
>   first `requestAnimationFrame(frame)` call is removed; that first frame already paints the same
>   thing ~16 ms later via `draw()` [3561–3577](../html/index.html#L3561-L3577), and the HUD's own
>   one-time init call [3271](../html/index.html#L3271) already covers the pre-play text.
> - `updateBalls` [2960](../html/index.html#L2960) now declares only the `dt` parameter it uses; the
>   call site [3619](../html/index.html#L3619) no longer passes the unused `now`.

- `state.paddle.w` was assigned in `updatePaddle` but never read — every draw/collision path called
  `paddleWidth()` instead.
- The `updateHud(); drawBackground(); drawBricks(); drawPaddle();` block was redundant; the rAF loop
  paints the same frame ~16 ms later.
- `updateBalls(dt, now)` never used `now`.

### 20. ✅ FIXED — No `AudioContext` resume, and the mute state wasn't persisted (S)
> **Fixed 2026-08-13.** `audioCtx()` [2298](../html/index.html#L2298) — `beep()`'s own body when
> this was written, split out by #59 — now calls `actx.resume()`
> [2307](../html/index.html#L2307) whenever the context is `"suspended"` — cheap and a no-op once
> already running, but it rescues audio for the rest of the session if the very first beep didn't
> happen to fire from inside a user-gesture handler. Separately, `state.muted` now round-trips through
> `loadMuted()`/`saveMuted()` [1473–1474](../html/index.html#L1473-L1474), the same `storageGet`/
> `storageSet` pair [1451–1465](../html/index.html#L1451-L1465) already used for the best score and the
> language preference, written on every toggle [2276](../html/index.html#L2276) and read back into
> `state.muted` at boot [1583](../html/index.html#L1583).

`beep` lazily constructed the context but never called `actx.resume()`. If the context was ever
created outside a user gesture it started `suspended` and the game was silently mute for the rest of
the session. Separately, `state.muted` wasn't saved, so the setting reset on every reload.

### 21. ✅ FIXED — Scattered magic numbers collected into a `CONFIG` block (M)
> **Fixed 2026-08-13.** A single `CONFIG` object [1169–1267](../html/index.html#L1169-L1267) now holds drop
> fall speed, particle gravity, the ball cap, the paddle bounce spread, each power-up's mult/duration
> pair, and — since added by #28/#29/#30 — the difficulty ramp, combo/floating-text, and laser tuning
> too. Every call site reads from it instead of a local literal: drop fall speed
> [2764](../html/index.html#L2764), particle gravity [2808](../html/index.html#L2808), the ball cap in
> both of `applyPowerup`'s multi-ball checks [2739](../html/index.html#L2739)/
> [2746](../html/index.html#L2746), the paddle bounce spread [3019](../html/index.html#L3019), and the
> four original effect branches [2715–2726](../html/index.html#L2715-L2726).

Magic numbers were scattered through the file: drop fall speed `130`, particle gravity `260`, effect
durations `10`/`8` seconds, multipliers `1.6`/`0.6`/`0.7`/`1.4`, ball-cap `5`, paddle bounce spread
`1.05`. Collecting these into one `CONFIG` object makes the game tunable without hunting through the
logic.

---

## D. Accessibility

### 22. ✅ FIXED — Overlay state changes are now announced (S)
> **Fixed 2026-08-13.** All six `.overlay` divs [620–662](../html/index.html#L620-L662) now carry
> `role="status" aria-live="polite"`, with a static `aria-hidden` default matching whether they're the
> one shown at boot. `showOverlay()` [2083–2115](../html/index.html#L2083-L2115) keeps `aria-hidden` in
> sync with the `.show` class on every transition — the overlay actually on screen is the only one
> ever inside the accessibility tree, which is what lets a screen reader announce it as it appears
> rather than the swap happening silently.

Level-clear, game-over, and victory overlays swapped in silently. A screen-reader user got no
notification.

### 23. ✅ FIXED — Toggle buttons now reflect their state (S)
> **Fixed 2026-08-13** (half fixed 2026-08-12 by the bilingual work — see below). Both deck buttons
> default to `aria-pressed="false"` in markup [740–741](../html/index.html#L740-L741) and are kept in
> sync by their render functions. `renderMuteButton()` [2165–2170](../html/index.html#L2165-L2170) now
> also sets `aria-pressed`; a new `renderPauseButton()`
> [2176–2182](../html/index.html#L2176-L2182) mirrors it for pause, and — since the pause button used to
> show the same "II" icon regardless of whether the game was actually paused — swaps the icon
> (`⏸`/`▶`) and `aria-label` between "pause" and "resume" too, not just `aria-pressed`. It's called
> from both `setPhase()` [2123](../html/index.html#L2123) and `applyLanguage()`
> [2219](../html/index.html#L2219), so it stays correct across phase changes and language switches
> alike. A `.icon-btn[aria-pressed="true"]` rule [549–553](../html/index.html#L549-L553) gives both
> buttons the same visual "pressed" cue the language toggle already had.

> **Half fixed 2026-08-12** by the bilingual work. `renderMuteButton()`
> ([2165–2170](../html/index.html#L2165-L2170)) sets the mute button's `aria-label` from both the
> language and the on/off state, so it no longer claims "Couper le son" while already muted.

Neither toggle exposed `aria-pressed`, and the pause button never changed its label or state when the
game was paused.

### 24. ✅ FIXED — Canvas now points assistive tech at the HUD (S)
> **Fixed 2026-08-13.** The HUD [591–608](../html/index.html#L591-L608) was already reachable — plain,
> unhidden DOM text ahead of the canvas in reading order — so no canvas fallback content was needed;
> what was missing was the connection between the two. The canvas now carries
> `aria-describedby="hud"` [616](../html/index.html#L616), pointing at the HUD container's new
> `id="hud"` [591](../html/index.html#L591), so a screen-reader user who lands directly on the canvas
> (rather than reading the page linearly) is told where the live score/lives text actually lives.

`<canvas>` had an `aria-label` but empty inner content and no live text alternative for score/lives.

### 25. ✅ FIXED — `prefers-reduced-motion` is now read in JS too (S)
> **Fixed 2026-08-13.** `burst()` [1729](../html/index.html#L1729) now scales its particle count down to
> roughly a third (never below 1) whenever `reduceMotion` is true, read from
> `matchMedia("(prefers-reduced-motion: reduce)")` [1722–1726](../html/index.html#L1722-L1726) — live,
> via a `change` listener, rather than once at load, so toggling the OS setting mid-session takes
> effect on the very next burst rather than requiring a reload.

[113–115](../html/index.html#L113-L115) disabled the title flicker, but the canvas particle bursts were
unaffected — the CSS media query can't reach into canvas drawing.

---

## E. Gameplay / UX enhancements

### 26. ✅ FIXED — Keyboard path out of the game-over / victory screens (S)
> **Fixed 2026-08-13.** `showOverlay()` [2083–2115](../html/index.html#L2083-L2115) now focuses the
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

`handleLaunchOrResume` [1928](../html/index.html#L1928) only handled `ready` and `paused`. From
`gameover`, `victory`, `levelclear`, or the initial `start` screen, Space did nothing — the player had
to reach for the mouse.

### 27. ✅ FIXED — Touch: the first tap both aimed and launched (S)
> **Fixed 2026-08-13.** Launching moved from `touchstart` to a new `touchend` handler
> [1911–1926](../html/index.html#L1911-L1926); `touchstart`/`touchmove`
> [1899–1910](../html/index.html#L1899-L1910) now only update `pointerX`, aiming the paddle. That gives
> the player a chance to drag into position before committing to serve, instead of the ball launching
> from wherever the finger first landed. The "vertical offset" half of the original fix — tracking the
> paddle's own Y position above the finger — was deliberately dropped: the paddle only ever steers
> horizontally, so moving it vertically during touch play would be a materially bigger change (new
> collision geometry, different feel from mouse/keyboard play) than this finding's effort estimate
> implied, and isn't needed to fix the actual bug (the ball launching prematurely). (#35 below is a
> follow-up gap in the `touchend` handler itself.)

`touchstart` [1899](../html/index.html#L1899) (previously) set `pointerX` and immediately called
`handleLaunchOrResume`. On mobile you could not position the paddle before serving — the ball launched
from wherever your finger first landed.

### 28. ✅ FIXED — Difficulty ramp within a level (M)
> **Fixed 2026-08-13.** `state.difficultyMult` [1581](../html/index.html#L1581) multiplies directly into
> ball velocity [2973](../html/index.html#L2973), alongside the existing power-up speed multiplier. It
> ramps via `bumpDifficulty()` [1635–1637](../html/index.html#L1635-L1637) — cumulative, multiplicative,
> capped at `CONFIG.difficulty.max` — from two classic-Breakout triggers: every top-wall bounce
> [2979–2985](../html/index.html#L2979-L2985), and every `CONFIG.difficulty.brickMilestone` bricks
> destroyed in the current level [2895–2898](../html/index.html#L2895-L2898). `CONFIG.difficulty`
> [1208–1213](../html/index.html#L1208-L1213) holds the tuning; `buildLevel()`
> [1667–1668](../html/index.html#L1667-L1668) resets both the multiplier and the milestone counter at the
> start of every level, so the ramp never carries over from one level — or one difficulty — to the
> next.

Ball speed was fixed per level ([1387](../html/index.html#L1387), `LEVELS[i].speed`). Classic breakout
speeds the ball up after N bricks or on reaching the top wall, which prevents long stalemates on the
last brick.

### 29. ✅ FIXED — Score feedback on the canvas (M)
> **Fixed 2026-08-13.** Destroying a brick now spawns a floating `"+N"` pop-up at its position
> ([1744–1749](../html/index.html#L1744-L1749), rising and fading over `CONFIG.floatingText.life`
> seconds via `updateFloatingTexts()`/`drawFloatingTexts()`
> [2812–2819](../html/index.html#L2812-L2819)/[3544–3559](../html/index.html#L3544-L3559)), wired into
> the frame loop alongside particles [3623](../html/index.html#L3623)/[3628](../html/index.html#L3628)
> and `draw()` [3575](../html/index.html#L3575). Consecutive bricks destroyed without the ball touching
> the paddle also build a combo [2902–2907](../html/index.html#L2902-L2907) that scales the points
> awarded, capped at `CONFIG.combo.max`; any paddle contact — top face or side clip — resets it
> [3003](../html/index.html#L3003). `CONFIG.combo`/`CONFIG.floatingText`
> [1214–1279](../html/index.html#L1214-L1279) hold the tuning. This changes the scoring curve going forward
> — an unbroken combo now scores noticeably more than the same bricks hit in isolation — so existing
> saved best scores are no longer directly comparable to newly-earned ones.

Points were only visible in the HUD, with no combo mechanic for consecutive brick hits without a
paddle touch.

### 30. ✅ FIXED — Sticky paddle and laser power-ups (M)
> **Fixed 2026-08-13.** Both suggested additions are in, slotting into the existing timed-effect
> architecture: `POWERUPS` [1126–1127](../html/index.html#L1126-L1127), `CONFIG.effects.sticky`/
> `CONFIG.effects.laser` [1192–1193](../html/index.html#L1192-L1193), and two new branches in
> `applyPowerup` [2730–2735](../html/index.html#L2730-L2735).
>
> **Sticky** re-attaches a ball on a genuine top-face paddle hit while `stickyEffect` is active
> [3005–3014](../html/index.html#L3005-L3014), capped to one attached ball at a time so multi-ball
> can't stack several on the paddle at once. `updatePaddle()`'s attached-ball tracking, previously
> hardcoded to `balls[0]`, now loops over every ball [2662–2666](../html/index.html#L2662-L2666) since
> sticky can catch any of them, not just the one served at the start of a life.
>
> **Laser** gives the action button a second job during `"playing"`: alongside releasing a stuck ball,
> `handleLaunchOrResume()` [1928–1938](../html/index.html#L1928-L1938) now calls `fireLaser()`
> [1961–1973](../html/index.html#L1961-L1973), which fires classic twin bolts from the paddle on a
> cooldown (`CONFIG.laser` [1198–1203](../html/index.html#L1198-L1203)). `updateLasers()`
> [2779–2800](../html/index.html#L2779-L2800) moves them and reuses `brickHit()` on impact — the same
> scoring/combo/difficulty path a ball hit goes through — and `drawLasers()`
> [3517–3530](../html/index.html#L3517-L3530) renders them. Releasing a sticky ball and firing both
> route through the same action-button entry point used everywhere else (mouse, touch, Space), via a
> new `launchAttachedBalls()` helper [1940–1953](../html/index.html#L1940-L1953) `launchBall()`
> (the "ready" → "playing" serve) now also calls.

The current six were solid, but nothing rewarded skillful play with new tools. **Sticky paddle** (ball
re-attaches, aim the next shot) and **laser** (fire upward on Space) were the suggested natural
additions.

### 31. ✅ FIXED — Active power-up timers are now visible (S)
> **Fixed 2026-08-13.** A depleting bar per effect, under the HUD
> ([714–734](../html/index.html#L714-L734) markup, [204–249](../html/index.html#L204-L249) CSS). Slots
> are toggled with the `hidden` attribute and resized via the fill's inline width rather than
> created/destroyed — see `updateEffectBar()`/`renderEffectBars()`
> [3292–3320](../html/index.html#L3292-L3320), called after every `applyPowerup()`
> [2758](../html/index.html#L2758) and once per frame [3631](../html/index.html#L3631). `state.widthEffect`/
> `state.speedEffect` don't record which specific powerup produced them, only the resulting `mult`, so
> the bar recovers it from the sign of `mult` — the same trick `drawPaddle()`
> [3456](../html/index.html#L3456) already used for its colour swap.

The paddle changed colour for width effects, but there was no indication of *how long* an effect
lasted, and speed effects had no visual at all.

### 32. ✅ FIXED — Add more levels (M)
> **Fixed 2026-08-13.** Five hand-authored levels added to `LEVELS`
> [805–819](../html/index.html#L805-L819), taking the game from 5 levels to 10. Went with hand-authored
> over the procedural-generator option: it keeps the existing finite-levels-then-`victory` structure
> intact (`checkLevelClear()`'s `LEVELS.length - 1` win check [2666](../html/index.html#L2666), the HUD's
> `n/LEVELS.length` readout [2800](../html/index.html#L2800), and `level.of`'s `{n}/{total}` string all
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
> [603](../html/index.html#L603) and [612](../html/index.html#L612).

Endless mode past level 5 (a procedural generator) was the other option on the table; not pursued here
— see the fix note above for why hand-authoring won out for this pass. Tracked as its own follow-up in
[todo.md](todo.md) (#41) if endless play is wanted later, no longer under #32.

### 37. ✅ FIXED — The power-up timer bars (#31) reflow the whole cabinet when they appear (M)
> **Fixed 2026-08-13.** `.effect-bars` and `.screen-wrap` are now independent flex siblings inside
> a new `.play-row` [257–261](../html/index.html#L257-L261) — the effect-bars markup moved from
> before `.screen-wrap` to after it, as a sibling rather than a fellow child of `.cabinet`'s own
> flex column [57–65](../html/index.html#L57-L65) *(markup: [613](../html/index.html#L613)
> wraps both; the bars themselves are now at [717–734](../html/index.html#L717-L734))*.
> `.effect-bars` [214–219](../html/index.html#L214-L219) takes a fixed `flex: 0 0 84px` column
> instead of wrapping horizontally, so a slot's `hidden` toggle (still the same mechanism from
> #31 — see `updateEffectBar()` [3292–3301](../html/index.html#L3292-L3301)) resizes only that
> column's own height, never `.screen-wrap`'s; the canvas inside it doesn't move. Below a
> 560px-viewport breakpoint [566–576](../html/index.html#L566-L576) there isn't width to spare for
> a side column without squeezing the canvas uncomfortably small, so `.play-row` falls back to the
> pre-#37 stacked layout there — the shift comes back on small phones, an accepted trade-off noted
> in the fix itself rather than a full fix. `fitCanvas()` (#17) already re-derives the canvas's
> backing-store size from its *displayed* width every resize, so narrowing the canvas to share
> space with the sidebar needed no JS changes.

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

## F. Regressions surfaced by the #26–29 pass

Found by an `/code-review` pass over commit `bb8ebf1` ("Fix findings #26-#29: overlay focus, touch
aim, difficulty ramp, combo score"). #33–#36 all fixed.

### 33. ✅ FIXED — `showOverlay()` blurs any focused button, not just its own (S)
> **Fixed 2026-08-13.** The blur is now scoped to buttons that actually belong to an overlay. A new
> `OVERLAY_BUTTON_IDS` lookup [2073–2082](../html/index.html#L2073-L2082) is built from
> `PHASE_OVERLAY`'s button entries (from `OVERLAY_PRIMARY_BTN`'s values at the time; #36 below folded
> that map into `PHASE_OVERLAY`), and `showOverlay()` [2104–2107](../html/index.html#L2104-L2107)
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
> [2051](../html/index.html#L2051) — `OVERLAY_PRIMARY_BTN` already had the matching
> `"overlay-start": "btn-start"` since #26 [2051](../html/index.html#L2051) — so boot
> [3644](../html/index.html#L3644) now calls `setPhase("start")` instead of `showOverlay(...)`
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
> **Fixed 2026-08-13.** `touchend`'s handler [1911–1927](../html/index.html#L1911-L1927) now only
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
> **Fixed 2026-08-13.** `PHASE_OVERLAY` [2050–2064](../html/index.html#L2050-L2064) is now the only
> map: each phase's entry carries both its overlay id and its button id together (e.g.
> `paused: { overlay: "overlay-pause", button: "btn-resume" }`), or is `null`/has no `button` key
> for `"playing"`/`"ready"`. `OVERLAY_PRIMARY_BTN` is gone; `OVERLAY_BUTTON_IDS`
> [2073–2082](../html/index.html#L2073-L2082) (see #33) and `setPhase()`
> [2120–2128](../html/index.html#L2120-L2128) both derive what they need from `PHASE_OVERLAY` alone,
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
> existing overlap test — [2989–3001](../html/index.html#L2989-L3001). When the ball's start-of-frame
> position was above the paddle top but its end-of-frame position has already cleared the paddle
> bottom (the exact tunneling case: no overlap left for `circleRectCollide` to catch), it's rewound
> to the point where it crossed the paddle's top plane, so the existing `isTopHit` branch just below
> sees a normal top hit and steers it exactly as it always has. Bricks are deliberately exempt — a
> missed brick costs nothing, the ball just continues past it — so this only guards the one collision
> that actually costs the player something. The stale comment in `LEVELS`
> ([810–816](../html/index.html#L810-L816)) claiming level 10's speed was "kept under the ceiling" is
> corrected too: that ceiling never held once the difficulty ramp was accounted for, and the sweep
> makes level speed a non-issue for this class of bug going forward. The paper-math test in
> `test/suites/physics.js` ("the ball cannot tunnel through the paddle...") is now a behavioural test
> that drives this exact worst case — level 10, `fast`, `difficultyMult` pinned to its cap, one 33ms
> frame — and asserts the ball still bounces; a matching `#38` regression test covers the same ground
> in `test/suites/regressions.js`.

The "cannot tunnel through the paddle at maximum speed" test
([test/suites/physics.js:202–218](../test/suites/physics.js#L202-L218)) only budgets for
`baseBallSpeed * LEVELS[i].speed * fast-powerup's 1.4x`, capped by the 33ms clamped max `dt`
([3583](../html/index.html#L3583)). It never factors in `state.difficultyMult`
([1581](../html/index.html#L1581)), the mid-level ramp (up to `CONFIG.difficulty.max` = `1.6`,
[1212](../html/index.html#L1212)) that's multiplied into the same per-frame displacement at
[2973](../html/index.html#L2973):

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
[2988](../html/index.html#L2988):

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
comment at [809–817](../html/index.html#L809-L817) claiming level 10 is "kept under the ceiling" should
be corrected either way, since it's not accurate today.

### 39. ✅ FIXED — Stale "1/5" HUD markup fallback (S)
> **Fixed 2026-08-14.** The markup now reads `<div class="hud-value" id="hud-level">1/10</div>`
> ([584](../html/index.html#L584)), matching the two overlay-eyebrow fallbacks #32 already updated. A
> `#39` regression test in `test/suites/regressions.js` checks the raw source text directly (not the
> post-boot DOM, since `updateHud()` overwrites this on the very first frame regardless of what the
> static markup said) so a future level-count change can't let this one quietly go stale again.

The static HUD counter at [584](../html/index.html#L584) —
`<div class="hud-value" id="hud-level">1/5</div>` — was not updated when #32 took the game to 10
levels, even though the #32 fix explicitly updated the two parallel overlay-eyebrow fallbacks at
[603](../html/index.html#L603) and [612](../html/index.html#L612) for the identical reason (both read
"Niveau 1 / 10" now). `updateHud()` ([2800](../html/index.html#L2800)) overwrites it with the real
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
([784](../html/index.html#L784)) — which is exactly the kind of brick-adjacency layout the
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
> (a text input + submit button, markup at [675–683](../html/index.html#L675-L683)) and `halloffame`
> (the top-10 board + a continue button, [685–691](../html/index.html#L685-L691)), each with its own
> `PHASE_OVERLAY` entry ([2063–2064](../html/index.html#L2063-L2064)) rather than bolting an input onto
> `overlay-victory`/`overlay-gameover` directly. `endGame()` ([3134–3143](../html/index.html#L3134-L3143))
> detours through `nameentry` — remembering which final screen to return to afterward in
> `state.returnPhase` (generalized from a `pendingWon` boolean by #43) — whenever
> `qualifiesForHallOfFame(state.score)`
> ([3172–3174](../html/index.html#L3172-L3174)) is true: strictly greater than 0, and either the board
> has room or the score beats its current lowest entry via `hallOfFameRank()`
> ([3160–3165](../html/index.html#L3160-L3165)) — a tie with the lowest entry does not bump it. The
> board is a capped, sorted `{name, score}` list under a new `neonbreak-hall-of-fame` key
> ([1449](../html/index.html#L1449)), round-tripped through `loadHallOfFame()`/`saveHallOfFame()`
> ([1481–1494](../html/index.html#L1481-L1494)) via the same guarded `storageGet`/`storageSet` pair #2
> already uses — a throw, or corrupted/foreign JSON under that key, degrades to an empty board rather
> than taking the game down.
>
> A submitted name is trimmed, capped to `CONFIG.hallOfFame.nameMax` (12 characters,
> [1283–1286](../html/index.html#L1283-L1286)), and falls back to a translated `"???"` placeholder when
> empty (`submitHallOfFameName()`, [3194–3211](../html/index.html#L3194-L3211)). `renderHallOfFame()`
> ([3218–3243](../html/index.html#L3218-L3243)) rebuilds the board through `innerHTML` rather than
> `textContent` as sketched below — the test harness's DOM stub has no `createElement`/`appendChild`
> to build real nodes with — but every interpolated value (the name; the score too, for uniformity)
> goes through a small `escapeHtml()` helper first ([790–792](../html/index.html#L790-L792)), so a name
> like `<img src=x onerror=...>` still can't be interpreted as markup. `isButtonFocused()` is renamed
> to `isTypingTarget()` and widened to also cover a focused `<input>`
> ([1812–1815](../html/index.html#L1812-L1815)), so Space still reaches the name field instead of being
> hijacked for launch/laser; Enter submits directly from the field
> ([1862–1864](../html/index.html#L1862-L1864)) since nothing else in this file uses a `<form>`.
>
> Covered by ten `#42a`–`#42j` cases in `regressions.js` — qualification gating including the score-0
> and tie edge cases, sorted insertion, the empty-name fallback, HTML-escaping, the win/loss branch
> back out, Space/Enter handling, and the max-size cap — plus two round-trip cases in `persistence.js`,
> including the `storageThrows` guard. Four existing tests that happened to end a run with a
> qualifying score (`state.js`, `rules.js`, `i18n.js`, `persistence.js`) now seed a full board via the
> `storage` boot option so they keep exercising what they were actually about, not the hall of fame.

Feature request: when a run ends (`endGame()`, [3134](../html/index.html#L3134)) with a score that
qualifies, prompt the player for their name, then show a top-10 leaderboard of name+score pairs.

Today only a single number persists across sessions — `state.best`, round-tripped through
`loadBest()`/`saveBest()` ([1464–1465](../html/index.html#L1464-L1465)) under `BEST_KEY`
([1446](../html/index.html#L1446)), both guarded by `storageGet`/`storageSet`
([1455–1463](../html/index.html#L1455-L1463)) per #2. This replaces "a number" with "a list":
a new `localStorage` key (e.g. `neonbreak-hall-of-fame`) holding a JSON array of `{ name, score }`,
capped at 10, sorted descending, read/written through the same guarded helpers so a throwing
`localStorage` degrades the same way #2 already handles for the best score.

**Where it hooks in:** both `endGame(true)` and `endGame(false)` ([3134](../html/index.html#L3134)) —
a run can end either by winning or by running out of lives, and both should qualify. The natural gate
is "does this score beat the lowest of the current top 10 (or is the list not yet full)?" — most runs
won't qualify, and skipping the prompt entirely for those keeps the existing victory/gameover flow
(`PHASE_OVERLAY` [2050–2064](../html/index.html#L2050-L2064), `overlay-victory`/`overlay-gameover`
markup [648–670](../html/index.html#L648-L670)) untouched for the common case.

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
  empty-list message) needs a key in both `STRINGS.fr` and `STRINGS.en` ([1298](../html/index.html#L1298))
  — the `i18n` suite already fails the build if one language's table is missing a key the other has,
  so this is enforced automatically once the keys exist.
- *Keyboard/focus.* The name-entry overlay's input should get focus the way every other overlay's
  primary button does today (`showOverlay()` [2083](../html/index.html#L2083), #26), and
  submitting needs both an Enter-in-the-input path and a click path — mirroring how
  `handleLaunchOrResume()` already serves keyboard, mouse, and touch from one entry point.

**Test coverage this would need:** a `persistence` suite case for the hall-of-fame round-trip
(including the `storageThrows` guard, per #2's test), a `state`/`rules` case for the qualifying-score
gate, and — since this is the first free-text player input — an explicit case asserting a name
containing HTML-special characters renders as literal text, not markup.

### 43. ✅ FIXED — View the hall of fame from the start screen, before playing (S)
> **Fixed 2026-08-14.** A second, lower-emphasis button on `overlay-start`
> ([625–626](../html/index.html#L625-L626), styled with a new `.btn-ghost` modifier
> [404–409](../html/index.html#L404-L409)) opens the board on demand — its handler
> ([2227–2241](../html/index.html#L2227-L2241)) sets `state.returnPhase = "start"` and calls
> `setPhase("halloffame")` directly, never `newGame()`, so score/lives/level are untouched. The
> board itself needed no changes — `renderHallOfFame()` already renders `halloffame.empty` for a
> fresh install with nothing on it yet, exactly as sketched below.
>
> `state.pendingWon` (a `true`/`false`/`null` flag) is generalized into `state.returnPhase`
> (`"start"` / `"victory"` / `"gameover"`, [1591–1596](../html/index.html#L1591-L1596)): `endGame()`
> ([3142](../html/index.html#L3142)) sets it to `won ? "victory" : "gameover"` before the post-game
> detour exactly as `pendingWon` did, and the continue button
> ([2268–2270](../html/index.html#L2268-L2270)) just does `setPhase(state.returnPhase)` — one field
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
([1449](../html/index.html#L1449)), so two players never see each other's scores, and the same person
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
interpolated values ([3239–3240](../html/index.html#L3239-L3240)), so XSS is handled, but a public
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
> ([1245–1257](../html/index.html#L1245-L1257)) and driven from three timers on `state`
> ([1607–1612](../html/index.html#L1607-L1612)): a camera shake on an explosion
> ([2843–2844](../html/index.html#L2843-L2844)) and on a lost ball
> ([3070](../html/index.html#L3070)), 55 ms of frozen simulation with the blast, and a paddle squash
> on every steered bounce ([3024](../html/index.html#L3024)). The whole layer lives in one block —
> [1751–1804](../html/index.html#L1751-L1804).
>
> **It is presentation, and the boundary is enforced rather than described.** The shake is a
> `ctx.translate` around the whole scene in `draw()` ([3562–3567](../html/index.html#L3562-L3567)),
> so nothing the game simulates moves because of it, and the squash is applied to the paddle's drawn
> rectangle only ([3460–3470](../html/index.html#L3460-L3470)) — `state.paddle.h` still governs
> collision, so the paddle cannot get easier or harder to hit by flexing.
>
> **The shake offset is derived from its own timer, not `rand()`** — two fast, incommensurable sines.
> Rolling for it inside `draw()` would have made what the game rolls (drop chances, mystery
> resolutions) depend on how many frames it happened to paint, which is a bug that would have
> surfaced as unreproducible seeded tests long after the cause was forgotten. `#58f` pins it.
>
> **Hit-stop is set, never accumulated** ([1770–1775](../html/index.html#L1770-L1775)). Summing it
> across a five-brick explosive chain would put the game to sleep for a third of a second and read as
> a hang. It is also spent from real elapsed time and cleared on a life reset
> ([1691–1693](../html/index.html#L1691-L1693)), so no path leaves the simulation frozen.
>
> `drawBackground()` now bleeds past the play area by the largest possible offset
> ([3362–3370](../html/index.html#L3362-L3370)); an exactly sized fill leaves a strip of the
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
> ([2317–2347](../html/index.html#L2317-L2347)), the single primitive everything audible is built
> from: a note at a scheduled time, optionally gliding to a second frequency (`slide`) or doubled by
> a detuned twin (`detune`).
>
> **The game is in a key.** `noteFreq()`, a minor-pentatonic `MUSIC_SCALE` and one root per level in
> `MUSIC_KEYS` ([2400–2402](../html/index.html#L2400-L2402)) pitch the music, the brick voices and
> the combo ladder from the same place, so a hit lands in tune with the bed rather than beside it —
> and each level sounds like a different level without a single new asset.
>
> **A voice per brick type.** `BRICK_VOICE` ([2447–2458](../html/index.html#L2447-L2458)) gives each
> type its own timbre, register and envelope: a wall thuds low and slides down, silver rings as two
> detuned squares, a mystery brick sparkles upward as it resolves, an explosive drops. Type is the
> only thing that changes what a hit *does* (#49/#51/#52), so it is now also the only thing that
> changes what a hit sounds like. `brickTone()` ([2462–2470](../html/index.html#L2462-L2470))
> replaces the four hand-tuned `beep()` calls that used to be scattered through `brickHit()`
> ([2888–2925](../html/index.html#L2888-L2925)).
>
> **A ladder for streaks.** `ladderSemi()` ([2438–2442](../html/index.html#L2438-L2442)) climbs a
> step of the scale per brick destroyed without a paddle touch, wrapping octaves and holding after
> two — past that the notes stop reading as notes. It is added only when the brick was destroyed,
> because only a destroyed brick builds the combo it counts, and it is read *after* `state.combo` is
> raised ([2910](../html/index.html#L2910)) so a hit sounds on the rung it just earned.
>
> **The bed.** Four voices over a 16-step bar ([2520–2576](../html/index.html#L2520-L2576)), queued
> by `updateMusic()` ([2628–2649](../html/index.html#L2628-L2649)) from `frame()`
> ([3595](../html/index.html#L3595)) and tuned in `CONFIG.music`
> ([1234–1240](../html/index.html#L1234-L1240)). Three things about it are deliberate:
>
> - **Frames decide what, the audio clock decides when.** A note placed at `frame()` time lands
>   wherever the frame fell, which at 60 Hz is up to 16 ms off the beat and audibly so. Frames only
>   queue steps up to `lookahead` ahead of `actx.currentTime`; WebAudio places them.
> - **A stall resyncs rather than catching up** ([2638](../html/index.html#L2638)). A backgrounded
>   tab leaves the audio clock tens of seconds ahead of the bar; without this the next frame would
>   queue every missed step at once — a burst, not music, and an unbounded loop besides. `#59f` pins
>   it.
> - **Voices arrive on the beat they are earned and leave slowly** — `nextIntensity()`
>   ([2615–2622](../html/index.html#L2615-L2622)) rises instantly to whatever `voiceCombo` tier the
>   streak has reached and falls at `voiceDecay` voices per second. Instant decay would flicker the
>   whole arrangement on and off, since a combo dies on *every* paddle touch — several times a level,
>   by design. `intensity` is a float, so a voice fades in and out rather than switching.
>
> Like #58's impact layer, this reads game state and writes none of it, and — same hazard, same fix —
> it takes nothing from the RNG stream (`#59g`): a note chosen by `rand()` would make what the game
> rolls depend on how long it had been playing, and seeded physics runs would stop reproducing.
> Mute needed no change: `audioCtx()` ([2298–2310](../html/index.html#L2298-L2310)) returns null
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
> ([861–877](../html/index.html#L861-L877)) carries a sky gradient, a grid tint, a horizon tint and
> a star colour per act; `themeFor()` ([879–881](../html/index.html#L879-L881)) maps the level onto
> it, and `buildLevel()` resolves both the palette and the star field once per level
> ([1669–1670](../html/index.html#L1669-L1670)) rather than per frame.
>
> **Brick colours are deliberately not themed.** A brick's colour *is* its type (#49/#51/#52), so
> re-tinting the field's foreground per act would make the one thing the player has to read at a
> glance the one thing that keeps moving. Only the background changes.
>
> **The parallax is three star layers plus a scrolling horizon**
> ([3342–3359](../html/index.html#L3342-L3359)), all derived from one number — `state.bgScroll`,
> seconds of real time accumulated in `frame()` ([3600](../html/index.html#L3600)). Nearer layers
> drift faster (`STAR_LAYERS`, [885–889](../html/index.html#L885-L889)), which is the whole effect;
> deriving every offset from the same accumulator is what stops the layers from sliding out of
> register after a stall. Stars are drawn a layer at a time, so the field costs three fill-style
> changes a frame rather than fifty, and the sky gradient is rebuilt only when the act changes
> ([3328–3340](../html/index.html#L3328-L3340)) — `createLinearGradient` allocates.
>
> **The field is generated, not rolled** ([906–918](../html/index.html#L906-L918)): a Lehmer
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
> ([1072–1109](../html/index.html#L1072-L1109)) builds the rest from the level index alone.
>
> **One accessor hides the seam.** `levelDef(idx)` ([1111–1116](../html/index.html#L1111-L1116))
> returns the authored entry or a generated one of the same `{ rows, speed }` shape, memoised a
> single slot deep because `resetPaddleAndBall()` re-reads it on every lost ball. Its two callers are
> `buildLevel()` ([1643](../html/index.html#L1643)) and `resetPaddleAndBall()`
> ([1680](../html/index.html#L1680)), and neither can tell the difference.
> `CONFIG.progression.totalLevels` ([1175–1182](../html/index.html#L1175-L1182)) replaced
> `LEVELS.length` in `checkLevelClear()` ([3120](../html/index.html#L3120)), `renderDynamicText()`
> ([2011](../html/index.html#L2011)) and `updateHud()` ([3264](../html/index.html#L3264)), and the
> HUD's pre-JS fallback became `1/100` ([602](../html/index.html#L602)) — #39's point about a stale
> fallback applies unchanged. Putting the length in `CONFIG` rather than in a bare constant is what
> left the test seam untouched: `CONFIG` was already exposed.
>
> **Deterministic, never from `Math.random()`.** The inline Lehmer generator #60 used for the star
> field is now a shared `seededRandom(seed)` ([898–902](../html/index.html#L898-L902)), seeded from
> the level index in both places. Level 47 is the same layout for every player and reproducible in a
> test (`#41d`), and rolling from the shared stream would have made drop chances and mystery
> resolutions depend on how many levels had been generated — the hazard `#58f`, `#59g` and `#60d`
> already pin down for the shake, the music and the background (`#41f`).
>
> **Archetypes, not noise.** Per-cell randomness produces mush; the authored levels are patterned.
> One archetype is picked per level from a library of seven — solid bands, checker, columns, pyramid,
> diamond, fortress, arch ([938–958](../html/index.html#L938-L958)) — and each row is built for the
> left five cells and mirrored. Symmetry is most of what makes a layout read as authored. Type mix
> escalates with depth `d = idx - LEVELS.length`: silver from the start rising to 30% of cells, walls
> from d≥3 capped at 12% and never in the bottom row, 0–3 explosives from d≥2, 1–4 mysteries from
> d≥5, 0–2 regenerating from d≥10. The three budgeted types are scattered *after* the mirror
> ([1034–1052](../html/index.html#L1034-L1052)) so their counts stay what the table asks for rather than
> silently doubling — a few asymmetric accents cost a layout nothing, a doubled explosive budget
> would. Rows grow `6 + floor(d/12)`, capped at the authored maximum of 10.
>
> **Every destructible brick is reachable.** A brick walled off from the ball is a softlock:
> `remainingBricks` never falls to zero and the run is dead with nothing left to hit. `ensureReachable()`
> ([1014–1030](../html/index.html#L1014-L1030)) flood-fills up from the open space below the layout —
> four-neighbour, empty cells and destructible bricks passable (a destructible brick opens its own
> cell once it is gone), `#` solid — and repairs rather than re-rolls, downgrading whichever wall
> faces open space ([991–1010](../html/index.html#L991-L1010)) and trying again. Termination is
> guaranteed, since with no walls left everything is reachable, and a repair pass is deterministic,
> so it costs nothing in seed stability. `#41c` asserts the invariant with a flood fill written
> independently in the test rather than by calling the game's own validator.
>
> **Both curves saturate rather than compound** ([1057–1070](../html/index.html#L1057-L1070)), and both
> are anchored on the authored table so they pick up exactly where `LEVELS` leaves off. Speed
> approaches 2.8 from level 10's 2.08 with a ~25-level time constant — 2.32 at 20, 2.65 at 50, 2.78
> at 100 — deliberately modest, because at the cap the ball already crosses ~51px in a worst-case
> 33ms frame once the `fast` power-up and the mid-level ramp stack on it. #38's swept check keeps it
> off the paddle (its regression test now runs at level 100 rather than level 10), but brick
> collision is not swept: **layout carries the back half of the difficulty, not speed.**
> `levelMultiplier(n)` stays exactly `n` through level 10 — the existing scoring tests pin that —
> then saturates toward 20 with a ~30-level constant, replacing the `(state.levelIndex + 1)` factor
> in `brickHit()` ([2904](../html/index.html#L2904)).
>
> **Relief:** three lives across 100 levels is not survivable, so clearing every 10th level hands one
> back, capped at `state.maxLives` ([3123–3129](../html/index.html#L3123-L3129)). Awarded on the way
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
> `"#S#S#S#S#S"` ([830](../html/index.html#L830)) — turning the offset checkerboard into alternating
> full-height wall and silver pillars. Same brick types, same counts, same speed; the only difference
> is that every silver now has a destructible brick under it instead of a wall.
>
> `ensureReachable()` (#41) validates generated levels only, so an authored layout has nothing
> catching this. `#68` is that check: the flood fill `#41c` runs over the generated levels now also
> runs over the authored ten, plus a direct assertion on the shape that caused it — no `S` in level
> 10's top row may sit directly on a `#`.

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
> ([1841–1846](../html/index.html#L1841-L1846)), reading the `state.keys` set the paddle already
> uses — which is cleared on `blur`, so a chord broken by alt-tab cannot get stuck half-down. Two
> details it turns on. It fires on whichever of the three keys *completes* the chord rather than on
> any keystroke while they happen to be held, or still having them down after a jump would re-open
> the prompt on the next key pressed. And its guard is `isTextEntryTarget()`
> ([1820–1823](../html/index.html#L1820-L1823)), deliberately narrower than the existing
> `isTypingTarget()`: it only has to stand aside for a text field, and since every overlay focuses
> its own button (#26), reusing `isTypingTarget()` would have meant the chord never fired from a
> menu at all — which is most of where it is wanted.
>
> **The prompt is a real phase**, `leveljump` in `PHASE_OVERLAY`
> ([2071](../html/index.html#L2071)), not a modal bolted on beside the phase machine. That is the
> architecture's rule, and it buys three things: the simulation stops while the prompt is up because
> `frame()` only updates on `playing`/`ready`; `showOverlay()` handles `aria-hidden` and focuses the
> field the way `nameentry` does; and its text is ordinary `data-i18n` rather than a special case.
> While it is showing it owns the keyboard — `Enter` submits, `Escape` dismisses, and nothing else in
> the handler gets a look in ([1831–1836](../html/index.html#L1831-L1836)).
>
> `openLevelJump()`/`cancelLevelJump()`/`submitLevelJump()`
> ([1996–2034](../html/index.html#L1996-L2034)) are the whole of it. Cancelling restores the phase
> the prompt interrupted, and **cancelling from `playing` lands on `paused`** — returning to
> `playing` would drop the player back into a live ball the instant the overlay closed, which is the
> reason `autoPause()` exists. Validation is strict rather than `parseInt`: `"12abc"` and `"1e3"` are
> typos, not level numbers, and the bound is `CONFIG.progression.totalLevels`, never a literal 100.
> Arriving needs no new code — `startLevel(n - 1)` already builds the level, resets the paddle and
> ball and lands on `ready`, and the `levelclear` → next-level loop reads `state.levelIndex + 1`.
>
> **A jumped run is out of the running.** `state.jumped` is set by the jump, sticky until
> `newGame()`, and checked in both `endGame()` ([3141](../html/index.html#L3141)) and
> `maybeSaveBest()` ([3110](../html/index.html#L3110)). The world board can never be reset (#67) and
> brick value saturates toward 20× (#41), so jumping straight to level 100 would otherwise be the
> cheapest high score in the game; excluding the local best too stops one test jump parking an
> unbeatable number on the player's own board. The overlay says so in as many words
> ([712](../html/index.html#L712)) — this is client-side JavaScript anyone can read, so it is a
> convenience, not a protected mode, and the UI should not pretend otherwise.
>
> Jumping from outside a run (`start`, a finished run, the board opened on demand) resets score and
> lives and refreshes the session token the way `newGame()` does, since there is no run behind it;
> jumping mid-run keeps both. `RUN_PHASES` ([1994](../html/index.html#L1994)) is the distinction.
>
> **One bug this surfaced in existing code.** `showOverlay()` blurred a leftover focused control only
> when it was a `BUTTON` ([2098–2101](../html/index.html#L2098-L2101)). That was harmless while
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

### 70. ✅ FIXED — The music is too repetitive (M)

> **Fixed 2026-08-16.** The bed was one 16-step bar looped forever — 1.8 seconds, under a level that
> lasts minutes. It is now an eight-bar phrase with a pulse under it, and its material belongs to the
> act rather than to the game.
>
> **The phrase.** `MUSIC_BARS` is 8 and a voice no longer has one pattern but several, with `form`
> saying which it plays in each bar — a tracker's order list
> ([2511–2553](../html/index.html#L2511-L2553)). Eight bars is ~15 seconds against 1.8, which is most
> of the perceived fix on its own. `MUSIC_FORM` ([2515](../html/index.html#L2515)) is the other half:
> one degree of the act's scale per bar, transposing every voice together, so the phrase has harmony
> and not just rhythm. `scheduleStep()` took a `bar` argument
> ([2589–2611](../html/index.html#L2589-L2611)) and is otherwise the function it was — the change is
> to the data table, exactly as the write-up below predicted.
>
> **Percussion.** A kick on every bar whatever the combo, and a hat bought with the first combo tier
> ([2560–2576](../html/index.html#L2560-L2576)). That is what lets the melodic voices drop out of a
> bar without the bed falling apart, which is what stops a loop sounding like a loop. The kick is a
> pitch drop and so is still an oscillator; the hat is filtered noise, and `noise()`
> ([2372](../html/index.html#L2372)) over a cached buffer ([2359](../html/index.html#L2359)) is the
> one piece of genuinely new audio machinery here. The buffer is filled from `seededRandom()`, never
> `Math.random()` — see below.
>
> **Material per act.** `MUSIC_ACTS` ([2414–2425](../html/index.html#L2414-L2425)) gives each of #60's
> five acts its own scale, its own tempo and its own timbre for every voice, keyed off the same
> `THEME_LEVELS` the backdrop uses — so the score turns over exactly when the field does. Act I is the
> bed #59 shipped, unchanged. `CONFIG.music.tempo` stays the single knob that moves everything: an act
> scales it rather than replacing it ([2430](../html/index.html#L2430)). Every scale is five notes, so
> the combo ladder is the same length in all of them ([2436](../html/index.html#L2436)) — it now reads
> the act's scale too, which is what keeps a brick hit in tune with the bed behind it.
>
> **`musicBar` lives outside `music`** ([2587](../html/index.html#L2587)). The bed stops on every
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
([2511](../html/index.html#L2511)) and `updateMusic()` advances `music.step` modulo it
([2628–2648](../html/index.html#L2628-L2648)), so at `CONFIG.music.tempo` 132 a step is
`60 / 132 / 4` = 0.114 s and the whole loop is **1.8 seconds long**. A single level is minutes of the
same two seconds, and #41 made a full run a hundred levels.

Nothing else varies enough to cover for that:

- **The material never changes.** `MUSIC_VOICES` ([2520–2553](../html/index.html#L2520-L2553)) is
  four fixed voices with fixed `steps` arrays. What combo buys is *which voices sound*
  (`nextIntensity`, [2615–2622](../html/index.html#L2615-L2622)) — four states of the same bar, not
  four different bars.
- **Per-level variation is transposition only.** `musicRoot()` picks a root from ten keys by
  `state.levelIndex % 10` ([2401–2402](../html/index.html#L2401-L2402)), so level 11 is level 1 again
  in the same key, and a 100-level run cycles those ten keys ten times.
- **One scale and one tempo for the entire game** — `MUSIC_SCALE` is a single minor pentatonic
  ([2416](../html/index.html#L2416)) and `tempo` is one number in `CONFIG.music`
  ([1234–1240](../html/index.html#L1234-L1240)).
- **There is no percussion at all.** Four pitched voices carry both the harmony and the pulse, which
  is why the pulse has to be so regular.

Loop *length* is most of the perceived fix, well ahead of harmonic sophistication. Getting from a
1.8-second loop to a phrase of ten or fifteen seconds would do more than any amount of cleverness
inside the current bar.

Also worth watching: `scheduleStep()` creates a gain node and an oscillator per note
([2326–2339](../html/index.html#L2326-L2339)), so a denser arrangement is more allocation per bar. It
is queued in `lookahead` batches rather than per frame, so this is not a per-frame cost, but a
percussion voice on every step is 16 more nodes a bar than the current busiest voice.

### 71. ✅ FIXED — Losing a ball deserves an animation and a sting (S/M)

> **Fixed 2026-08-15.** The ball draining off the bottom now bursts, sounds, and — the part that made
> the rest possible — takes a moment.
>
> **The beat.** `loseLife()` ([3068–3087](../html/index.html#L3068-L3087)) no longer transitions; it
> sets `state.lifeLost = {remaining, ended}` and moves to a new `lifelost` phase
> ([2056](../html/index.html#L2056)), which `frame()` spends a frame at a time
> ([3612–3615](../html/index.html#L3612-L3615)) before calling `finishLifeLost()`
> ([3092–3101](../html/index.html#L3092-L3101)) — the other half of the old function, serving again or
> ending the run. `CONFIG.impact.lifeLostBeat` is 0.7 s
> ([1260](../html/index.html#L1260)). Making it a phase rather than a counter checked beside the
> phase machine is what keeps the rest honest: `lifelost` shows no overlay (so the field stays
> visible), nothing simulates during it because `frame()` only runs the update block on `playing`,
> and the transition still goes through `setPhase()`.
>
> `ended` is decided when the ball is lost, not when the beat runs out, so a life spent on the last
> ball still ends the run even if something else changes `state.lives` in between.
>
> **The burst** is two calls ([3078–3079](../html/index.html#L3078-L3079)): white for the ball coming
> apart, the way every brick burst is its own colour, and red for the life indicator that just went
> out — which is the part the player actually has to read. It is pinned to the bottom edge at the
> ball's last x ([3058](../html/index.html#L3058)), because by the time `loseLife()` runs the ball is
> already 30 px below the canvas and a burst down there is a burst nobody sees. Particles already
> keep updating outside `playing`, so this needed no new draw path.
>
> **The sting** ([2477–2496](../html/index.html#L2477-L2496)) is four notes falling through the
> level's own scale, pitched from `musicRoot()` like everything else in #59 — that is the difference
> between a sting and a buzzer — and placed against the audio clock rather than fired as four
> `beep()`s at frame time, which would put each note wherever its frame happened to fall. The last
> note is a long sawtooth sliding a fifth under the others, and it rings on past the beat into the
> "Ready?" screen. `audioCtx()` returns null when muted, which is the whole guard.
>
> **`prefers-reduced-motion` changes the visuals and not the pacing.** The shake stays suppressed and
> `burst()` thins itself out as it already did, but the beat is deliberately *not* conditional
> ([1253–1260](../html/index.html#L1253-L1260)): it is pacing, not motion, and #58's rule is that the
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
> `gameover` each carry a `.run-flag` line ([655](../html/index.html#L655),
> [667](../html/index.html#L667)) filled from one new string, `run.jumped`
> ([1325](../html/index.html#L1325), [1383](../html/index.html#L1383)), which says both halves of it:
> the run is out of the hall of fame, and playing again gives an eligible one.
>
> It is written in `renderDynamicText()` ([2155–2157](../html/index.html#L2155-L2157)) rather than in
> `endGame()`, which is where every other conditional string is already rebuilt from state — so it
> also follows a mid-game language switch, and `newGame()` clearing `state.jumped` clears the line
> with it without anyone having to remember to. Both overlays get it because a jumped run that clears
> level 100 reaches `victory`, not `gameover`. Empty on an ordinary run, and `.run-flag:empty`
> ([383](../html/index.html#L383)) takes the element out of the layout entirely so the end screens are
> unchanged for everyone else.
>
> **The prompt's warning now reads as one.** `.jump-warn` ([440](../html/index.html#L440)) was 11px
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
([3141](../html/index.html#L3141)) and `maybeSaveBest()` ([3110](../html/index.html#L3110)). The
effect, on two runs identical apart from the shortcut:

| | Without S+E+B | With S+E+B |
|---|---|---|
| Score at death | 30 | 30 |
| What the player gets | `nameentry` → `halloffame` | `gameover`, immediately |

**The rule stays** — the world board can never be reset (#67) and brick value saturates toward 20×
(#41), so jumping to level 90 would otherwise be the cheapest high score in the game. The defect is
that nothing says it happened. The only notice is one line of 11px dim text on the jump prompt
([709](../html/index.html#L709), `.jump-warn` at [440](../html/index.html#L440)), read once, several
minutes before it matters. By the time the run ends the player has forgotten it — and the observed
behaviour is indistinguishable from the hall of fame being broken, which is exactly how it got
reported.

It is also the developer's own testing tool that disables the feature they are most likely testing.

### 73. ✅ FIXED — A "high scores" button on the end screens (S)

> **Fixed 2026-08-16.** `overlay-victory` and `overlay-gameover` each gained a secondary
> `btn-ghost` button beside the restart one ([659](../html/index.html#L659),
> [669](../html/index.html#L669)), so the board is reachable from the screen a run just ended on
> instead of costing a restart that replaces the score you wanted to compare against.
>
> The three entry points now share `viewHallOfFame(from)` ([2234–2238](../html/index.html#L2234-L2238))
> rather than repeating #43's three lines twice more. That is what keeps `state.returnPhase`
> honest: it is only ever meaningful because every route into `halloffame` sets it, and a route that
> forgot would send `setPhase(null)`. Re-rendering before the transition is not decoration either —
> the run that just ended may have changed the board, and the world list can have been swapped in
> underneath it (#67).
>
> **Restart stays the primary control.** `PHASE_OVERLAY` ([2065–2066](../html/index.html#L2065-L2066))
> still focuses `btn-restart` / `btn-restart-win`, per #26's rule that each overlay focuses its own
> call to action; `#73a`/`#73b` assert the new button does not take it.
>
> **`start.viewHof` became `hof.view`** ([1310](../html/index.html#L1310),
> [1368](../html/index.html#L1368)) across both tables and all three markup sites. The text was
> already right for all three screens — the key was the part that would have gone stale, naming one
> screen while appearing on three.

Losing a run leaves only "Rejouer". The board is reachable from the start screen (#43,
[626](../html/index.html#L626)) but not from the two screens where a player has just finished a run
and most wants to see where it landed — so checking costs a restart, and the score you wanted to
compare against is the one you just replaced on screen.

Add a secondary button to `overlay-gameover` ([662–670](../html/index.html#L662-L670)) and
`overlay-victory` ([648–660](../html/index.html#L648-L660)) beside the existing restart button.

Who it is actually for: a *qualifying* run already passes through the board on the way out, since
`endGame()` detours through `nameentry` → `halloffame`. So the button mostly serves runs that did not
qualify, plus anyone wanting a second look after the detour — and it is the only route to the board
for a jumped run (#69/#72), which never gets the detour at all.

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
