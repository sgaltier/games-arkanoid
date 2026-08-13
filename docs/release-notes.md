# Release notes

Changes to **Neon Break**, newest first. `#N` references point at the numbered findings in
[code-review.md](code-review.md).

The project is not versioned or tagged, so entries are grouped by the commit that delivered them.

## Review progress

| Findings | Status |
|---|---|
| #1, #2, #3 | ✅ Fixed — 2026-08-12 (`18130c8`) |
| #4, #5, #6 | ✅ Fixed — 2026-08-12 (`3ab988f`) |
| #7, #8, #9, #10 | ✅ Fixed — 2026-08-13 |
| #11 – #32 | Open — 22 remaining |

Findings #20 and #23 were partially advanced by the bilingual work below, but both remain open.

---

## 2026-08-13 — Input handling and collision fixes

### Fixed

**Arrow keys no longer scroll the page** (#7)
`ArrowLeft`/`ArrowRight`/`KeyA`/`KeyD` are now `preventDefault`ed in the `keydown` handler alongside
the existing pointer-release logic. On a narrow viewport where the cabinet overflows, steering the
paddle used to scroll the document under it.

**Right- and middle-click no longer launch the ball** (#8)
`mousedown` on the canvas now checks `e.button === 0` before treating the click as a launch/resume.
Previously any mouse button did it, so opening a context menu with a right-click also served the ball.

**A ball clipping the paddle's side is no longer teleported onto the top** (#9)
The paddle collision now remembers the ball's `y` from before the frame moved it. Only a ball that was
above the paddle top resolves as a top-face bounce; a ball that was already level with the paddle
resolves as a side hit instead — horizontal reflection only, same treatment a brick's side face gets.
Previously any downward-moving ball touching the paddle at all was snapped onto the top, which read as
a phantom save when the ball had actually clipped the side.

**Corner brick collisions now resolve against the brick actually struck, not array order** (#10)
When a ball overlaps two adjacent bricks at once — a corner between them — the collision now scores
each overlapping brick by penetration depth and resolves against the shallowest one. It previously
just took the first overlap in array order, which is always the top-row brick since that's how bricks
are stored, producing occasional wrong-direction ricochets in the dense levels 4–5.

### Notes

Each fix landed with a regression test added first against the unfixed code and confirmed failing,
per the convention in [testing.md](testing.md). #7 and #8 already had `pending` tests written ahead of
time in `test/suites/input.js`; those are now unpended. #9 and #10 are new entries in
`test/suites/regressions.js`. Full suite: 134 passed, 0 failed, 2 pending (#14, #15, unrelated
performance findings).

---

## 2026-08-12 — English and French

The game is now bilingual. It picks a language on first load and offers a toggle to override that
choice, which is remembered for next time.

### Added

**A language toggle in the marquee**
A small segmented `FR`/`EN` pill sits to the right of the title, styled as quiet cabinet trim rather
than as another neon element. The active language is marked with `aria-pressed`, so the control is
usable and legible to assistive tech as a pair of toggle buttons. It survives the narrow-viewport
breakpoint that hides the tagline.

**Automatic language selection**
On first load the game reads `navigator.languages` — the ordered list of languages the player's
browser and OS are already configured for — and picks French if French appears anywhere in it,
otherwise English. The list is respected in order, so a `de-DE, fr-FR` browser gets French.

This is locale, not geography. Deciding by IP address would mean calling a third-party service on
every load, which would break a file designed to run offline from `file://` with no dependencies, and
the Geolocation API would raise a permission prompt out of all proportion to choosing a language.
Locale is also the more accurate signal: it reflects what the player actually reads, not where they
happen to be sitting.

**The choice is remembered**
Picking a language stores it, and a stored choice always wins over detection on subsequent loads.
Storage failures are non-fatal — the selection simply lasts for the session, consistent with how the
best score already behaves.

### Changed

**All display text now comes from a string table**
Static text is tagged in the markup and swapped at runtime; interpolated text (scores, level numbers)
is rebuilt from one function. Switching language mid-game re-renders whatever overlay is currently
showing, so a paused or game-over screen updates immediately rather than waiting for the next state
change.

French typography is preserved rather than machine-copied: French keeps its space before a colon
("Score : 420"), English does not ("Score: 420").

**The mute button's label is now correct**
Its accessible label previously read "Couper le son" permanently, including while already muted. It
now tracks both the language and the on/off state. This is part of finding #23, which remains open
for the rest (`aria-pressed`, and the pause button, still do not reflect state).

**Storage helpers generalised**
The guarded `localStorage` wrappers added earlier were specific to the best score; they are now
generic `storageGet`/`storageSet`, reused for the language preference. This is the groundwork finding
#20 calls for in order to persist the mute setting.

### Notes

The document language attribute (`<html lang>`) follows the selection, so screen readers and browser
translation features get the right hint.

Verified with the headless harness, now at 49 assertions. Alongside runtime checks it performs static
checks that catch the realistic failure mode for translation work: that both tables define the same
keys, that placeholders match across languages, and that every key referenced from markup or code
actually exists. The harness is not committed.

---

## 2026-08-12 — Pause behaviour and keyboard access (`3ab988f`)

### Fixed

**Power-up timers no longer drain while the game is paused** (#4)
A 10-second "widen" used to keep counting down on the pause screen, so pausing to answer the door
could cost you the whole bonus. Effects now carry a `remaining` duration measured in seconds of
actual play instead of an absolute wall-clock deadline. As a side benefit the timers are now immune
to background-tab throttling and system clock adjustments.

**The game pauses itself when you switch away** (#5)
Backgrounding the tab or clicking into another window previously left the ball live. Returning
dropped you straight into the action with no warm-up, and power-up timers kept expiring in the
meantime. Both now trigger an automatic pause. It only fires on leaving — coming back never
auto-resumes, so you restart play deliberately.

**Space activates a focused button instead of being swallowed** (#6)
Space was unconditionally suppressed to stop the page scrolling, which also meant a keyboard-only
player who tabbed to "Rejouer" could not press it with Space (Enter still worked). Space is now
handed back to the browser whenever a button holds focus.

This carried a companion fix worth knowing about: the pause and mute buttons on the deck stay
on-screen and keep focus after a mouse click, so the change alone would have made Space toggle pause
instead of launching the ball. Those buttons now drop focus after pointer clicks only — keyboard
activation keeps focus, so tab-order navigation is unaffected.

### Notes

Verified with a throwaway headless harness that stubs the DOM, loads the real script, and drives the
game loop directly — 18 assertions covering timer suspension across a 30-second pause, both
auto-pause triggers, and the Space/focus interaction. The harness was not committed.

---

## 2026-08-12 — Document structure and crash-safety (`18130c8`)

### Fixed

**Accented French text can no longer mojibake** (#1)
The file began directly at `<style>` with no doctype and no charset declaration. Opened over
`file://`, or served without a `charset` header, browsers fell back to windows-1252 and rendered
`Détruisez` as `DÃ©truisez`. The page now has a proper `<!doctype html>`, `<html lang="fr">`, and a
`<head>` carrying `<meta charset="utf-8">`, a viewport meta, and a `<title>`.

This also moves the page out of quirks mode into standards mode.

**A blocked `localStorage` no longer kills the game** (#2)
The best score was read at startup while building the game state. In Safari private browsing, with
site data disabled, or in some sandboxed `file://` contexts, touching `localStorage` *throws* — which
aborted the entire script and left a dead black canvas with no error the player could see. Reads and
writes are now guarded, falling back to an in-memory best score.

**The paddle no longer sticks to a wall after alt-tabbing** (#3)
No `keyup` is delivered for a key still held when the window loses focus, so alt-tabbing mid-press
left the paddle pinned against the edge until you pressed and released that key again. Held keys are
now cleared on blur.

---

## 2026-08-12 — Code review (`d20ab63`)

Added [docs/code-review.md](code-review.md): 32 numbered findings across correctness, performance,
code structure, accessibility, and gameplay, each anchored to the relevant source lines with an
effort estimate. No code changes.

---

## 2026-08-12 — Initial commit (`8b6c46d`)

`arkanoid.html` — a single self-contained French-language neon arcade breakout game. Vanilla JS in an
IIFE, 2D canvas, WebAudio blips, five hand-authored levels, six power-ups, no dependencies and no
build step.
