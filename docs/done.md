# Neon Break — Fixed Findings

Target: [arkanoid.html](../arkanoid.html). This is the **done** half of the project's review backlog —
every finding here has shipped. Open items live in [todo.md](todo.md); what shipped in which commit is
tracked in [release-notes.md](release-notes.md). A finding keeps its original number when it moves
from `todo.md` to here, so numbering is shared across both files and never reused — every number from
1 up belongs to exactly one of the two.

Each entry keeps its original write-up (category, effort estimate, the bug as found) with a
`> **Fixed <date>.**` note prepended describing what shipped — a historical record, not a live TODO.

**Status:** 40 findings fixed. See [todo.md](todo.md) for what's still open.

**Line references below are re-anchored after each round of fixes** — they are only valid against the
current `arkanoid.html`.

---

## A. Correctness bugs

### 1. ✅ FIXED — No `<!DOCTYPE html>`, no `<meta charset="utf-8">` (S)
> **Fixed 2026-08-12.** The file now opens with `<!doctype html>` / `<html lang="fr">` and a real
> `<head>` carrying `<meta charset="utf-8">`, a viewport meta, and a `<title>`, with the markup
> wrapped in `<body>` — see [arkanoid.html:1–7](../arkanoid.html#L1-L7),
> [:528–529](../arkanoid.html#L528-L529), [:2248–2249](../arkanoid.html#L2248-L2249).

The file previously began directly with `<style>`, with no doctype, `<html>`, `<head>`, `<title>`,
charset, viewport, or `lang` attribute. Two real consequences:

- **Quirks mode.** Without a doctype the browser rendered in quirks mode, changing box-model and
  inline-layout behaviour.
- **Encoding.** The file contains raw UTF-8 accented text (`Détruisez` [:573](../arkanoid.html#L573),
  `Prêt ?` [:579](../arkanoid.html#L579), `Bougez` [:580](../arkanoid.html#L580)). With no charset
  declared, a browser opening this over `file://` or a server that didn't send `charset` would fall
  back to windows-1252 and render `DÃ©truisez`.

### 2. ✅ FIXED — `localStorage` access was unguarded, one throw killed the entire game (S)
> **Fixed 2026-08-12.** Reads and writes now go through `loadBest()` / `saveBest()`
> ([:988–1002](../arkanoid.html#L988-L1002)), both wrapped in `try/catch`, with the best score
> degrading to in-memory only. Call sites: [:1037](../arkanoid.html#L1037),
> [:1893](../arkanoid.html#L1893).

`localStorage.getItem(BEST_KEY)` was read at IIFE top level while constructing `state`. In Safari
private browsing, with cookies/site-data disabled, or in some sandboxed `file://` contexts,
`localStorage` access **throws** — which aborted the whole IIFE and rendered a dead canvas with no
error visible to the player.

### 3. ✅ FIXED — Held keys stuck when the window lost focus (S)
> **Fixed 2026-08-12.** A `blur` handler now clears every held key —
> [:1213–1219](../arkanoid.html#L1213-L1219).

`keydown` sets `state.keys[e.code] = true` [:1191](../arkanoid.html#L1191) and only `keyup` cleared it
[:1212](../arkanoid.html#L1212). Alt-tabbing (or hitting a browser shortcut) while holding <kbd>→</kbd>
meant the `keyup` was never delivered — on return the paddle slid into the wall and stayed pinned
until the key was pressed and released again.

### 4. ✅ FIXED — Power-up timers kept running while the game was paused (S)
> **Fixed 2026-08-12.** Effects now carry a `remaining` duration in seconds instead of an absolute
> `until` deadline, and `updateEffects(dt)` decrements it from the frame delta — which the loop only
> feeds while the phase is `playing`. See [:1580–1591](../arkanoid.html#L1580-L1591), the effect
> durations each `remaining` starts from in `CONFIG.effects`
> ([:800–807](../arkanoid.html#L800-L807), added by #21, since extended by #30), and the call site at
> [:2218](../arkanoid.html#L2218).
> Verified: a `widen` survives a 30-second pause intact, then expires after its full 10 seconds of
> actual play.

`widthEffect` / `speedEffect` stored an absolute `until` timestamp from `performance.now()` and were
compared against the rAF `now`. Pausing for 20 seconds silently burned a 10-second "widen". Counting
in accumulated play time also makes the timers immune to tab-throttling and clock adjustments.

### 5. ✅ FIXED — Game did not auto-pause when the tab was hidden or the window blurred (S)
> **Fixed 2026-08-12.** `autoPause()` ([:1221–1229](../arkanoid.html#L1221-L1229)) pauses whenever the
> phase is `playing`, wired to both `visibilitychange` and the existing `blur` handler from #3
> ([:1216–1219](../arkanoid.html#L1216-L1219)). It deliberately only fires *on* hide/blur, never on
> return, so the player resumes explicitly.

There was no `visibilitychange` handler. `requestAnimationFrame` throttles in a background tab, and
`dt` is clamped to 33 ms [:2211](../arkanoid.html#L2211), so the game didn't *jump* — but it stayed in
the `playing` phase, so power-up timers kept expiring (see #4) and returning to the tab dropped you
straight back into live play with no warm-up.

### 6. ✅ FIXED — `e.preventDefault()` on Space blocked button activation (S)
> **Fixed 2026-08-12.** The Space branch is now guarded by `isButtonFocused()` (renamed to
> `isTypingTarget()` and widened to cover text inputs too by #42, [:1184–1188](../arkanoid.html#L1184-L1188),
> used at [:1202](../arkanoid.html#L1202)): when a `<button>` holds focus the key is handed back to the
> browser, so it activates the button instead of launching the ball.
>
> This needed a companion fix. The deck's pause/mute buttons stay on screen and keep focus after a
> mouse click, so the guard alone would have made Space toggle pause instead of launching. A
> `blurIfPointerClick` helper ([:1497–1502](../arkanoid.html#L1497-L1502)) drops focus after pointer
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
> alongside the existing pointer-release logic — [:1194–1201](../arkanoid.html#L1194-L1201). Applied to
> all four movement codes (`ArrowLeft`/`ArrowRight`/`KeyA`/`KeyD`) rather than singling out the arrow
> keys, since suppressing the letter keys too is harmless and keeps them behaving identically.

`ArrowLeft`/`ArrowRight` are read but never `preventDefault`ed. On a narrow viewport where the cabinet
overflows, steering the paddle also scrolls the document under it.

### 8. ✅ FIXED — `mousedown` launches the ball on any button, including right-click (S)
> **Fixed 2026-08-13.** The handler now takes the event and returns early unless
> `e.button === 0` — [:1236–1239](../arkanoid.html#L1236-L1239).

`canvas.addEventListener("mousedown", handleLaunchOrResume)` had no `e.button` check. Right-clicking
or middle-clicking to open a context menu launched the ball.

### 9. ✅ FIXED — Ball–paddle collision teleported the ball on side hits (M)
> **Fixed 2026-08-13.** The ball's `y` from before the frame's own movement is captured as `prevY`
> [:1782](../arkanoid.html#L1782). A paddle collision is only resolved as a top-face bounce — steering
> by offset and snapping onto the top — when `prevY` was already above the paddle top
> [:1825–1833](../arkanoid.html#L1825-L1833); otherwise it resolves as a side hit that reflects only
> the horizontal component and repositions the ball beside the paddle, the same treatment a brick's
> side face gets [:1834–1842](../arkanoid.html#L1834-L1842). Paddle-velocity spin was left for a
> separate pass — out of scope for the teleport itself.

Any `circleRectCollide` with `dy > 0` snapped `ball.y = pr.y - ball.r - 0.5`, i.e. onto the top of the
paddle. A ball clipping the paddle's *side* while descending past it got warped upward and re-served,
which read as a phantom save.

### 10. ✅ FIXED — Only one brick collision was resolved per ball per frame, chosen by array order (M)
> **Fixed 2026-08-13.** The bricks loop no longer resolves against the first overlap it finds. It now
> scans every alive brick the ball overlaps, scores each with `brickPenetration()`
> [:1750–1759](../arkanoid.html#L1750-L1759) — the smaller of the two axis overlaps, i.e. how shallow
> the intrusion is — and resolves against whichever brick has the smallest penetration
> [:1845–1863](../arkanoid.html#L1845-L1863). Array order no longer has any say in which face gets hit.

The loop broke after the first overlapping brick. Bricks are stored top-row-first, so when a ball
overlapped two adjacent bricks in a corner, it always bounced off the *upper* one regardless of which
face it actually struck. Visible as occasional wrong-direction ricochets in the dense levels 4–5.

### 11. ✅ FIXED — Drop hitbox (8 px) didn't match the drawn capsule (10 px) (S)
> **Fixed 2026-08-13.** `updateDrops`'s hit test now uses the same 10px radius `drawDrops` renders the
> capsule with — [:1656–1657](../arkanoid.html#L1656-L1657) vs. the `arc(0, 0, 10, …)` at
> [:2141](../arkanoid.html#L2141).

`updateDrops` tested `± 8` while `drawDrops` rendered `arc(0,0,10,…)`. Power-ups visually clipped the
paddle without being collected.

### 12. ✅ FIXED — Multi-ball could spawn balls aimed straight down (S)
> **Fixed 2026-08-13.** The clone angle is derived from the source ball's angle mirrored upward when
> it's descending, then spread symmetrically to either side — [:1632–1636](../arkanoid.html#L1632-L1636).
> A source ball travelling straight down used to produce two clones that were also both descending and
> usually lost within a second; now every clone starts with a negative `dy`.

The clone angle was `atan2(base.dy, base.dx) ± 0.6`. If the source ball was descending, both clones
were also descending, making "M" feel like a dud.

### 13. ✅ FIXED — Best score was only persisted at game over (S)
> **Fixed 2026-08-13.** The `state.score > state.best` check and `saveBest()` call are now behind a
> shared `maybeSaveBest()` helper [:1887–1895](../arkanoid.html#L1887-L1895), called from
> `checkLevelClear()` [:1899](../arkanoid.html#L1899) as well as `endGame()`
> [:1909](../arkanoid.html#L1909). Progress is now checkpointed at every level clear, not just at the
> end of the run.

`endGame` was the only caller of `saveBest()`. Closing the tab mid-run — including after clearing four
levels — lost the score entirely.

---

## B. Performance

### 14. ✅ FIXED — `getComputedStyle(document.body)` called per drop, per frame (S)
> **Fixed 2026-08-13.** The font string is now built once into a module-level `DROP_FONT` constant
> [:776](../arkanoid.html#L776); `drawDrops` just assigns it — [:2144](../arkanoid.html#L2144). The
> body's font never changes at runtime, so there was nothing to gain from recomputing it 60 times a
> second.

`getComputedStyle(document.body)` was called inside the `drawDrops` loop, once per falling power-up,
per frame. This forced a synchronous style recalculation every frame for every falling power-up — the
single most expensive line in the render path.

### 15. ✅ FIXED — `updateHud()` writes four DOM nodes every frame (S)
> **Fixed 2026-08-13.** A `hudLast` cache [:1998](../arkanoid.html#L1998) records what's currently
> displayed for each of the four HUD fields; `updateHud()` [:1999–2010](../arkanoid.html#L1999-L2010)
> only touches `textContent` for a field whose value actually changed since the last call. The
> unconditional per-frame call [:2225](../arkanoid.html#L2225) stays — it's still what catches
> `state.best` needing a live update against `state.score` — but an idle frame now writes nothing.

`updateHud()` was called unconditionally every frame, in addition to the event-driven calls in
`brickHit`, `applyPowerup`, and `loseLife` — 240 needless `textContent` assignments per second even
while nothing displayed was changing.

### 16. ✅ FIXED — `checkLevelClear()` scans the full brick array every frame (S)
> **Fixed 2026-08-13.** `state.remainingBricks` [:1054](../arkanoid.html#L1054) counts destructible
> bricks still alive; `buildLevel()` seeds it when a level starts
> [:1085](../arkanoid.html#L1085)/[:1102](../arkanoid.html#L1102), and `brickHit()` decrements it at the
> single point a brick actually dies [:1718](../arkanoid.html#L1718). `checkLevelClear()`
> [:1897–1906](../arkanoid.html#L1897-L1906) is now an `O(1)` counter check instead of an `O(n)` scan.

`checkLevelClear()` ran `.some()` over up to 80 bricks every single frame. Cheap in absolute terms, but
trivially replaceable with a counter decremented in `brickHit`.

### 17. ✅ FIXED — Canvas backing store is sized from DPR only, ignoring displayed size (S)
> **Fixed 2026-08-13.** `fitCanvas()` [:677–691](../arkanoid.html#L677-L691) now reads the canvas's
> actual displayed width via `getBoundingClientRect()` and scales the backing store by
> `dpr * min(1, displayWidth / GAME_W)` — never upsizing past `dpr` (unchanged from before whenever the
> canvas is shown at or above its logical size), but shrinking the allocation when the canvas — styled
> `width: 100%; height: auto` — renders narrower than that, as on a phone.

`fitCanvas` always allocated `480 × 680 × dpr`. On a phone where the canvas displays at ~300 px wide
with `dpr = 3`, that was a 1440×2040 buffer for a 300 px element.

---

## C. Code quality / structure

### 18. ✅ FIXED — Phase transitions bypassed `setPhase()` in three places (S)
> **Fixed 2026-08-13.** `setPhase()` [:1400](../arkanoid.html#L1400) now owns every phase→overlay
> mapping via a `PHASE_OVERLAY` lookup [:1342–1356](../arkanoid.html#L1342-L1356), extended to cover
> `levelclear`/`victory`/`gameover` as well as the phases it already handled. `togglePause`
> [:1320](../arkanoid.html#L1320), `checkLevelClear` [:1903](../arkanoid.html#L1903), and `endGame`
> [:1911](../arkanoid.html#L1911) now all just call `setPhase(...)` instead of duplicating the
> `state.phase` assignment and `showOverlay` call. (#34 below was a follow-up gap — the boot-time
> start screen still bypassed this — since fixed.)

`setPhase` [:1400](../arkanoid.html#L1400) was the intended single entry point, but `togglePause`,
`checkLevelClear`, and `endGame` each assigned `state.phase` *and* called `showOverlay` directly.
That's the kind of duplication that causes an overlay/phase desync the first time someone adds a
state.

### 19. ✅ FIXED — Dead/redundant code (S)
> **Fixed 2026-08-13.**
> - `state.paddle.w` is gone entirely — both the initial field and the `updatePaddle` assignment that
>   nothing ever read; `paddleWidth()` remains the one source of truth.
> - The redundant `updateHud(); drawBackground(); drawBricks(); drawPaddle();` block right before the
>   first `requestAnimationFrame(frame)` call is removed; that first frame already paints the same
>   thing ~16 ms later via `draw()` [:2196–2205](../arkanoid.html#L2196-L2205), and the HUD's own
>   one-time init call [:2011](../arkanoid.html#L2011) already covers the pre-play text.
> - `updateBalls` [:1774](../arkanoid.html#L1774) now declares only the `dt` parameter it uses; the
>   call site [:2219](../arkanoid.html#L2219) no longer passes the unused `now`.

- `state.paddle.w` was assigned in `updatePaddle` but never read — every draw/collision path called
  `paddleWidth()` instead.
- The `updateHud(); drawBackground(); drawBricks(); drawPaddle();` block was redundant; the rAF loop
  paints the same frame ~16 ms later.
- `updateBalls(dt, now)` never used `now`.

### 20. ✅ FIXED — No `AudioContext` resume, and the mute state wasn't persisted (S)
> **Fixed 2026-08-13.** `beep()` [:1539](../arkanoid.html#L1539) now calls `actx.resume()`
> [:1548](../arkanoid.html#L1548) whenever the context is `"suspended"` — cheap and a no-op once
> already running, but it rescues audio for the rest of the session if the very first beep didn't
> happen to fire from inside a user-gesture handler. Separately, `state.muted` now round-trips through
> `loadMuted()`/`saveMuted()` [:1010–1011](../arkanoid.html#L1010-L1011), the same `storageGet`/
> `storageSet` pair [:988–1002](../arkanoid.html#L988-L1002) already used for the best score and the
> language preference, written on every toggle [:1522](../arkanoid.html#L1522) and read back into
> `state.muted` at boot [:1058](../arkanoid.html#L1058).

`beep` lazily constructed the context but never called `actx.resume()`. If the context was ever
created outside a user gesture it started `suspended` and the game was silently mute for the rest of
the session. Separately, `state.muted` wasn't saved, so the setting reset on every reload.

### 21. ✅ FIXED — Scattered magic numbers collected into a `CONFIG` block (M)
> **Fixed 2026-08-13.** A single `CONFIG` object [:795–848](../arkanoid.html#L795-L848) now holds drop
> fall speed, particle gravity, the ball cap, the paddle bounce spread, each power-up's mult/duration
> pair, and — since added by #28/#29/#30 — the difficulty ramp, combo/floating-text, and laser tuning
> too. Every call site reads from it instead of a local literal: drop fall speed
> [:1652](../arkanoid.html#L1652), particle gravity [:1696](../arkanoid.html#L1696), the ball cap in
> both of `applyPowerup`'s multi-ball checks [:1627](../arkanoid.html#L1627)/
> [:1634](../arkanoid.html#L1634), the paddle bounce spread [:1829](../arkanoid.html#L1829), and the
> four original effect branches [:1603–1614](../arkanoid.html#L1603-L1614).

Magic numbers were scattered through the file: drop fall speed `130`, particle gravity `260`, effect
durations `10`/`8` seconds, multipliers `1.6`/`0.6`/`0.7`/`1.4`, ball-cap `5`, paddle bounce spread
`1.05`. Collecting these into one `CONFIG` object makes the game tunable without hunting through the
logic.

---

## D. Accessibility

### 22. ✅ FIXED — Overlay state changes are now announced (S)
> **Fixed 2026-08-13.** All six `.overlay` divs [:570–604](../arkanoid.html#L570-L604) now carry
> `role="status" aria-live="polite"`, with a static `aria-hidden` default matching whether they're the
> one shown at boot. `showOverlay()` [:1367–1399](../arkanoid.html#L1367-L1399) keeps `aria-hidden` in
> sync with the `.show` class on every transition — the overlay actually on screen is the only one
> ever inside the accessibility tree, which is what lets a screen reader announce it as it appears
> rather than the swap happening silently.

Level-clear, game-over, and victory overlays swapped in silently. A screen-reader user got no
notification.

### 23. ✅ FIXED — Toggle buttons now reflect their state (S)
> **Fixed 2026-08-13** (half fixed 2026-08-12 by the bilingual work — see below). Both deck buttons
> default to `aria-pressed="false"` in markup [:660–661](../arkanoid.html#L660-L661) and are kept in
> sync by their render functions. `renderMuteButton()` [:1434–1439](../arkanoid.html#L1434-L1439) now
> also sets `aria-pressed`; a new `renderPauseButton()`
> [:1445–1451](../arkanoid.html#L1445-L1451) mirrors it for pause, and — since the pause button used to
> show the same "II" icon regardless of whether the game was actually paused — swaps the icon
> (`⏸`/`▶`) and `aria-label` between "pause" and "resume" too, not just `aria-pressed`. It's called
> from both `setPhase()` [:1403](../arkanoid.html#L1403) and `applyLanguage()`
> [:1488](../arkanoid.html#L1488), so it stays correct across phase changes and language switches
> alike. A `.icon-btn[aria-pressed="true"]` rule [:499–503](../arkanoid.html#L499-L503) gives both
> buttons the same visual "pressed" cue the language toggle already had.

> **Half fixed 2026-08-12** by the bilingual work. `renderMuteButton()`
> ([:1434–1439](../arkanoid.html#L1434-L1439)) sets the mute button's `aria-label` from both the
> language and the on/off state, so it no longer claims "Couper le son" while already muted.

Neither toggle exposed `aria-pressed`, and the pause button never changed its label or state when the
game was paused.

### 24. ✅ FIXED — Canvas now points assistive tech at the HUD (S)
> **Fixed 2026-08-13.** The HUD [:541–558](../arkanoid.html#L541-L558) was already reachable — plain,
> unhidden DOM text ahead of the canvas in reading order — so no canvas fallback content was needed;
> what was missing was the connection between the two. The canvas now carries
> `aria-describedby="hud"` [:566](../arkanoid.html#L566), pointing at the HUD container's new
> `id="hud"` [:541](../arkanoid.html#L541), so a screen-reader user who lands directly on the canvas
> (rather than reading the page linearly) is told where the live score/lives text actually lives.

`<canvas>` had an `aria-label` but empty inner content and no live text alternative for score/lives.

### 25. ✅ FIXED — `prefers-reduced-motion` is now read in JS too (S)
> **Fixed 2026-08-13.** `burst()` [:1156](../arkanoid.html#L1156) now scales its particle count down to
> roughly a third (never below 1) whenever `reduceMotion` is true, read from
> `matchMedia("(prefers-reduced-motion: reduce)")` [:1149–1153](../arkanoid.html#L1149-L1153) — live,
> via a `change` listener, rather than once at load, so toggling the OS setting mid-session takes
> effect on the very next burst rather than requiring a reload.

[:113–115](../arkanoid.html#L113-L115) disabled the title flicker, but the canvas particle bursts were
unaffected — the CSS media query can't reach into canvas drawing.

---

## E. Gameplay / UX enhancements

### 26. ✅ FIXED — Keyboard path out of the game-over / victory screens (S)
> **Fixed 2026-08-13.** `showOverlay()` [:1367–1399](../arkanoid.html#L1367-L1399) now focuses the
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

`handleLaunchOrResume` [:1273](../arkanoid.html#L1273) only handled `ready` and `paused`. From
`gameover`, `victory`, `levelclear`, or the initial `start` screen, Space did nothing — the player had
to reach for the mouse.

### 27. ✅ FIXED — Touch: the first tap both aimed and launched (S)
> **Fixed 2026-08-13.** Launching moved from `touchstart` to a new `touchend` handler
> [:1256–1271](../arkanoid.html#L1256-L1271); `touchstart`/`touchmove`
> [:1244–1255](../arkanoid.html#L1244-L1255) now only update `pointerX`, aiming the paddle. That gives
> the player a chance to drag into position before committing to serve, instead of the ball launching
> from wherever the finger first landed. The "vertical offset" half of the original fix — tracking the
> paddle's own Y position above the finger — was deliberately dropped: the paddle only ever steers
> horizontally, so moving it vertically during touch play would be a materially bigger change (new
> collision geometry, different feel from mouse/keyboard play) than this finding's effort estimate
> implied, and isn't needed to fix the actual bug (the ball launching prematurely). (#35 below is a
> follow-up gap in the `touchend` handler itself.)

`touchstart` [:1244](../arkanoid.html#L1244) (previously) set `pointerX` and immediately called
`handleLaunchOrResume`. On mobile you could not position the paddle before serving — the ball launched
from wherever your finger first landed.

### 28. ✅ FIXED — Difficulty ramp within a level (M)
> **Fixed 2026-08-13.** `state.difficultyMult` [:1056](../arkanoid.html#L1056) multiplies directly into
> ball velocity [:1783](../arkanoid.html#L1783), alongside the existing power-up speed multiplier. It
> ramps via `bumpDifficulty()` [:1075–1077](../arkanoid.html#L1075-L1077) — cumulative, multiplicative,
> capped at `CONFIG.difficulty.max` — from two classic-Breakout triggers: every top-wall bounce
> [:1789–1795](../arkanoid.html#L1789-L1795), and every `CONFIG.difficulty.brickMilestone` bricks
> destroyed in the current level [:1719–1722](../arkanoid.html#L1719-L1722). `CONFIG.difficulty`
> [:821–826](../arkanoid.html#L821-L826) holds the tuning; `buildLevel()`
> [:1103–1104](../arkanoid.html#L1103-L1104) resets both the multiplier and the milestone counter at the
> start of every level, so the ramp never carries over from one level — or one difficulty — to the
> next.

Ball speed was fixed per level ([:1114](../arkanoid.html#L1114), `LEVELS[i].speed`). Classic breakout
speeds the ball up after N bricks or on reaching the top wall, which prevents long stalemates on the
last brick.

### 29. ✅ FIXED — Score feedback on the canvas (M)
> **Fixed 2026-08-13.** Destroying a brick now spawns a floating `"+N"` pop-up at its position
> ([:1171–1176](../arkanoid.html#L1171-L1176), rising and fading over `CONFIG.floatingText.life`
> seconds via `updateFloatingTexts()`/`drawFloatingTexts()`
> [:1700–1707](../arkanoid.html#L1700-L1707)/[:2179–2194](../arkanoid.html#L2179-L2194)), wired into
> the frame loop alongside particles [:2223](../arkanoid.html#L2223)/[:2228](../arkanoid.html#L2228)
> and `draw()` [:2204](../arkanoid.html#L2204). Consecutive bricks destroyed without the ball touching
> the paddle also build a combo [:1726–1731](../arkanoid.html#L1726-L1731) that scales the points
> awarded, capped at `CONFIG.combo.max`; any paddle contact — top face or side clip — resets it
> [:1813](../arkanoid.html#L1813). `CONFIG.combo`/`CONFIG.floatingText`
> [:827–847](../arkanoid.html#L827-L847) hold the tuning. This changes the scoring curve going forward
> — an unbroken combo now scores noticeably more than the same bricks hit in isolation — so existing
> saved best scores are no longer directly comparable to newly-earned ones.

Points were only visible in the HUD, with no combo mechanic for consecutive brick hits without a
paddle touch.

### 30. ✅ FIXED — Sticky paddle and laser power-ups (M)
> **Fixed 2026-08-13.** Both suggested additions are in, slotting into the existing timed-effect
> architecture: `POWERUPS` [:766–767](../arkanoid.html#L766-L767), `CONFIG.effects.sticky`/
> `CONFIG.effects.laser` [:805–806](../arkanoid.html#L805-L806), and two new branches in
> `applyPowerup` [:1618–1623](../arkanoid.html#L1618-L1623).
>
> **Sticky** re-attaches a ball on a genuine top-face paddle hit while `stickyEffect` is active
> [:1815–1824](../arkanoid.html#L1815-L1824), capped to one attached ball at a time so multi-ball
> can't stack several on the paddle at once. `updatePaddle()`'s attached-ball tracking, previously
> hardcoded to `balls[0]`, now loops over every ball [:1573–1577](../arkanoid.html#L1573-L1577) since
> sticky can catch any of them, not just the one served at the start of a life.
>
> **Laser** gives the action button a second job during `"playing"`: alongside releasing a stuck ball,
> `handleLaunchOrResume()` [:1273–1283](../arkanoid.html#L1273-L1283) now calls `fireLaser()`
> [:1306–1318](../arkanoid.html#L1306-L1318), which fires classic twin bolts from the paddle on a
> cooldown (`CONFIG.laser` [:811–816](../arkanoid.html#L811-L816)). `updateLasers()`
> [:1667–1688](../arkanoid.html#L1667-L1688) moves them and reuses `brickHit()` on impact — the same
> scoring/combo/difficulty path a ball hit goes through — and `drawLasers()`
> [:2152–2165](../arkanoid.html#L2152-L2165) renders them. Releasing a sticky ball and firing both
> route through the same action-button entry point used everywhere else (mouse, touch, Space), via a
> new `launchAttachedBalls()` helper [:1285–1298](../arkanoid.html#L1285-L1298) `launchBall()`
> (the "ready" → "playing" serve) now also calls.

The current six were solid, but nothing rewarded skillful play with new tools. **Sticky paddle** (ball
re-attaches, aim the next shot) and **laser** (fire upward on Space) were the suggested natural
additions.

### 31. ✅ FIXED — Active power-up timers are now visible (S)
> **Fixed 2026-08-13.** A depleting bar per effect, under the HUD
> ([:634–654](../arkanoid.html#L634-L654) markup, [:204–249](../arkanoid.html#L204-L249) CSS). Slots
> are toggled with the `hidden` attribute and resized via the fill's inline width rather than
> created/destroyed — see `updateEffectBar()`/`renderEffectBars()`
> [:2032–2060](../arkanoid.html#L2032-L2060), called after every `applyPowerup()`
> [:1646](../arkanoid.html#L1646) and once per frame [:2230](../arkanoid.html#L2230). `state.widthEffect`/
> `state.speedEffect` don't record which specific powerup produced them, only the resulting `mult`, so
> the bar recovers it from the sign of `mult` — the same trick `drawPaddle()`
> [:2100](../arkanoid.html#L2100) already used for its colour swap.

The paddle changed colour for width effects, but there was no indication of *how long* an effect
lasted, and speed effects had no visual at all.

### 32. ✅ FIXED — Add more levels (M)
> **Fixed 2026-08-13.** Five hand-authored levels added to `LEVELS`
> [:724–738](../arkanoid.html#L724-L738), taking the game from 5 levels to 10. Went with hand-authored
> over the procedural-generator option: it keeps the existing finite-levels-then-`victory` structure
> intact (`checkLevelClear()`'s `LEVELS.length - 1` win check [:1900](../arkanoid.html#L1900), the HUD's
> `n/LEVELS.length` readout [:2004](../arkanoid.html#L2004), and `level.of`'s `{n}/{total}` string all
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
> [:571](../arkanoid.html#L571) and [:578](../arkanoid.html#L578).

Endless mode past level 5 (a procedural generator) was the other option on the table; not pursued here
— see the fix note above for why hand-authoring won out for this pass. Tracked as its own follow-up in
[todo.md](todo.md) (#41) if endless play is wanted later, no longer under #32.

### 37. ✅ FIXED — The power-up timer bars (#31) reflow the whole cabinet when they appear (M)
> **Fixed 2026-08-13.** `.effect-bars` and `.screen-wrap` are now independent flex siblings inside
> a new `.play-row` [:257–261](../arkanoid.html#L257-L261) — the effect-bars markup moved from
> before `.screen-wrap` to after it, as a sibling rather than a fellow child of `.cabinet`'s own
> flex column [:57–65](../arkanoid.html#L57-L65) *(markup: [:563](../arkanoid.html#L563)
> wraps both; the bars themselves are now at [:637–654](../arkanoid.html#L637-L654))*.
> `.effect-bars` [:214–219](../arkanoid.html#L214-L219) takes a fixed `flex: 0 0 84px` column
> instead of wrapping horizontally, so a slot's `hidden` toggle (still the same mechanism from
> #31 — see `updateEffectBar()` [:2032–2041](../arkanoid.html#L2032-L2041)) resizes only that
> column's own height, never `.screen-wrap`'s; the canvas inside it doesn't move. Below a
> 560px-viewport breakpoint [:516–526](../arkanoid.html#L516-L526) there isn't width to spare for
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
> `OVERLAY_BUTTON_IDS` lookup [:1357–1366](../arkanoid.html#L1357-L1366) is built from
> `PHASE_OVERLAY`'s button entries (from `OVERLAY_PRIMARY_BTN`'s values at the time; #36 below folded
> that map into `PHASE_OVERLAY`), and `showOverlay()` [:1385–1388](../arkanoid.html#L1385-L1388)
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
> [:1343](../arkanoid.html#L1343) — `OVERLAY_PRIMARY_BTN` already had the matching
> `"overlay-start": "btn-start"` since #26 [:1343](../arkanoid.html#L1343) — so boot
> [:2243](../arkanoid.html#L2243) now calls `setPhase("start")` instead of `showOverlay(...)`
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
> **Fixed 2026-08-13.** `touchend`'s handler [:1256–1272](../arkanoid.html#L1256-L1272) now only
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
> **Fixed 2026-08-13.** `PHASE_OVERLAY` [:1342–1356](../arkanoid.html#L1342-L1356) is now the only
> map: each phase's entry carries both its overlay id and its button id together (e.g.
> `paused: { overlay: "overlay-pause", button: "btn-resume" }`), or is `null`/has no `button` key
> for `"playing"`/`"ready"`. `OVERLAY_PRIMARY_BTN` is gone; `OVERLAY_BUTTON_IDS`
> [:1357–1366](../arkanoid.html#L1357-L1366) (see #33) and `setPhase()`
> [:1400–1408](../arkanoid.html#L1400-L1408) both derive what they need from `PHASE_OVERLAY` alone,
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
> existing overlap test — [:1799–1811](../arkanoid.html#L1799-L1811). When the ball's start-of-frame
> position was above the paddle top but its end-of-frame position has already cleared the paddle
> bottom (the exact tunneling case: no overlap left for `circleRectCollide` to catch), it's rewound
> to the point where it crossed the paddle's top plane, so the existing `isTopHit` branch just below
> sees a normal top hit and steers it exactly as it always has. Bricks are deliberately exempt — a
> missed brick costs nothing, the ball just continues past it — so this only guards the one collision
> that actually costs the player something. The stale comment in `LEVELS`
> ([:727–733](../arkanoid.html#L727-L733)) claiming level 10's speed was "kept under the ceiling" is
> corrected too: that ceiling never held once the difficulty ramp was accounted for, and the sweep
> makes level speed a non-issue for this class of bug going forward. The paper-math test in
> `test/suites/physics.js` ("the ball cannot tunnel through the paddle...") is now a behavioural test
> that drives this exact worst case — level 10, `fast`, `difficultyMult` pinned to its cap, one 33ms
> frame — and asserts the ball still bounces; a matching `#38` regression test covers the same ground
> in `test/suites/regressions.js`.

The "cannot tunnel through the paddle at maximum speed" test
([test/suites/physics.js:202–218](../test/suites/physics.js#L202-L218)) only budgets for
`baseBallSpeed * LEVELS[i].speed * fast-powerup's 1.4x`, capped by the 33ms clamped max `dt`
([:2211](../arkanoid.html#L2211)). It never factors in `state.difficultyMult`
([:1056](../arkanoid.html#L1056)), the mid-level ramp (up to `CONFIG.difficulty.max` = `1.6`,
[:825](../arkanoid.html#L825)) that's multiplied into the same per-frame displacement at
[:1783](../arkanoid.html#L1783):

```js
var v = ball.speed * mult * state.difficultyMult * dt;
```

The #32 fix note above (this file) and release-notes both call out that the level-10 speed was
tuned to stay under the tunneling test's ceiling — but that ceiling itself is wrong, and
the release-notes entry ([release-notes.md:165–168](../release-notes.md#L165-L168)) already flags the
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
[:1798](../arkanoid.html#L1798):

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
comment at [:727–735](../arkanoid.html#L727-L735) claiming level 10 is "kept under the ceiling" should
be corrected either way, since it's not accurate today.

### 39. ✅ FIXED — Stale "1/5" HUD markup fallback (S)
> **Fixed 2026-08-14.** The markup now reads `<div class="hud-value" id="hud-level">1/10</div>`
> ([:552](../arkanoid.html#L552)), matching the two overlay-eyebrow fallbacks #32 already updated. A
> `#39` regression test in `test/suites/regressions.js` checks the raw source text directly (not the
> post-boot DOM, since `updateHud()` overwrites this on the very first frame regardless of what the
> static markup said) so a future level-count change can't let this one quietly go stale again.

The static HUD counter at [:552](../arkanoid.html#L552) —
`<div class="hud-value" id="hud-level">1/5</div>` — was not updated when #32 took the game to 10
levels, even though the #32 fix explicitly updated the two parallel overlay-eyebrow fallbacks at
[:571](../arkanoid.html#L571) and [:578](../arkanoid.html#L578) for the identical reason (both read
"Niveau 1 / 10" now). `updateHud()` ([:2004](../arkanoid.html#L2004)) overwrites it with the real
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
([:738](../arkanoid.html#L738)) — which is exactly the kind of brick-adjacency layout the
smallest-penetration collision resolver (#10) was written to handle, and the new density is untested
territory for it.

The release-notes entry for #32 ([release-notes.md:174–177](../release-notes.md#L174-L177)) states "the
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
> (a text input + submit button, markup at [:615–623](../arkanoid.html#L615-L623)) and `halloffame`
> (the top-10 board + a continue button, [:625–630](../arkanoid.html#L625-L630)), each with its own
> `PHASE_OVERLAY` entry ([:1352–1353](../arkanoid.html#L1352-L1353)) rather than bolting an input onto
> `overlay-victory`/`overlay-gameover` directly. `endGame()` ([:1908–1917](../arkanoid.html#L1908-L1917))
> detours through `nameentry` — remembering which final screen to return to afterward in
> `state.pendingWon` — whenever `qualifiesForHallOfFame(state.score)`
> ([:1937–1939](../arkanoid.html#L1937-L1939)) is true: strictly greater than 0, and either the board
> has room or the score beats its current lowest entry via `hallOfFameRank()`
> ([:1930–1936](../arkanoid.html#L1930-L1936)) — a tie with the lowest entry does not bump it. The
> board is a capped, sorted `{name, score}` list under a new `neonbreak-hall-of-fame` key
> ([:986](../arkanoid.html#L986)), round-tripped through `loadHallOfFame()`/`saveHallOfFame()`
> ([:1018–1031](../arkanoid.html#L1018-L1031)) via the same guarded `storageGet`/`storageSet` pair #2
> already uses — a throw, or corrupted/foreign JSON under that key, degrades to an empty board rather
> than taking the game down.
>
> A submitted name is trimmed, capped to `CONFIG.hallOfFame.nameMax` (12 characters,
> [:844–847](../arkanoid.html#L844-L847)), and falls back to a translated `"???"` placeholder when
> empty (`submitHallOfFameName()`, [:1954–1962](../arkanoid.html#L1954-L1962)). `renderHallOfFame()`
> ([:1969–1983](../arkanoid.html#L1969-L1983)) rebuilds the board through `innerHTML` rather than
> `textContent` as sketched below — the test harness's DOM stub has no `createElement`/`appendChild`
> to build real nodes with — but every interpolated value (the name; the score too, for uniformity)
> goes through a small `escapeHtml()` helper first ([:710–712](../arkanoid.html#L710-L712)), so a name
> like `<img src=x onerror=...>` still can't be interpreted as markup. `isButtonFocused()` is renamed
> to `isTypingTarget()` and widened to also cover a focused `<input>`
> ([:1185–1188](../arkanoid.html#L1185-L1188)), so Space still reaches the name field instead of being
> hijacked for launch/laser; Enter submits directly from the field
> ([:1207–1209](../arkanoid.html#L1207-L1209)) since nothing else in this file uses a `<form>`.
>
> Covered by ten `#42a`–`#42j` cases in `regressions.js` — qualification gating including the score-0
> and tie edge cases, sorted insertion, the empty-name fallback, HTML-escaping, the win/loss branch
> back out, Space/Enter handling, and the max-size cap — plus two round-trip cases in `persistence.js`,
> including the `storageThrows` guard. Four existing tests that happened to end a run with a
> qualifying score (`state.js`, `rules.js`, `i18n.js`, `persistence.js`) now seed a full board via the
> `storage` boot option so they keep exercising what they were actually about, not the hall of fame.

Feature request: when a run ends (`endGame()`, [:1908](../arkanoid.html#L1908)) with a score that
qualifies, prompt the player for their name, then show a top-10 leaderboard of name+score pairs.

Today only a single number persists across sessions — `state.best`, round-tripped through
`loadBest()`/`saveBest()` ([:1001–1002](../arkanoid.html#L1001-L1002)) under `BEST_KEY`
([:983](../arkanoid.html#L983)), both guarded by `storageGet`/`storageSet`
([:992–1000](../arkanoid.html#L992-L1000)) per #2. This replaces "a number" with "a list":
a new `localStorage` key (e.g. `neonbreak-hall-of-fame`) holding a JSON array of `{ name, score }`,
capped at 10, sorted descending, read/written through the same guarded helpers so a throwing
`localStorage` degrades the same way #2 already handles for the best score.

**Where it hooks in:** both `endGame(true)` and `endGame(false)` ([:1908](../arkanoid.html#L1908)) —
a run can end either by winning or by running out of lives, and both should qualify. The natural gate
is "does this score beat the lowest of the current top 10 (or is the list not yet full)?" — most runs
won't qualify, and skipping the prompt entirely for those keeps the existing victory/gameover flow
(`PHASE_OVERLAY` [:1342–1356](../arkanoid.html#L1342-L1356), `overlay-victory`/`overlay-gameover`
markup [:596–610](../arkanoid.html#L596-L610)) untouched for the common case.

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
  empty-list message) needs a key in both `STRINGS.fr` and `STRINGS.en` ([:859](../arkanoid.html#L859))
  — the `i18n` suite already fails the build if one language's table is missing a key the other has,
  so this is enforced automatically once the keys exist.
- *Keyboard/focus.* The name-entry overlay's input should get focus the way every other overlay's
  primary button does today (`showOverlay()` [:1367](../arkanoid.html#L1367), #26), and
  submitting needs both an Enter-in-the-input path and a click path — mirroring how
  `handleLaunchOrResume()` already serves keyboard, mouse, and touch from one entry point.

**Test coverage this would need:** a `persistence` suite case for the hall-of-fame round-trip
(including the `storageThrows` guard, per #2's test), a `state`/`rules` case for the qualifying-score
gate, and — since this is the first free-text player input — an explicit case asserting a name
containing HTML-special characters renders as literal text, not markup.

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
