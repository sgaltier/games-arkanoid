# Neon Break — Code Review Findings

Reviewed: 2026-08-12 · Target: [arkanoid.html](../arkanoid.html)

The project is a single self-contained file, `arkanoid.html`: a French-language neon arcade breakout
game. Vanilla ES5-style JS in an IIFE, 2D canvas, no build step, no dependencies, no tests.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

## Status

| Date | Items | Note |
|---|---|---|
| 2026-08-12 | **#1, #2, #3 — ✅ fixed** | Document structure, `localStorage` guard, stuck-key fix |

Remaining: 29 open items. **Line references below were re-anchored to the post-fix file** — the three
fixes shifted the source by 6–26 lines depending on region.

---

## A. Correctness bugs

### 1. ✅ FIXED — No `<!DOCTYPE html>`, no `<meta charset="utf-8">` (S)
> **Fixed 2026-08-12.** The file now opens with `<!doctype html>` / `<html lang="fr">` and a real
> `<head>` carrying `<meta charset="utf-8">`, a viewport meta, and a `<title>`, with the markup
> wrapped in `<body>` — see [arkanoid.html:1–7](../arkanoid.html#L1-L7),
> [:371–372](../arkanoid.html#L371-L372), [:1149–1150](../arkanoid.html#L1149-L1150).

The file previously began directly with `<style>`, with no doctype, `<html>`, `<head>`, `<title>`,
charset, viewport, or `lang` attribute. Two real consequences:

- **Quirks mode.** Without a doctype the browser rendered in quirks mode, changing box-model and
  inline-layout behaviour.
- **Encoding.** The file contains raw UTF-8 accented text (`Détruisez` [:408](../arkanoid.html#L408),
  `Prêt ?` [:414](../arkanoid.html#L414), `Bougez` [:415](../arkanoid.html#L415)). With no charset
  declared, a browser opening this over `file://` or a server that didn't send `charset` would fall
  back to windows-1252 and render `DÃ©truisez`.

### 2. ✅ FIXED — `localStorage` access was unguarded, one throw killed the entire game (S)
> **Fixed 2026-08-12.** Reads and writes now go through `loadBest()` / `saveBest()`
> ([:553–564](../arkanoid.html#L553-L564)), both wrapped in `try/catch`, with the best score
> degrading to in-memory only. Call sites: [:570](../arkanoid.html#L570),
> [:972](../arkanoid.html#L972).

`localStorage.getItem(BEST_KEY)` was read at IIFE top level while constructing `state`. In Safari
private browsing, with cookies/site-data disabled, or in some sandboxed `file://` contexts,
`localStorage` access **throws** — which aborted the whole IIFE and rendered a dead canvas with no
error visible to the player.

### 3. ✅ FIXED — Held keys stuck when the window lost focus (S)
> **Fixed 2026-08-12.** A `blur` handler now clears every held key —
> [:673–676](../arkanoid.html#L673-L676).

`keydown` sets `state.keys[e.code] = true` [:663](../arkanoid.html#L663) and only `keyup` cleared it
[:672](../arkanoid.html#L672). Alt-tabbing (or hitting a browser shortcut) while holding <kbd>→</kbd>
meant the `keyup` was never delivered — on return the paddle slid into the wall and stayed pinned
until the key was pressed and released again.

### 4. Power-up timers keep running while the game is paused (S)
`widthEffect` / `speedEffect` store an absolute `until` timestamp from `performance.now()`
([:802–805](../arkanoid.html#L802-L805)) and are compared against the rAF `now` in `updateEffects`
([:796–797](../arkanoid.html#L796-L797)). Pausing for 20 seconds silently burns a 10-second "widen".

Fix: track remaining duration and decrement by `dt` only while playing, or offset `until` by the
paused interval on resume.

### 5. Game does not auto-pause when the tab is hidden or the window blurs (S)
There is no `visibilitychange` handler. `requestAnimationFrame` throttles in a background tab, and
`dt` is clamped to 33 ms [:1120](../arkanoid.html#L1120), so the game doesn't *jump* — but it stays in
the `playing` phase, so power-up timers keep expiring (see #4) and returning to the tab drops you
straight back into live play with no warm-up.

Fix: on `visibilitychange`/`blur`, if phase is `playing`, call `togglePause()`. The `blur` listener
added for #3 is the natural place to hang this.

### 6. `e.preventDefault()` on Space blocks button activation (S)
[:669](../arkanoid.html#L669) unconditionally prevents the default for `Space`. That's correct for
stopping page scroll, but it also prevents Space from activating a keyboard-focused `.btn` — so a
keyboard-only player who tabs to "Rejouer" cannot press it with Space (Enter still works).

Fix: skip `preventDefault` when `document.activeElement` is a button, or scope the key handling.

### 7. Arrow keys scroll the page (S)
`ArrowLeft`/`ArrowRight` are read but never `preventDefault`ed. On a narrow viewport where the cabinet
overflows, steering the paddle also scrolls the document under it.

Fix: `preventDefault` for the four movement codes.

### 8. `mousedown` launches the ball on any button, including right-click (S)
[:683](../arkanoid.html#L683) — `canvas.addEventListener("mousedown", handleLaunchOrResume)` with no
`e.button` check. Right-clicking or middle-clicking to open a context menu launches the ball.

Fix: guard on `e.button === 0`.

### 9. Ball–paddle collision teleports the ball on side hits (M)
[:910–917](../arkanoid.html#L910-L917) — any `circleRectCollide` with `dy > 0` snaps
`ball.y = pr.y - ball.r - 0.5`, i.e. on top of the paddle. A ball clipping the paddle's *side* while
descending past it gets warped upward and re-served, which reads as a phantom save. The same code has
no relative-velocity term, so a fast-moving paddle doesn't impart any spin.

Fix: only treat it as a top-face hit when the ball's previous `y` was above the paddle top; otherwise
resolve as a side hit. Optionally add paddle velocity into the outgoing angle.

### 10. Only one brick collision is resolved per ball per frame, chosen by array order (M)
[:921–929](../arkanoid.html#L921-L929) breaks after the first overlapping brick. Bricks are stored
top-row-first, so when a ball overlaps two adjacent bricks in a corner, it always bounces off the
*upper* one regardless of which face it actually struck. Visible as occasional wrong-direction
ricochets in the dense levels 4–5.

Fix: collect all overlaps, resolve against the one with the smallest penetration.

### 11. Drop hitbox (8 px) doesn't match the drawn capsule (10 px) (S)
`updateDrops` tests `± 8` [:829–830](../arkanoid.html#L829-L830); `drawDrops` renders `arc(0,0,10,…)`
[:1084](../arkanoid.html#L1084). Power-ups visually clip the paddle without being collected.

### 12. Multi-ball can spawn balls aimed straight down (S)
[:812](../arkanoid.html#L812) — the clone angle is `atan2(base.dy, base.dx) ± 0.6`. If the source ball
is descending, both clones are also descending and are usually lost within a second, making "M" feel
like a dud.

Fix: bias clone angles upward, or spread them symmetrically around the horizontal.

### 13. Best score is only persisted at game over (S)
`endGame` [:969–973](../arkanoid.html#L969-L973) is the only caller of `saveBest()`. Closing the tab
mid-run — including after clearing four levels — loses the score entirely.

Fix: call `saveBest()` (added in #2) whenever `state.score > state.best`, e.g. on level clear.

---

## B. Performance

### 14. `getComputedStyle(document.body)` called per drop, per frame (S)
[:1087](../arkanoid.html#L1087), inside the `drawDrops` loop. This forces a synchronous style
recalculation every frame for every falling power-up — the single most expensive line in the render path.

Fix: hoist the font string to a module-level constant.

### 15. `updateHud()` writes four DOM nodes every frame (S)
Called unconditionally at [:1132](../arkanoid.html#L1132) in addition to the event-driven calls in
`brickHit`, `applyPowerup`, and `loseLife`. 240 needless `textContent` assignments per second.

Fix: drop the per-frame call, or guard each write behind a changed-value check.

### 16. `checkLevelClear()` scans the full brick array every frame (S)
[:953–956](../arkanoid.html#L953-L956) runs `.some()` over up to 80 bricks each frame. Cheap in
absolute terms, but trivially replaceable with a `remainingBricks` counter decremented in `brickHit`.

### 17. Canvas backing store is sized from DPR only, ignoring displayed size (S)
`fitCanvas` [:476–481](../arkanoid.html#L476-L481) always allocates `480 × 680 × dpr`. On a phone where
the canvas displays at ~300 px wide with `dpr = 3`, that's a 1440×2040 buffer for a 300 px element.

Fix: derive the multiplier from `getBoundingClientRect().width` as well as DPR.

---

## C. Code quality / structure

### 18. Phase transitions bypass `setPhase()` in three places (S)
`setPhase` [:730](../arkanoid.html#L730) is the intended single entry point, but `togglePause`
[:714](../arkanoid.html#L714), `checkLevelClear` [:961](../arkanoid.html#L961), and `endGame`
[:976](../arkanoid.html#L976) each assign `state.phase` *and* call `showOverlay` directly. That's the
kind of duplication that causes an overlay/phase desync the first time someone adds a state.

Fix: route every transition through `setPhase`, and let it own the overlay mapping.

### 19. Dead/redundant code (S)
- `state.paddle.w` [:577](../arkanoid.html#L577) is assigned in `updatePaddle` [:783](../arkanoid.html#L783)
  but never read — every draw/collision path calls `paddleWidth()` instead.
- The `updateHud(); drawBackground(); drawBricks(); drawPaddle();` block at
  [:1141–1144](../arkanoid.html#L1141-L1144) is redundant; the rAF loop paints the same frame ~16 ms later.
- `updateBalls(dt, now)` [:892](../arkanoid.html#L892) never uses `now`.

### 20. No `AudioContext` resume, and the mute state isn't persisted (S)
`beep` [:761](../arkanoid.html#L761) lazily constructs the context but never calls `actx.resume()`. If
the context is ever created outside a user gesture it starts `suspended` and the game is silently mute
for the rest of the session. Separately, `state.muted` isn't saved, so the setting resets on every
reload — the guarded storage helpers from #2 ([:553–564](../arkanoid.html#L553-L564)) generalise to
cover this.

### 21. Extract a `config` block (M)
Magic numbers are scattered through the file: drop fall speed `130` [:827](../arkanoid.html#L827), particle
gravity `260` [:846](../arkanoid.html#L846), effect durations `10000`/`8000` [:802–805](../arkanoid.html#L802-L805),
multipliers `1.6`/`0.6`/`0.7`/`1.4`, ball-cap `5`, paddle bounce spread `1.05` [:913](../arkanoid.html#L913).
Collecting these into one `CONFIG` object makes the game tunable without hunting through the logic.

---

## D. Accessibility

### 22. Overlay state changes are not announced (S)
Level-clear, game-over, and victory overlays swap in silently. A screen-reader user gets no notification.

Fix: `role="status"` / `aria-live="polite"` on the overlay container, and `aria-hidden` toggled with
`.show`.

### 23. Toggle buttons don't reflect their state (S)
The mute button swaps its emoji [:754](../arkanoid.html#L754) but keeps `aria-label="Couper le son"`
[:453](../arkanoid.html#L453) forever. The pause button [:452](../arkanoid.html#L452) never changes at all.

Fix: `aria-pressed` plus a label that tracks state on both.

### 24. Canvas has no accessible fallback (S)
`<canvas>` [:401](../arkanoid.html#L401) has an `aria-label` but empty inner content and no live text
alternative for score/lives. The HUD above it is real DOM text, which mitigates this — worth confirming
the HUD is reachable rather than adding canvas fallback content.

### 25. `prefers-reduced-motion` is only honoured in CSS (S)
[:111–113](../arkanoid.html#L111-L113) disables the title flicker, but the canvas particle bursts and
glow are unaffected. Consider reading the media query in JS and reducing `burst()` counts.

---

## E. Gameplay / UX enhancements

### 26. No keyboard path out of the game-over / victory screens (S)
`handleLaunchOrResume` [:698](../arkanoid.html#L698) only handles `ready` and `paused`. From `gameover`,
`victory`, `levelclear`, or the initial `start` screen, Space does nothing — the player must reach for
the mouse.

Fix: make Space/Enter activate the primary button of whatever overlay is showing.

### 27. Touch: the first tap both aims and launches (S)
`touchstart` [:684–690](../arkanoid.html#L684-L690) sets `pointerX` and immediately calls
`handleLaunchOrResume`. On mobile you cannot position the paddle before serving — the ball launches
from wherever your finger first landed. Also, the finger sits directly on the paddle, occluding it.

Fix: launch on `touchend` instead, and apply a vertical offset so the paddle tracks above the finger.

### 28. No difficulty ramp within a level (M)
Ball speed is fixed per level ([:622](../arkanoid.html#L622), `LEVELS[i].speed`). Classic breakout speeds
the ball up after N bricks or on reaching the top wall, which prevents long stalemates on the last brick.

### 29. No score feedback on the canvas (M)
Points are only visible in the HUD. Floating `+30` text at the brick position, and a combo multiplier for
consecutive brick hits without a paddle touch, would add a lot of feel for modest code.

### 30. Suggested additional power-ups (M)
The current six are solid. Natural additions given the existing architecture: **sticky paddle** (ball
re-attaches, aim the next shot) and **laser** (fire upward on Space). Both slot into `POWERUPS`
[:528–535](../arkanoid.html#L528-L535) and `applyPowerup` [:800](../arkanoid.html#L800).

### 31. Active power-up timers are invisible (S)
The paddle changes colour for width effects [:1044](../arkanoid.html#L1044), but there is no indication
of *how long* an effect lasts, and speed effects have no visual at all.

Fix: a thin depleting bar under the HUD, or a shrinking ring on the paddle.

### 32. Only 5 levels, hand-authored (M)
[:500–506](../arkanoid.html#L500-L506). Options: add more hand-authored layouts, or add a procedural
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
