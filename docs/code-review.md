# Neon Break — Code Review Findings

Reviewed: 2026-08-12 · Target: [arkanoid.html](../arkanoid.html)

The project is a single self-contained file, `arkanoid.html`: a bilingual (French/English) neon arcade
breakout game. Vanilla ES5-style JS in an IIFE, 2D canvas, no build step, no dependencies, no tests.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** #1–#6 fixed, 26 items open. What shipped and when is tracked in
[release-notes.md](release-notes.md); individual items below carry a `✅ FIXED` note with the details.

**Line references below are re-anchored after each round of fixes** — they are only valid against the
current `arkanoid.html`.

---

## A. Correctness bugs

### 1. ✅ FIXED — No `<!DOCTYPE html>`, no `<meta charset="utf-8">` (S)
> **Fixed 2026-08-12.** The file now opens with `<!doctype html>` / `<html lang="fr">` and a real
> `<head>` carrying `<meta charset="utf-8">`, a viewport meta, and a `<title>`, with the markup
> wrapped in `<body>` — see [arkanoid.html:1–7](../arkanoid.html#L1-L7),
> [:409–410](../arkanoid.html#L409-L410), [:1434–1435](../arkanoid.html#L1434-L1435).

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
> [:1259](../arkanoid.html#L1259).

`localStorage.getItem(BEST_KEY)` was read at IIFE top level while constructing `state`. In Safari
private browsing, with cookies/site-data disabled, or in some sandboxed `file://` contexts,
`localStorage` access **throws** — which aborted the whole IIFE and rendered a dead canvas with no
error visible to the player.

### 3. ✅ FIXED — Held keys stuck when the window lost focus (S)
> **Fixed 2026-08-12.** A `blur` handler now clears every held key —
> [:852–861](../arkanoid.html#L852-L861).

`keydown` sets `state.keys[e.code] = true` [:842](../arkanoid.html#L842) and only `keyup` cleared it
[:851](../arkanoid.html#L851). Alt-tabbing (or hitting a browser shortcut) while holding <kbd>→</kbd>
meant the `keyup` was never delivered — on return the paddle slid into the wall and stayed pinned
until the key was pressed and released again.

### 4. ✅ FIXED — Power-up timers kept running while the game was paused (S)
> **Fixed 2026-08-12.** Effects now carry a `remaining` duration in seconds instead of an absolute
> `until` deadline, and `updateEffects(dt)` decrements it from the frame delta — which the loop only
> feeds while the phase is `playing`. See [:1075–1086](../arkanoid.html#L1075-L1086),
> [:1090–1093](../arkanoid.html#L1090-L1093), and the call site at [:1411](../arkanoid.html#L1411).
> Verified: a `widen` survives a 30-second pause intact, then expires after its full 10 seconds of
> actual play.

`widthEffect` / `speedEffect` stored an absolute `until` timestamp from `performance.now()` and were
compared against the rAF `now`. Pausing for 20 seconds silently burned a 10-second "widen". Counting
in accumulated play time also makes the timers immune to tab-throttling and clock adjustments.

### 5. ✅ FIXED — Game did not auto-pause when the tab was hidden or the window blurred (S)
> **Fixed 2026-08-12.** `autoPause()` ([:860–869](../arkanoid.html#L860-L869)) pauses whenever the
> phase is `playing`, wired to both `visibilitychange` and the existing `blur` handler from #3
> ([:855–858](../arkanoid.html#L855-L858)). It deliberately only fires *on* hide/blur, never on
> return, so the player resumes explicitly.

There was no `visibilitychange` handler. `requestAnimationFrame` throttles in a background tab, and
`dt` is clamped to 33 ms [:1404](../arkanoid.html#L1404), so the game didn't *jump* — but it stayed in
the `playing` phase, so power-up timers kept expiring (see #4) and returning to the tab dropped you
straight back into live play with no warm-up.

### 6. ✅ FIXED — `e.preventDefault()` on Space blocked button activation (S)
> **Fixed 2026-08-12.** The Space branch is now guarded by `isButtonFocused()`
> ([:833–838](../arkanoid.html#L833-L838), used at [:848](../arkanoid.html#L848)): when a `<button>`
> holds focus the key is handed back to the browser, so it activates the button instead of launching
> the ball.
>
> This needed a companion fix. The deck's pause/mute buttons stay on screen and keep focus after a
> mouse click, so the guard alone would have made Space toggle pause instead of launching. A
> `blurIfPointerClick` helper ([:1005–1010](../arkanoid.html#L1005-L1010)) drops focus after pointer
> clicks only — keyboard activation (`detail === 0`) keeps it, so tab-order navigation is unharmed.

Space was unconditionally `preventDefault`ed. Correct for stopping page scroll, but it also prevented
Space from activating a keyboard-focused `.btn` — a keyboard-only player who tabbed to "Rejouer" could
not press it with Space (Enter still worked).

### 7. Arrow keys scroll the page (S)
`ArrowLeft`/`ArrowRight` are read but never `preventDefault`ed. On a narrow viewport where the cabinet
overflows, steering the paddle also scrolls the document under it.

Fix: `preventDefault` for the four movement codes. The `isButtonFocused()` guard added for #6 is the
pattern to follow.

### 8. `mousedown` launches the ball on any button, including right-click (S)
[:875](../arkanoid.html#L875) — `canvas.addEventListener("mousedown", handleLaunchOrResume)` with no
`e.button` check. Right-clicking or middle-clicking to open a context menu launches the ball.

Fix: guard on `e.button === 0`.

### 9. Ball–paddle collision teleports the ball on side hits (M)
[:1198–1205](../arkanoid.html#L1198-L1205) — any `circleRectCollide` with `dy > 0` snaps
`ball.y = pr.y - ball.r - 0.5`, i.e. on top of the paddle. A ball clipping the paddle's *side* while
descending past it gets warped upward and re-served, which reads as a phantom save. The same code has
no relative-velocity term, so a fast-moving paddle doesn't impart any spin.

Fix: only treat it as a top-face hit when the ball's previous `y` was above the paddle top; otherwise
resolve as a side hit. Optionally add paddle velocity into the outgoing angle.

### 10. Only one brick collision is resolved per ball per frame, chosen by array order (M)
[:1209–1217](../arkanoid.html#L1209-L1217) breaks after the first overlapping brick. Bricks are stored
top-row-first, so when a ball overlaps two adjacent bricks in a corner, it always bounces off the
*upper* one regardless of which face it actually struck. Visible as occasional wrong-direction
ricochets in the dense levels 4–5.

Fix: collect all overlaps, resolve against the one with the smallest penetration.

### 11. Drop hitbox (8 px) doesn't match the drawn capsule (10 px) (S)
`updateDrops` tests `± 8` [:1117–1118](../arkanoid.html#L1117-L1118); `drawDrops` renders `arc(0,0,10,…)`
[:1368](../arkanoid.html#L1368). Power-ups visually clip the paddle without being collected.

### 12. Multi-ball can spawn balls aimed straight down (S)
[:1100](../arkanoid.html#L1100) — the clone angle is `atan2(base.dy, base.dx) ± 0.6`. If the source ball
is descending, both clones are also descending and are usually lost within a second, making "M" feel
like a dud.

Fix: bias clone angles upward, or spread them symmetrically around the horizontal.

### 13. Best score is only persisted at game over (S)
`endGame` [:1256–1260](../arkanoid.html#L1256-L1260) is the only caller of `saveBest()`. Closing the
tab mid-run — including after clearing four levels — loses the score entirely.

Fix: call `saveBest()` (added in #2) whenever `state.score > state.best`, e.g. on level clear.

---

## B. Performance

### 14. `getComputedStyle(document.body)` called per drop, per frame (S)
[:1371](../arkanoid.html#L1371), inside the `drawDrops` loop. This forces a synchronous style
recalculation every frame for every falling power-up — the single most expensive line in the render path.

Fix: hoist the font string to a module-level constant.

### 15. `updateHud()` writes four DOM nodes every frame (S)
Called unconditionally at [:1416](../arkanoid.html#L1416) in addition to the event-driven calls in
`brickHit`, `applyPowerup`, and `loseLife`. 240 needless `textContent` assignments per second.

Fix: drop the per-frame call, or guard each write behind a changed-value check.

### 16. `checkLevelClear()` scans the full brick array every frame (S)
[:1241–1245](../arkanoid.html#L1241-L1245) runs `.some()` over up to 80 bricks each frame. Cheap in
absolute terms, but trivially replaceable with a `remainingBricks` counter decremented in `brickHit`.

### 17. Canvas backing store is sized from DPR only, ignoring displayed size (S)
`fitCanvas` [:518–523](../arkanoid.html#L518-L523) always allocates `480 × 680 × dpr`. On a phone where
the canvas displays at ~300 px wide with `dpr = 3`, that's a 1440×2040 buffer for a 300 px element.

Fix: derive the multiplier from `getBoundingClientRect().width` as well as DPR.

---

## C. Code quality / structure

### 18. Phase transitions bypass `setPhase()` in three places (S)
`setPhase` [:922](../arkanoid.html#L922) is the intended single entry point, but `togglePause`
[:905](../arkanoid.html#L905), `checkLevelClear` [:1249](../arkanoid.html#L1249), and `endGame`
[:1264](../arkanoid.html#L1264) each assign `state.phase` *and* call `showOverlay` directly. That's the
kind of duplication that causes an overlay/phase desync the first time someone adds a state.

Fix: route every transition through `setPhase`, and let it own the overlay mapping.

### 19. Dead/redundant code (S)
- `state.paddle.w` [:747](../arkanoid.html#L747) is assigned in `updatePaddle` [:1063](../arkanoid.html#L1063)
  but never read — every draw/collision path calls `paddleWidth()` instead.
- The `updateHud(); drawBackground(); drawBricks(); drawPaddle();` block at
  [:1425–1429](../arkanoid.html#L1425-L1429) is redundant; the rAF loop paints the same frame ~16 ms later.
- `updateBalls(dt, now)` [:1180](../arkanoid.html#L1180) never uses `now`.

### 20. No `AudioContext` resume, and the mute state isn't persisted (S) — *groundwork done*
`beep` [:1041](../arkanoid.html#L1041) lazily constructs the context but never calls `actx.resume()`. If
the context is ever created outside a user gesture it starts `suspended` and the game is silently mute
for the rest of the session. Separately, `state.muted` isn't saved, so the setting resets on every
reload.

> The generalisation this called for has since landed: the guarded wrappers are now
> `storageGet`/`storageSet` ([:714–731](../arkanoid.html#L714-L731)), already reused for the language
> preference. Persisting mute is now the same three lines as `loadLang`/`saveLang`.

### 21. Extract a `config` block (M)
Magic numbers are scattered through the file: drop fall speed `130` [:1115](../arkanoid.html#L1115), particle
gravity `260` [:1134](../arkanoid.html#L1134), effect durations `10`/`8` seconds [:1090–1093](../arkanoid.html#L1090-L1093),
multipliers `1.6`/`0.6`/`0.7`/`1.4`, ball-cap `5`, paddle bounce spread `1.05` [:1201](../arkanoid.html#L1201).
Collecting these into one `CONFIG` object makes the game tunable without hunting through the logic.

---

## D. Accessibility

### 22. Overlay state changes are not announced (S)
Level-clear, game-over, and victory overlays swap in silently. A screen-reader user gets no notification.

Fix: `role="status"` / `aria-live="polite"` on the overlay container, and `aria-hidden` toggled with
`.show`.

### 23. Toggle buttons don't reflect their state (S) — *partially done*
> **Half fixed 2026-08-12** by the bilingual work. `renderMuteButton()`
> ([:957–961](../arkanoid.html#L957-L961)) now sets the mute button's `aria-label` from both the
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
`handleLaunchOrResume` [:890](../arkanoid.html#L890) only handles `ready` and `paused`. From `gameover`,
`victory`, `levelclear`, or the initial `start` screen, Space does nothing — the player must reach for
the mouse.

Fix: make Space/Enter activate the primary button of whatever overlay is showing. Interacts with #6 —
the `isButtonFocused()` guard already yields Space to a focused button, so this is about giving the
overlay's primary button focus when it appears.

### 27. Touch: the first tap both aims and launches (S)
`touchstart` [:876–882](../arkanoid.html#L876-L882) sets `pointerX` and immediately calls
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
[:570–577](../arkanoid.html#L570-L577) and `applyPowerup` [:1089](../arkanoid.html#L1089).

### 31. Active power-up timers are invisible (S)
The paddle changes colour for width effects [:1327](../arkanoid.html#L1327), but there is no indication
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
