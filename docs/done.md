# Blokrush — Fixed Findings

Target: [blokrush.html](../html/index.html). This is the **done** half of the project's review backlog —
every finding here has shipped. Open items live in [todo.md](todo.md); what shipped in which commit is
tracked in [release-notes.md](release-notes.md). A finding keeps its original number when it moves
from `todo.md` to here, so numbering is shared across both files and never reused — every number from
1 up belongs to exactly one of the two.

Each entry keeps its original write-up (category, effort estimate, the bug as found) with a
`> **Fixed <date>.**` note prepended describing what shipped — a historical record, not a live TODO.

**Status:** 40 findings fixed. See [todo.md](todo.md) for what's still open.

**Line references below are re-anchored after each round of fixes** — they are only valid against the
current `index.html`.

---

## A. Correctness bugs

### 1. ✅ FIXED — No `<!DOCTYPE html>`, no `<meta charset="utf-8">` (S)
> **Fixed 2026-08-12.** The file now opens with `<!doctype html>` / `<html lang="fr">` and a real
> `<head>` carrying `<meta charset="utf-8">`, a viewport meta, and a `<title>`, with the markup
> wrapped in `<body>` — see [index.html:1–7](../html/index.html#L1-L7),
> [:543–544](../html/index.html#L543-L544), [:2522–2523](../html/index.html#L2522-L2523).

The file previously began directly with `<style>`, with no doctype, `<html>`, `<head>`, `<title>`,
charset, viewport, or `lang` attribute. Two real consequences:

- **Quirks mode.** Without a doctype the browser rendered in quirks mode, changing box-model and
  inline-layout behaviour.
- **Encoding.** The file contains raw UTF-8 accented text (`Détruisez` [:588](../html/index.html#L588),
  `Prêt ?` [:596](../html/index.html#L596), `Bougez` [:597](../html/index.html#L597)). With no charset
  declared, a browser opening this over `file://` or a server that didn't send `charset` would fall
  back to windows-1252 and render `DÃ©truisez`.

### 2. ✅ FIXED — `localStorage` access was unguarded, one throw killed the entire game (S)
> **Fixed 2026-08-12.** Reads and writes now go through `loadBest()` / `saveBest()`
> ([:1033–1047](../html/index.html#L1033-L1047)), both wrapped in `try/catch`, with the best score
> degrading to in-memory only. Call sites: [:1144](../html/index.html#L1144),
> [:2085](../html/index.html#L2085).

`localStorage.getItem(BEST_KEY)` was read at IIFE top level while constructing `state`. In Safari
private browsing, with cookies/site-data disabled, or in some sandboxed `file://` contexts,
`localStorage` access **throws** — which aborted the whole IIFE and rendered a dead canvas with no
error visible to the player.

### 3. ✅ FIXED — Held keys stuck when the window lost focus (S)
> **Fixed 2026-08-12.** A `blur` handler now clears every held key —
> [:1337–1343](../html/index.html#L1337-L1343).

`keydown` sets `state.keys[e.code] = true` [:1315](../html/index.html#L1315) and only `keyup` cleared it
[:1336](../html/index.html#L1336). Alt-tabbing (or hitting a browser shortcut) while holding <kbd>→</kbd>
meant the `keyup` was never delivered — on return the paddle slid into the wall and stayed pinned
until the key was pressed and released again.

### 4. ✅ FIXED — Power-up timers kept running while the game was paused (S)
> **Fixed 2026-08-12.** Effects now carry a `remaining` duration in seconds instead of an absolute
> `until` deadline, and `updateEffects(dt)` decrements it from the frame delta — which the loop only
> feeds while the phase is `playing`. See [:1711–1722](../html/index.html#L1711-L1722), the effect
> durations each `remaining` starts from in `CONFIG.effects`
> ([:826–833](../html/index.html#L826-L833), added by #21, since extended by #30), and the call site at
> [:2486](../html/index.html#L2486).
> Verified: a `widen` survives a 30-second pause intact, then expires after its full 10 seconds of
> actual play.

`widthEffect` / `speedEffect` stored an absolute `until` timestamp from `performance.now()` and were
compared against the rAF `now`. Pausing for 20 seconds silently burned a 10-second "widen". Counting
in accumulated play time also makes the timers immune to tab-throttling and clock adjustments.

### 5. ✅ FIXED — Game did not auto-pause when the tab was hidden or the window blurred (S)
> **Fixed 2026-08-12.** `autoPause()` ([:1345–1353](../html/index.html#L1345-L1353)) pauses whenever the
> phase is `playing`, wired to both `visibilitychange` and the existing `blur` handler from #3
> ([:1340–1343](../html/index.html#L1340-L1343)). It deliberately only fires *on* hide/blur, never on
> return, so the player resumes explicitly.

There was no `visibilitychange` handler. `requestAnimationFrame` throttles in a background tab, and
`dt` is clamped to 33 ms [:2479](../html/index.html#L2479), so the game didn't *jump* — but it stayed in
the `playing` phase, so power-up timers kept expiring (see #4) and returning to the tab dropped you
straight back into live play with no warm-up.

### 6. ✅ FIXED — `e.preventDefault()` on Space blocked button activation (S)
> **Fixed 2026-08-12.** The Space branch is now guarded by `isButtonFocused()` (renamed to
> `isTypingTarget()` and widened to cover text inputs too by #42, [:1308–1312](../html/index.html#L1308-L1312),
> used at [:1326](../html/index.html#L1326)): when a `<button>` holds focus the key is handed back to the
> browser, so it activates the button instead of launching the ball.
>
> This needed a companion fix. The deck's pause/mute buttons stay on screen and keep focus after a
> mouse click, so the guard alone would have made Space toggle pause instead of launching. A
> `blurIfPointerClick` helper ([:1628–1633](../html/index.html#L1628-L1633)) drops focus after pointer
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
> alongside the existing pointer-release logic — [:1318–1325](../html/index.html#L1318-L1325). Applied to
> all four movement codes (`ArrowLeft`/`ArrowRight`/`KeyA`/`KeyD`) rather than singling out the arrow
> keys, since suppressing the letter keys too is harmless and keeps them behaving identically.

`ArrowLeft`/`ArrowRight` are read but never `preventDefault`ed. On a narrow viewport where the cabinet
overflows, steering the paddle also scrolls the document under it.

### 8. ✅ FIXED — `mousedown` launches the ball on any button, including right-click (S)
> **Fixed 2026-08-13.** The handler now takes the event and returns early unless
> `e.button === 0` — [:1360–1363](../html/index.html#L1360-L1363).

`canvas.addEventListener("mousedown", handleLaunchOrResume)` had no `e.button` check. Right-clicking
or middle-clicking to open a context menu launched the ball.

### 9. ✅ FIXED — Ball–paddle collision teleported the ball on side hits (M)
> **Fixed 2026-08-13.** The ball's `y` from before the frame's own movement is captured as `prevY`
> [:1974](../html/index.html#L1974). A paddle collision is only resolved as a top-face bounce — steering
> by offset and snapping onto the top — when `prevY` was already above the paddle top
> [:2017–2025](../html/index.html#L2017-L2025); otherwise it resolves as a side hit that reflects only
> the horizontal component and repositions the ball beside the paddle, the same treatment a brick's
> side face gets [:2026–2034](../html/index.html#L2026-L2034). Paddle-velocity spin was left for a
> separate pass — out of scope for the teleport itself.

Any `circleRectCollide` with `dy > 0` snapped `ball.y = pr.y - ball.r - 0.5`, i.e. onto the top of the
paddle. A ball clipping the paddle's *side* while descending past it got warped upward and re-served,
which read as a phantom save.

### 10. ✅ FIXED — Only one brick collision was resolved per ball per frame, chosen by array order (M)
> **Fixed 2026-08-13.** The bricks loop no longer resolves against the first overlap it finds. It now
> scans every alive brick the ball overlaps, scores each with `brickPenetration()`
> [:1942–1951](../html/index.html#L1942-L1951) — the smaller of the two axis overlaps, i.e. how shallow
> the intrusion is — and resolves against whichever brick has the smallest penetration
> [:2037–2055](../html/index.html#L2037-L2055). Array order no longer has any say in which face gets hit.

The loop broke after the first overlapping brick. Bricks are stored top-row-first, so when a ball
overlapped two adjacent bricks in a corner, it always bounced off the *upper* one regardless of which
face it actually struck. Visible as occasional wrong-direction ricochets in the dense levels 4–5.

### 11. ✅ FIXED — Drop hitbox (8 px) didn't match the drawn capsule (10 px) (S)
> **Fixed 2026-08-13.** `updateDrops`'s hit test now uses the same 10px radius `drawDrops` renders the
> capsule with — [:1810–1811](../html/index.html#L1810-L1811) vs. the `arc(0, 0, 10, …)` at
> [:2409](../html/index.html#L2409).

`updateDrops` tested `± 8` while `drawDrops` rendered `arc(0,0,10,…)`. Power-ups visually clipped the
paddle without being collected.

### 12. ✅ FIXED — Multi-ball could spawn balls aimed straight down (S)
> **Fixed 2026-08-13.** The clone angle is derived from the source ball's angle mirrored upward when
> it's descending, then spread symmetrically to either side — [:1786–1790](../html/index.html#L1786-L1790).
> A source ball travelling straight down used to produce two clones that were also both descending and
> usually lost within a second; now every clone starts with a negative `dy`.

The clone angle was `atan2(base.dy, base.dx) ± 0.6`. If the source ball was descending, both clones
were also descending, making "M" feel like a dud.

### 13. ✅ FIXED — Best score was only persisted at game over (S)
> **Fixed 2026-08-13.** The `state.score > state.best` check and `saveBest()` call are now behind a
> shared `maybeSaveBest()` helper [:2079–2087](../html/index.html#L2079-L2087), called from
> `checkLevelClear()` [:2091](../html/index.html#L2091) as well as `endGame()`
> [:2101](../html/index.html#L2101). Progress is now checkpointed at every level clear, not just at the
> end of the run.

`endGame` was the only caller of `saveBest()`. Closing the tab mid-run — including after clearing four
levels — lost the score entirely.

---

## B. Performance

### 14. ✅ FIXED — `getComputedStyle(document.body)` called per drop, per frame (S)
> **Fixed 2026-08-13.** The font string is now built once into a module-level `DROP_FONT` constant
> [:802](../html/index.html#L802); `drawDrops` just assigns it — [:2412](../html/index.html#L2412). The
> body's font never changes at runtime, so there was nothing to gain from recomputing it 60 times a
> second.

`getComputedStyle(document.body)` was called inside the `drawDrops` loop, once per falling power-up,
per frame. This forced a synchronous style recalculation every frame for every falling power-up — the
single most expensive line in the render path.

### 15. ✅ FIXED — `updateHud()` writes four DOM nodes every frame (S)
> **Fixed 2026-08-13.** A `hudLast` cache [:2220](../html/index.html#L2220) records what's currently
> displayed for each of the four HUD fields; `updateHud()` [:2221–2232](../html/index.html#L2221-L2232)
> only touches `textContent` for a field whose value actually changed since the last call. The
> unconditional per-frame call [:2494](../html/index.html#L2494) stays — it's still what catches
> `state.best` needing a live update against `state.score` — but an idle frame now writes nothing.

`updateHud()` was called unconditionally every frame, in addition to the event-driven calls in
`brickHit`, `applyPowerup`, and `loseLife` — 240 needless `textContent` assignments per second even
while nothing displayed was changing.

### 16. ✅ FIXED — `checkLevelClear()` scans the full brick array every frame (S)
> **Fixed 2026-08-13.** `state.remainingBricks` [:1161](../html/index.html#L1161) counts destructible
> bricks still alive; `buildLevel()` seeds it when a level starts
> [:1202](../html/index.html#L1202)/[:1223](../html/index.html#L1223), and `brickHit()` decrements it at the
> single point a brick actually dies [:1902](../html/index.html#L1902). `checkLevelClear()`
> [:2089–2098](../html/index.html#L2089-L2098) is now an `O(1)` counter check instead of an `O(n)` scan.

`checkLevelClear()` ran `.some()` over up to 80 bricks every single frame. Cheap in absolute terms, but
trivially replaceable with a counter decremented in `brickHit`.

### 17. ✅ FIXED — Canvas backing store is sized from DPR only, ignoring displayed size (S)
> **Fixed 2026-08-13.** `fitCanvas()` [:695–709](../html/index.html#L695-L709) now reads the canvas's
> actual displayed width via `getBoundingClientRect()` and scales the backing store by
> `dpr * min(1, displayWidth / GAME_W)` — never upsizing past `dpr` (unchanged from before whenever the
> canvas is shown at or above its logical size), but shrinking the allocation when the canvas — styled
> `width: 100%; height: auto` — renders narrower than that, as on a phone.

`fitCanvas` always allocated `480 × 680 × dpr`. On a phone where the canvas displays at ~300 px wide
with `dpr = 3`, that was a 1440×2040 buffer for a 300 px element.

---

## C. Code quality / structure

### 18. ✅ FIXED — Phase transitions bypassed `setPhase()` in three places (S)
> **Fixed 2026-08-13.** `setPhase()` [:1524](../html/index.html#L1524) now owns every phase→overlay
> mapping via a `PHASE_OVERLAY` lookup [:1466–1480](../html/index.html#L1466-L1480), extended to cover
> `levelclear`/`victory`/`gameover` as well as the phases it already handled. `togglePause`
> [:1444](../html/index.html#L1444), `checkLevelClear` [:2095](../html/index.html#L2095), and `endGame`
> [:2103](../html/index.html#L2103) now all just call `setPhase(...)` instead of duplicating the
> `state.phase` assignment and `showOverlay` call. (#34 below was a follow-up gap — the boot-time
> start screen still bypassed this — since fixed.)

`setPhase` [:1524](../html/index.html#L1524) was the intended single entry point, but `togglePause`,
`checkLevelClear`, and `endGame` each assigned `state.phase` *and* called `showOverlay` directly.
That's the kind of duplication that causes an overlay/phase desync the first time someone adds a
state.

### 19. ✅ FIXED — Dead/redundant code (S)
> **Fixed 2026-08-13.**
> - `state.paddle.w` is gone entirely — both the initial field and the `updatePaddle` assignment that
>   nothing ever read; `paddleWidth()` remains the one source of truth.
> - The redundant `updateHud(); drawBackground(); drawBricks(); drawPaddle();` block right before the
>   first `requestAnimationFrame(frame)` call is removed; that first frame already paints the same
>   thing ~16 ms later via `draw()` [:2464–2473](../html/index.html#L2464-L2473), and the HUD's own
>   one-time init call [:2233](../html/index.html#L2233) already covers the pre-play text.
> - `updateBalls` [:1966](../html/index.html#L1966) now declares only the `dt` parameter it uses; the
>   call site [:2488](../html/index.html#L2488) no longer passes the unused `now`.

- `state.paddle.w` was assigned in `updatePaddle` but never read — every draw/collision path called
  `paddleWidth()` instead.
- The `updateHud(); drawBackground(); drawBricks(); drawPaddle();` block was redundant; the rAF loop
  paints the same frame ~16 ms later.
- `updateBalls(dt, now)` never used `now`.

### 20. ✅ FIXED — No `AudioContext` resume, and the mute state wasn't persisted (S)
> **Fixed 2026-08-13.** `beep()` [:1670](../html/index.html#L1670) now calls `actx.resume()`
> [:1679](../html/index.html#L1679) whenever the context is `"suspended"` — cheap and a no-op once
> already running, but it rescues audio for the rest of the session if the very first beep didn't
> happen to fire from inside a user-gesture handler. Separately, `state.muted` now round-trips through
> `loadMuted()`/`saveMuted()` [:1055–1056](../html/index.html#L1055-L1056), the same `storageGet`/
> `storageSet` pair [:1033–1047](../html/index.html#L1033-L1047) already used for the best score and the
> language preference, written on every toggle [:1653](../html/index.html#L1653) and read back into
> `state.muted` at boot [:1165](../html/index.html#L1165).

`beep` lazily constructed the context but never called `actx.resume()`. If the context was ever
created outside a user gesture it started `suspended` and the game was silently mute for the rest of
the session. Separately, `state.muted` wasn't saved, so the setting reset on every reload.

### 21. ✅ FIXED — Scattered magic numbers collected into a `CONFIG` block (M)
> **Fixed 2026-08-13.** A single `CONFIG` object [:821–887](../html/index.html#L821-L887) now holds drop
> fall speed, particle gravity, the ball cap, the paddle bounce spread, each power-up's mult/duration
> pair, and — since added by #28/#29/#30 — the difficulty ramp, combo/floating-text, and laser tuning
> too. Every call site reads from it instead of a local literal: drop fall speed
> [:1806](../html/index.html#L1806), particle gravity [:1850](../html/index.html#L1850), the ball cap in
> both of `applyPowerup`'s multi-ball checks [:1781](../html/index.html#L1781)/
> [:1788](../html/index.html#L1788), the paddle bounce spread [:2021](../html/index.html#L2021), and the
> four original effect branches [:1757–1768](../html/index.html#L1757-L1768).

Magic numbers were scattered through the file: drop fall speed `130`, particle gravity `260`, effect
durations `10`/`8` seconds, multipliers `1.6`/`0.6`/`0.7`/`1.4`, ball-cap `5`, paddle bounce spread
`1.05`. Collecting these into one `CONFIG` object makes the game tunable without hunting through the
logic.

---

## D. Accessibility

### 22. ✅ FIXED — Overlay state changes are now announced (S)
> **Fixed 2026-08-13.** All six `.overlay` divs [:585–621](../html/index.html#L585-L621) now carry
> `role="status" aria-live="polite"`, with a static `aria-hidden` default matching whether they're the
> one shown at boot. `showOverlay()` [:1491–1523](../html/index.html#L1491-L1523) keeps `aria-hidden` in
> sync with the `.show` class on every transition — the overlay actually on screen is the only one
> ever inside the accessibility tree, which is what lets a screen reader announce it as it appears
> rather than the swap happening silently.

Level-clear, game-over, and victory overlays swapped in silently. A screen-reader user got no
notification.

### 23. ✅ FIXED — Toggle buttons now reflect their state (S)
> **Fixed 2026-08-13** (half fixed 2026-08-12 by the bilingual work — see below). Both deck buttons
> default to `aria-pressed="false"` in markup [:678–679](../html/index.html#L678-L679) and are kept in
> sync by their render functions. `renderMuteButton()` [:1558–1563](../html/index.html#L1558-L1563) now
> also sets `aria-pressed`; a new `renderPauseButton()`
> [:1569–1575](../html/index.html#L1569-L1575) mirrors it for pause, and — since the pause button used to
> show the same "II" icon regardless of whether the game was actually paused — swaps the icon
> (`⏸`/`▶`) and `aria-label` between "pause" and "resume" too, not just `aria-pressed`. It's called
> from both `setPhase()` [:1527](../html/index.html#L1527) and `applyLanguage()`
> [:1612](../html/index.html#L1612), so it stays correct across phase changes and language switches
> alike. A `.icon-btn[aria-pressed="true"]` rule [:514–518](../html/index.html#L514-L518) gives both
> buttons the same visual "pressed" cue the language toggle already had.

> **Half fixed 2026-08-12** by the bilingual work. `renderMuteButton()`
> ([:1558–1563](../html/index.html#L1558-L1563)) sets the mute button's `aria-label` from both the
> language and the on/off state, so it no longer claims "Couper le son" while already muted.

Neither toggle exposed `aria-pressed`, and the pause button never changed its label or state when the
game was paused.

### 24. ✅ FIXED — Canvas now points assistive tech at the HUD (S)
> **Fixed 2026-08-13.** The HUD [:556–573](../html/index.html#L556-L573) was already reachable — plain,
> unhidden DOM text ahead of the canvas in reading order — so no canvas fallback content was needed;
> what was missing was the connection between the two. The canvas now carries
> `aria-describedby="hud"` [:581](../html/index.html#L581), pointing at the HUD container's new
> `id="hud"` [:556](../html/index.html#L556), so a screen-reader user who lands directly on the canvas
> (rather than reading the page linearly) is told where the live score/lives text actually lives.

`<canvas>` had an `aria-label` but empty inner content and no live text alternative for score/lives.

### 25. ✅ FIXED — `prefers-reduced-motion` is now read in JS too (S)
> **Fixed 2026-08-13.** `burst()` [:1280](../html/index.html#L1280) now scales its particle count down to
> roughly a third (never below 1) whenever `reduceMotion` is true, read from
> `matchMedia("(prefers-reduced-motion: reduce)")` [:1273–1277](../html/index.html#L1273-L1277) — live,
> via a `change` listener, rather than once at load, so toggling the OS setting mid-session takes
> effect on the very next burst rather than requiring a reload.

[:113–115](../html/index.html#L113-L115) disabled the title flicker, but the canvas particle bursts were
unaffected — the CSS media query can't reach into canvas drawing.

---

## E. Gameplay / UX enhancements

### 26. ✅ FIXED — Keyboard path out of the game-over / victory screens (S)
> **Fixed 2026-08-13.** `showOverlay()` [:1491–1523](../html/index.html#L1491-L1523) now focuses the
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

`handleLaunchOrResume` [:1397](../html/index.html#L1397) only handled `ready` and `paused`. From
`gameover`, `victory`, `levelclear`, or the initial `start` screen, Space did nothing — the player had
to reach for the mouse.

### 27. ✅ FIXED — Touch: the first tap both aimed and launched (S)
> **Fixed 2026-08-13.** Launching moved from `touchstart` to a new `touchend` handler
> [:1380–1395](../html/index.html#L1380-L1395); `touchstart`/`touchmove`
> [:1368–1379](../html/index.html#L1368-L1379) now only update `pointerX`, aiming the paddle. That gives
> the player a chance to drag into position before committing to serve, instead of the ball launching
> from wherever the finger first landed. The "vertical offset" half of the original fix — tracking the
> paddle's own Y position above the finger — was deliberately dropped: the paddle only ever steers
> horizontally, so moving it vertically during touch play would be a materially bigger change (new
> collision geometry, different feel from mouse/keyboard play) than this finding's effort estimate
> implied, and isn't needed to fix the actual bug (the ball launching prematurely). (#35 below is a
> follow-up gap in the `touchend` handler itself.)

`touchstart` [:1368](../html/index.html#L1368) (previously) set `pointerX` and immediately called
`handleLaunchOrResume`. On mobile you could not position the paddle before serving — the ball launched
from wherever your finger first landed.

### 28. ✅ FIXED — Difficulty ramp within a level (M)
> **Fixed 2026-08-13.** `state.difficultyMult` [:1163](../html/index.html#L1163) multiplies directly into
> ball velocity [:1975](../html/index.html#L1975), alongside the existing power-up speed multiplier. It
> ramps via `bumpDifficulty()` [:1192–1194](../html/index.html#L1192-L1194) — cumulative, multiplicative,
> capped at `CONFIG.difficulty.max` — from two classic-Breakout triggers: every top-wall bounce
> [:1981–1987](../html/index.html#L1981-L1987), and every `CONFIG.difficulty.brickMilestone` bricks
> destroyed in the current level [:1903–1906](../html/index.html#L1903-L1906). `CONFIG.difficulty`
> [:847–852](../html/index.html#L847-L852) holds the tuning; `buildLevel()`
> [:1224–1225](../html/index.html#L1224-L1225) resets both the multiplier and the milestone counter at the
> start of every level, so the ramp never carries over from one level — or one difficulty — to the
> next.

Ball speed was fixed per level ([:1235](../html/index.html#L1235), `LEVELS[i].speed`). Classic breakout
speeds the ball up after N bricks or on reaching the top wall, which prevents long stalemates on the
last brick.

### 29. ✅ FIXED — Score feedback on the canvas (M)
> **Fixed 2026-08-13.** Destroying a brick now spawns a floating `"+N"` pop-up at its position
> ([:1295–1300](../html/index.html#L1295-L1300), rising and fading over `CONFIG.floatingText.life`
> seconds via `updateFloatingTexts()`/`drawFloatingTexts()`
> [:1854–1861](../html/index.html#L1854-L1861)/[:2447–2462](../html/index.html#L2447-L2462)), wired into
> the frame loop alongside particles [:2492](../html/index.html#L2492)/[:2497](../html/index.html#L2497)
> and `draw()` [:2472](../html/index.html#L2472). Consecutive bricks destroyed without the ball touching
> the paddle also build a combo [:1910–1915](../html/index.html#L1910-L1915) that scales the points
> awarded, capped at `CONFIG.combo.max`; any paddle contact — top face or side clip — resets it
> [:2005](../html/index.html#L2005). `CONFIG.combo`/`CONFIG.floatingText`
> [:853–886](../html/index.html#L853-L886) hold the tuning. This changes the scoring curve going forward
> — an unbroken combo now scores noticeably more than the same bricks hit in isolation — so existing
> saved best scores are no longer directly comparable to newly-earned ones.

Points were only visible in the HUD, with no combo mechanic for consecutive brick hits without a
paddle touch.

### 30. ✅ FIXED — Sticky paddle and laser power-ups (M)
> **Fixed 2026-08-13.** Both suggested additions are in, slotting into the existing timed-effect
> architecture: `POWERUPS` [:792–793](../html/index.html#L792-L793), `CONFIG.effects.sticky`/
> `CONFIG.effects.laser` [:831–832](../html/index.html#L831-L832), and two new branches in
> `applyPowerup` [:1772–1777](../html/index.html#L1772-L1777).
>
> **Sticky** re-attaches a ball on a genuine top-face paddle hit while `stickyEffect` is active
> [:2007–2016](../html/index.html#L2007-L2016), capped to one attached ball at a time so multi-ball
> can't stack several on the paddle at once. `updatePaddle()`'s attached-ball tracking, previously
> hardcoded to `balls[0]`, now loops over every ball [:1704–1708](../html/index.html#L1704-L1708) since
> sticky can catch any of them, not just the one served at the start of a life.
>
> **Laser** gives the action button a second job during `"playing"`: alongside releasing a stuck ball,
> `handleLaunchOrResume()` [:1397–1407](../html/index.html#L1397-L1407) now calls `fireLaser()`
> [:1430–1442](../html/index.html#L1430-L1442), which fires classic twin bolts from the paddle on a
> cooldown (`CONFIG.laser` [:837–842](../html/index.html#L837-L842)). `updateLasers()`
> [:1821–1842](../html/index.html#L1821-L1842) moves them and reuses `brickHit()` on impact — the same
> scoring/combo/difficulty path a ball hit goes through — and `drawLasers()`
> [:2420–2433](../html/index.html#L2420-L2433) renders them. Releasing a sticky ball and firing both
> route through the same action-button entry point used everywhere else (mouse, touch, Space), via a
> new `launchAttachedBalls()` helper [:1409–1422](../html/index.html#L1409-L1422) `launchBall()`
> (the "ready" → "playing" serve) now also calls.

The current six were solid, but nothing rewarded skillful play with new tools. **Sticky paddle** (ball
re-attaches, aim the next shot) and **laser** (fire upward on Space) were the suggested natural
additions.

### 31. ✅ FIXED — Active power-up timers are now visible (S)
> **Fixed 2026-08-13.** A depleting bar per effect, under the HUD
> ([:652–672](../html/index.html#L652-L672) markup, [:204–249](../html/index.html#L204-L249) CSS). Slots
> are toggled with the `hidden` attribute and resized via the fill's inline width rather than
> created/destroyed — see `updateEffectBar()`/`renderEffectBars()`
> [:2254–2282](../html/index.html#L2254-L2282), called after every `applyPowerup()`
> [:1800](../html/index.html#L1800) and once per frame [:2499](../html/index.html#L2499). `state.widthEffect`/
> `state.speedEffect` don't record which specific powerup produced them, only the resulting `mult`, so
> the bar recovers it from the sign of `mult` — the same trick `drawPaddle()`
> [:2368](../html/index.html#L2368) already used for its colour swap.

The paddle changed colour for width effects, but there was no indication of *how long* an effect
lasted, and speed effects had no visual at all.

### 32. ✅ FIXED — Add more levels (M)
> **Fixed 2026-08-13.** Five hand-authored levels added to `LEVELS`
> [:742–756](../html/index.html#L742-L756), taking the game from 5 levels to 10. Went with hand-authored
> over the procedural-generator option: it keeps the existing finite-levels-then-`victory` structure
> intact (`checkLevelClear()`'s `LEVELS.length - 1` win check [:2092](../html/index.html#L2092), the HUD's
> `n/LEVELS.length` readout [:2226](../html/index.html#L2226), and `level.of`'s `{n}/{total}` string all
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
> [:586](../html/index.html#L586) and [:595](../html/index.html#L595).

Endless mode past level 5 (a procedural generator) was the other option on the table; not pursued here
— see the fix note above for why hand-authoring won out for this pass. Tracked as its own follow-up in
[todo.md](todo.md) (#41) if endless play is wanted later, no longer under #32.

### 37. ✅ FIXED — The power-up timer bars (#31) reflow the whole cabinet when they appear (M)
> **Fixed 2026-08-13.** `.effect-bars` and `.screen-wrap` are now independent flex siblings inside
> a new `.play-row` [:257–261](../html/index.html#L257-L261) — the effect-bars markup moved from
> before `.screen-wrap` to after it, as a sibling rather than a fellow child of `.cabinet`'s own
> flex column [:57–65](../html/index.html#L57-L65) *(markup: [:578](../html/index.html#L578)
> wraps both; the bars themselves are now at [:655–672](../html/index.html#L655-L672))*.
> `.effect-bars` [:214–219](../html/index.html#L214-L219) takes a fixed `flex: 0 0 84px` column
> instead of wrapping horizontally, so a slot's `hidden` toggle (still the same mechanism from
> #31 — see `updateEffectBar()` [:2254–2263](../html/index.html#L2254-L2263)) resizes only that
> column's own height, never `.screen-wrap`'s; the canvas inside it doesn't move. Below a
> 560px-viewport breakpoint [:531–541](../html/index.html#L531-L541) there isn't width to spare for
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
> `OVERLAY_BUTTON_IDS` lookup [:1481–1490](../html/index.html#L1481-L1490) is built from
> `PHASE_OVERLAY`'s button entries (from `OVERLAY_PRIMARY_BTN`'s values at the time; #36 below folded
> that map into `PHASE_OVERLAY`), and `showOverlay()` [:1509–1512](../html/index.html#L1509-L1512)
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
> [:1467](../html/index.html#L1467) — `OVERLAY_PRIMARY_BTN` already had the matching
> `"overlay-start": "btn-start"` since #26 [:1467](../html/index.html#L1467) — so boot
> [:2512](../html/index.html#L2512) now calls `setPhase("start")` instead of `showOverlay(...)`
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
> **Fixed 2026-08-13.** `touchend`'s handler [:1380–1396](../html/index.html#L1380-L1396) now only
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
> **Fixed 2026-08-13.** `PHASE_OVERLAY` [:1466–1480](../html/index.html#L1466-L1480) is now the only
> map: each phase's entry carries both its overlay id and its button id together (e.g.
> `paused: { overlay: "overlay-pause", button: "btn-resume" }`), or is `null`/has no `button` key
> for `"playing"`/`"ready"`. `OVERLAY_PRIMARY_BTN` is gone; `OVERLAY_BUTTON_IDS`
> [:1481–1490](../html/index.html#L1481-L1490) (see #33) and `setPhase()`
> [:1524–1532](../html/index.html#L1524-L1532) both derive what they need from `PHASE_OVERLAY` alone,
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
> existing overlap test — [:1991–2003](../html/index.html#L1991-L2003). When the ball's start-of-frame
> position was above the paddle top but its end-of-frame position has already cleared the paddle
> bottom (the exact tunneling case: no overlap left for `circleRectCollide` to catch), it's rewound
> to the point where it crossed the paddle's top plane, so the existing `isTopHit` branch just below
> sees a normal top hit and steers it exactly as it always has. Bricks are deliberately exempt — a
> missed brick costs nothing, the ball just continues past it — so this only guards the one collision
> that actually costs the player something. The stale comment in `LEVELS`
> ([:747–753](../html/index.html#L747-L753)) claiming level 10's speed was "kept under the ceiling" is
> corrected too: that ceiling never held once the difficulty ramp was accounted for, and the sweep
> makes level speed a non-issue for this class of bug going forward. The paper-math test in
> `test/suites/physics.js` ("the ball cannot tunnel through the paddle...") is now a behavioural test
> that drives this exact worst case — level 10, `fast`, `difficultyMult` pinned to its cap, one 33ms
> frame — and asserts the ball still bounces; a matching `#38` regression test covers the same ground
> in `test/suites/regressions.js`.

The "cannot tunnel through the paddle at maximum speed" test
([test/suites/physics.js:202–218](../test/suites/physics.js#L202-L218)) only budgets for
`baseBallSpeed * LEVELS[i].speed * fast-powerup's 1.4x`, capped by the 33ms clamped max `dt`
([:2479](../html/index.html#L2479)). It never factors in `state.difficultyMult`
([:1163](../html/index.html#L1163)), the mid-level ramp (up to `CONFIG.difficulty.max` = `1.6`,
[:851](../html/index.html#L851)) that's multiplied into the same per-frame displacement at
[:1975](../html/index.html#L1975):

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
[:1990](../html/index.html#L1990):

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
comment at [:746–754](../html/index.html#L746-L754) claiming level 10 is "kept under the ceiling" should
be corrected either way, since it's not accurate today.

### 39. ✅ FIXED — Stale "1/5" HUD markup fallback (S)
> **Fixed 2026-08-14.** The markup now reads `<div class="hud-value" id="hud-level">1/10</div>`
> ([:567](../html/index.html#L567)), matching the two overlay-eyebrow fallbacks #32 already updated. A
> `#39` regression test in `test/suites/regressions.js` checks the raw source text directly (not the
> post-boot DOM, since `updateHud()` overwrites this on the very first frame regardless of what the
> static markup said) so a future level-count change can't let this one quietly go stale again.

The static HUD counter at [:567](../html/index.html#L567) —
`<div class="hud-value" id="hud-level">1/5</div>` — was not updated when #32 took the game to 10
levels, even though the #32 fix explicitly updated the two parallel overlay-eyebrow fallbacks at
[:586](../html/index.html#L586) and [:595](../html/index.html#L595) for the identical reason (both read
"Niveau 1 / 10" now). `updateHud()` ([:2226](../html/index.html#L2226)) overwrites it with the real
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
([:758](../html/index.html#L758)) — which is exactly the kind of brick-adjacency layout the
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
> (a text input + submit button, markup at [:632–640](../html/index.html#L632-L640)) and `halloffame`
> (the top-10 board + a continue button, [:642–648](../html/index.html#L642-L648)), each with its own
> `PHASE_OVERLAY` entry ([:1476–1477](../html/index.html#L1476-L1477)) rather than bolting an input onto
> `overlay-victory`/`overlay-gameover` directly. `endGame()` ([:2100–2109](../html/index.html#L2100-L2109))
> detours through `nameentry` — remembering which final screen to return to afterward in
> `state.returnPhase` (generalized from a `pendingWon` boolean by #43) — whenever
> `qualifiesForHallOfFame(state.score)`
> ([:2134–2136](../html/index.html#L2134-L2136)) is true: strictly greater than 0, and either the board
> has room or the score beats its current lowest entry via `hallOfFameRank()`
> ([:2122–2127](../html/index.html#L2122-L2127)) — a tie with the lowest entry does not bump it. The
> board is a capped, sorted `{name, score}` list under a new `neonbreak-hall-of-fame` key
> ([:1031](../html/index.html#L1031)), round-tripped through `loadHallOfFame()`/`saveHallOfFame()`
> ([:1063–1076](../html/index.html#L1063-L1076)) via the same guarded `storageGet`/`storageSet` pair #2
> already uses — a throw, or corrupted/foreign JSON under that key, degrades to an empty board rather
> than taking the game down.
>
> A submitted name is trimmed, capped to `CONFIG.hallOfFame.nameMax` (12 characters,
> [:883–886](../html/index.html#L883-L886)), and falls back to a translated `"???"` placeholder when
> empty (`submitHallOfFameName()`, [:2156–2173](../html/index.html#L2156-L2173)). `renderHallOfFame()`
> ([:2180–2205](../html/index.html#L2180-L2205)) rebuilds the board through `innerHTML` rather than
> `textContent` as sketched below — the test harness's DOM stub has no `createElement`/`appendChild`
> to build real nodes with — but every interpolated value (the name; the score too, for uniformity)
> goes through a small `escapeHtml()` helper first ([:728–730](../html/index.html#L728-L730)), so a name
> like `<img src=x onerror=...>` still can't be interpreted as markup. `isButtonFocused()` is renamed
> to `isTypingTarget()` and widened to also cover a focused `<input>`
> ([:1309–1312](../html/index.html#L1309-L1312)), so Space still reaches the name field instead of being
> hijacked for launch/laser; Enter submits directly from the field
> ([:1331–1333](../html/index.html#L1331-L1333)) since nothing else in this file uses a `<form>`.
>
> Covered by ten `#42a`–`#42j` cases in `regressions.js` — qualification gating including the score-0
> and tie edge cases, sorted insertion, the empty-name fallback, HTML-escaping, the win/loss branch
> back out, Space/Enter handling, and the max-size cap — plus two round-trip cases in `persistence.js`,
> including the `storageThrows` guard. Four existing tests that happened to end a run with a
> qualifying score (`state.js`, `rules.js`, `i18n.js`, `persistence.js`) now seed a full board via the
> `storage` boot option so they keep exercising what they were actually about, not the hall of fame.

Feature request: when a run ends (`endGame()`, [:2100](../html/index.html#L2100)) with a score that
qualifies, prompt the player for their name, then show a top-10 leaderboard of name+score pairs.

Today only a single number persists across sessions — `state.best`, round-tripped through
`loadBest()`/`saveBest()` ([:1046–1047](../html/index.html#L1046-L1047)) under `BEST_KEY`
([:1028](../html/index.html#L1028)), both guarded by `storageGet`/`storageSet`
([:1037–1045](../html/index.html#L1037-L1045)) per #2. This replaces "a number" with "a list":
a new `localStorage` key (e.g. `neonbreak-hall-of-fame`) holding a JSON array of `{ name, score }`,
capped at 10, sorted descending, read/written through the same guarded helpers so a throwing
`localStorage` degrades the same way #2 already handles for the best score.

**Where it hooks in:** both `endGame(true)` and `endGame(false)` ([:2100](../html/index.html#L2100)) —
a run can end either by winning or by running out of lives, and both should qualify. The natural gate
is "does this score beat the lowest of the current top 10 (or is the list not yet full)?" — most runs
won't qualify, and skipping the prompt entirely for those keeps the existing victory/gameover flow
(`PHASE_OVERLAY` [:1466–1480](../html/index.html#L1466-L1480), `overlay-victory`/`overlay-gameover`
markup [:613–627](../html/index.html#L613-L627)) untouched for the common case.

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
  empty-list message) needs a key in both `STRINGS.fr` and `STRINGS.en` ([:898](../html/index.html#L898))
  — the `i18n` suite already fails the build if one language's table is missing a key the other has,
  so this is enforced automatically once the keys exist.
- *Keyboard/focus.* The name-entry overlay's input should get focus the way every other overlay's
  primary button does today (`showOverlay()` [:1491](../html/index.html#L1491), #26), and
  submitting needs both an Enter-in-the-input path and a click path — mirroring how
  `handleLaunchOrResume()` already serves keyboard, mouse, and touch from one entry point.

**Test coverage this would need:** a `persistence` suite case for the hall-of-fame round-trip
(including the `storageThrows` guard, per #2's test), a `state`/`rules` case for the qualifying-score
gate, and — since this is the first free-text player input — an explicit case asserting a name
containing HTML-special characters renders as literal text, not markup.

### 43. ✅ FIXED — View the hall of fame from the start screen, before playing (S)
> **Fixed 2026-08-14.** A second, lower-emphasis button on `overlay-start`
> ([:590–591](../html/index.html#L590-L591), styled with a new `.btn-ghost` modifier
> [:392–397](../html/index.html#L392-L397)) opens the board on demand — its handler
> ([:1620–1626](../html/index.html#L1620-L1626)) sets `state.returnPhase = "start"` and calls
> `setPhase("halloffame")` directly, never `newGame()`, so score/lives/level are untouched. The
> board itself needed no changes — `renderHallOfFame()` already renders `halloffame.empty` for a
> fresh install with nothing on it yet, exactly as sketched below.
>
> `state.pendingWon` (a `true`/`false`/`null` flag) is generalized into `state.returnPhase`
> (`"start"` / `"victory"` / `"gameover"`, [:1173–1178](../html/index.html#L1173-L1178)): `endGame()`
> ([:2104](../html/index.html#L2104)) sets it to `won ? "victory" : "gameover"` before the post-game
> detour exactly as `pendingWon` did, and the continue button
> ([:1645–1647](../html/index.html#L1645-L1647)) just does `setPhase(state.returnPhase)` — one field
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
([:1031](../html/index.html#L1031)), so two players never see each other's scores, and the same person
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
interpolated values ([:2201–2202](../html/index.html#L2201-L2202)), so XSS is handled, but a public
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
