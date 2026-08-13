# Neon Break — Code Review Findings

Reviewed: 2026-08-12 · Target: [arkanoid.html](../arkanoid.html)

The project is a single self-contained file, `arkanoid.html`: a bilingual (French/English) neon arcade
breakout game. Vanilla ES5-style JS in an IIFE, 2D canvas, no build step, no dependencies, no tests.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** #1–#13 fixed, 19 items open. What shipped and when is tracked in
[release-notes.md](release-notes.md); individual items below carry a `✅ FIXED` note with the details.

**Line references below are re-anchored after each round of fixes** — they are only valid against the
current `arkanoid.html`.

---

## A. Correctness bugs

### 1. ✅ FIXED — No `<!DOCTYPE html>`, no `<meta charset="utf-8">` (S)
> **Fixed 2026-08-12.** The file now opens with `<!doctype html>` / `<html lang="fr">` and a real
> `<head>` carrying `<meta charset="utf-8">`, a viewport meta, and a `<title>`, with the markup
> wrapped in `<body>` — see [arkanoid.html:1–7](../arkanoid.html#L1-L7),
> [:409–410](../arkanoid.html#L409-L410), [:1474–1475](../arkanoid.html#L1474-L1475).

The file previously began directly with `<style>`, with no doctype, `<html>`, `<head>`, `<title>`,
charset, viewport, or `lang` attribute. Two real consequences:

- **Quirks mode.** Without a doctype the browser rendered in quirks mode, changing box-model and
  inline-layout behaviour.
- **Encoding.** The file contains raw UTF-8 accented text (`Détruisez` [:450](../arkanoid.html#L450),
  `Prêt ?` [:456](../arkanoid.html#L456), `Bougez` [:457](../arkanoid.html#L457)). With no charset
  declared, a browser opening this over `file://` or a server that didn't send `charset` would fall
  back to windows-1252 and render `DÃ©truisez`.

### 2. ✅ FIXED — `localStorage` access was unguarded, one throw killed the entire game (S)
> **Fixed 2026-08-12.** Reads and writes now go through `loadBest()` / `saveBest()`
> ([:714–731](../arkanoid.html#L714-L731)), both wrapped in `try/catch`, with the best score
> degrading to in-memory only. Call sites: [:740](../arkanoid.html#L740),
> [:1296](../arkanoid.html#L1296).

`localStorage.getItem(BEST_KEY)` was read at IIFE top level while constructing `state`. In Safari
private browsing, with cookies/site-data disabled, or in some sandboxed `file://` contexts,
`localStorage` access **throws** — which aborted the whole IIFE and rendered a dead canvas with no
error visible to the player.

### 3. ✅ FIXED — Held keys stuck when the window lost focus (S)
> **Fixed 2026-08-12.** A `blur` handler now clears every held key —
> [:857–866](../arkanoid.html#L857-L866).

`keydown` sets `state.keys[e.code] = true` [:842](../arkanoid.html#L842) and only `keyup` cleared it
[:856](../arkanoid.html#L856). Alt-tabbing (or hitting a browser shortcut) while holding <kbd>→</kbd>
meant the `keyup` was never delivered — on return the paddle slid into the wall and stayed pinned
until the key was pressed and released again.

### 4. ✅ FIXED — Power-up timers kept running while the game was paused (S)
> **Fixed 2026-08-12.** Effects now carry a `remaining` duration in seconds instead of an absolute
> `until` deadline, and `updateEffects(dt)` decrements it from the frame delta — which the loop only
> feeds while the phase is `playing`. See [:1083–1094](../arkanoid.html#L1083-L1094),
> [:1098–1101](../arkanoid.html#L1098-L1101), and the call site at [:1468](../arkanoid.html#L1468).
> Verified: a `widen` survives a 30-second pause intact, then expires after its full 10 seconds of
> actual play.

`widthEffect` / `speedEffect` stored an absolute `until` timestamp from `performance.now()` and were
compared against the rAF `now`. Pausing for 20 seconds silently burned a 10-second "widen". Counting
in accumulated play time also makes the timers immune to tab-throttling and clock adjustments.

### 5. ✅ FIXED — Game did not auto-pause when the tab was hidden or the window blurred (S)
> **Fixed 2026-08-12.** `autoPause()` ([:865–874](../arkanoid.html#L865-L874)) pauses whenever the
> phase is `playing`, wired to both `visibilitychange` and the existing `blur` handler from #3
> ([:860–863](../arkanoid.html#L860-L863)). It deliberately only fires *on* hide/blur, never on
> return, so the player resumes explicitly.

There was no `visibilitychange` handler. `requestAnimationFrame` throttles in a background tab, and
`dt` is clamped to 33 ms [:1421](../arkanoid.html#L1421), so the game didn't *jump* — but it stayed in
the `playing` phase, so power-up timers kept expiring (see #4) and returning to the tab dropped you
straight back into live play with no warm-up.

### 6. ✅ FIXED — `e.preventDefault()` on Space blocked button activation (S)
> **Fixed 2026-08-12.** The Space branch is now guarded by `isButtonFocused()`
> ([:833–838](../arkanoid.html#L833-L838), used at [:853](../arkanoid.html#L853)): when a `<button>`
> holds focus the key is handed back to the browser, so it activates the button instead of launching
> the ball.
>
> This needed a companion fix. The deck's pause/mute buttons stay on screen and keep focus after a
> mouse click, so the guard alone would have made Space toggle pause instead of launching. A
> `blurIfPointerClick` helper ([:1013–1018](../arkanoid.html#L1013-L1018)) drops focus after pointer
> clicks only — keyboard activation (`detail === 0`) keeps it, so tab-order navigation is unharmed.

Space was unconditionally `preventDefault`ed. Correct for stopping page scroll, but it also prevented
Space from activating a keyboard-focused `.btn` — a keyboard-only player who tabbed to "Rejouer" could
not press it with Space (Enter still worked).

### 7. ✅ FIXED — Arrow keys scroll the page (S)
> **Fixed 2026-08-13.** The movement branch in the `keydown` handler now calls `e.preventDefault()`
> alongside the existing pointer-release logic — [:845–852](../arkanoid.html#L845-L852). Applied to
> all four movement codes (`ArrowLeft`/`ArrowRight`/`KeyA`/`KeyD`) rather than singling out the arrow
> keys, since suppressing the letter keys too is harmless and keeps them behaving identically.

`ArrowLeft`/`ArrowRight` are read but never `preventDefault`ed. On a narrow viewport where the cabinet
overflows, steering the paddle also scrolls the document under it.

### 8. ✅ FIXED — `mousedown` launches the ball on any button, including right-click (S)
> **Fixed 2026-08-13.** The handler now takes the event and returns early unless
> `e.button === 0` — [:880–883](../arkanoid.html#L880-L883).

`canvas.addEventListener("mousedown", handleLaunchOrResume)` had no `e.button` check. Right-clicking
or middle-clicking to open a context menu launched the ball.

### 9. ✅ FIXED — Ball–paddle collision teleported the ball on side hits (M)
> **Fixed 2026-08-13.** The ball's `y` from before the frame's own movement is captured as `prevY`
> [:1216](../arkanoid.html#L1216). A paddle collision is only resolved as a top-face bounce — steering
> by offset and snapping onto the top — when `prevY` was already above the paddle top
> [:1228–1236](../arkanoid.html#L1228-L1236); otherwise it resolves as a side hit that reflects only
> the horizontal component and repositions the ball beside the paddle, the same treatment a brick's
> side face gets [:1237–1244](../arkanoid.html#L1237-L1244). Paddle-velocity spin was left for a
> separate pass — out of scope for the teleport itself.

Any `circleRectCollide` with `dy > 0` snapped `ball.y = pr.y - ball.r - 0.5`, i.e. onto the top of the
paddle. A ball clipping the paddle's *side* while descending past it got warped upward and re-served,
which read as a phantom save.

### 10. ✅ FIXED — Only one brick collision was resolved per ball per frame, chosen by array order (M)
> **Fixed 2026-08-13.** The bricks loop no longer resolves against the first overlap it finds. It now
> scans every alive brick the ball overlaps, scores each with `brickPenetration()`
> [:1184–1193](../arkanoid.html#L1184-L1193) — the smaller of the two axis overlaps, i.e. how shallow
> the intrusion is — and resolves against whichever brick has the smallest penetration
> [:1248–1266](../arkanoid.html#L1248-L1266). Array order no longer has any say in which face gets hit.

The loop broke after the first overlapping brick. Bricks are stored top-row-first, so when a ball
overlapped two adjacent bricks in a corner, it always bounced off the *upper* one regardless of which
face it actually struck. Visible as occasional wrong-direction ricochets in the dense levels 4–5.

### 11. ✅ FIXED — Drop hitbox (8 px) didn't match the drawn capsule (10 px) (S)
> **Fixed 2026-08-13.** `updateDrops`'s hit test now uses the same 10px radius `drawDrops` renders the
> capsule with — [:1134–1135](../arkanoid.html#L1134-L1135) vs. the `arc(0, 0, 10, …)` at
> [:1425](../arkanoid.html#L1425).

`updateDrops` tested `± 8` while `drawDrops` rendered `arc(0,0,10,…)`. Power-ups visually clipped the
paddle without being collected.

### 12. ✅ FIXED — Multi-ball could spawn balls aimed straight down (S)
> **Fixed 2026-08-13.** The clone angle is derived from the source ball's angle mirrored upward when
> it's descending, then spread symmetrically to either side — [:1111–1115](../arkanoid.html#L1111-L1115).
> A source ball travelling straight down used to produce two clones that were also both descending and
> usually lost within a second; now every clone starts with a negative `dy`.

The clone angle was `atan2(base.dy, base.dx) ± 0.6`. If the source ball was descending, both clones
were also descending, making "M" feel like a dud.

### 13. ✅ FIXED — Best score was only persisted at game over (S)
> **Fixed 2026-08-13.** The `state.score > state.best` check and `saveBest()` call are now behind a
> shared `maybeSaveBest()` helper [:1290–1298](../arkanoid.html#L1290-L1298), called from
> `checkLevelClear()` [:1305](../arkanoid.html#L1305) as well as `endGame()`
> [:1317](../arkanoid.html#L1317). Progress is now checkpointed at every level clear, not just at the
> end of the run.

`endGame` was the only caller of `saveBest()`. Closing the tab mid-run — including after clearing four
levels — lost the score entirely.

---

## B. Performance

### 14. `getComputedStyle(document.body)` called per drop, per frame (S)
[:1428](../arkanoid.html#L1428), inside the `drawDrops` loop. This forces a synchronous style
recalculation every frame for every falling power-up — the single most expensive line in the render path.

Fix: hoist the font string to a module-level constant.

### 15. `updateHud()` writes four DOM nodes every frame (S)
Called unconditionally at [:1473](../arkanoid.html#L1473) in addition to the event-driven calls in
`brickHit`, `applyPowerup`, and `loseLife`. 240 needless `textContent` assignments per second.

Fix: drop the per-frame call, or guard each write behind a changed-value check.

### 16. `checkLevelClear()` scans the full brick array every frame (S)
[:1300–1304](../arkanoid.html#L1300-L1304) runs `.some()` over up to 80 bricks each frame. Cheap in
absolute terms, but trivially replaceable with a `remainingBricks` counter decremented in `brickHit`.

### 17. Canvas backing store is sized from DPR only, ignoring displayed size (S)
`fitCanvas` [:518–523](../arkanoid.html#L518-L523) always allocates `480 × 680 × dpr`. On a phone where
the canvas displays at ~300 px wide with `dpr = 3`, that's a 1440×2040 buffer for a 300 px element.

Fix: derive the multiplier from `getBoundingClientRect().width` as well as DPR.

---

## C. Code quality / structure

### 18. Phase transitions bypass `setPhase()` in three places (S)
`setPhase` [:930](../arkanoid.html#L930) is the intended single entry point, but `togglePause`
[:913](../arkanoid.html#L913), `checkLevelClear` [:1309](../arkanoid.html#L1309), and `endGame`
[:1321](../arkanoid.html#L1321) each assign `state.phase` *and* call `showOverlay` directly. That's the
kind of duplication that causes an overlay/phase desync the first time someone adds a state.

Fix: route every transition through `setPhase`, and let it own the overlay mapping.

### 19. Dead/redundant code (S)
- `state.paddle.w` [:747](../arkanoid.html#L747) is assigned in `updatePaddle` [:1071](../arkanoid.html#L1071)
  but never read — every draw/collision path calls `paddleWidth()` instead.
- The `updateHud(); drawBackground(); drawBricks(); drawPaddle();` block at
  [:1482–1486](../arkanoid.html#L1482-L1486) is redundant; the rAF loop paints the same frame ~16 ms later.
- `updateBalls(dt, now)` [:1208](../arkanoid.html#L1208) never uses `now`.

### 20. No `AudioContext` resume, and the mute state isn't persisted (S) — *groundwork done*
`beep` [:1049](../arkanoid.html#L1049) lazily constructs the context but never calls `actx.resume()`. If
the context is ever created outside a user gesture it starts `suspended` and the game is silently mute
for the rest of the session. Separately, `state.muted` isn't saved, so the setting resets on every
reload.

> The generalisation this called for has since landed: the guarded wrappers are now
> `storageGet`/`storageSet` ([:714–731](../arkanoid.html#L714-L731)), already reused for the language
> preference. Persisting mute is now the same three lines as `loadLang`/`saveLang`.

### 21. Extract a `config` block (M)
Magic numbers are scattered through the file: drop fall speed `130` [:1130](../arkanoid.html#L1130), particle
gravity `260` [:1151](../arkanoid.html#L1151), effect durations `10`/`8` seconds [:1098–1101](../arkanoid.html#L1098-L1101),
multipliers `1.6`/`0.6`/`0.7`/`1.4`, ball-cap `5`, paddle bounce spread `1.05` [:1233](../arkanoid.html#L1233).
Collecting these into one `CONFIG` object makes the game tunable without hunting through the logic.

---

## D. Accessibility

### 22. Overlay state changes are not announced (S)
Level-clear, game-over, and victory overlays swap in silently. A screen-reader user gets no notification.

Fix: `role="status"` / `aria-live="polite"` on the overlay container, and `aria-hidden` toggled with
`.show`.

### 23. Toggle buttons don't reflect their state (S) — *partially done*
> **Half fixed 2026-08-12** by the bilingual work. `renderMuteButton()`
> ([:965–969](../arkanoid.html#L965-L969)) now sets the mute button's `aria-label` from both the
> language and the on/off state, so it no longer claims "Couper le son" while already muted.

Still open: neither toggle exposes `aria-pressed`, and the pause button
[:494](../arkanoid.html#L494) still never changes its label or state when the game is paused. The
language toggle added in the same round *does* use `aria-pressed`
([:417–418](../arkanoid.html#L417-L418)) and is the pattern to copy.

Fix: `aria-pressed` on both deck buttons, and a state-tracking label for pause mirroring
`renderMuteButton()`.

### 24. Canvas has no accessible fallback (S)
`<canvas>` [:443](../arkanoid.html#L443) has an `aria-label` but empty inner content and no live text
alternative for score/lives. The HUD above it is real DOM text, which mitigates this — worth confirming
the HUD is reachable rather than adding canvas fallback content.

### 25. `prefers-reduced-motion` is only honoured in CSS (S)
[:111–113](../arkanoid.html#L111-L113) disables the title flicker, but the canvas particle bursts and
glow are unaffected. Consider reading the media query in JS and reducing `burst()` counts.

---

## E. Gameplay / UX enhancements

### 26. No keyboard path out of the game-over / victory screens (S)
`handleLaunchOrResume` [:898](../arkanoid.html#L898) only handles `ready` and `paused`. From `gameover`,
`victory`, `levelclear`, or the initial `start` screen, Space does nothing — the player must reach for
the mouse.

Fix: make Space/Enter activate the primary button of whatever overlay is showing. Interacts with #6 —
the `isButtonFocused()` guard already yields Space to a focused button, so this is about giving the
overlay's primary button focus when it appears.

### 27. Touch: the first tap both aims and launches (S)
`touchstart` [:884–890](../arkanoid.html#L884-L890) sets `pointerX` and immediately calls
`handleLaunchOrResume`. On mobile you cannot position the paddle before serving — the ball launches
from wherever your finger first landed. Also, the finger sits directly on the paddle, occluding it.

Fix: launch on `touchend` instead, and apply a vertical offset so the paddle tracks above the finger.

### 28. No difficulty ramp within a level (M)
Ball speed is fixed per level ([:793](../arkanoid.html#L793), `LEVELS[i].speed`). Classic breakout speeds
the ball up after N bricks or on reaching the top wall, which prevents long stalemates on the last brick.

### 29. No score feedback on the canvas (M)
Points are only visible in the HUD. Floating `+30` text at the brick position, and a combo multiplier for
consecutive brick hits without a paddle touch, would add a lot of feel for modest code.

### 30. Suggested additional power-ups (M)
The current six are solid. Natural additions given the existing architecture: **sticky paddle** (ball
re-attaches, aim the next shot) and **laser** (fire upward on Space). Both slot into `POWERUPS`
[:570–577](../arkanoid.html#L570-L577) and `applyPowerup` [:1097](../arkanoid.html#L1097).

### 31. Active power-up timers are invisible (S)
The paddle changes colour for width effects [:1384](../arkanoid.html#L1384), but there is no indication
of *how long* an effect lasts, and speed effects have no visual at all.

Fix: a thin depleting bar under the HUD, or a shrinking ring on the paddle. Cheap now that #4 stores a
`remaining` duration — the bar is just `remaining / total`.

### 32. Only 5 levels, hand-authored (M)
[:542–548](../arkanoid.html#L542-L548). Options: add more hand-authored layouts, or add a procedural
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

Items #4–#6 were additionally checked with a throwaway headless harness that stubs the DOM, loads the
real script, and drives `frame()` directly — 18 assertions covering timer suspension across a pause,
both auto-pause triggers, and the Space/focus interaction. It is not committed; see the note in the
project history if it needs recreating.
