# Neon Break — Code Review Findings

Reviewed: 2026-08-12 · Target: [arkanoid.html](../arkanoid.html)

The project is a single self-contained file, `arkanoid.html`: a bilingual (French/English) neon arcade
breakout game. Vanilla ES5-style JS in an IIFE, 2D canvas, no build step, no dependencies, no tests.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** #1–#25 fixed, 7 items open. What shipped and when is tracked in
[release-notes.md](release-notes.md); individual items below carry a `✅ FIXED` note with the details.

**Line references below are re-anchored after each round of fixes** — they are only valid against the
current `arkanoid.html`.

---

## A. Correctness bugs

### 1. ✅ FIXED — No `<!DOCTYPE html>`, no `<meta charset="utf-8">` (S)
> **Fixed 2026-08-12.** The file now opens with `<!doctype html>` / `<html lang="fr">` and a real
> `<head>` carrying `<meta charset="utf-8">`, a viewport meta, and a `<title>`, with the markup
> wrapped in `<body>` — see [arkanoid.html:1–7](../arkanoid.html#L1-L7),
> [:420–421](../arkanoid.html#L420-L421), [:1598–1599](../arkanoid.html#L1598-L1599).

The file previously began directly with `<style>`, with no doctype, `<html>`, `<head>`, `<title>`,
charset, viewport, or `lang` attribute. Two real consequences:

- **Quirks mode.** Without a doctype the browser rendered in quirks mode, changing box-model and
  inline-layout behaviour.
- **Encoding.** The file contains raw UTF-8 accented text (`Détruisez` [:461](../arkanoid.html#L461),
  `Prêt ?` [:467](../arkanoid.html#L467), `Bougez` [:468](../arkanoid.html#L468)). With no charset
  declared, a browser opening this over `file://` or a server that didn't send `charset` would fall
  back to windows-1252 and render `DÃ©truisez`.

### 2. ✅ FIXED — `localStorage` access was unguarded, one throw killed the entire game (S)
> **Fixed 2026-08-12.** Reads and writes now go through `loadBest()` / `saveBest()`
> ([:760–777](../arkanoid.html#L760-L777)), both wrapped in `try/catch`, with the best score
> degrading to in-memory only. Call sites: [:789](../arkanoid.html#L789),
> [:1409](../arkanoid.html#L1409).

`localStorage.getItem(BEST_KEY)` was read at IIFE top level while constructing `state`. In Safari
private browsing, with cookies/site-data disabled, or in some sandboxed `file://` contexts,
`localStorage` access **throws** — which aborted the whole IIFE and rendered a dead canvas with no
error visible to the player.

### 3. ✅ FIXED — Held keys stuck when the window lost focus (S)
> **Fixed 2026-08-12.** A `blur` handler now clears every held key —
> [:922–931](../arkanoid.html#L922-L931).

`keydown` sets `state.keys[e.code] = true` [:907](../arkanoid.html#L907) and only `keyup` cleared it
[:921](../arkanoid.html#L921). Alt-tabbing (or hitting a browser shortcut) while holding <kbd>→</kbd>
meant the `keyup` was never delivered — on return the paddle slid into the wall and stayed pinned
until the key was pressed and released again.

### 4. ✅ FIXED — Power-up timers kept running while the game was paused (S)
> **Fixed 2026-08-12.** Effects now carry a `remaining` duration in seconds instead of an absolute
> `until` deadline, and `updateEffects(dt)` decrements it from the frame delta — which the loop only
> feeds while the phase is `playing`. See [:1185–1196](../arkanoid.html#L1185-L1196), the effect
> durations each `remaining` starts from in `CONFIG.effects`
> ([:625–630](../arkanoid.html#L625-L630), added by #21), and the call site at
> [:1579](../arkanoid.html#L1579).
> Verified: a `widen` survives a 30-second pause intact, then expires after its full 10 seconds of
> actual play.

`widthEffect` / `speedEffect` stored an absolute `until` timestamp from `performance.now()` and were
compared against the rAF `now`. Pausing for 20 seconds silently burned a 10-second "widen". Counting
in accumulated play time also makes the timers immune to tab-throttling and clock adjustments.

### 5. ✅ FIXED — Game did not auto-pause when the tab was hidden or the window blurred (S)
> **Fixed 2026-08-12.** `autoPause()` ([:930–939](../arkanoid.html#L930-L939)) pauses whenever the
> phase is `playing`, wired to both `visibilitychange` and the existing `blur` handler from #3
> ([:925–928](../arkanoid.html#L925-L928)). It deliberately only fires *on* hide/blur, never on
> return, so the player resumes explicitly.

There was no `visibilitychange` handler. `requestAnimationFrame` throttles in a background tab, and
`dt` is clamped to 33 ms [:1572](../arkanoid.html#L1572), so the game didn't *jump* — but it stayed in
the `playing` phase, so power-up timers kept expiring (see #4) and returning to the tab dropped you
straight back into live play with no warm-up.

### 6. ✅ FIXED — `e.preventDefault()` on Space blocked button activation (S)
> **Fixed 2026-08-12.** The Space branch is now guarded by `isButtonFocused()`
> ([:898–903](../arkanoid.html#L898-L903), used at [:918](../arkanoid.html#L918)): when a `<button>`
> holds focus the key is handed back to the browser, so it activates the button instead of launching
> the ball.
>
> This needed a companion fix. The deck's pause/mute buttons stay on screen and keep focus after a
> mouse click, so the guard alone would have made Space toggle pause instead of launching. A
> `blurIfPointerClick` helper ([:1108–1113](../arkanoid.html#L1108-L1113)) drops focus after pointer
> clicks only — keyboard activation (`detail === 0`) keeps it, so tab-order navigation is unharmed.

Space was unconditionally `preventDefault`ed. Correct for stopping page scroll, but it also prevented
Space from activating a keyboard-focused `.btn` — a keyboard-only player who tabbed to "Rejouer" could
not press it with Space (Enter still worked).

### 7. ✅ FIXED — Arrow keys scroll the page (S)
> **Fixed 2026-08-13.** The movement branch in the `keydown` handler now calls `e.preventDefault()`
> alongside the existing pointer-release logic — [:910–917](../arkanoid.html#L910-L917). Applied to
> all four movement codes (`ArrowLeft`/`ArrowRight`/`KeyA`/`KeyD`) rather than singling out the arrow
> keys, since suppressing the letter keys too is harmless and keeps them behaving identically.

`ArrowLeft`/`ArrowRight` are read but never `preventDefault`ed. On a narrow viewport where the cabinet
overflows, steering the paddle also scrolls the document under it.

### 8. ✅ FIXED — `mousedown` launches the ball on any button, including right-click (S)
> **Fixed 2026-08-13.** The handler now takes the event and returns early unless
> `e.button === 0` — [:945–948](../arkanoid.html#L945-L948).

`canvas.addEventListener("mousedown", handleLaunchOrResume)` had no `e.button` check. Right-clicking
or middle-clicking to open a context menu launched the ball.

### 9. ✅ FIXED — Ball–paddle collision teleported the ball on side hits (M)
> **Fixed 2026-08-13.** The ball's `y` from before the frame's own movement is captured as `prevY`
> [:1329](../arkanoid.html#L1329). A paddle collision is only resolved as a top-face bounce — steering
> by offset and snapping onto the top — when `prevY` was already above the paddle top
> [:1341–1349](../arkanoid.html#L1341-L1349); otherwise it resolves as a side hit that reflects only
> the horizontal component and repositions the ball beside the paddle, the same treatment a brick's
> side face gets [:1350–1357](../arkanoid.html#L1350-L1357). Paddle-velocity spin was left for a
> separate pass — out of scope for the teleport itself.

Any `circleRectCollide` with `dy > 0` snapped `ball.y = pr.y - ball.r - 0.5`, i.e. onto the top of the
paddle. A ball clipping the paddle's *side* while descending past it got warped upward and re-served,
which read as a phantom save.

### 10. ✅ FIXED — Only one brick collision was resolved per ball per frame, chosen by array order (M)
> **Fixed 2026-08-13.** The bricks loop no longer resolves against the first overlap it finds. It now
> scans every alive brick the ball overlaps, scores each with `brickPenetration()`
> [:1297–1306](../arkanoid.html#L1297-L1306) — the smaller of the two axis overlaps, i.e. how shallow
> the intrusion is — and resolves against whichever brick has the smallest penetration
> [:1361–1379](../arkanoid.html#L1361-L1379). Array order no longer has any say in which face gets hit.

The loop broke after the first overlapping brick. Bricks are stored top-row-first, so when a ball
overlapped two adjacent bricks in a corner, it always bounced off the *upper* one regardless of which
face it actually struck. Visible as occasional wrong-direction ricochets in the dense levels 4–5.

### 11. ✅ FIXED — Drop hitbox (8 px) didn't match the drawn capsule (10 px) (S)
> **Fixed 2026-08-13.** `updateDrops`'s hit test now uses the same 10px radius `drawDrops` renders the
> capsule with — [:1246–1247](../arkanoid.html#L1246-L1247) vs. the `arc(0, 0, 10, …)` at
> [:1536](../arkanoid.html#L1536).

`updateDrops` tested `± 8` while `drawDrops` rendered `arc(0,0,10,…)`. Power-ups visually clipped the
paddle without being collected.

### 12. ✅ FIXED — Multi-ball could spawn balls aimed straight down (S)
> **Fixed 2026-08-13.** The clone angle is derived from the source ball's angle mirrored upward when
> it's descending, then spread symmetrically to either side — [:1223–1227](../arkanoid.html#L1223-L1227).
> A source ball travelling straight down used to produce two clones that were also both descending and
> usually lost within a second; now every clone starts with a negative `dy`.

The clone angle was `atan2(base.dy, base.dx) ± 0.6`. If the source ball was descending, both clones
were also descending, making "M" feel like a dud.

### 13. ✅ FIXED — Best score was only persisted at game over (S)
> **Fixed 2026-08-13.** The `state.score > state.best` check and `saveBest()` call are now behind a
> shared `maybeSaveBest()` helper [:1403–1411](../arkanoid.html#L1403-L1411), called from
> `checkLevelClear()` [:1415](../arkanoid.html#L1415) as well as `endGame()`
> [:1425](../arkanoid.html#L1425). Progress is now checkpointed at every level clear, not just at the
> end of the run.

`endGame` was the only caller of `saveBest()`. Closing the tab mid-run — including after clearing four
levels — lost the score entirely.

---

## B. Performance

### 14. ✅ FIXED — `getComputedStyle(document.body)` called per drop, per frame (S)
> **Fixed 2026-08-13.** The font string is now built once into a module-level `DROP_FONT` constant
> [:603](../arkanoid.html#L603); `drawDrops` just assigns it — [:1539](../arkanoid.html#L1539). The
> body's font never changes at runtime, so there was nothing to gain from recomputing it 60 times a
> second.

`getComputedStyle(document.body)` was called inside the `drawDrops` loop, once per falling power-up,
per frame. This forced a synchronous style recalculation every frame for every falling power-up — the
single most expensive line in the render path.

### 15. ✅ FIXED — `updateHud()` writes four DOM nodes every frame (S)
> **Fixed 2026-08-13.** A `hudLast` cache [:1443](../arkanoid.html#L1443) records what's currently
> displayed for each of the four HUD fields; `updateHud()` [:1444–1455](../arkanoid.html#L1444-L1455)
> only touches `textContent` for a field whose value actually changed since the last call. The
> unconditional per-frame call [:1584](../arkanoid.html#L1584) stays — it's still what catches
> `state.best` needing a live update against `state.score` — but an idle frame now writes nothing.

`updateHud()` was called unconditionally every frame, in addition to the event-driven calls in
`brickHit`, `applyPowerup`, and `loseLife` — 240 needless `textContent` assignments per second even
while nothing displayed was changing.

### 16. ✅ FIXED — `checkLevelClear()` scans the full brick array every frame (S)
> **Fixed 2026-08-13.** `state.remainingBricks` [:801](../arkanoid.html#L801) counts destructible
> bricks still alive; `buildLevel()` seeds it when a level starts
> [:821](../arkanoid.html#L821)/[:838](../arkanoid.html#L838), and `brickHit()` decrements it at the
> single point a brick actually dies [:1276](../arkanoid.html#L1276). `checkLevelClear()`
> [:1413–1422](../arkanoid.html#L1413-L1422) is now an `O(1)` counter check instead of an `O(n)` scan.

`checkLevelClear()` ran `.some()` over up to 80 bricks every single frame. Cheap in absolute terms, but
trivially replaceable with a counter decremented in `brickHit`.

### 17. ✅ FIXED — Canvas backing store is sized from DPR only, ignoring displayed size (S)
> **Fixed 2026-08-13.** `fitCanvas()` [:529–543](../arkanoid.html#L529-L543) now reads the canvas's
> actual displayed width via `getBoundingClientRect()` and scales the backing store by
> `dpr * min(1, displayWidth / GAME_W)` — never upsizing past `dpr` (unchanged from before whenever the
> canvas is shown at or above its logical size), but shrinking the allocation when the canvas — styled
> `width: 100%; height: auto` — renders narrower than that, as on a phone.

`fitCanvas` always allocated `480 × 680 × dpr`. On a phone where the canvas displays at ~300 px wide
with `dpr = 3`, that was a 1440×2040 buffer for a 300 px element.

---

## C. Code quality / structure

### 18. ✅ FIXED — Phase transitions bypassed `setPhase()` in three places (S)
> **Fixed 2026-08-13.** `setPhase()` [:1016](../arkanoid.html#L1016) now owns every phase→overlay
> mapping via a `PHASE_OVERLAY` lookup [:1008–1015](../arkanoid.html#L1008-L1015), extended to cover
> `levelclear`/`victory`/`gameover` as well as the phases it already handled. `togglePause`
> [:978](../arkanoid.html#L978), `checkLevelClear` [:1419](../arkanoid.html#L1419), and `endGame`
> [:1427](../arkanoid.html#L1427) now all just call `setPhase(...)` instead of duplicating the
> `state.phase` assignment and `showOverlay` call.

`setPhase` [:1016](../arkanoid.html#L1016) was the intended single entry point, but `togglePause`,
`checkLevelClear`, and `endGame` each assigned `state.phase` *and* called `showOverlay` directly.
That's the kind of duplication that causes an overlay/phase desync the first time someone adds a
state.

### 19. ✅ FIXED — Dead/redundant code (S)
> **Fixed 2026-08-13.**
> - `state.paddle.w` is gone entirely — both the initial field and the `updatePaddle` assignment that
>   nothing ever read; `paddleWidth()` remains the one source of truth.
> - The redundant `updateHud(); drawBackground(); drawBricks(); drawPaddle();` block right before the
>   first `requestAnimationFrame(frame)` call is removed; that first frame already paints the same
>   thing ~16 ms later via `draw()` [:1559–1566](../arkanoid.html#L1559-L1566), and the HUD's own
>   one-time init call [:1456](../arkanoid.html#L1456) already covers the pre-play text.
> - `updateBalls` [:1321](../arkanoid.html#L1321) now declares only the `dt` parameter it uses; the
>   call site [:1580](../arkanoid.html#L1580) no longer passes the unused `now`.

- `state.paddle.w` was assigned in `updatePaddle` but never read — every draw/collision path called
  `paddleWidth()` instead.
- The `updateHud(); drawBackground(); drawBricks(); drawPaddle();` block was redundant; the rAF loop
  paints the same frame ~16 ms later.
- `updateBalls(dt, now)` never used `now`.

### 20. ✅ FIXED — No `AudioContext` resume, and the mute state wasn't persisted (S)
> **Fixed 2026-08-13.** `beep()` [:1146](../arkanoid.html#L1146) now calls `actx.resume()`
> [:1155](../arkanoid.html#L1155) whenever the context is `"suspended"` — cheap and a no-op once
> already running, but it rescues audio for the rest of the session if the very first beep didn't
> happen to fire from inside a user-gesture handler. Separately, `state.muted` now round-trips through
> `loadMuted()`/`saveMuted()` [:782–783](../arkanoid.html#L782-L783), the same `storageGet`/
> `storageSet` pair [:760–777](../arkanoid.html#L760-L777) already used for the best score and the
> language preference, written on every toggle [:1129](../arkanoid.html#L1129) and read back into
> `state.muted` at boot [:802](../arkanoid.html#L802).

`beep` lazily constructed the context but never called `actx.resume()`. If the context was ever
created outside a user gesture it started `suspended` and the game was silently mute for the rest of
the session. Separately, `state.muted` wasn't saved, so the setting reset on every reload.

### 21. ✅ FIXED — Scattered magic numbers collected into a `CONFIG` block (M)
> **Fixed 2026-08-13.** A single `CONFIG` object [:620–631](../arkanoid.html#L620-L631) now holds drop
> fall speed, particle gravity, the ball cap, the paddle bounce spread, and each power-up's
> mult/duration pair. Every previous call site reads from it instead of a local literal: drop fall
> speed [:1242](../arkanoid.html#L1242), particle gravity [:1263](../arkanoid.html#L1263), the ball cap
> in both of `applyPowerup`'s multi-ball checks [:1218](../arkanoid.html#L1218)/
> [:1225](../arkanoid.html#L1225), the paddle bounce spread [:1346](../arkanoid.html#L1346), and the
> four effect branches [:1200–1215](../arkanoid.html#L1200-L1215).

Magic numbers were scattered through the file: drop fall speed `130`, particle gravity `260`, effect
durations `10`/`8` seconds, multipliers `1.6`/`0.6`/`0.7`/`1.4`, ball-cap `5`, paddle bounce spread
`1.05`. Collecting these into one `CONFIG` object makes the game tunable without hunting through the
logic.

---

## D. Accessibility

### 22. ✅ FIXED — Overlay state changes are now announced (S)
> **Fixed 2026-08-13.** All six `.overlay` divs [:458–492](../arkanoid.html#L458-L492) now carry
> `role="status" aria-live="polite"`, with a static `aria-hidden` default matching whether they're the
> one shown at boot. `showOverlay()` [:991–1004](../arkanoid.html#L991-L1004) keeps `aria-hidden` in
> sync with the `.show` class on every transition — the overlay actually on screen is the only one
> ever inside the accessibility tree, which is what lets a screen reader announce it as it appears
> rather than the swap happening silently.

Level-clear, game-over, and victory overlays swapped in silently. A screen-reader user got no
notification.

### 23. ✅ FIXED — Toggle buttons now reflect their state (S)
> **Fixed 2026-08-13** (half fixed 2026-08-12 by the bilingual work — see below). Both deck buttons
> default to `aria-pressed="false"` in markup [:505–506](../arkanoid.html#L505-L506) and are kept in
> sync by their render functions. `renderMuteButton()` [:1046–1051](../arkanoid.html#L1046-L1051) now
> also sets `aria-pressed`; a new `renderPauseButton()`
> [:1057–1063](../arkanoid.html#L1057-L1063) mirrors it for pause, and — since the pause button used to
> show the same "II" icon regardless of whether the game was actually paused — swaps the icon
> (`⏸`/`▶`) and `aria-label` between "pause" and "resume" too, not just `aria-pressed`. It's called
> from both `setPhase()` [:1019](../arkanoid.html#L1019) and `applyLanguage()`
> [:1100](../arkanoid.html#L1100), so it stays correct across phase changes and language switches
> alike. A `.icon-btn[aria-pressed="true"]` rule [:379–383](../arkanoid.html#L379-L383) gives both
> buttons the same visual "pressed" cue the language toggle already had.

> **Half fixed 2026-08-12** by the bilingual work. `renderMuteButton()`
> ([:1046–1051](../arkanoid.html#L1046-L1051)) sets the mute button's `aria-label` from both the
> language and the on/off state, so it no longer claims "Couper le son" while already muted.

Neither toggle exposed `aria-pressed`, and the pause button never changed its label or state when the
game was paused.

### 24. ✅ FIXED — Canvas now points assistive tech at the HUD (S)
> **Fixed 2026-08-13.** The HUD [:433–450](../arkanoid.html#L433-L450) was already reachable — plain,
> unhidden DOM text ahead of the canvas in reading order — so no canvas fallback content was needed;
> what was missing was the connection between the two. The canvas now carries
> `aria-describedby="hud"` [:454](../arkanoid.html#L454), pointing at the HUD container's new
> `id="hud"` [:433](../arkanoid.html#L433), so a screen-reader user who lands directly on the canvas
> (rather than reading the page linearly) is told where the live score/lives text actually lives.

`<canvas>` had an `aria-label` but empty inner content and no live text alternative for score/lives.

### 25. ✅ FIXED — `prefers-reduced-motion` is now read in JS too (S)
> **Fixed 2026-08-13.** `burst()` [:884](../arkanoid.html#L884) now scales its particle count down to
> roughly a third (never below 1) whenever `reduceMotion` is true, read from
> `matchMedia("(prefers-reduced-motion: reduce)")` [:877–881](../arkanoid.html#L877-L881) — live, via a
> `change` listener, rather than once at load, so toggling the OS setting mid-session takes effect on
> the very next burst rather than requiring a reload.

[:111–113](../arkanoid.html#L111-L113) disabled the title flicker, but the canvas particle bursts were
unaffected — the CSS media query can't reach into canvas drawing.

---

## E. Gameplay / UX enhancements

### 26. No keyboard path out of the game-over / victory screens (S)
`handleLaunchOrResume` [:963](../arkanoid.html#L963) only handles `ready` and `paused`. From `gameover`,
`victory`, `levelclear`, or the initial `start` screen, Space does nothing — the player must reach for
the mouse.

Fix: make Space/Enter activate the primary button of whatever overlay is showing. Interacts with #6 —
the `isButtonFocused()` guard already yields Space to a focused button, so this is about giving the
overlay's primary button focus when it appears.

### 27. Touch: the first tap both aims and launches (S)
`touchstart` [:949–955](../arkanoid.html#L949-L955) sets `pointerX` and immediately calls
`handleLaunchOrResume`. On mobile you cannot position the paddle before serving — the ball launches
from wherever your finger first landed. Also, the finger sits directly on the paddle, occluding it.

Fix: launch on `touchend` instead, and apply a vertical offset so the paddle tracks above the finger.

### 28. No difficulty ramp within a level (M)
Ball speed is fixed per level ([:846](../arkanoid.html#L846), `LEVELS[i].speed`). Classic breakout speeds
the ball up after N bricks or on reaching the top wall, which prevents long stalemates on the last brick.

### 29. No score feedback on the canvas (M)
Points are only visible in the HUD. Floating `+30` text at the brick position, and a combo multiplier for
consecutive brick hits without a paddle touch, would add a lot of feel for modest code.

### 30. Suggested additional power-ups (M)
The current six are solid. Natural additions given the existing architecture: **sticky paddle** (ball
re-attaches, aim the next shot) and **laser** (fire upward on Space). Both slot into `POWERUPS`
[:590–597](../arkanoid.html#L590-L597) and `applyPowerup` [:1199](../arkanoid.html#L1199).

### 31. Active power-up timers are invisible (S)
The paddle changes colour for width effects [:1495](../arkanoid.html#L1495), but there is no indication
of *how long* an effect lasts, and speed effects have no visual at all.

Fix: a thin depleting bar under the HUD, or a shrinking ring on the paddle. Cheap now that #4 stores a
`remaining` duration — the bar is just `remaining / total`.

### 32. Only 5 levels, hand-authored (M)
[:562–568](../arkanoid.html#L562-L568). Options: add more hand-authored layouts, or add a procedural
generator for endless mode past level 5.

---

## Verification

There is no test infrastructure in the repo, so verification is manual. After any selected change:

1. Open `arkanoid.html` in a browser (both `file://` and via a local server — the two differ for
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

Items #4–#6 were additionally checked with a throwaway headless harness that stubs the DOM, loads the
real script, and drives `frame()` directly — 18 assertions covering timer suspension across a pause,
both auto-pause triggers, and the Space/focus interaction. It is not committed; see the note in the
project history if it needs recreating.

As of #14–#25, this manual checklist is backed by an automated suite — see
[testing.md](testing.md) — but the steps above remain useful as an end-to-end sanity pass.
