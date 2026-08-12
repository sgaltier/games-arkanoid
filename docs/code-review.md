# Neon Break — Code Review Findings

Reviewed: 2026-08-12 · Target: [arkanoid.html](../arkanoid.html) @ `8b6c46d`

The project is a single self-contained file, `arkanoid.html` (1121 lines): a French-language neon
arcade breakout game. Vanilla ES5-style JS in an IIFE, 2D canvas, no build step, no dependencies,
no tests.

This document is a **menu, not a commitment** — nothing below is implemented until selected. Items
are ordered by severity within each group. Each carries an effort estimate (S / M / L).

---

## A. Correctness bugs

### 1. No `<!DOCTYPE html>`, no `<meta charset="utf-8">` — accented French text can mojibake (S)
The file begins directly with `<style>` at [arkanoid.html:1](../arkanoid.html#L1). There is no doctype,
no `<html>`, `<head>`, `<title>`, charset, viewport, or `lang` attribute.

Two real consequences:
- **Quirks mode.** Without a doctype the browser renders in quirks mode, which changes box-model and
  inline-layout behaviour.
- **Encoding.** The file contains raw UTF-8 accented text (`Détruisez` [:400](../arkanoid.html#L400),
  `Prêt ?` [:406](../arkanoid.html#L406), `Bougez` [:407](../arkanoid.html#L407)). With no charset
  declared, a browser opening this over `file://` or a server that doesn't send `charset` will fall
  back to windows-1252 and render `DÃ©truisez`.

Fix: wrap in a proper document with `<!doctype html>`, `<html lang="fr">`, `<meta charset="utf-8">`,
`<meta name="viewport" content="width=device-width, initial-scale=1">`, and a `<title>`.

### 2. `localStorage` access is unguarded — one throw kills the entire game (S)
[arkanoid.html:548](../arkanoid.html#L548) reads `localStorage.getItem(BEST_KEY)` at IIFE top level, and
[:946](../arkanoid.html#L946) writes it. In Safari private browsing, with cookies/site-data disabled, or
in some sandboxed `file://` contexts, `localStorage` access **throws**. Because line 548 runs during
state construction, the whole IIFE aborts and the page renders a dead canvas with no error visible to
the player.

Fix: wrap both in `try/catch` with an in-memory fallback for `best`.

### 3. Held keys stick when the window loses focus (S)
`keydown` sets `state.keys[e.code] = true` [:641](../arkanoid.html#L641) and only `keyup` clears it
[:650](../arkanoid.html#L650). If the player alt-tabs (or hits a browser shortcut) while holding
<kbd>→</kbd>, the `keyup` is never delivered — on return the paddle slides into the wall and stays
pinned until the key is pressed and released again.

Fix: `window.addEventListener("blur", …)` to clear `state.keys`.

### 4. Power-up timers keep running while the game is paused (S)
`widthEffect` / `speedEffect` store an absolute `until` timestamp from `performance.now()`
([:776–779](../arkanoid.html#L776-L779)) and are compared against the rAF `now` in `updateEffects`
([:770–771](../arkanoid.html#L770-L771)). Pausing for 20 seconds silently burns a 10-second "widen".

Fix: track remaining duration and decrement by `dt` only while playing, or offset `until` by the
paused interval on resume.

### 5. Game does not auto-pause when the tab is hidden or the window blurs (S)
There is no `visibilitychange` handler. `requestAnimationFrame` throttles in a background tab, and
`dt` is clamped to 33 ms [:1094](../arkanoid.html#L1094), so the game doesn't *jump* — but it stays in
the `playing` phase, so power-up timers keep expiring (see #4) and returning to the tab drops you
straight back into live play with no warm-up.

Fix: on `visibilitychange`/`blur`, if phase is `playing`, call `togglePause()`.

### 6. `e.preventDefault()` on Space blocks button activation (S)
[:647](../arkanoid.html#L647) unconditionally prevents the default for `Space`. That's correct for
stopping page scroll, but it also prevents Space from activating a keyboard-focused `.btn` — so a
keyboard-only player who tabs to "Rejouer" cannot press it with Space (Enter still works).

Fix: skip `preventDefault` when `document.activeElement` is a button, or scope the key handling.

### 7. Arrow keys scroll the page (S)
`ArrowLeft`/`ArrowRight` are read but never `preventDefault`ed. On a narrow viewport where the cabinet
overflows, steering the paddle also scrolls the document under it.

Fix: `preventDefault` for the four movement codes.

### 8. `mousedown` launches the ball on any button, including right-click (S)
[:657](../arkanoid.html#L657) — `canvas.addEventListener("mousedown", handleLaunchOrResume)` with no
`e.button` check. Right-clicking or middle-clicking to open a context menu launches the ball.

Fix: guard on `e.button === 0`.

### 9. Ball–paddle collision teleports the ball on side hits (M)
[:884–891](../arkanoid.html#L884-L891) — any `circleRectCollide` with `dy > 0` snaps
`ball.y = pr.y - ball.r - 0.5`, i.e. on top of the paddle. A ball clipping the paddle's *side* while
descending past it gets warped upward and re-served, which reads as a phantom save. The same code has
no relative-velocity term, so a fast-moving paddle doesn't impart any spin.

Fix: only treat it as a top-face hit when the ball's previous `y` was above the paddle top; otherwise
resolve as a side hit. Optionally add paddle velocity into the outgoing angle.

### 10. Only one brick collision is resolved per ball per frame, chosen by array order (M)
[:895–903](../arkanoid.html#L895-L903) breaks after the first overlapping brick. Bricks are stored
top-row-first, so when a ball overlaps two adjacent bricks in a corner, it always bounces off the
*upper* one regardless of which face it actually struck. Visible as occasional wrong-direction
ricochets in the dense levels 4–5.

Fix: collect all overlaps, resolve against the one with the smallest penetration.

### 11. Drop hitbox (8 px) doesn't match the drawn capsule (10 px) (S)
`updateDrops` tests `± 8` [:803–804](../arkanoid.html#L803-L804); `drawDrops` renders `arc(0,0,10,…)`
[:1058](../arkanoid.html#L1058). Power-ups visually clip the paddle without being collected.

### 12. Multi-ball can spawn balls aimed straight down (S)
[:786](../arkanoid.html#L786) — the clone angle is `atan2(base.dy, base.dx) ± 0.6`. If the source ball is
descending, both clones are also descending and are usually lost within a second, making "M" feel like
a dud.

Fix: bias clone angles upward, or spread them symmetrically around the horizontal.

### 13. Best score is only persisted at game over (S)
`endGame` [:943–947](../arkanoid.html#L943-L947) is the only writer. Closing the tab mid-run — including
after clearing four levels — loses the score entirely.

Fix: persist whenever `state.score > state.best`, e.g. in `updateHud` or on level clear.

---

## B. Performance

### 14. `getComputedStyle(document.body)` called per drop, per frame (S)
[:1061](../arkanoid.html#L1061), inside the `drawDrops` loop. This forces a synchronous style
recalculation every frame for every falling power-up — the single most expensive line in the render path.

Fix: hoist the font string to a module-level constant.

### 15. `updateHud()` writes four DOM nodes every frame (S)
Called unconditionally at [:1106](../arkanoid.html#L1106) in addition to the event-driven calls in
`brickHit`, `applyPowerup`, and `loseLife`. 240 needless `textContent` assignments per second.

Fix: drop the per-frame call, or guard each write behind a changed-value check.

### 16. `checkLevelClear()` scans the full brick array every frame (S)
[:927–930](../arkanoid.html#L927-L930) runs `.some()` over up to 80 bricks each frame. Cheap in absolute
terms, but trivially replaceable with a `remainingBricks` counter decremented in `brickHit`.

### 17. Canvas backing store is sized from DPR only, ignoring displayed size (S)
`fitCanvas` [:468–473](../arkanoid.html#L468-L473) always allocates `480 × 680 × dpr`. On a phone where
the canvas displays at ~300 px wide with `dpr = 3`, that's a 1440×2040 buffer for a 300 px element.

Fix: derive the multiplier from `getBoundingClientRect().width` as well as DPR.

---

## C. Code quality / structure

### 18. Phase transitions bypass `setPhase()` in three places (S)
`setPhase` [:704](../arkanoid.html#L704) is the intended single entry point, but `togglePause`
[:688](../arkanoid.html#L688), `checkLevelClear` [:935](../arkanoid.html#L935), and `endGame`
[:950](../arkanoid.html#L950) each assign `state.phase` *and* call `showOverlay` directly. That's the
kind of duplication that causes an overlay/phase desync the first time someone adds a state.

Fix: route every transition through `setPhase`, and let it own the overlay mapping.

### 19. Dead/redundant code (S)
- `state.paddle.w` [:555](../arkanoid.html#L555) is assigned in `updatePaddle` [:757](../arkanoid.html#L757)
  but never read — every draw/collision path calls `paddleWidth()` instead.
- The `updateHud(); drawBackground(); drawBricks(); drawPaddle();` block at
  [:1115–1118](../arkanoid.html#L1115-L1118) is redundant; the rAF loop paints the same frame ~16 ms later.
- `updateBalls(dt, now)` [:866](../arkanoid.html#L866) never uses `now`.

### 20. No `AudioContext` resume, and the mute state isn't persisted (S)
`beep` [:735](../arkanoid.html#L735) lazily constructs the context but never calls `actx.resume()`. If the
context is ever created outside a user gesture it starts `suspended` and the game is silently mute for
the rest of the session. Separately, `state.muted` isn't saved to `localStorage`, so the setting resets
on every reload.

### 21. Extract a `config` block (M)
Magic numbers are scattered through the file: drop fall speed `130` [:801](../arkanoid.html#L801), particle
gravity `260` [:820](../arkanoid.html#L820), effect durations `10000`/`8000` [:776–779](../arkanoid.html#L776-L779),
multipliers `1.6`/`0.6`/`0.7`/`1.4`, ball-cap `5`, paddle bounce spread `1.05` [:887](../arkanoid.html#L887).
Collecting these into one `CONFIG` object makes the game tunable without hunting through the logic.

---

## D. Accessibility

### 22. Overlay state changes are not announced (S)
Level-clear, game-over, and victory overlays swap in silently. A screen-reader user gets no notification.

Fix: `role="status"` / `aria-live="polite"` on the overlay container, and `aria-hidden` toggled with
`.show`.

### 23. Toggle buttons don't reflect their state (S)
The mute button swaps its emoji [:728](../arkanoid.html#L728) but keeps `aria-label="Couper le son"`
[:445](../arkanoid.html#L445) forever. The pause button [:444](../arkanoid.html#L444) never changes at all.

Fix: `aria-pressed` plus a label that tracks state on both.

### 24. Canvas has no accessible fallback (S)
`<canvas>` [:393](../arkanoid.html#L393) has an `aria-label` but empty inner content and no live text
alternative for score/lives. The HUD above it is real DOM text, which mitigates this — worth confirming
the HUD is reachable rather than adding canvas fallback content.

### 25. `prefers-reduced-motion` is only honoured in CSS (S)
[:105–107](../arkanoid.html#L105-L107) disables the title flicker, but the canvas particle bursts and glow
are unaffected. Consider reading the media query in JS and reducing `burst()` counts.

---

## E. Gameplay / UX enhancements

### 26. No keyboard path out of the game-over / victory screens (S)
`handleLaunchOrResume` [:672](../arkanoid.html#L672) only handles `ready` and `paused`. From `gameover`,
`victory`, `levelclear`, or the initial `start` screen, Space does nothing — the player must reach for
the mouse.

Fix: make Space/Enter activate the primary button of whatever overlay is showing.

### 27. Touch: the first tap both aims and launches (S)
`touchstart` [:658–664](../arkanoid.html#L658-L664) sets `pointerX` and immediately calls
`handleLaunchOrResume`. On mobile you cannot position the paddle before serving — the ball launches
from wherever your finger first landed. Also, the finger sits directly on the paddle, occluding it.

Fix: launch on `touchend` instead, and apply a vertical offset so the paddle tracks above the finger.

### 28. No difficulty ramp within a level (M)
Ball speed is fixed per level ([:600](../arkanoid.html#L600), `LEVELS[i].speed`). Classic breakout speeds
the ball up after N bricks or on reaching the top wall, which prevents long stalemates on the last brick.

### 29. No score feedback on the canvas (M)
Points are only visible in the HUD. Floating `+30` text at the brick position, and a combo multiplier for
consecutive brick hits without a paddle touch, would add a lot of feel for modest code.

### 30. Suggested additional power-ups (M)
The current six are solid. Natural additions given the existing architecture: **sticky paddle** (ball
re-attaches, aim the next shot) and **laser** (fire upward on Space). Both slot into `POWERUPS`
[:520–527](../arkanoid.html#L520-L527) and `applyPowerup` [:774](../arkanoid.html#L774).

### 31. Active power-up timers are invisible (S)
The paddle changes colour for width effects [:1018](../arkanoid.html#L1018), but there is no indication of
*how long* an effect lasts, and speed effects have no visual at all.

Fix: a thin depleting bar under the HUD, or a shrinking ring on the paddle.

### 32. Only 5 levels, hand-authored (M)
[:492–498](../arkanoid.html#L492-L498). Options: add more hand-authored layouts, or add a procedural
generator for endless mode past level 5.

---

## Verification

There is no test infrastructure, so verification is manual. After any selected change:

1. Open `arkanoid.html` in a browser (both `file://` and via a local server — the two differ for
   items #1 and #2).
2. Confirm accented French text renders correctly on both (`Détruisez`, `Prêt`, `Meilleur`).
3. Full playthrough: start → launch → clear level 1 → level 2 → lose all lives → restart.
4. Pause mid-effect, wait 15 s, resume — confirm the power-up survives (#4).
5. Alt-tab while holding an arrow key, return — confirm the paddle stops (#3).
6. Test with DevTools device emulation for touch behaviour (#27) and DPR scaling (#17).
7. Open DevTools Performance and confirm no per-frame style recalc from `drawDrops` (#14).
8. Tab through the page with the keyboard only; confirm every overlay button is reachable and
   activatable (#6, #26).

If several items are selected, implement in group order (A → E) so that structural fixes (#18) land
before features that would otherwise duplicate the old pattern.
