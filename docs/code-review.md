# Neon Break — Code Review Findings

Reviewed: 2026-08-12 · Target: [arkanoid.html](../arkanoid.html)

The project is a single self-contained file, `arkanoid.html`: a bilingual (French/English) neon arcade
breakout game. Vanilla ES5-style JS in an IIFE, 2D canvas, no build step, no dependencies, no tests.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** #1–#29 fixed, 3 items open. What shipped and when is tracked in
[release-notes.md](release-notes.md); individual items below carry a `✅ FIXED` note with the details.

**Line references below are re-anchored after each round of fixes** — they are only valid against the
current `arkanoid.html`.

---

## A. Correctness bugs

### 1. ✅ FIXED — No `<!DOCTYPE html>`, no `<meta charset="utf-8">` (S)
> **Fixed 2026-08-12.** The file now opens with `<!doctype html>` / `<html lang="fr">` and a real
> `<head>` carrying `<meta charset="utf-8">`, a viewport meta, and a `<title>`, with the markup
> wrapped in `<body>` — see [arkanoid.html:1–7](../arkanoid.html#L1-L7),
> [:420–421](../arkanoid.html#L420-L421), [:1733–1734](../arkanoid.html#L1733-L1734).

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
> ([:784–798](../arkanoid.html#L784-L798)), both wrapped in `try/catch`, with the best score
> degrading to in-memory only. Call sites: [:813](../arkanoid.html#L813),
> [:1519](../arkanoid.html#L1519).

`localStorage.getItem(BEST_KEY)` was read at IIFE top level while constructing `state`. In Safari
private browsing, with cookies/site-data disabled, or in some sandboxed `file://` contexts,
`localStorage` access **throws** — which aborted the whole IIFE and rendered a dead canvas with no
error visible to the player.

### 3. ✅ FIXED — Held keys stuck when the window lost focus (S)
> **Fixed 2026-08-12.** A `blur` handler now clears every held key —
> [:970–976](../arkanoid.html#L970-L976).

`keydown` sets `state.keys[e.code] = true` [:955](../arkanoid.html#L955) and only `keyup` cleared it
[:969](../arkanoid.html#L969). Alt-tabbing (or hitting a browser shortcut) while holding <kbd>→</kbd>
meant the `keyup` was never delivered — on return the paddle slid into the wall and stayed pinned
until the key was pressed and released again.

### 4. ✅ FIXED — Power-up timers kept running while the game was paused (S)
> **Fixed 2026-08-12.** Effects now carry a `remaining` duration in seconds instead of an absolute
> `until` deadline, and `updateEffects(dt)` decrements it from the frame delta — which the loop only
> feeds while the phase is `playing`. See [:1268–1279](../arkanoid.html#L1268-L1279), the effect
> durations each `remaining` starts from in `CONFIG.effects`
> ([:627–632](../arkanoid.html#L627-L632), added by #21), and the call site at
> [:1707](../arkanoid.html#L1707).
> Verified: a `widen` survives a 30-second pause intact, then expires after its full 10 seconds of
> actual play.

`widthEffect` / `speedEffect` stored an absolute `until` timestamp from `performance.now()` and were
compared against the rAF `now`. Pausing for 20 seconds silently burned a 10-second "widen". Counting
in accumulated play time also makes the timers immune to tab-throttling and clock adjustments.

### 5. ✅ FIXED — Game did not auto-pause when the tab was hidden or the window blurred (S)
> **Fixed 2026-08-12.** `autoPause()` ([:978–986](../arkanoid.html#L978-L986)) pauses whenever the
> phase is `playing`, wired to both `visibilitychange` and the existing `blur` handler from #3
> ([:973–976](../arkanoid.html#L973-L976)). It deliberately only fires *on* hide/blur, never on
> return, so the player resumes explicitly.

There was no `visibilitychange` handler. `requestAnimationFrame` throttles in a background tab, and
`dt` is clamped to 33 ms [:1700](../arkanoid.html#L1700), so the game didn't *jump* — but it stayed in
the `playing` phase, so power-up timers kept expiring (see #4) and returning to the tab dropped you
straight back into live play with no warm-up.

### 6. ✅ FIXED — `e.preventDefault()` on Space blocked button activation (S)
> **Fixed 2026-08-12.** The Space branch is now guarded by `isButtonFocused()`
> ([:949–952](../arkanoid.html#L949-L952), used at [:966](../arkanoid.html#L966)): when a `<button>`
> holds focus the key is handed back to the browser, so it activates the button instead of launching
> the ball.
>
> This needed a companion fix. The deck's pause/mute buttons stay on screen and keep focus after a
> mouse click, so the guard alone would have made Space toggle pause instead of launching. A
> `blurIfPointerClick` helper ([:1194–1199](../arkanoid.html#L1194-L1199)) drops focus after pointer
> clicks only — keyboard activation (`detail === 0`) keeps it, so tab-order navigation is unharmed.
>
> A related gap closed under #26: `showOverlay()` also blurs a stale button focus left over from
> whatever overlay just hid, so `isButtonFocused()` can't get stuck reporting `true` once the new
> overlay has no button of its own.

Space was unconditionally `preventDefault`ed. Correct for stopping page scroll, but it also prevented
Space from activating a keyboard-focused `.btn` — a keyboard-only player who tabbed to "Rejouer" could
not press it with Space (Enter still worked).

### 7. ✅ FIXED — Arrow keys scroll the page (S)
> **Fixed 2026-08-13.** The movement branch in the `keydown` handler now calls `e.preventDefault()`
> alongside the existing pointer-release logic — [:958–965](../arkanoid.html#L958-L965). Applied to
> all four movement codes (`ArrowLeft`/`ArrowRight`/`KeyA`/`KeyD`) rather than singling out the arrow
> keys, since suppressing the letter keys too is harmless and keeps them behaving identically.

`ArrowLeft`/`ArrowRight` are read but never `preventDefault`ed. On a narrow viewport where the cabinet
overflows, steering the paddle also scrolls the document under it.

### 8. ✅ FIXED — `mousedown` launches the ball on any button, including right-click (S)
> **Fixed 2026-08-13.** The handler now takes the event and returns early unless
> `e.button === 0` — [:993–996](../arkanoid.html#L993-L996).

`canvas.addEventListener("mousedown", handleLaunchOrResume)` had no `e.button` check. Right-clicking
or middle-clicking to open a context menu launched the ball.

### 9. ✅ FIXED — Ball–paddle collision teleported the ball on side hits (M)
> **Fixed 2026-08-13.** The ball's `y` from before the frame's own movement is captured as `prevY`
> [:1432](../arkanoid.html#L1432). A paddle collision is only resolved as a top-face bounce — steering
> by offset and snapping onto the top — when `prevY` was already above the paddle top
> [:1451–1459](../arkanoid.html#L1451-L1459); otherwise it resolves as a side hit that reflects only
> the horizontal component and repositions the ball beside the paddle, the same treatment a brick's
> side face gets [:1460–1467](../arkanoid.html#L1460-L1467). Paddle-velocity spin was left for a
> separate pass — out of scope for the teleport itself.

Any `circleRectCollide` with `dy > 0` snapped `ball.y = pr.y - ball.r - 0.5`, i.e. onto the top of the
paddle. A ball clipping the paddle's *side* while descending past it got warped upward and re-served,
which read as a phantom save.

### 10. ✅ FIXED — Only one brick collision was resolved per ball per frame, chosen by array order (M)
> **Fixed 2026-08-13.** The bricks loop no longer resolves against the first overlap it finds. It now
> scans every alive brick the ball overlaps, scores each with `brickPenetration()`
> [:1400–1409](../arkanoid.html#L1400-L1409) — the smaller of the two axis overlaps, i.e. how shallow
> the intrusion is — and resolves against whichever brick has the smallest penetration
> [:1471–1489](../arkanoid.html#L1471-L1489). Array order no longer has any say in which face gets hit.

The loop broke after the first overlapping brick. Bricks are stored top-row-first, so when a ball
overlapped two adjacent bricks in a corner, it always bounced off the *upper* one regardless of which
face it actually struck. Visible as occasional wrong-direction ricochets in the dense levels 4–5.

### 11. ✅ FIXED — Drop hitbox (8 px) didn't match the drawn capsule (10 px) (S)
> **Fixed 2026-08-13.** `updateDrops`'s hit test now uses the same 10px radius `drawDrops` renders the
> capsule with — [:1329–1330](../arkanoid.html#L1329-L1330) vs. the `arc(0, 0, 10, …)` at
> [:1646](../arkanoid.html#L1646).

`updateDrops` tested `± 8` while `drawDrops` rendered `arc(0,0,10,…)`. Power-ups visually clipped the
paddle without being collected.

### 12. ✅ FIXED — Multi-ball could spawn balls aimed straight down (S)
> **Fixed 2026-08-13.** The clone angle is derived from the source ball's angle mirrored upward when
> it's descending, then spread symmetrically to either side — [:1306–1310](../arkanoid.html#L1306-L1310).
> A source ball travelling straight down used to produce two clones that were also both descending and
> usually lost within a second; now every clone starts with a negative `dy`.

The clone angle was `atan2(base.dy, base.dx) ± 0.6`. If the source ball was descending, both clones
were also descending, making "M" feel like a dud.

### 13. ✅ FIXED — Best score was only persisted at game over (S)
> **Fixed 2026-08-13.** The `state.score > state.best` check and `saveBest()` call are now behind a
> shared `maybeSaveBest()` helper [:1513–1521](../arkanoid.html#L1513-L1521), called from
> `checkLevelClear()` [:1525](../arkanoid.html#L1525) as well as `endGame()`
> [:1535](../arkanoid.html#L1535). Progress is now checkpointed at every level clear, not just at the
> end of the run.

`endGame` was the only caller of `saveBest()`. Closing the tab mid-run — including after clearing four
levels — lost the score entirely.

---

## B. Performance

### 14. ✅ FIXED — `getComputedStyle(document.body)` called per drop, per frame (S)
> **Fixed 2026-08-13.** The font string is now built once into a module-level `DROP_FONT` constant
> [:603](../arkanoid.html#L603); `drawDrops` just assigns it — [:1649](../arkanoid.html#L1649). The
> body's font never changes at runtime, so there was nothing to gain from recomputing it 60 times a
> second.

`getComputedStyle(document.body)` was called inside the `drawDrops` loop, once per falling power-up,
per frame. This forced a synchronous style recalculation every frame for every falling power-up — the
single most expensive line in the render path.

### 15. ✅ FIXED — `updateHud()` writes four DOM nodes every frame (S)
> **Fixed 2026-08-13.** A `hudLast` cache [:1553](../arkanoid.html#L1553) records what's currently
> displayed for each of the four HUD fields; `updateHud()` [:1554–1565](../arkanoid.html#L1554-L1565)
> only touches `textContent` for a field whose value actually changed since the last call. The
> unconditional per-frame call [:1713](../arkanoid.html#L1713) stays — it's still what catches
> `state.best` needing a live update against `state.score` — but an idle frame now writes nothing.

`updateHud()` was called unconditionally every frame, in addition to the event-driven calls in
`brickHit`, `applyPowerup`, and `loseLife` — 240 needless `textContent` assignments per second even
while nothing displayed was changing.

### 16. ✅ FIXED — `checkLevelClear()` scans the full brick array every frame (S)
> **Fixed 2026-08-13.** `state.remainingBricks` [:826](../arkanoid.html#L826) counts destructible
> bricks still alive; `buildLevel()` seeds it when a level starts
> [:854](../arkanoid.html#L854)/[:871](../arkanoid.html#L871), and `brickHit()` decrements it at the
> single point a brick actually dies [:1368](../arkanoid.html#L1368). `checkLevelClear()`
> [:1523–1532](../arkanoid.html#L1523-L1532) is now an `O(1)` counter check instead of an `O(n)` scan.

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
> **Fixed 2026-08-13.** `setPhase()` [:1099](../arkanoid.html#L1099) now owns every phase→overlay
> mapping via a `PHASE_OVERLAY` lookup [:1091–1098](../arkanoid.html#L1091-L1098), extended to cover
> `levelclear`/`victory`/`gameover` as well as the phases it already handled. `togglePause`
> [:1040](../arkanoid.html#L1040), `checkLevelClear` [:1529](../arkanoid.html#L1529), and `endGame`
> [:1537](../arkanoid.html#L1537) now all just call `setPhase(...)` instead of duplicating the
> `state.phase` assignment and `showOverlay` call.

`setPhase` [:1099](../arkanoid.html#L1099) was the intended single entry point, but `togglePause`,
`checkLevelClear`, and `endGame` each assigned `state.phase` *and* called `showOverlay` directly.
That's the kind of duplication that causes an overlay/phase desync the first time someone adds a
state.

### 19. ✅ FIXED — Dead/redundant code (S)
> **Fixed 2026-08-13.**
> - `state.paddle.w` is gone entirely — both the initial field and the `updatePaddle` assignment that
>   nothing ever read; `paddleWidth()` remains the one source of truth.
> - The redundant `updateHud(); drawBackground(); drawBricks(); drawPaddle();` block right before the
>   first `requestAnimationFrame(frame)` call is removed; that first frame already paints the same
>   thing ~16 ms later via `draw()` [:1686–1694](../arkanoid.html#L1686-L1694), and the HUD's own
>   one-time init call [:1566](../arkanoid.html#L1566) already covers the pre-play text.
> - `updateBalls` [:1424](../arkanoid.html#L1424) now declares only the `dt` parameter it uses; the
>   call site [:1708](../arkanoid.html#L1708) no longer passes the unused `now`.

- `state.paddle.w` was assigned in `updatePaddle` but never read — every draw/collision path called
  `paddleWidth()` instead.
- The `updateHud(); drawBackground(); drawBricks(); drawPaddle();` block was redundant; the rAF loop
  paints the same frame ~16 ms later.
- `updateBalls(dt, now)` never used `now`.

### 20. ✅ FIXED — No `AudioContext` resume, and the mute state wasn't persisted (S)
> **Fixed 2026-08-13.** `beep()` [:1229](../arkanoid.html#L1229) now calls `actx.resume()`
> [:1238](../arkanoid.html#L1238) whenever the context is `"suspended"` — cheap and a no-op once
> already running, but it rescues audio for the rest of the session if the very first beep didn't
> happen to fire from inside a user-gesture handler. Separately, `state.muted` now round-trips through
> `loadMuted()`/`saveMuted()` [:806–807](../arkanoid.html#L806-L807), the same `storageGet`/
> `storageSet` pair [:784–798](../arkanoid.html#L784-L798) already used for the best score and the
> language preference, written on every toggle [:1212](../arkanoid.html#L1212) and read back into
> `state.muted` at boot [:830](../arkanoid.html#L830).

`beep` lazily constructed the context but never called `actx.resume()`. If the context was ever
created outside a user gesture it started `suspended` and the game was silently mute for the rest of
the session. Separately, `state.muted` wasn't saved, so the setting reset on every reload.

### 21. ✅ FIXED — Scattered magic numbers collected into a `CONFIG` block (M)
> **Fixed 2026-08-13.** A single `CONFIG` object [:622–655](../arkanoid.html#L622-L655) now holds drop
> fall speed, particle gravity, the ball cap, the paddle bounce spread, each power-up's mult/duration
> pair, and — since added by #28/#29 — the difficulty ramp and combo/floating-text tuning too. Every
> call site reads from it instead of a local literal: drop fall speed
> [:1325](../arkanoid.html#L1325), particle gravity [:1346](../arkanoid.html#L1346), the ball cap in
> both of `applyPowerup`'s multi-ball checks [:1301](../arkanoid.html#L1301)/
> [:1308](../arkanoid.html#L1308), the paddle bounce spread [:1456](../arkanoid.html#L1456), and the
> four effect branches [:1283–1294](../arkanoid.html#L1283-L1294).

Magic numbers were scattered through the file: drop fall speed `130`, particle gravity `260`, effect
durations `10`/`8` seconds, multipliers `1.6`/`0.6`/`0.7`/`1.4`, ball-cap `5`, paddle bounce spread
`1.05`. Collecting these into one `CONFIG` object makes the game tunable without hunting through the
logic.

---

## D. Accessibility

### 22. ✅ FIXED — Overlay state changes are now announced (S)
> **Fixed 2026-08-13.** All six `.overlay` divs [:458–492](../arkanoid.html#L458-L492) now carry
> `role="status" aria-live="polite"`, with a static `aria-hidden` default matching whether they're the
> one shown at boot. `showOverlay()` [:1063–1087](../arkanoid.html#L1063-L1087) keeps `aria-hidden` in
> sync with the `.show` class on every transition — the overlay actually on screen is the only one
> ever inside the accessibility tree, which is what lets a screen reader announce it as it appears
> rather than the swap happening silently.

Level-clear, game-over, and victory overlays swapped in silently. A screen-reader user got no
notification.

### 23. ✅ FIXED — Toggle buttons now reflect their state (S)
> **Fixed 2026-08-13** (half fixed 2026-08-12 by the bilingual work — see below). Both deck buttons
> default to `aria-pressed="false"` in markup [:505–506](../arkanoid.html#L505-L506) and are kept in
> sync by their render functions. `renderMuteButton()` [:1129–1134](../arkanoid.html#L1129-L1134) now
> also sets `aria-pressed`; a new `renderPauseButton()`
> [:1140–1146](../arkanoid.html#L1140-L1146) mirrors it for pause, and — since the pause button used to
> show the same "II" icon regardless of whether the game was actually paused — swaps the icon
> (`⏸`/`▶`) and `aria-label` between "pause" and "resume" too, not just `aria-pressed`. It's called
> from both `setPhase()` [:1102](../arkanoid.html#L1102) and `applyLanguage()`
> [:1183](../arkanoid.html#L1183), so it stays correct across phase changes and language switches
> alike. A `.icon-btn[aria-pressed="true"]` rule [:379–383](../arkanoid.html#L379-L383) gives both
> buttons the same visual "pressed" cue the language toggle already had.

> **Half fixed 2026-08-12** by the bilingual work. `renderMuteButton()`
> ([:1129–1134](../arkanoid.html#L1129-L1134)) sets the mute button's `aria-label` from both the
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
> **Fixed 2026-08-13.** `burst()` [:921](../arkanoid.html#L921) now scales its particle count down to
> roughly a third (never below 1) whenever `reduceMotion` is true, read from
> `matchMedia("(prefers-reduced-motion: reduce)")` [:914–918](../arkanoid.html#L914-L918) — live, via a
> `change` listener, rather than once at load, so toggling the OS setting mid-session takes effect on
> the very next burst rather than requiring a reload.

[:111–113](../arkanoid.html#L111-L113) disabled the title flicker, but the canvas particle bursts were
unaffected — the CSS media query can't reach into canvas drawing.

---

## E. Gameplay / UX enhancements

### 26. ✅ FIXED — Keyboard path out of the game-over / victory screens (S)
> **Fixed 2026-08-13.** `showOverlay()` [:1063–1087](../arkanoid.html#L1063-L1087) now focuses the
> overlay's own call-to-action button whenever one appears, looked up from a small
> `OVERLAY_PRIMARY_BTN` map [:1056–1062](../arkanoid.html#L1056-L1062) ("ready" has no button and is
> a no-op). Once that button holds focus, `isButtonFocused()` hands Space back to the browser (see
> #6) and native button activation does the rest — for Enter, which was never suppressed, this was
> already true. The initial start screen gets the same treatment: boot now routes through
> `showOverlay("overlay-start")` [:1728](../arkanoid.html#L1728) instead of leaving it purely to the
> static markup, so "Lancer la partie" is focused from the very first frame, not just after a later
> transition.

`handleLaunchOrResume` [:1025](../arkanoid.html#L1025) only handled `ready` and `paused`. From
`gameover`, `victory`, `levelclear`, or the initial `start` screen, Space did nothing — the player had
to reach for the mouse.

### 27. ✅ FIXED — Touch: the first tap both aimed and launched (S)
> **Fixed 2026-08-13.** Launching moved from `touchstart` to a new `touchend` handler
> [:1013–1023](../arkanoid.html#L1013-L1023); `touchstart`/`touchmove`
> [:1001–1012](../arkanoid.html#L1001-L1012) now only update `pointerX`, aiming the paddle. That gives
> the player a chance to drag into position before committing to serve, instead of the ball launching
> from wherever the finger first landed. The "vertical offset" half of the original fix — tracking the
> paddle's own Y position above the finger — was deliberately dropped: the paddle only ever steers
> horizontally, so moving it vertically during touch play would be a materially bigger change (new
> collision geometry, different feel from mouse/keyboard play) than this finding's effort estimate
> implied, and isn't needed to fix the actual bug (the ball launching prematurely).

`touchstart` [:1001](../arkanoid.html#L1001) (previously) set `pointerX` and immediately called
`handleLaunchOrResume`. On mobile you could not position the paddle before serving — the ball launched
from wherever your finger first landed.

### 28. ✅ FIXED — Difficulty ramp within a level (M)
> **Fixed 2026-08-13.** `state.difficultyMult` [:828](../arkanoid.html#L828) multiplies directly into
> ball velocity [:1433](../arkanoid.html#L1433), alongside the existing power-up speed multiplier. It
> ramps via `bumpDifficulty()` [:844–846](../arkanoid.html#L844-L846) — cumulative, multiplicative,
> capped at `CONFIG.difficulty.max` — from two classic-Breakout triggers: every top-wall bounce
> [:1439–1445](../arkanoid.html#L1439-L1445), and every `CONFIG.difficulty.brickMilestone` bricks
> destroyed in the current level [:1370–1372](../arkanoid.html#L1370-L1372). `CONFIG.difficulty`
> [:637–642](../arkanoid.html#L637-L642) holds the tuning; `buildLevel()`
> [:872–873](../arkanoid.html#L872-L873) resets both the multiplier and the milestone counter at the
> start of every level, so the ramp never carries over from one level — or one difficulty — to the
> next.

Ball speed was fixed per level ([:881](../arkanoid.html#L881), `LEVELS[i].speed`). Classic breakout
speeds the ball up after N bricks or on reaching the top wall, which prevents long stalemates on the
last brick.

### 29. ✅ FIXED — Score feedback on the canvas (M)
> **Fixed 2026-08-13.** Destroying a brick now spawns a floating `"+N"` pop-up at its position
> ([:936–941](../arkanoid.html#L936-L941), rising and fading over `CONFIG.floatingText.life` seconds via
> `updateFloatingTexts()`/`drawFloatingTexts()` [:1350–1357](../arkanoid.html#L1350-L1357)/
> [:1669–1684](../arkanoid.html#L1669-L1684)), wired into the frame loop alongside particles
> [:1711](../arkanoid.html#L1711)/[:1716](../arkanoid.html#L1716) and `draw()`
> [:1693](../arkanoid.html#L1693). Consecutive bricks destroyed without the ball touching the paddle
> also build a combo [:1376–1381](../arkanoid.html#L1376-L1381) that scales the points awarded, capped
> at `CONFIG.combo.max`; any paddle contact — top face or side clip — resets it
> [:1450](../arkanoid.html#L1450). `CONFIG.combo`/`CONFIG.floatingText`
> [:643–654](../arkanoid.html#L643-L654) hold the tuning. This changes the scoring curve going forward
> — an unbroken combo now scores noticeably more than the same bricks hit in isolation — so existing
> saved best scores are no longer directly comparable to newly-earned ones.

Points were only visible in the HUD, with no combo mechanic for consecutive brick hits without a
paddle touch.

### 30. Suggested additional power-ups (M)
The current six are solid. Natural additions given the existing architecture: **sticky paddle** (ball
re-attaches, aim the next shot) and **laser** (fire upward on Space). Both slot into `POWERUPS`
[:590–597](../arkanoid.html#L590-L597) and `applyPowerup` [:1282](../arkanoid.html#L1282).

### 31. Active power-up timers are invisible (S)
The paddle changes colour for width effects [:1605](../arkanoid.html#L1605), but there is no indication
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
11. On a touch device (or DevTools touch emulation), tap-drag to aim before releasing to serve, and
    confirm the ball only launches on release (#27).
12. Play a level to the last couple of bricks without losing the ball; confirm the ball is visibly
    faster than at the start (#28), and that combo streaks show a rising floating score (#29).

Items #4–#6 were additionally checked with a throwaway headless harness that stubs the DOM, loads the
real script, and drives `frame()` directly — 18 assertions covering timer suspension across a pause,
both auto-pause triggers, and the Space/focus interaction. It is not committed; see the note in the
project history if it needs recreating.

As of #14–#29, this manual checklist is backed by an automated suite — see
[testing.md](testing.md) — but the steps above remain useful as an end-to-end sanity pass.
