# Neon Break — Code Review Findings

Reviewed: 2026-08-12 · Target: [arkanoid.html](../arkanoid.html)

The project is a single self-contained file, `arkanoid.html`: a bilingual (French/English) neon arcade
breakout game. Vanilla ES5-style JS in an IIFE, 2D canvas, no build step, no dependencies, no tests.

This document is a **menu, not a commitment** — items are implemented only when selected. Items are
ordered by severity within each group. Each carries an effort estimate (S / M / L).

**Status:** #1–#17 fixed, 15 items open. What shipped and when is tracked in
[release-notes.md](release-notes.md); individual items below carry a `✅ FIXED` note with the details.

**Line references below are re-anchored after each round of fixes** — they are only valid against the
current `arkanoid.html`.

---

## A. Correctness bugs

### 1. ✅ FIXED — No `<!DOCTYPE html>`, no `<meta charset="utf-8">` (S)
> **Fixed 2026-08-12.** The file now opens with `<!doctype html>` / `<html lang="fr">` and a real
> `<head>` carrying `<meta charset="utf-8">`, a viewport meta, and a `<title>`, with the markup
> wrapped in `<body>` — see [arkanoid.html:1–7](../arkanoid.html#L1-L7),
> [:415–416](../arkanoid.html#L415-L416), [:1505–1506](../arkanoid.html#L1505-L1506).

The file previously began directly with `<style>`, with no doctype, `<html>`, `<head>`, `<title>`,
charset, viewport, or `lang` attribute. Two real consequences:

- **Quirks mode.** Without a doctype the browser rendered in quirks mode, changing box-model and
  inline-layout behaviour.
- **Encoding.** The file contains raw UTF-8 accented text (`Détruisez` [:456](../arkanoid.html#L456),
  `Prêt ?` [:462](../arkanoid.html#L462), `Bougez` [:463](../arkanoid.html#L463)). With no charset
  declared, a browser opening this over `file://` or a server that didn't send `charset` would fall
  back to windows-1252 and render `DÃ©truisez`.

### 2. ✅ FIXED — `localStorage` access was unguarded, one throw killed the entire game (S)
> **Fixed 2026-08-12.** Reads and writes now go through `loadBest()` / `saveBest()`
> ([:733–750](../arkanoid.html#L733-L750)), both wrapped in `try/catch`, with the best score
> degrading to in-memory only. Call sites: [:759](../arkanoid.html#L759),
> [:1320](../arkanoid.html#L1320).

`localStorage.getItem(BEST_KEY)` was read at IIFE top level while constructing `state`. In Safari
private browsing, with cookies/site-data disabled, or in some sandboxed `file://` contexts,
`localStorage` access **throws** — which aborted the whole IIFE and rendered a dead canvas with no
error visible to the player.

### 3. ✅ FIXED — Held keys stuck when the window lost focus (S)
> **Fixed 2026-08-12.** A `blur` handler now clears every held key —
> [:880–889](../arkanoid.html#L880-L889).

`keydown` sets `state.keys[e.code] = true` [:865](../arkanoid.html#L865) and only `keyup` cleared it
[:879](../arkanoid.html#L879). Alt-tabbing (or hitting a browser shortcut) while holding <kbd>→</kbd>
meant the `keyup` was never delivered — on return the paddle slid into the wall and stayed pinned
until the key was pressed and released again.

### 4. ✅ FIXED — Power-up timers kept running while the game was paused (S)
> **Fixed 2026-08-12.** Effects now carry a `remaining` duration in seconds instead of an absolute
> `until` deadline, and `updateEffects(dt)` decrements it from the frame delta — which the loop only
> feeds while the phase is `playing`. See [:1106–1117](../arkanoid.html#L1106-L1117),
> [:1121–1124](../arkanoid.html#L1121-L1124), and the call site at [:1499](../arkanoid.html#L1499).
> Verified: a `widen` survives a 30-second pause intact, then expires after its full 10 seconds of
> actual play.

`widthEffect` / `speedEffect` stored an absolute `until` timestamp from `performance.now()` and were
compared against the rAF `now`. Pausing for 20 seconds silently burned a 10-second "widen". Counting
in accumulated play time also makes the timers immune to tab-throttling and clock adjustments.

### 5. ✅ FIXED — Game did not auto-pause when the tab was hidden or the window blurred (S)
> **Fixed 2026-08-12.** `autoPause()` ([:888–897](../arkanoid.html#L888-L897)) pauses whenever the
> phase is `playing`, wired to both `visibilitychange` and the existing `blur` handler from #3
> ([:883–886](../arkanoid.html#L883-L886)). It deliberately only fires *on* hide/blur, never on
> return, so the player resumes explicitly.

There was no `visibilitychange` handler. `requestAnimationFrame` throttles in a background tab, and
`dt` is clamped to 33 ms [:1492](../arkanoid.html#L1492), so the game didn't *jump* — but it stayed in
the `playing` phase, so power-up timers kept expiring (see #4) and returning to the tab dropped you
straight back into live play with no warm-up.

### 6. ✅ FIXED — `e.preventDefault()` on Space blocked button activation (S)
> **Fixed 2026-08-12.** The Space branch is now guarded by `isButtonFocused()`
> ([:856–861](../arkanoid.html#L856-L861), used at [:876](../arkanoid.html#L876)): when a `<button>`
> holds focus the key is handed back to the browser, so it activates the button instead of launching
> the ball.
>
> This needed a companion fix. The deck's pause/mute buttons stay on screen and keep focus after a
> mouse click, so the guard alone would have made Space toggle pause instead of launching. A
> `blurIfPointerClick` helper ([:1036–1041](../arkanoid.html#L1036-L1041)) drops focus after pointer
> clicks only — keyboard activation (`detail === 0`) keeps it, so tab-order navigation is unharmed.

Space was unconditionally `preventDefault`ed. Correct for stopping page scroll, but it also prevented
Space from activating a keyboard-focused `.btn` — a keyboard-only player who tabbed to "Rejouer" could
not press it with Space (Enter still worked).

### 7. ✅ FIXED — Arrow keys scroll the page (S)
> **Fixed 2026-08-13.** The movement branch in the `keydown` handler now calls `e.preventDefault()`
> alongside the existing pointer-release logic — [:868–875](../arkanoid.html#L868-L875). Applied to
> all four movement codes (`ArrowLeft`/`ArrowRight`/`KeyA`/`KeyD`) rather than singling out the arrow
> keys, since suppressing the letter keys too is harmless and keeps them behaving identically.

`ArrowLeft`/`ArrowRight` are read but never `preventDefault`ed. On a narrow viewport where the cabinet
overflows, steering the paddle also scrolls the document under it.

### 8. ✅ FIXED — `mousedown` launches the ball on any button, including right-click (S)
> **Fixed 2026-08-13.** The handler now takes the event and returns early unless
> `e.button === 0` — [:903–906](../arkanoid.html#L903-L906).

`canvas.addEventListener("mousedown", handleLaunchOrResume)` had no `e.button` check. Right-clicking
or middle-clicking to open a context menu launched the ball.

### 9. ✅ FIXED — Ball–paddle collision teleported the ball on side hits (M)
> **Fixed 2026-08-13.** The ball's `y` from before the frame's own movement is captured as `prevY`
> [:1240](../arkanoid.html#L1240). A paddle collision is only resolved as a top-face bounce — steering
> by offset and snapping onto the top — when `prevY` was already above the paddle top
> [:1252–1260](../arkanoid.html#L1252-L1260); otherwise it resolves as a side hit that reflects only
> the horizontal component and repositions the ball beside the paddle, the same treatment a brick's
> side face gets [:1261–1268](../arkanoid.html#L1261-L1268). Paddle-velocity spin was left for a
> separate pass — out of scope for the teleport itself.

Any `circleRectCollide` with `dy > 0` snapped `ball.y = pr.y - ball.r - 0.5`, i.e. onto the top of the
paddle. A ball clipping the paddle's *side* while descending past it got warped upward and re-served,
which read as a phantom save.

### 10. ✅ FIXED — Only one brick collision was resolved per ball per frame, chosen by array order (M)
> **Fixed 2026-08-13.** The bricks loop no longer resolves against the first overlap it finds. It now
> scans every alive brick the ball overlaps, scores each with `brickPenetration()`
> [:1208–1217](../arkanoid.html#L1208-L1217) — the smaller of the two axis overlaps, i.e. how shallow
> the intrusion is — and resolves against whichever brick has the smallest penetration
> [:1272–1290](../arkanoid.html#L1272-L1290). Array order no longer has any say in which face gets hit.

The loop broke after the first overlapping brick. Bricks are stored top-row-first, so when a ball
overlapped two adjacent bricks in a corner, it always bounced off the *upper* one regardless of which
face it actually struck. Visible as occasional wrong-direction ricochets in the dense levels 4–5.

### 11. ✅ FIXED — Drop hitbox (8 px) didn't match the drawn capsule (10 px) (S)
> **Fixed 2026-08-13.** `updateDrops`'s hit test now uses the same 10px radius `drawDrops` renders the
> capsule with — [:1157–1158](../arkanoid.html#L1157-L1158) vs. the `arc(0, 0, 10, …)` at
> [:1456](../arkanoid.html#L1456).

`updateDrops` tested `± 8` while `drawDrops` rendered `arc(0,0,10,…)`. Power-ups visually clipped the
paddle without being collected.

### 12. ✅ FIXED — Multi-ball could spawn balls aimed straight down (S)
> **Fixed 2026-08-13.** The clone angle is derived from the source ball's angle mirrored upward when
> it's descending, then spread symmetrically to either side — [:1134–1138](../arkanoid.html#L1134-L1138).
> A source ball travelling straight down used to produce two clones that were also both descending and
> usually lost within a second; now every clone starts with a negative `dy`.

The clone angle was `atan2(base.dy, base.dx) ± 0.6`. If the source ball was descending, both clones
were also descending, making "M" feel like a dud.

### 13. ✅ FIXED — Best score was only persisted at game over (S)
> **Fixed 2026-08-13.** The `state.score > state.best` check and `saveBest()` call are now behind a
> shared `maybeSaveBest()` helper [:1314–1322](../arkanoid.html#L1314-L1322), called from
> `checkLevelClear()` [:1326](../arkanoid.html#L1326) as well as `endGame()`
> [:1338](../arkanoid.html#L1338). Progress is now checkpointed at every level clear, not just at the
> end of the run.

`endGame` was the only caller of `saveBest()`. Closing the tab mid-run — including after clearing four
levels — lost the score entirely.

---

## B. Performance

### 14. ✅ FIXED — `getComputedStyle(document.body)` called per drop, per frame (S)
> **Fixed 2026-08-13.** The font string is now built once into a module-level `DROP_FONT` constant
> [:598](../arkanoid.html#L598); `drawDrops` just assigns it — [:1459](../arkanoid.html#L1459). The
> body's font never changes at runtime, so there was nothing to gain from recomputing it 60 times a
> second.

`getComputedStyle(document.body)` was called inside the `drawDrops` loop, once per falling power-up,
per frame. This forced a synchronous style recalculation every frame for every falling power-up — the
single most expensive line in the render path.

### 15. ✅ FIXED — `updateHud()` writes four DOM nodes every frame (S)
> **Fixed 2026-08-13.** A `hudLast` cache [:1363](../arkanoid.html#L1363) records what's currently
> displayed for each of the four HUD fields; `updateHud()` [:1364–1375](../arkanoid.html#L1364-L1375)
> only touches `textContent` for a field whose value actually changed since the last call. The
> unconditional per-frame call [:1504](../arkanoid.html#L1504) stays — it's still what catches
> `state.best` needing a live update against `state.score` — but an idle frame now writes nothing.

`updateHud()` was called unconditionally every frame, in addition to the event-driven calls in
`brickHit`, `applyPowerup`, and `loseLife` — 240 needless `textContent` assignments per second even
while nothing displayed was changing.

### 16. ✅ FIXED — `checkLevelClear()` scans the full brick array every frame (S)
> **Fixed 2026-08-13.** `state.remainingBricks` [:771](../arkanoid.html#L771) counts destructible
> bricks still alive; `buildLevel()` seeds it when a level starts
> [:791](../arkanoid.html#L791)/[:808](../arkanoid.html#L808), and `brickHit()` decrements it at the
> single point a brick actually dies [:1187](../arkanoid.html#L1187). `checkLevelClear()`
> [:1324–1335](../arkanoid.html#L1324-L1335) is now an `O(1)` counter check instead of an `O(n)` scan.

`checkLevelClear()` ran `.some()` over up to 80 bricks every single frame. Cheap in absolute terms, but
trivially replaceable with a counter decremented in `brickHit`.

### 17. ✅ FIXED — Canvas backing store is sized from DPR only, ignoring displayed size (S)
> **Fixed 2026-08-13.** `fitCanvas()` [:524–538](../arkanoid.html#L524-L538) now reads the canvas's
> actual displayed width via `getBoundingClientRect()` and scales the backing store by
> `dpr * min(1, displayWidth / GAME_W)` — never upsizing past `dpr` (unchanged from before whenever the
> canvas is shown at or above its logical size), but shrinking the allocation when the canvas — styled
> `width: 100%; height: auto` — renders narrower than that, as on a phone.

`fitCanvas` always allocated `480 × 680 × dpr`. On a phone where the canvas displays at ~300 px wide
with `dpr = 3`, that was a 1440×2040 buffer for a 300 px element.

---

## C. Code quality / structure

### 18. Phase transitions bypass `setPhase()` in three places (S)
`setPhase` [:953](../arkanoid.html#L953) is the intended single entry point, but `togglePause`
[:936](../arkanoid.html#L936), `checkLevelClear` [:1330](../arkanoid.html#L1330), and `endGame`
[:1342](../arkanoid.html#L1342) each assign `state.phase` *and* call `showOverlay` directly. That's the
kind of duplication that causes an overlay/phase desync the first time someone adds a state.

Fix: route every transition through `setPhase`, and let it own the overlay mapping.

### 19. Dead/redundant code (S)
- `state.paddle.w` [:766](../arkanoid.html#L766) is assigned in `updatePaddle` [:1094](../arkanoid.html#L1094)
  but never read — every draw/collision path calls `paddleWidth()` instead.
- The `updateHud(); drawBackground(); drawBricks(); drawPaddle();` block at
  [:1513–1517](../arkanoid.html#L1513-L1517) is redundant; the rAF loop paints the same frame ~16 ms later.
- `updateBalls(dt, now)` [:1232](../arkanoid.html#L1232) never uses `now`.

### 20. No `AudioContext` resume, and the mute state isn't persisted (S) — *groundwork done*
`beep` [:1072](../arkanoid.html#L1072) lazily constructs the context but never calls `actx.resume()`. If
the context is ever created outside a user gesture it starts `suspended` and the game is silently mute
for the rest of the session. Separately, `state.muted` isn't saved, so the setting resets on every
reload.

> The generalisation this called for has since landed: the guarded wrappers are now
> `storageGet`/`storageSet` ([:733–750](../arkanoid.html#L733-L750)), already reused for the language
> preference. Persisting mute is now the same three lines as `loadLang`/`saveLang`.

### 21. Extract a `config` block (M)
Magic numbers are scattered through the file: drop fall speed `130` [:1153](../arkanoid.html#L1153), particle
gravity `260` [:1174](../arkanoid.html#L1174), effect durations `10`/`8` seconds [:1121–1124](../arkanoid.html#L1121-L1124),
multipliers `1.6`/`0.6`/`0.7`/`1.4`, ball-cap `5`, paddle bounce spread `1.05` [:1257](../arkanoid.html#L1257).
Collecting these into one `CONFIG` object makes the game tunable without hunting through the logic.

---

## D. Accessibility

### 22. Overlay state changes are not announced (S)
Level-clear, game-over, and victory overlays swap in silently. A screen-reader user gets no notification.

Fix: `role="status"` / `aria-live="polite"` on the overlay container, and `aria-hidden` toggled with
`.show`.

### 23. Toggle buttons don't reflect their state (S) — *partially done*
> **Half fixed 2026-08-12** by the bilingual work. `renderMuteButton()`
> ([:988–992](../arkanoid.html#L988-L992)) now sets the mute button's `aria-label` from both the
> language and the on/off state, so it no longer claims "Couper le son" while already muted.

Still open: neither toggle exposes `aria-pressed`, and the pause button
[:500](../arkanoid.html#L500) still never changes its label or state when the game is paused. The
language toggle added in the same round *does* use `aria-pressed`
([:423–424](../arkanoid.html#L423-L424)) and is the pattern to copy.

Fix: `aria-pressed` on both deck buttons, and a state-tracking label for pause mirroring
`renderMuteButton()`.

### 24. Canvas has no accessible fallback (S)
`<canvas>` [:449](../arkanoid.html#L449) has an `aria-label` but empty inner content and no live text
alternative for score/lives. The HUD above it is real DOM text, which mitigates this — worth confirming
the HUD is reachable rather than adding canvas fallback content.

### 25. `prefers-reduced-motion` is only honoured in CSS (S)
[:111–113](../arkanoid.html#L111-L113) disables the title flicker, but the canvas particle bursts and
glow are unaffected. Consider reading the media query in JS and reducing `burst()` counts.

---

## E. Gameplay / UX enhancements

### 26. No keyboard path out of the game-over / victory screens (S)
`handleLaunchOrResume` [:921](../arkanoid.html#L921) only handles `ready` and `paused`. From `gameover`,
`victory`, `levelclear`, or the initial `start` screen, Space does nothing — the player must reach for
the mouse.

Fix: make Space/Enter activate the primary button of whatever overlay is showing. Interacts with #6 —
the `isButtonFocused()` guard already yields Space to a focused button, so this is about giving the
overlay's primary button focus when it appears.

### 27. Touch: the first tap both aims and launches (S)
`touchstart` [:907–913](../arkanoid.html#L907-L913) sets `pointerX` and immediately calls
`handleLaunchOrResume`. On mobile you cannot position the paddle before serving — the ball launches
from wherever your finger first landed. Also, the finger sits directly on the paddle, occluding it.

Fix: launch on `touchend` instead, and apply a vertical offset so the paddle tracks above the finger.

### 28. No difficulty ramp within a level (M)
Ball speed is fixed per level ([:816](../arkanoid.html#L816), `LEVELS[i].speed`). Classic breakout speeds
the ball up after N bricks or on reaching the top wall, which prevents long stalemates on the last brick.

### 29. No score feedback on the canvas (M)
Points are only visible in the HUD. Floating `+30` text at the brick position, and a combo multiplier for
consecutive brick hits without a paddle touch, would add a lot of feel for modest code.

### 30. Suggested additional power-ups (M)
The current six are solid. Natural additions given the existing architecture: **sticky paddle** (ball
re-attaches, aim the next shot) and **laser** (fire upward on Space). Both slot into `POWERUPS`
[:585–592](../arkanoid.html#L585-L592) and `applyPowerup` [:1120](../arkanoid.html#L1120).

### 31. Active power-up timers are invisible (S)
The paddle changes colour for width effects [:1415](../arkanoid.html#L1415), but there is no indication
of *how long* an effect lasts, and speed effects have no visual at all.

Fix: a thin depleting bar under the HUD, or a shrinking ring on the paddle. Cheap now that #4 stores a
`remaining` duration — the bar is just `remaining / total`.

### 32. Only 5 levels, hand-authored (M)
[:557–563](../arkanoid.html#L557-L563). Options: add more hand-authored layouts, or add a procedural
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

As of #14–#17, this manual checklist is now backed by an automated suite — see
[testing.md](testing.md) — but the steps above remain useful as an end-to-end sanity pass.
