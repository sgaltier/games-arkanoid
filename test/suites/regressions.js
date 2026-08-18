"use strict";
/*
  One test per fixed finding from docs/done.md.

  This is the file that grows every time a bug is fixed. The convention is in
  docs/testing.md: write the test, watch it fail against the unfixed code, then
  fix the bug and watch it pass. A regression test that has never been seen
  failing proves nothing.

  Tests elsewhere in the suite may cover the same ground more thoroughly; the
  point of this file is to state, in one place and in the finding's own terms,
  what must never come back.
*/

const { boot, HTML, SCRIPT } = require("../dom-stub");

// Empty a level the short way. Bypassing brickHit means the remainingBricks
// counter it maintains (#16) has to be kept in sync by hand. On a boss level
// (#44) remainingBricks is already pinned at 0, so it's the boss that has to
// be put down instead — checkLevelClear() reads state.boss.dead there.
function clearBricks(g) {
  g.T.state.bricks.forEach((b) => { if (b.hp !== Infinity) b.alive = false; });
  g.T.state.remainingBricks = 0;
  if (g.T.state.boss) {
    g.T.state.boss.parts.forEach((p) => { p.hp = 0; p.alive = false; });
    g.T.state.boss.dead = true;
  }
}

// #69: press and release the level-jump chord. Releasing matters — the chord
// fires on whichever of the three completes it, so leaving them held would let
// the next keystroke look like a fresh chord.
function chord(g) {
  g.key("KeyS");
  g.key("KeyE");
  g.key("KeyB");
  g.keyUp("KeyS");
  g.keyUp("KeyE");
  g.keyUp("KeyB");
}

// #71: how many frames the lost-ball beat actually takes, from a handle already
// sitting in it. Counted rather than asserted against the config directly, so
// the reduced-motion comparison is of real elapsed frames.
function beatFrames(g) {
  let n = 0;
  while (g.T.state.phase === "lifelost" && n < 200) { g.frame(); n++; }
  return n;
}

// A board already full of higher scores, so ending a run goes straight to
// gameover rather than detouring through nameentry (#42).
const FULL_HOF = JSON.stringify(
  Array.from({ length: 10 }, (_, i) => ({ name: "CPU", score: 999000 - i }))
);

// Destructible bricks in the level currently loaded that the ball can never
// touch — a softlock, since remainingBricks then never falls to zero and the run
// is dead with nothing left to hit (#41c for generated levels, #68 for authored
// ones). Written out here rather than calling the game's own validator, so a
// broken validator cannot pass itself.
function walledOffBricks(g) {
  const bricks = g.T.state.bricks;
  // Recover grid coordinates from geometry: the smallest gap between two
  // distinct brick origins is the cell pitch, so an entirely empty row or column
  // still counts as one cell rather than collapsing away and inventing adjacency.
  const axis = (vals) => {
    const u = [...new Set(vals)].sort((p, q) => p - q);
    const pitch = Math.min(...u.slice(1).map((v, k) => v - u[k]));
    return { min: u[0], pitch, size: Math.round((u[u.length - 1] - u[0]) / pitch) + 1 };
  };
  const X = axis(bricks.map((b) => b.x));
  const Y = axis(bricks.map((b) => b.y));
  const grid = Array.from({ length: Y.size }, () => Array(X.size).fill("."));
  for (const b of bricks) {
    grid[Math.round((b.y - Y.min) / Y.pitch)][Math.round((b.x - X.min) / X.pitch)] =
      b.hp === Infinity ? "#" : "o";
  }

  // Up from the open space below the layout. Empty cells and destructible bricks
  // are passable — a destructible brick opens its own cell once it is gone —
  // walls are not.
  const seen = grid.map((row) => row.map(() => false));
  const queue = [];
  for (let c = 0; c < X.size; c++) {
    if (grid[Y.size - 1][c] === "#") continue;
    seen[Y.size - 1][c] = true;
    queue.push([Y.size - 1, c]);
  }
  while (queue.length) {
    const [r, c] = queue.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= Y.size || nc < 0 || nc >= X.size) continue;
      if (seen[nr][nc] || grid[nr][nc] === "#") continue;
      seen[nr][nc] = true;
      queue.push([nr, nc]);
    }
  }
  const out = [];
  for (let r = 0; r < Y.size; r++) {
    for (let c = 0; c < X.size; c++) {
      if (grid[r][c] === "o" && !seen[r][c]) out.push({ r, c });
    }
  }
  return out;
}

// Shared #49/#51 fixture. Level 0 is four solid rows of ten 1hp bricks with no gaps, so
// buildLevel()'s row-major order makes state.bricks[row * 10 + col] the cell at
// that grid position — a real layout with real geometry, rather than a
// hand-built one that could drift from what buildLevel actually produces.
// Returns { g, at, blast } where blast(brick) drives a ball up into it, so the
// explosion is reached through the game's own collision path and brickHit does
// not have to join SEAM.
function gridLevel(opts) {
  const g = boot(opts).start();
  g.T.startLevel(0);
  g.T.setPhase("playing"); // startLevel leaves it "ready", where balls do not move
  const at = (r, c) => g.T.state.bricks[r * 10 + c];
  const blast = (target) => {
    // #58 freezes the frame after an explosion. This fixture drives exactly one
    // frame per blast, on purpose — running more would let the ball carry on
    // through the rubble and destroy bricks the test never asked it to — so the
    // freeze has to be cleared or a second blast in the same test never lands.
    g.T.state.hitStop = 0;
    const ball = g.T.state.balls[0];
    ball.attached = false;
    ball.x = target.x + target.w / 2;
    ball.y = target.y + target.h + 8;
    ball.dx = 0;
    ball.dy = -1;
    ball.speed = 300;
    g.frame();
  };
  const deadCells = () => {
    const out = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) if (!at(r, c).alive) out.push(r + "," + c);
    return out;
  };
  // Advance play time with the ball re-attached to the paddle, so it cannot hit
  // anything. #51's timing assertions need this: a loose ball keeps demolishing
  // the grid and will happily knock a regenerated brick straight back down
  // between the tick that revives it and the assertion that looks for it.
  const idle = (seconds) => {
    g.T.state.balls.forEach((b) => { b.attached = true; });
    g.runAlive(seconds);
  };
  return { g, at, blast, deadCells, idle };
}

// #52 fixture: a board of nothing but mystery bricks, played until a good
// number have resolved. LEVELS is reachable through the seam and each boot()
// re-evaluates the script, so overwriting level 0's rows affects only this game.
function mysteryBoard(seed, seconds) {
  const g = boot({ seed }).start();
  g.T.LEVELS[0].rows = ["??????????", "??????????", "??????????", "??????????"];
  g.T.startLevel(0);
  g.T.setPhase("playing");
  g.T.launchBall();
  g.runAlive(seconds === undefined ? 40 : seconds);
  return g;
}

// What the level-clear counter is supposed to be tracking: bricks standing
// right now that can still be destroyed. A resolved wall is not one, and
// neither is a regenerating brick that is currently down — #51 deliberately
// leaves those uncounted so a level can be cleared while one is away, and
// updateBricks() adds it back on return.
function standingDestroyable(g) {
  return g.T.state.bricks.filter((b) => b.alive && b.hp !== Infinity).length;
}

module.exports = {
  name: "regressions — one test per fixed finding",
  tests: [
    {
      name: "#1 — the page has a document shell, so it never renders in quirks mode",
      fn(a) {
        a.match(HTML.slice(0, 120), /^<!doctype html>\s*<html lang="(fr|en)">/i,
          "the file must open with a doctype and a language-tagged <html>");
        a.match(HTML, /<meta\s+charset="utf-8">/i,
          "without a charset, utf-8 French is read as windows-1252 and mojibakes");
      },
    },
    {
      name: "#2 — a throwing localStorage does not take the game down",
      fn(a) {
        let g;
        a.doesNotThrow(() => { g = boot({ storageThrows: true }); },
          "the best score is read while building state; an unguarded throw killed the whole IIFE");
        a.eq(g.T.state.phase, "start", "the game should have initialised normally");
        a.eq(g.T.state.best, 0);
      },
    },
    {
      name: "#3 — held keys are dropped when the window loses focus",
      fn(a) {
        const g = boot().start();
        g.hold("ArrowRight");
        g.run(0.1);
        g.fireWin("blur");
        // No keyup is delivered for a key held across a focus change, so without
        // the blur handler the paddle stayed pinned against the wall on return.
        a.empty(Object.keys(g.T.state.keys), "held keys survived the blur");
        const parked = g.T.state.paddle.x;
        g.run(1.0);
        a.eq(g.T.state.paddle.x, parked, "the paddle kept drifting after focus loss");
      },
    },
    {
      name: "#4 — power-up timers do not drain while the game is paused",
      fn(a) {
        const g = boot().start();
        g.T.applyPowerup({ type: "widen" });
        g.runAlive(1.0);
        const remaining = g.T.state.widthEffect.remaining;

        g.key("KeyP");
        g.run(30);
        a.ok(g.T.state.widthEffect,
          "a 10-second bonus expired while parked on the pause screen");
        a.eq(g.T.state.widthEffect.remaining, remaining, "the clock advanced while paused");

        g.key("KeyP");
        g.runAlive(remaining + 0.5);
        a.not(g.T.state.widthEffect, "the effect should still expire after its full duration of play");
      },
    },
    {
      name: "#5 — the game pauses itself when the tab is hidden or focus is lost",
      fn(a) {
        const byBlur = boot().start();
        byBlur.fireWin("blur");
        a.eq(byBlur.T.state.phase, "paused", "losing focus should pause");

        const byHide = boot().start();
        byHide.doc.hidden = true;
        byHide.fireDoc("visibilitychange");
        a.eq(byHide.T.state.phase, "paused", "backgrounding the tab should pause");

        // Returning must not auto-resume — the player restarts play deliberately.
        byHide.doc.hidden = false;
        byHide.fireDoc("visibilitychange");
        a.eq(byHide.T.state.phase, "paused", "coming back should leave the game paused");
      },
    },
    {
      name: "#6 — Space activates a focused button instead of being swallowed",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);

        g.doc.activeElement = g.el("btn-restart");
        const withButton = g.key("Space");
        a.eq(withButton.defaultPrevented, false,
          "preventing the default stops a keyboard user activating the button");
        a.eq(g.T.state.phase, "ready", "Space should not also launch the ball");

        g.doc.activeElement = g.doc.body;
        const withoutButton = g.key("Space");
        a.eq(withoutButton.defaultPrevented, true, "Space must still stop the page scrolling");
        a.eq(g.T.state.phase, "playing", "and still launch when nothing is focused");
      },
    },
    {
      name: "#6b — on-screen buttons release focus after a pointer click",
      fn(a) {
        // Companion to #6: the deck and language buttons stay visible, so a mouse
        // click would leave one focused and it would then swallow the Space the
        // player expects to launch with.
        // btn-pause is excluded here: since #26, its click also transitions
        // the phase to "paused", which refocuses the pause overlay's own
        // resume button — a different, and separately regression-tested (#26),
        // interaction that would confound this assertion.
        const g = boot().start();
        g.doc.activeElement = g.el("btn-mute");
        g.el("btn-mute").click(1);
        a.eq(g.doc.activeElement, g.doc.body, "btn-mute kept focus after a pointer click");

        g.doc.activeElement = g.langButton("en");
        g.langButton("en").click(1);
        a.eq(g.doc.activeElement, g.doc.body, "the language toggle kept focus after a pointer click");

        // Keyboard activation must still keep focus, or tab navigation breaks.
        g.doc.activeElement = g.el("btn-mute");
        g.el("btn-mute").click(0);
        a.eq(g.doc.activeElement, g.el("btn-mute"), "keyboard activation must not steal focus");
      },
    },
    {
      name: "#20a — storage helpers are generic and shared",
      fn(a) {
        // The guarded wrappers were specific to the best score before the
        // bilingual work generalised them. Both keys must survive a hostile
        // storage without throwing.
        const g = boot({ storageThrows: true, langs: ["fr-FR"] });
        a.doesNotThrow(() => g.langButton("en").click(1), "saving the language threw");
        a.doesNotThrow(() => {
          g.start();
          g.T.state.score = 10;
          g.T.state.lives = 1;
          g.loseBall();
        }, "saving the best score threw");
      },
    },
    {
      name: "#23a — the mute button never claims the wrong state",
      fn(a) {
        const g = boot({ langs: ["fr-FR"] });
        const mute = g.el("btn-mute");
        const unmuted = mute.getAttribute("aria-label");
        mute.click(1);
        a.ne(mute.getAttribute("aria-label"), unmuted,
          "the label read the same muted and unmuted, so it was wrong half the time");
      },
    },
    {
      name: "#9 — a ball that clips the paddle's side is not teleported onto the top",
      fn(a) {
        const g = boot().start();
        const p = g.T.state.paddle;
        const b = g.T.state.balls[0];
        // The ball is already level with the paddle's middle before this frame
        // moves it — i.e. it did not approach from above. A fast, mostly
        // horizontal ball can reach the paddle's side face within one frame.
        b.x = p.x - 20;
        b.y = p.y + p.h / 2;
        b.dx = 1;
        b.dy = 0.05;
        b.speed = 2000;
        b.attached = false;
        g.frame();
        a.gte(b.y, p.y,
          "a side clip snapped the ball onto the paddle's top face, which reads as a phantom save");
        a.gt(b.dy, 0,
          "a side hit reversed vertical travel like a top bounce instead of just deflecting sideways");
      },
    },
    {
      name: "#10 — the closest overlapping brick is resolved, not the first one in array order",
      fn(a) {
        const g = boot().start();
        // Two bricks positioned so a ball sitting in the notch between them
        // overlaps both, but penetrates the second one less deeply. Bricks are
        // otherwise stored top-row-first, so brick0 (the "upper" one) is always
        // checked first.
        const brick0 = { x: 100, y: 100, w: 40, h: 20, type: "1", hp: 1, alive: true };
        const brick1 = { x: 140, y: 120, w: 40, h: 20, type: "1", hp: 1, alive: true };
        g.T.state.bricks = [brick0, brick1];
        const b = g.T.state.balls[0];
        b.x = 138;
        b.y = 119;
        b.dx = 0;
        b.dy = 0;
        b.speed = 0;
        b.attached = false;
        g.frame();
        a.not(brick1.alive,
          "the ball penetrates brick1 more shallowly, so that is the face it actually struck");
        a.ok(brick0.alive,
          "array order (brick0 first) must not override which brick was really hit");
      },
    },
    {
      name: "#11 — the drop hitbox matches the drawn capsule",
      fn(a) {
        const g = boot().start();
        const p = g.T.state.paddle;
        const pw = g.T.paddleWidth();
        const def = g.T.POWERUPS.find((d) => d.type === "life");
        // updateDrops falls the drop by 130*dt before testing for a catch, so
        // back the start position off by one frame's fall to land it exactly
        // 9px above the paddle top at the moment of the test — inside the
        // drawn capsule's 10px radius, outside the old 8px hitbox.
        const fallStep = 130 * 0.016;
        g.T.state.drops = [{ x: p.x + pw / 2, y: p.y - 9 - fallStep, def }];
        const lives = g.T.state.lives;
        g.frame();
        a.eq(g.T.state.drops.length, 0,
          "the capsule (drawn with a 10px radius) already touches the paddle, but the hitbox missed it");
        a.gt(g.T.state.lives, lives, "the power-up should have been collected, not just discarded");
      },
    },
    {
      name: "#12 — a multi-ball clone never spawns aimed downward",
      fn(a) {
        const g = boot().start();
        const b = g.T.state.balls[0];
        b.dx = 0;
        b.dy = 1; // straight down
        b.attached = false;
        g.T.applyPowerup({ type: "multi" });
        const clones = g.T.state.balls.slice(1);
        a.gt(clones.length, 0, "multi-ball should have added clones");
        for (const clone of clones) {
          a.lt(clone.dy, 0,
            `a clone spawned with dy=${clone.dy}, still descending from a source ball aimed straight down`);
        }
      },
    },
    {
      name: "#13 — clearing a level persists the best score without waiting for game over",
      fn(a) {
        const g = boot().start();
        g.T.state.score = 999;
        // Kill every destructible brick so the level completes without ending
        // the game outright (there are more levels after this one). Bypassing
        // brickHit means the remainingBricks counter it maintains (see #16)
        // has to be kept in sync by hand here.
        g.T.state.bricks.forEach((br) => { if (br.hp !== Infinity) br.alive = false; });
        g.T.state.remainingBricks = 0;
        g.frame();
        a.eq(g.T.state.phase, "levelclear", "the level should have cleared, not ended the game");
        a.eq(g.T.state.best, 999, "the best score should update in memory on level clear");
        a.eq(g.store["neonbreak-best-score"], "999",
          "closing the tab right after a level clear would otherwise lose the score");
      },
    },
    {
      name: "#16 — brickHit keeps the remainingBricks counter in sync with destroyed bricks",
      fn(a) {
        const g = boot().start();
        const before = g.T.state.remainingBricks;
        const destructible = g.T.state.bricks.filter((b) => b.hp !== Infinity && b.alive);
        a.eq(before, destructible.length,
          "remainingBricks should start out matching the destructible bricks buildLevel just built");

        // Drive the ball into one destructible brick, same as rules.js's hitBrick
        // helper — up to 3 hits covers even a 2-hp "S" brick.
        const target = destructible[0];
        const ball = g.T.state.balls[0];
        for (let i = 0; i < 3 && target.alive; i++) {
          ball.attached = false;
          ball.x = target.x + target.w / 2;
          ball.y = target.y + target.h + ball.r - 2;
          ball.dx = 0;
          ball.dy = -1;
          ball.speed = 1;
          g.frame();
        }
        a.eq(target.alive, false, "the target brick should be destroyed within 3 hits");
        a.eq(g.T.state.remainingBricks, before - 1,
          "destroying exactly one destructible brick should decrement the counter by exactly one");
      },
    },
    {
      name: "#16 — checkLevelClear reads the remainingBricks counter, not a live array scan",
      fn(a) {
        const g = boot().start();
        // Every destructible brick is still alive in the array; only the
        // counter says the level is clear. The pre-fix implementation
        // re-scanned state.bricks every frame and would have stayed "playing".
        g.T.state.remainingBricks = 0;
        g.frame();
        a.eq(g.T.state.phase, "levelclear",
          "the level should clear off the counter even though the brick array itself isn't empty");
      },
    },
    {
      name: "#17 — the canvas backing store scales down with a narrower displayed size",
      fn(a) {
        // On a phone the canvas often renders well under its 480 logical px
        // wide (CSS gives it `width: 100%`); the backing store should shrink
        // with it instead of always allocating GAME_W * dpr regardless of how
        // small the element is actually displayed.
        const g = boot({ dpr: 2, canvasWidth: 240 }); // half of GAME_W
        const canvas = g.el("game");
        a.eq(canvas.width, 480,
          `canvas.width was ${canvas.width}; at half the displayed width it should allocate half ` +
          `the backing-store pixels (480), not a flat GAME_W * dpr (960)`);
        a.eq(canvas.height, 680,
          `canvas.height was ${canvas.height}; it should scale down with canvas.width, keeping ` +
          "the same GAME_W:GAME_H aspect ratio");
      },
    },
    {
      name: "#18 — setPhase owns the levelclear/victory/gameover overlay mapping",
      fn(a) {
        // Before the fix, setPhase()'s if/else chain simply had no branch for
        // these three phases, so calling it directly — which is exactly what
        // checkLevelClear()/endGame() now do instead of duplicating the
        // overlay logic themselves — would silently leave the wrong overlay
        // (or none) on screen.
        const g = boot();
        g.T.setPhase("levelclear");
        a.eq(g.shownOverlays()[0], "overlay-levelclear");
        g.T.setPhase("victory");
        a.eq(g.shownOverlays()[0], "overlay-victory");
        g.T.setPhase("gameover");
        a.eq(g.shownOverlays()[0], "overlay-gameover");
      },
    },
    {
      name: "#19a — state.paddle.w is no longer a dead, stale field",
      fn(a) {
        // paddleWidth() is the actual source of truth everywhere; nothing
        // ever read the assignment updatePaddle() used to make.
        const g = boot().start();
        a.eq(g.T.state.paddle.w, undefined,
          "paddle.w should no longer be set at all, not just left unread");
      },
    },
    {
      name: "#19b — the redundant initial full-canvas paint before the first rAF frame is gone",
      fn(a) {
        a.not(/updateHud\(\);\s*drawBackground\(\);\s*drawBricks\(\);\s*drawPaddle\(\);/.test(SCRIPT),
          "the four calls right before the first requestAnimationFrame(frame) duplicated exactly " +
          "what that first frame paints ~16ms later");
      },
    },
    {
      name: "#19c — updateBalls no longer takes an unused now parameter",
      fn(a) {
        a.match(SCRIPT, /function updateBalls\(dt\)\s*\{/,
          "updateBalls should declare only the dt parameter it actually uses");
        a.not(/updateBalls\(dt, now\)/.test(SCRIPT),
          "the call site should no longer pass the removed now argument");
      },
    },
    {
      name: "#20b — a suspended AudioContext is resumed on first use",
      fn(a) {
        // Some browsers hand back a "suspended" context unless it was built
        // directly inside a user-gesture handler; without an explicit
        // resume() call the game would be silently mute for the rest of the
        // session.
        const g = boot();
        g.T.applyPowerup({ type: "life" }); // any powerup beeps
        a.gt(g.counters.audioResumes, 0, "beep() should have resumed the suspended context");
      },
    },
    {
      name: "#20c — muting is remembered across a reload",
      fn(a) {
        const first = boot();
        a.eq(first.T.state.muted, false, "starts unmuted by default");
        first.el("btn-mute").click(1);
        a.eq(first.T.state.muted, true);
        a.eq(first.store["neonbreak-muted"], "1",
          "the mute toggle should write straight through to storage, like the language toggle does");

        const second = boot({ storage: first.store });
        a.eq(second.T.state.muted, true, "a later session should boot back into the remembered state");
      },
    },
    {
      name: "#21 — scattered magic numbers are collected into one CONFIG object",
      fn(a) {
        const g = boot().start();
        const CONFIG = g.T.CONFIG;
        a.ok(CONFIG, "CONFIG should be exposed for tuning");
        a.eq(CONFIG.maxBalls, 5);
        a.eq(CONFIG.paddleBounceSpread, 1.05);
        a.eq(CONFIG.dropFallSpeed, 130);
        a.eq(CONFIG.particleGravity, 260);
        a.eq(CONFIG.effects.widen.mult, 1.6);
        a.eq(CONFIG.effects.widen.duration, 10);

        // Prove gameplay actually reads from CONFIG rather than a separate,
        // still-duplicated literal that happens to agree with it today.
        g.T.applyPowerup({ type: "widen" });
        a.eq(g.T.state.widthEffect.mult, CONFIG.effects.widen.mult);
        a.eq(g.T.state.widthEffect.remaining, CONFIG.effects.widen.duration);
      },
    },
    {
      name: "#22 — overlay changes are announced to assistive tech",
      fn(a) {
        const g = boot().start();
        const overlayIds = [
          "overlay-start", "overlay-ready", "overlay-pause",
          "overlay-levelclear", "overlay-victory", "overlay-gameover",
        ];
        overlayIds.forEach((id) => {
          const el = g.el(id);
          a.eq(el.getAttribute("role"), "status",
            `${id} should be a live region so a screen reader hears it appear`);
          a.eq(el.getAttribute("aria-live"), "polite",
            `${id} should announce politely rather than interrupting`);
        });

        g.T.setPhase("levelclear");
        a.eq(g.el("overlay-levelclear").getAttribute("aria-hidden"), "false",
          "the overlay actually on screen must be out of aria-hidden or its live-region content " +
          "is never announced");
        a.eq(g.el("overlay-ready").getAttribute("aria-hidden"), "true",
          "every overlay not on screen should stay aria-hidden so it isn't announced as if it were");
      },
    },
    {
      name: "#23b — the pause button reflects paused state via aria-pressed, icon and label",
      fn(a) {
        const g = boot().start();
        const pauseBtn = g.el("btn-pause");
        a.eq(pauseBtn.getAttribute("aria-pressed"), "false");
        const playingLabel = pauseBtn.getAttribute("aria-label");
        const playingIcon = pauseBtn.innerHTML;

        g.T.togglePause();
        a.eq(g.T.state.phase, "paused");
        a.eq(pauseBtn.getAttribute("aria-pressed"), "true",
          "aria-pressed should flip once the game is actually paused");
        a.ne(pauseBtn.getAttribute("aria-label"), playingLabel,
          "the label should change between pause and resume, like the mute button already does");
        a.ne(pauseBtn.innerHTML, playingIcon,
          "the icon should change too, not just the label");

        g.T.togglePause();
        a.eq(g.T.state.phase, "playing");
        a.eq(pauseBtn.getAttribute("aria-pressed"), "false");
      },
    },
    {
      name: "#23c — the mute button now exposes aria-pressed",
      fn(a) {
        const g = boot();
        const muteBtn = g.el("btn-mute");
        a.eq(muteBtn.getAttribute("aria-pressed"), "false");
        muteBtn.click(1);
        a.eq(muteBtn.getAttribute("aria-pressed"), "true");
      },
    },
    {
      name: "#24 — the canvas points assistive tech at the live HUD text",
      fn(a) {
        const g = boot();
        const hud = g.el("hud");
        a.ok(hud.getAttribute("id"), "the HUD container needs a stable id to be described-by");
        a.eq(g.el("game").getAttribute("aria-describedby"), hud.getAttribute("id"),
          "the canvas should reference the HUD as its accessible description, since the canvas " +
          "itself carries no live text for score/lives");
      },
    },
    {
      name: "#25a — particle bursts are reduced under prefers-reduced-motion",
      fn(a) {
        // Drive an identical brick hit against two otherwise-identical boots
        // and compare how many particles the burst actually added.
        function hitFirstBrickDelta(g) {
          const before = g.T.state.particles.length;
          const target = g.T.state.bricks.find((b) => b.hp !== Infinity && b.alive);
          const ball = g.T.state.balls[0];
          ball.attached = false;
          ball.x = target.x + target.w / 2;
          ball.y = target.y + target.h + ball.r - 2;
          ball.dx = 0;
          ball.dy = -1;
          ball.speed = 1;
          g.frame();
          return g.T.state.particles.length - before;
        }

        const normal = hitFirstBrickDelta(boot().start());
        const reduced = hitFirstBrickDelta(boot({ reducedMotion: true }).start());
        a.gt(normal, reduced,
          `a burst under reduced motion should spawn fewer particles (${reduced} vs ${normal})`);
        a.gt(reduced, 0, "reduced motion should still give some feedback, not none at all");
      },
    },
    {
      name: "#25b — the reduced-motion preference is read live, not just once at load",
      fn(a) {
        const g = boot({ reducedMotion: false }).start();
        function hitBrickDelta() {
          const before = g.T.state.particles.length;
          const target = g.T.state.bricks.find((b) => b.hp !== Infinity && b.alive);
          const ball = g.T.state.balls[0];
          ball.attached = false;
          ball.x = target.x + target.w / 2;
          ball.y = target.y + target.h + ball.r - 2;
          ball.dx = 0;
          ball.dy = -1;
          ball.speed = 1;
          g.frame();
          return g.T.state.particles.length - before;
        }

        const before = hitBrickDelta();
        g.fireMedia("(prefers-reduced-motion: reduce)", true);
        const after = hitBrickDelta();
        a.gt(before, after,
          "toggling the OS setting mid-session should immediately affect the next burst, not " +
          "require a reload");
      },
    },
    {
      name: "#26 — every overlay's primary button gets focus when it appears",
      fn(a) {
        const g = boot();
        a.eq(g.doc.activeElement, g.el("btn-start"),
          "the start screen's own button should be focused at boot, not just after a later transition");

        [
          ["paused", "btn-resume"],
          ["levelclear", "btn-next"],
          ["victory", "btn-restart-win"],
          ["gameover", "btn-restart"],
        ].forEach(([phase, btnId]) => {
          g.T.setPhase(phase);
          a.eq(g.doc.activeElement, g.el(btnId),
            `setPhase("${phase}") should focus ${btnId}, so Space/Enter activates it`);
        });

        // "ready" has no button of its own — a stale focus left over from
        // whichever overlay was showing before must not linger and keep
        // swallowing Space via isButtonFocused() (see #6).
        g.T.setPhase("ready");
        a.ne(g.doc.activeElement.tagName, "BUTTON",
          "no button should remain focused once an overlay with none of its own is shown");
      },
    },
    {
      name: "#26b — clicking pause hands focus straight to the resume button",
      fn(a) {
        const g = boot().start();
        g.el("btn-pause").click(1);
        a.eq(g.T.state.phase, "paused");
        a.eq(g.doc.activeElement, g.el("btn-resume"),
          "a mouse click blurs btn-pause (see #6), but the phase transition should immediately " +
          "hand focus to the new overlay's own button");
      },
    },
    {
      name: "#27 — a touch aims on touchstart/touchmove but only launches on touchend",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        a.eq(g.T.state.phase, "ready");

        g.touch("touchstart", 100);
        a.eq(g.T.state.phase, "ready", "touchstart alone should only aim the paddle, not launch");
        a.eq(g.T.state.pointerX, 100);

        g.touch("touchmove", 200);
        a.eq(g.T.state.phase, "ready", "touchmove should keep aiming, not launch");
        a.eq(g.T.state.pointerX, 200, "the paddle should still be positionable after the first touch");

        g.touch("touchend", 200);
        a.eq(g.T.state.phase, "playing", "touchend should launch");
      },
    },
    {
      name: "#28a — reaching the top wall ramps up the difficulty multiplier, capped at CONFIG.difficulty.max",
      fn(a) {
        const g = boot().start();
        const ball = g.T.state.balls[0];
        for (let i = 0; i < 60; i++) {
          ball.attached = false;
          ball.x = 240;
          ball.y = 5; // already above the wall threshold (ball.r is 7)
          ball.dx = 0;
          ball.dy = -1;
          ball.speed = 1;
          g.frame();
        }
        a.gt(g.T.state.difficultyMult, 1, "repeated top-wall bounces should have raised the multiplier");
        a.lte(g.T.state.difficultyMult, g.T.CONFIG.difficulty.max,
          "the multiplier must never exceed CONFIG.difficulty.max");
      },
    },
    {
      name: "#28b — every CONFIG.difficulty.brickMilestone bricks destroyed also ramps the difficulty",
      fn(a) {
        const g = boot().start();
        const milestone = g.T.CONFIG.difficulty.brickMilestone;
        const before = g.T.state.difficultyMult;
        const ball = g.T.state.balls[0];
        for (let i = 0; i < milestone; i++) {
          const target = g.T.state.bricks.find((b) => b.hp !== Infinity && b.alive);
          ball.attached = false;
          ball.x = target.x + target.w / 2;
          ball.y = target.y + target.h + ball.r - 2;
          ball.dx = 0;
          ball.dy = -1;
          ball.speed = 1;
          g.frame();
        }
        a.gt(g.T.state.difficultyMult, before,
          `destroying ${milestone} bricks should have crossed a difficulty milestone`);
      },
    },
    {
      name: "#28c — the difficulty multiplier actually scales ball speed, and resets on a new level",
      fn(a) {
        const g = boot().start();
        const ball = g.T.state.balls[0];
        ball.attached = false;
        ball.x = 240;
        ball.y = 300;
        ball.dx = 1;
        ball.dy = 0;
        ball.speed = 100;

        g.T.state.difficultyMult = 1;
        g.frame();
        const slowDx = g.T.state.balls[0].x - 240;

        ball.x = 240;
        g.T.state.difficultyMult = 1.5;
        g.frame();
        const fastDx = g.T.state.balls[0].x - 240;

        a.gt(fastDx, slowDx, "a higher difficultyMult should move the ball further in the same frame");

        g.T.startLevel(1);
        a.eq(g.T.state.difficultyMult, 1, "a new level should start the ramp back at 1");
      },
    },
    {
      name: "#29a — destroying a brick spawns a floating score pop-up at its position",
      fn(a) {
        const g = boot().start();
        const target = g.T.state.bricks.find((b) => b.hp !== Infinity && b.alive);
        const ball = g.T.state.balls[0];
        ball.attached = false;
        ball.x = target.x + target.w / 2;
        ball.y = target.y + target.h + ball.r - 2;
        ball.dx = 0;
        ball.dy = -1;
        ball.speed = 1;
        a.eq(g.T.state.floatingTexts.length, 0);
        g.frame();
        a.eq(g.T.state.floatingTexts.length, 1, "destroying a brick should spawn one floating text");
        a.match(g.T.state.floatingTexts[0].text, /^\+\d+/,
          `floating text "${g.T.state.floatingTexts[0].text}" should read as a score gain`);
      },
    },
    {
      name: "#29b — consecutive brick hits without a paddle touch build a score combo",
      fn(a) {
        const g = boot().start();
        const scores = [];
        const ball = g.T.state.balls[0];
        for (let i = 0; i < 3; i++) {
          const target = g.T.state.bricks.find((b) => b.hp !== Infinity && b.alive);
          const before = g.T.state.score;
          ball.attached = false;
          ball.x = target.x + target.w / 2;
          ball.y = target.y + target.h + ball.r - 2;
          ball.dx = 0;
          ball.dy = -1;
          ball.speed = 1;
          g.frame();
          scores.push(g.T.state.score - before);
        }
        a.eq(g.T.state.combo, 3,
          "three consecutive hits with no paddle touch between them should read as a combo of 3");
        a.gt(scores[2], scores[0], "a later hit in an unbroken combo should score more than the first");
      },
    },
    {
      name: "#29c — touching the paddle resets the combo",
      fn(a) {
        const g = boot().start();
        g.T.state.combo = 5;
        const p = g.T.state.paddle;
        const ball = g.T.state.balls[0];
        ball.attached = false;
        // Already overlapping the paddle before this frame's movement, like
        // #9's side-hit setup — a high speed here would tunnel straight
        // through the paddle's 12px height instead of colliding with it.
        ball.x = p.x + 10;
        ball.y = p.y + p.h / 2;
        ball.dx = 0;
        ball.dy = 1;
        ball.speed = 1;
        g.frame();
        a.eq(g.T.state.combo, 0, "any paddle contact should end the combo streak");
      },
    },
    {
      name: "#30a — sticky catches a ball on a genuine top-face paddle hit",
      fn(a) {
        const g = boot().start();
        g.T.state.stickyEffect = { remaining: 10 };
        const p = g.T.state.paddle;
        const ball = g.T.state.balls[0];
        ball.attached = false;
        // Above the paddle before this frame's movement — a genuine top-face
        // hit, not a side clip (see #9).
        ball.x = p.x + 10;
        ball.y = p.y - ball.r - 2;
        ball.dx = 0;
        ball.dy = 1;
        ball.speed = 200;
        g.frame();
        a.eq(ball.attached, true, "a top-face hit during sticky should catch the ball, not bounce it");
        a.eq(ball.dx, 0);
        a.eq(ball.dy, 0);
      },
    },
    {
      name: "#30b — the action button releases a sticky-caught ball mid-play",
      fn(a) {
        const g = boot().start();
        const ball = g.T.state.balls[0];
        ball.attached = true;
        ball.dx = 0;
        ball.dy = 0;
        a.eq(g.T.state.phase, "playing");
        g.T.handleLaunchOrResume();
        a.eq(ball.attached, false, "the action button should release a stuck ball during play");
        a.near(Math.hypot(ball.dx, ball.dy), 1, 1e-9, "the released ball should get a real launch direction");
        a.lt(ball.dy, 0, "the released ball should head back upward");
      },
    },
    {
      name: "#30c — sticky catches at most one ball at a time",
      fn(a) {
        const g = boot().start();
        g.T.state.stickyEffect = { remaining: 10 };
        const p = g.T.state.paddle;

        // Control: with nothing already stuck, a lone top hit sticks — same
        // setup as #30a. Establishes the baseline the cap assertion below
        // actually depends on, so this test fails pre-fix rather than
        // trivially passing because sticky doesn't exist at all yet.
        const control = g.T.state.balls[0];
        control.attached = false;
        control.x = p.x + 10;
        control.y = p.y - control.r - 2;
        control.dx = 0;
        control.dy = 1;
        control.speed = 200;
        g.frame();
        a.eq(control.attached, true, "sanity check: a lone top hit should stick under sticky");

        const second = { x: p.x + 30, y: p.y - 8, r: 7, dx: 0, dy: 1, speed: 200, attached: false };
        g.T.state.balls.push(second);
        second.y = p.y - second.r - 2;
        g.frame();
        a.eq(second.attached, false,
          "a second ball should bounce normally, not also stick, while one is already caught");
      },
    },
    {
      name: "#30d — the action button fires the laser instead of a no-op during play",
      fn(a) {
        const g = boot().start();
        g.T.state.laserEffect = { remaining: 8 };
        a.eq(g.T.state.lasers.length, 0);
        g.T.handleLaunchOrResume();
        a.eq(g.T.state.lasers.length, 2, "firing should spawn the classic twin bolts");
      },
    },
    {
      name: "#30e — the laser has a cooldown between shots",
      fn(a) {
        const g = boot().start();
        g.T.state.laserEffect = { remaining: 8 };
        g.T.handleLaunchOrResume();
        const afterFirst = g.T.state.lasers.length;
        g.T.handleLaunchOrResume(); // immediately again, cooldown should block it
        a.eq(g.T.state.lasers.length, afterFirst,
          "firing again before the cooldown elapses should not add more bolts");
      },
    },
    {
      name: "#30f — a laser bolt destroys the brick it reaches",
      fn(a) {
        const g = boot().start();
        const target = g.T.state.bricks.find((b) => b.hp !== Infinity && b.alive);
        g.T.state.lasers.push({ x: target.x + target.w / 2, y: target.y + target.h - 1 });
        g.frame();
        a.eq(target.alive, false, "a laser bolt reaching a brick should destroy it, same as a ball hit");
        a.eq(g.T.state.lasers.length, 0, "the bolt should be consumed on impact");
      },
    },
    {
      name: "#31 — active power-up timers show as depleting bars",
      fn(a) {
        const g = boot().start();
        const widthBar = g.el("bar-width");
        const widthFill = g.el("bar-width-fill");
        const widthLabel = g.el("bar-width-label");
        a.eq(widthBar.hidden, true, "no bar should show before any effect is active");

        g.T.applyPowerup({ type: "widen" });
        a.eq(widthBar.hidden, false, "the width bar should appear once widen is active");
        a.eq(widthLabel.textContent, g.T.t("powerup.widen"));
        const full = parseFloat(widthFill.style.width);
        a.near(full, 100, 1, "a freshly-applied effect should start at a full bar");

        g.T.state.widthEffect.remaining = g.T.CONFIG.effects.widen.duration / 2;
        g.frame();
        const half = parseFloat(widthFill.style.width);
        a.lt(half, full, "the bar should deplete as the effect's remaining time counts down");

        g.T.state.widthEffect = null;
        g.frame();
        a.eq(widthBar.hidden, true, "the bar should hide again once the effect ends");
      },
    },
    {
      name: "#78 — effect bars show the power-up's full name, not just a letter",
      fn(a) {
        const g = boot().start();
        const widthLabel = g.el("bar-width-label");
        const widthBar = g.el("bar-width");
        const speedLabel = g.el("bar-speed-label");
        const stickyLabel = g.el("bar-sticky-label");
        const laserLabel = g.el("bar-laser-label");

        g.T.applyPowerup({ type: "widen" });
        a.eq(widthLabel.textContent, g.T.t("powerup.widen"),
          "the width bar's on-bar text should name the active effect, not just its letter");
        a.eq(widthBar.getAttribute("title"), g.T.t("powerup.widen"),
          "the title should carry the same name, as a fallback for whatever the bar clips");
        g.T.applyPowerup({ type: "narrow" });
        a.eq(widthLabel.textContent, g.T.t("powerup.narrow"),
          "the same bar should relabel itself when narrow takes over from widen");

        g.T.applyPowerup({ type: "slow" });
        a.eq(speedLabel.textContent, g.T.t("powerup.slow"));
        g.T.applyPowerup({ type: "fast" });
        a.eq(speedLabel.textContent, g.T.t("powerup.fast"));

        g.T.applyPowerup({ type: "sticky" });
        a.eq(stickyLabel.textContent, g.T.t("powerup.sticky"));
        g.T.applyPowerup({ type: "laser" });
        a.eq(laserLabel.textContent, g.T.t("powerup.laser"));
      },
    },
    {
      name: "#33 — showOverlay only blurs a button that belongs to the overlay it's hiding",
      fn(a) {
        const g = boot().start();
        // A real browser focuses a button on click; the stub doesn't, so focus()
        // stands in for that. detail 0 on the click itself mimics keyboard
        // activation, which deliberately keeps focus on the deck buttons
        // (see #6/#23) so they stay reachable via Space.
        g.el("btn-mute").focus();
        g.el("btn-mute").click(0);
        a.eq(g.doc.activeElement, g.el("btn-mute"),
          "a keyboard-activated mute button should hold focus");
        // "ready" has no primary button of its own (see #26), so nothing
        // re-focuses anything afterward — this isolates the blur itself.
        g.T.setPhase("ready");
        a.eq(g.doc.activeElement, g.el("btn-mute"),
          "the ready overlay has nothing to do with the mute button; it must not be blurred");
      },
    },
    {
      name: "#34 — \"start\" is a phase routed through setPhase()/PHASE_OVERLAY, not a boot-only special case",
      fn(a) {
        const g = boot().start();
        g.T.setPhase("levelclear"); // move away from "start" so the transition back is visible
        g.T.setPhase("start");
        a.eq(g.T.state.phase, "start");
        a.eq(g.shownOverlays()[0], "overlay-start",
          "setPhase(\"start\") should route through PHASE_OVERLAY like every other phase, the " +
          "same single entry point #18 established — not rely on a boot-time showOverlay() call " +
          "that bypasses it");
        a.eq(g.doc.activeElement, g.el("btn-start"),
          "the start overlay's own button should be focused, same as any overlay reached via setPhase()");
      },
    },
    {
      name: "#35 — touchend doesn't launch while a second finger is still down",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        a.eq(g.T.state.phase, "ready");

        g.touch("touchstart", 100);
        // A second finger is still touching the canvas when the primary one
        // lifts — e.touches reports one remaining.
        g.touch("touchend", 100, 0, 1);
        a.eq(g.T.state.phase, "ready",
          "lifting one of two fingers should not launch — the player hasn't committed to the serve");

        g.touch("touchend", 100); // the last finger lifts — no touches remain
        a.eq(g.T.state.phase, "playing", "lifting the last finger should launch");
      },
    },
    {
      name: "#36 — the overlay and its button are one hand-authored entry per phase, not two maps to sync",
      fn(a) {
        const g = boot();
        const PHASE_OVERLAY = g.T.PHASE_OVERLAY;
        a.ok(PHASE_OVERLAY, "PHASE_OVERLAY should be exposed");
        // Every phase that has a call-to-action button carries it right
        // alongside its overlay id, in the same entry — not in a second,
        // separately-maintained map that could drift out of sync.
        ["start", "paused", "levelclear", "victory", "gameover"].forEach((phase) => {
          const entry = PHASE_OVERLAY[phase];
          a.ok(entry && entry.overlay && entry.button,
            `${phase} should carry both its overlay and its button in one entry`);
        });
        a.ok(PHASE_OVERLAY.ready && PHASE_OVERLAY.ready.overlay && !PHASE_OVERLAY.ready.button,
          "ready shows an overlay but deliberately has no button of its own");
        a.eq(PHASE_OVERLAY.playing, null, "playing shows no overlay");
      },
    },
    {
      name: "#38 — a fast ball stacked with the difficulty ramp does not tunnel through the paddle",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        g.T.startLevel(g.T.CONFIG.progression.totalLevels - 1); // fastest level
        g.key("Space");
        g.T.applyPowerup({ type: "fast" });
        // Pin the mid-level ramp at its cap — the combination the original
        // "cannot tunnel" test never budgeted for.
        g.T.state.difficultyMult = g.T.CONFIG.difficulty.max;

        const ball = g.T.state.balls[0];
        const paddle = g.T.state.paddle;
        ball.x = paddle.x + g.T.paddleWidth() / 2;
        ball.y = paddle.y - ball.r - 1;
        ball.dx = 0;
        ball.dy = 1;
        ball.attached = false;

        g.frame(33); // the frame loop clamps dt to this

        a.lt(ball.dy, 0, "the ball crossed the paddle with no collision ever detected");
        a.lt(ball.y, paddle.y, "the ball should have been rewound to a bounce, not left past the paddle");
      },
    },
    {
      name: "#39 — the static HUD level markup matches the real level count",
      fn(a) {
        // updateHud() overwrites this on the very first frame (it runs once
        // unconditionally at boot), so the stale markup was only ever visible
        // for the instant before JS runs — check the raw source, not the
        // post-boot DOM, or a booted handle would mask the bug either way.
        const g = boot();
        const total = g.T.CONFIG.progression.totalLevels;
        a.match(HTML, new RegExp(`id="hud-level">1/${total}<`),
          "the pre-JS fallback text should already read the real level count, not a stale one");
      },
    },
    {
      name: "#42a — a qualifying score at game over detours through nameentry",
      fn(a) {
        const g = boot().start(); // fresh boot: empty hall-of-fame board
        g.T.state.score = 50;
        g.T.state.lives = 1;
        g.loseBall();
        a.eq(g.T.state.phase, "nameentry", "an empty board should let any positive score in");
        a.eq(g.shownOverlays()[0], "overlay-nameentry");
        a.eq(g.doc.activeElement, g.el("nameentry-input"),
          "the name field should be focused the same way every overlay's primary control is (#26)");
      },
    },
    {
      name: "#42b — a score of 0 never qualifies for the hall of fame",
      fn(a) {
        const g = boot().start();
        g.T.state.lives = 1;
        g.loseBall(); // state.score is still 0
        a.eq(g.T.state.phase, "gameover", "0 points should go straight to gameover, not prompt for a name");
      },
    },
    {
      name: "#42c — a full board only accepts a score that beats its lowest entry",
      fn(a) {
        const full = JSON.stringify(
          Array.from({ length: 10 }, (_, i) => ({ name: "CPU", score: 100 - i }))
        ); // lowest entry: 91

        const tie = boot({ storage: { "neonbreak-hall-of-fame": full } }).start();
        tie.T.state.score = 91; // ties the lowest — must not qualify
        tie.T.state.lives = 1;
        tie.loseBall();
        a.eq(tie.T.state.phase, "gameover", "a tie with the lowest entry should not bump it");

        const beats = boot({ storage: { "neonbreak-hall-of-fame": full } }).start();
        beats.T.state.score = 92; // beats the lowest by one point
        beats.T.state.lives = 1;
        beats.loseBall();
        a.eq(beats.T.state.phase, "nameentry", "a score that beats the lowest entry should qualify");
      },
    },
    {
      name: "#42d — submitting a name inserts it into the board in sorted order",
      fn(a) {
        const seeded = JSON.stringify([{ name: "AAA", score: 300 }, { name: "BBB", score: 100 }]);
        const g = boot({ storage: { "neonbreak-hall-of-fame": seeded } }).start();
        g.T.state.score = 200;
        g.T.state.lives = 1;
        g.loseBall();
        a.eq(g.T.state.phase, "nameentry");
        g.el("nameentry-input").value = "Ada";
        g.el("btn-nameentry-submit").click(1);
        a.eq(g.T.state.phase, "halloffame", "submitting should move on to the board");
        const list = g.T.state.hallOfFame;
        a.eq(JSON.stringify(list.map((e) => e.name)), JSON.stringify(["AAA", "Ada", "BBB"]),
          "the new entry should land between the one it beats and the one it doesn't");
        a.eq(g.store["neonbreak-hall-of-fame"], JSON.stringify(list), "the board should persist immediately");
      },
    },
    {
      // #76: an empty submission used to fall back to a "???" placeholder
      // rather than being rejected — superseded below.
      name: "#76a — an empty name submission is rejected, not saved as a placeholder",
      fn(a) {
        const g = boot().start();
        g.T.state.score = 10;
        g.T.state.lives = 1;
        g.loseBall();
        a.eq(g.T.state.phase, "nameentry");
        // nameentry-input's .value is never set — mimics submitting with nothing typed.
        g.el("btn-nameentry-submit").click(1);
        a.eq(g.T.state.phase, "nameentry", "an empty submission should not advance past nameentry");
        a.eq(g.T.state.hallOfFame.length, 0, "nothing should be saved to the board");
        a.includes(g.el("nameentry-error").textContent, String(g.T.CONFIG.hallOfFame.nameMin),
          "the validation message should explain the minimum length");
      },
    },
    {
      name: "#76b — a one- or two-character name is also rejected",
      fn(a) {
        const g = boot().start();
        g.T.state.score = 10;
        g.T.state.lives = 1;
        g.loseBall();
        g.el("nameentry-input").value = "ab";
        g.el("btn-nameentry-submit").click(1);
        a.eq(g.T.state.phase, "nameentry", "a two-character name should not advance past nameentry");
        a.eq(g.T.state.hallOfFame.length, 0, "nothing should be saved to the board");
      },
    },
    {
      name: "#76c — a three-character name is accepted, the minimum",
      fn(a) {
        const g = boot().start();
        g.T.state.score = 10;
        g.T.state.lives = 1;
        g.loseBall();
        g.el("nameentry-input").value = "abc";
        g.el("btn-nameentry-submit").click(1);
        a.eq(g.T.state.phase, "halloffame", "a three-character name should be accepted");
        a.eq(g.T.state.hallOfFame[0].name, "abc");
      },
    },
    {
      name: "#76d — a name past the 16-character max is truncated, not rejected",
      fn(a) {
        const g = boot().start();
        g.T.state.score = 10;
        g.T.state.lives = 1;
        g.loseBall();
        g.el("nameentry-input").value = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        g.el("btn-nameentry-submit").click(1);
        a.eq(g.T.state.phase, "halloffame");
        a.eq(g.T.state.hallOfFame[0].name, "ABCDEFGHIJKLMNOP", "should be clamped to nameMax (16) characters");
      },
    },
    {
      name: "#76e — a rejected submission clears once a valid name is typed and resubmitted",
      fn(a) {
        const g = boot().start();
        g.T.state.score = 10;
        g.T.state.lives = 1;
        g.loseBall();
        g.el("btn-nameentry-submit").click(1); // empty: rejected
        a.not(g.el("nameentry-error").textContent === "", "the error message should be showing");
        g.el("nameentry-input").value = "Rex";
        g.el("btn-nameentry-submit").click(1);
        a.eq(g.T.state.phase, "halloffame", "a valid resubmission should now go through");
        a.eq(g.el("nameentry-error").textContent, "", "the error message should be cleared");
      },
    },
    {
      name: "#42f — a submitted name containing HTML never gets interpreted as markup",
      fn(a) {
        const g = boot().start();
        g.T.state.score = 10;
        g.T.state.lives = 1;
        g.loseBall();
        g.el("nameentry-input").value = '<img src=x onerror="alert(1)">';
        g.el("btn-nameentry-submit").click(1);
        const rendered = g.el("hof-list").innerHTML;
        a.not(rendered.includes("<img"), "a raw <img> tag reached the rendered board");
        a.includes(rendered, "&lt;img", "the name should render as literal escaped text instead");
      },
    },
    {
      name: "#42g — the continue button routes back to victory or gameover depending on how the run ended",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        g.T.startLevel(g.T.CONFIG.progression.totalLevels - 1); // final level, so clearing it wins
        g.key("Space");
        g.T.state.score = 10;
        clearBricks(g);
        g.frame();
        a.eq(g.T.state.phase, "nameentry", "a qualifying score should still detour on a win");
        g.el("nameentry-input").value = "Win";
        g.el("btn-nameentry-submit").click(1);
        a.eq(g.T.state.phase, "halloffame");
        g.el("btn-hof-continue").click(1);
        a.eq(g.T.state.phase, "victory", "a win should still end on victory, not gameover, after the detour");
      },
    },
    {
      name: "#42h — the name field accepts a literal space instead of launching or firing",
      fn(a) {
        const g = boot().start();
        g.T.state.score = 10;
        g.T.state.lives = 1;
        g.loseBall();
        g.el("nameentry-input").focus();
        const ev = g.key("Space");
        a.not(ev.defaultPrevented, "Space should reach the input, not be swallowed for the ball/laser");
      },
    },
    {
      name: "#42i — pressing Enter in the name field submits, like every other overlay's focused control",
      fn(a) {
        const g = boot().start();
        g.T.state.score = 10;
        g.T.state.lives = 1;
        g.loseBall();
        g.el("nameentry-input").value = "Zed";
        g.key("Enter");
        a.eq(g.T.state.phase, "halloffame", "Enter should submit the name, same as clicking Valider/Submit");
        a.eq(g.T.state.hallOfFame[0].name, "Zed");
      },
    },
    {
      name: "#42j — the board never grows past CONFIG.hallOfFame.max",
      fn(a) {
        const full = JSON.stringify(
          Array.from({ length: 10 }, (_, i) => ({ name: "CPU", score: 200 - i }))
        );
        const g = boot({ storage: { "neonbreak-hall-of-fame": full } }).start();
        g.T.state.score = 500; // beats everything on the board
        g.T.state.lives = 1;
        g.loseBall();
        g.el("nameentry-input").value = "Top";
        g.el("btn-nameentry-submit").click(1);
        a.eq(g.T.state.hallOfFame.length, g.T.CONFIG.hallOfFame.max, "the board should stay capped at max");
        a.eq(g.T.state.hallOfFame[0].score, 500, "the new top score should be first");
        a.eq(g.T.state.hallOfFame[g.T.state.hallOfFame.length - 1].score, 192,
          "the lowest previous entry should have been pushed off the board");
      },
    },
    {
      name: "#43a — the hall of fame is reachable from the start screen without playing",
      fn(a) {
        const g = boot(); // fresh boot: still on "start", never played
        a.eq(g.T.state.phase, "start");
        g.el("btn-view-hof").click(1);
        a.eq(g.T.state.phase, "halloffame", "viewing the board should not require a run first");
        a.eq(g.shownOverlays()[0], "overlay-halloffame");
      },
    },
    {
      name: "#43b — viewing an empty board from the start screen shows the empty-board message",
      fn(a) {
        const g = boot();
        g.el("btn-view-hof").click(1);
        a.includes(g.el("hof-list").innerHTML, "hof-empty",
          "a fresh install with no entries yet should show the empty-board message, not a blank list");
      },
    },
    {
      name: "#43c — continuing from a board opened before playing returns to the start screen",
      fn(a) {
        const g = boot();
        g.el("btn-view-hof").click(1);
        g.el("btn-hof-continue").click(1);
        a.eq(g.T.state.phase, "start",
          "continue should return to where the board was opened from, not gameover");
      },
    },
    {
      name: "#43d — opening the board on demand never resets score or level",
      fn(a) {
        const g = boot().start();
        g.T.state.score = 40;
        g.T.state.levelIndex = 2;
        g.el("btn-view-hof").click(1);
        a.eq(g.T.state.score, 40, "viewing the board must not reset the score");
        a.eq(g.T.state.levelIndex, 2, "viewing the board must not reset the level");
      },
    },
    {
      name: "#43e — the continue button still routes a loss to gameover after the returnPhase refactor",
      fn(a) {
        const g = boot().start(); // fresh boot: empty hall-of-fame board
        g.T.state.score = 10;
        g.T.state.lives = 1;
        g.loseBall();
        a.eq(g.T.state.phase, "nameentry");
        g.el("nameentry-input").value = "Los";
        g.el("btn-nameentry-submit").click(1);
        a.eq(g.T.state.phase, "halloffame");
        g.el("btn-hof-continue").click(1);
        a.eq(g.T.state.phase, "gameover", "a loss should still end on gameover, not victory, after the detour");
      },
    },

    // -----------------------------------------------------------------------
    // #67 — global hall of fame
    // -----------------------------------------------------------------------
    {
      name: "#67a — an unreachable API leaves the local board in charge",
      async fn(a) {
        // boot() with no `api` option rejects every fetch, which is the state
        // every suite predating #67 runs in.
        const g = boot({ storage: { "neonbreak-hall-of-fame": JSON.stringify([{ name: "Loc", score: 90 }]) } });
        await g.settle();
        a.eq(g.T.state.globalScores, null, "a failed fetch must leave globalScores null, not []");
        g.el("btn-view-hof").click(1);
        a.includes(g.el("hof-list").innerHTML, "Loc", "the local board should still render");
        a.eq(g.el("hof-scope").textContent, "Scores de cet appareil — classement mondial indisponible");
      },
    },
    {
      name: "#67b — the world board replaces the local one once the API answers",
      async fn(a) {
        const g = boot({
          storage: { "neonbreak-hall-of-fame": JSON.stringify([{ name: "Loc", score: 90 }]) },
          api: () => ({ scores: [{ name: "Wld", score: 5000 }], token: "tok-1" }),
        });
        await g.settle();
        a.eq(g.T.state.globalScores.length, 1);
        g.el("btn-view-hof").click(1);
        const html = g.el("hof-list").innerHTML;
        a.includes(html, "Wld", "the world board should be the one shown");
        a.ok(!html.includes("Loc"), "the local board must not be mixed into the world one");
        a.eq(g.el("hof-scope").textContent, "Classement mondial");
      },
    },
    {
      name: "#67c — submitting posts the score with the token from the last board fetch",
      async fn(a) {
        const g = boot({ api: () => ({ scores: [], token: "tok-42" }) }).start();
        await g.settle();
        g.T.state.score = 700;
        g.T.state.lives = 1;
        g.loseBall();
        a.eq(g.T.state.phase, "nameentry");
        g.el("nameentry-input").value = "Ada";
        g.el("btn-nameentry-submit").click(1);
        await g.settle();
        const post = g.apiCalls.filter((c) => c.init && c.init.method === "POST").pop();
        a.ok(post, "submitting should POST to the API");
        a.eq(post.body.token, "tok-42");
        a.eq(post.body.name, "Ada");
        a.eq(post.body.score, 700);
      },
    },
    {
      name: "#67d — a session token is spent once, so a re-submit cannot replay it",
      async fn(a) {
        const g = boot({ api: () => ({ scores: [], token: "tok-9" }) }).start();
        await g.settle();
        g.T.state.score = 500;
        g.T.state.lives = 1;
        g.loseBall();
        g.el("nameentry-input").value = "Tok";
        g.el("btn-nameentry-submit").click(1);
        await g.settle();
        a.eq(g.T.state.sessionToken, null, "the token should be cleared once spent");
        const before = g.apiCalls.filter((c) => c.init && c.init.method === "POST").length;
        g.el("nameentry-input").value = "Tok"; // input.value was cleared by the successful submit above
        g.el("btn-nameentry-submit").click(1); // same handler, no fresh token behind it
        await g.settle();
        a.eq(
          g.apiCalls.filter((c) => c.init && c.init.method === "POST").length, before,
          "a second submit with no fresh token must not POST again"
        );
      },
    },
    {
      name: "#67e — the local board keeps its own ordering while the world board is showing",
      async fn(a) {
        // The regression: insertHallOfFameEntry() once took its splice index from
        // hallOfFameRank(), which now ranks against the world board. A score
        // ranking low globally would then be spliced into the local array at that
        // global index and leave it mis-sorted.
        //
        // The world board deliberately holds five entries that all beat the score
        // while the local board holds two. The buggy path returns the world rank
        // (5) and splices past the end of a two-entry array, appending instead of
        // inserting. A shorter world board would return an index that happens to
        // be correct locally too, and this test would prove nothing.
        const g = boot({
          storage: { "neonbreak-hall-of-fame": JSON.stringify([{ name: "A", score: 300 }, { name: "B", score: 100 }]) },
          api: () => ({
            scores: [9000, 8000, 7000, 6000, 5000].map((s, i) => ({ name: "W" + i, score: s })),
            token: "tok-3",
          }),
        }).start();
        await g.settle();
        g.T.state.score = 200; // between the two local entries, far below the world entry
        g.T.state.lives = 1;
        g.loseBall();
        g.el("nameentry-input").value = "Mid";
        g.el("btn-nameentry-submit").click(1);
        const local = g.T.state.hallOfFame.map((e) => e.score);
        a.eq(JSON.stringify(local), JSON.stringify([300, 200, 100]), "the local board must stay sorted descending");
      },
    },
    {
      name: "#67f — a run played offline still reaches the local board",
      async fn(a) {
        const g = boot().start(); // no api: every fetch rejects
        await g.settle();
        g.T.state.score = 250;
        g.T.state.lives = 1;
        g.loseBall();
        a.eq(g.T.state.phase, "nameentry", "qualification should fall back to the local board");
        g.el("nameentry-input").value = "Solo";
        g.el("btn-nameentry-submit").click(1);
        await g.settle();
        a.eq(g.T.state.hallOfFame[0].name, "Solo", "the score must not be lost just because the API was down");
        a.eq(g.T.state.phase, "halloffame");
      },
    },
    {
      name: "#67g — the board re-renders with the server's list after a successful submit",
      async fn(a) {
        let posted = false;
        const g = boot({
          api: (url, init) => {
            if (init && init.method === "POST") { posted = true; return { scores: [{ name: "Srv", score: 4242 }] }; }
            return { scores: [], token: "tok-7" };
          },
        }).start();
        await g.settle();
        g.T.state.score = 300;
        g.T.state.lives = 1;
        g.loseBall();
        g.el("nameentry-input").value = "Zoe";
        g.el("btn-nameentry-submit").click(1);
        await g.settle();
        a.ok(posted, "the submit should have reached the API");
        a.includes(g.el("hof-list").innerHTML, "Srv", "the list should show what the server returned");
        a.includes(g.el("hof-list").innerHTML, "4242");
      },
    },

    // -----------------------------------------------------------------------
    // #49 — explosive bricks
    // -----------------------------------------------------------------------
    {
      name: "#49a — destroying an explosive takes the eight cells around it, and nothing further",
      fn(a) {
        const { at, blast, deadCells } = gridLevel();
        at(1, 4).type = "X";
        blast(at(1, 4));
        a.eq(
          deadCells().join(" "),
          "0,3 0,4 0,5 1,3 1,4 1,5 2,3 2,4 2,5",
          "the blast should clear exactly the 3x3 block centred on the explosive"
        );
      },
    },
    {
      name: "#49b — the blast does not reach two cells away",
      fn(a) {
        // Guards the geometric neighbour test's tolerance: it is a cell pitch
        // plus 1px, and must not creep into the next ring if the layout
        // constants ever change.
        const { at, blast } = gridLevel();
        at(1, 4).type = "X";
        blast(at(1, 4));
        a.ok(at(1, 2).alive, "a brick two columns away must survive");
        a.ok(at(1, 6).alive, "and on the other side too");
        a.ok(at(3, 4).alive, "a brick two rows away must survive");
      },
    },
    {
      name: "#49c — a blast leaves indestructible walls standing",
      fn(a) {
        const { at, blast } = gridLevel();
        at(1, 4).type = "X";
        at(1, 3).type = "#";
        at(1, 3).hp = Infinity;
        blast(at(1, 4));
        a.ok(at(1, 3).alive, "an explosion must not clear what the ball itself cannot");
        a.ok(!at(1, 5).alive, "while an ordinary neighbour still goes");
      },
    },
    {
      name: "#49d — silver survives one blast and falls to a second",
      fn(a) {
        // The blast deals damage rather than deleting, so brick durability keeps
        // meaning what it means everywhere else.
        const { at, blast } = gridLevel();
        at(1, 4).type = "X";
        at(0, 4).type = "S";
        at(0, 4).hp = 2;
        blast(at(1, 4));
        a.ok(at(0, 4).alive, "silver should take the first blast without dying");
        a.eq(at(0, 4).type, "Sc", "and should show as damaged");

        at(2, 4).type = "X";
        at(2, 4).alive = true;
        at(2, 4).hp = 1;
        // A second explosive directly under the damaged silver, two rows down,
        // is not adjacent to it — so revive the cell between them and blast that.
        at(1, 4).alive = true;
        at(1, 4).hp = 1;
        at(1, 4).type = "X";
        blast(at(1, 4));
        a.ok(!at(0, 4).alive, "the second blast should finish the damaged silver");
      },
    },
    {
      name: "#49e — explosives chain into each other and the cascade terminates",
      fn(a) {
        const { at, blast, deadCells } = gridLevel();
        at(1, 4).type = "X";
        at(1, 5).type = "X"; // adjacent, so the first blast sets off the second
        blast(at(1, 4));
        const dead = deadCells();
        a.ok(dead.includes("1,5"), "the adjacent explosive should have gone up too");
        a.ok(dead.includes("0,6") && dead.includes("1,6") && dead.includes("2,6"),
          "and taken its own neighbours with it, which the first blast could not reach");
        a.eq(dead.length, 12, "the two overlapping 3x3 blocks cover twelve cells");
      },
    },
    {
      name: "#49f — remainingBricks matches what the cascade actually destroyed",
      fn(a) {
        // The level-clear check reads remainingBricks, so a blast that skipped
        // the counter would either end the level early or make it unclearable.
        const { g, at, blast, deadCells } = gridLevel();
        const before = g.T.state.remainingBricks;
        at(1, 4).type = "X";
        at(1, 5).type = "X";
        blast(at(1, 4));
        a.eq(g.T.state.remainingBricks, before - deadCells().length,
          "every brick the cascade cleared must be one off the counter");
      },
    },

    // -----------------------------------------------------------------------
    // #51 — regenerating bricks, and readable silver damage
    // -----------------------------------------------------------------------
    {
      name: "#51a — a regenerating brick comes back after its delay",
      fn(a) {
        const { g, at, blast, idle } = gridLevel();
        at(1, 4).type = "R";
        at(1, 4).regenLeft = g.T.CONFIG.regen.max;
        blast(at(1, 4));
        a.ok(!at(1, 4).alive, "it should go down when hit like any other brick");
        a.gt(at(1, 4).regenTimer, 0, "and should be counting back");

        idle(g.T.CONFIG.regen.delay - 1);
        a.ok(!at(1, 4).alive, "it must not return early");
        idle(1.5);
        a.ok(at(1, 4).alive, "it should be standing again once the delay elapsed");
        a.eq(at(1, 4).hp, 1, "and be hittable again");
      },
    },
    {
      name: "#51b — the regen timer does not drain while paused",
      fn(a) {
        // Same class of bug as #4: a timer that runs behind the pause screen.
        const { g, at, blast, idle } = gridLevel();
        at(1, 4).type = "R";
        at(1, 4).regenLeft = g.T.CONFIG.regen.max;
        blast(at(1, 4));
        const pending = at(1, 4).regenTimer;

        g.key("KeyP");
        g.run(30);
        a.ok(!at(1, 4).alive, "the brick returned while the game was parked on the pause screen");
        a.eq(at(1, 4).regenTimer, pending, "the timer advanced while paused");

        g.key("KeyP");
        idle(pending + 0.5);
        a.ok(at(1, 4).alive, "and should still return after its full delay of actual play");
      },
    },
    {
      name: "#51c — remainingBricks goes back up when the brick returns",
      fn(a) {
        const { g, at, blast, idle } = gridLevel();
        at(1, 4).type = "R";
        at(1, 4).regenLeft = g.T.CONFIG.regen.max;
        const before = g.T.state.remainingBricks;
        blast(at(1, 4));
        a.eq(g.T.state.remainingBricks, before - 1, "it counts as cleared while it is down");
        idle(g.T.CONFIG.regen.delay + 0.5);
        a.eq(g.T.state.remainingBricks, before, "and counts again once it is back");
      },
    },
    {
      name: "#51d — a level finished while the brick is down still clears",
      fn(a) {
        // The finding's actual requirement: the brick returns "unless the level
        // is cleared first". Since remainingBricks stays down while it is down,
        // clearing everything else must end the level rather than waiting.
        const { g, at, blast, idle } = gridLevel();
        at(1, 4).type = "R";
        at(1, 4).regenLeft = g.T.CONFIG.regen.max;
        blast(at(1, 4));
        // Clear every other brick outright, leaving only the pending one.
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 10; c++) {
            if (at(r, c).alive) { at(r, c).alive = false; g.T.state.remainingBricks -= 1; }
          }
        }
        g.frame();
        a.eq(g.T.state.phase, "levelclear", "the level should clear rather than wait for the return");
      },
    },
    {
      name: "#51e — it stops returning after CONFIG.regen.max times",
      fn(a) {
        // Not a difficulty detail: uncapped, this brick is an unlimited supply
        // of points, and since #67 the leaderboard is global.
        const { g, at, blast, idle } = gridLevel();
        const max = g.T.CONFIG.regen.max;
        at(1, 4).type = "R";
        at(1, 4).regenLeft = max;
        for (let i = 0; i < max; i++) {
          blast(at(1, 4));
          idle(g.T.CONFIG.regen.delay + 0.5);
          a.ok(at(1, 4).alive, `return ${i + 1} of ${max} should have happened`);
        }
        blast(at(1, 4));
        a.eq(at(1, 4).regenLeft, 0, "all returns should be spent");
        a.eq(at(1, 4).regenTimer, 0, "so no further return should be scheduled");
        idle(g.T.CONFIG.regen.delay * 2);
        a.ok(!at(1, 4).alive, "the brick must stay down once its returns are spent");
      },
    },
    {
      name: "#51f — damaged silver is drawn differently from intact silver",
      fn(a) {
        // The finding's second half: damage was signalled only by swapping one
        // grey for another. The crack overlay means extra canvas work, which is
        // the only handle the stub gives us on what was actually drawn.
        const { g, at } = gridLevel();
        for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) at(r, c).alive = false;
        at(1, 4).alive = true;
        at(1, 4).type = "S";
        g.counters.reset();
        g.frame();
        const intact = g.counters.canvasOps;

        at(1, 4).type = "Sc";
        g.counters.reset();
        g.frame();
        a.gt(g.counters.canvasOps, intact,
          "cracked silver should draw more than intact silver, not just recolour it");
      },
    },

    // -----------------------------------------------------------------------
    // #52 — mystery bricks
    // -----------------------------------------------------------------------
    {
      name: "#52a — a mystery brick becomes a real type when first struck",
      fn(a) {
        const g = mysteryBoard(999);
        const resolved = g.T.state.bricks.filter((b) => b.type !== "?");
        a.gt(resolved.length, 0, "play should have revealed some of them");
        const allowed = ["1", "2", "3", "4", "S", "Sc", "X", "R", "#"];
        const strays = resolved.filter((b) => !allowed.includes(b.type));
        a.empty(strays.map((b) => b.type), "a mystery resolved into a type that does not exist");
      },
    },
    {
      name: "#52b — a mystery that becomes a wall comes off the clearable count",
      fn(a) {
        // The softlock. buildLevel() counts every "?" as clearable, because at
        // build time it has 1hp like anything else. A mystery that resolves into
        // an indestructible wall can never be cleared, so if the count does not
        // come down with it the level can never reach zero and the run is stuck
        // with nothing left to hit.
        const g = mysteryBoard(999);
        const walls = g.T.state.bricks.filter((b) => b.type === "#").length;
        // Without this the test would still pass if the seed stopped producing a
        // wall — quietly checking nothing, which is the failure mode that matters
        // most here.
        a.gt(walls, 0, "this seed must actually produce a wall or the case is untested");
        a.eq(g.T.state.remainingBricks, standingDestroyable(g),
          "the counter must track only what can still be destroyed");
      },
    },
    {
      name: "#52c — the count stays honest across many different boards",
      fn(a) {
        let wallsSeen = 0;
        for (const seed of [1, 7, 42, 999, 12345, 31337]) {
          const g = mysteryBoard(seed);
          wallsSeen += g.T.state.bricks.filter((b) => b.type === "#").length;
          a.eq(g.T.state.remainingBricks, standingDestroyable(g),
            `counter drifted from what is actually destroyable (seed ${seed})`);
        }
        a.gt(wallsSeen, 0, "no seed produced a wall, so the interesting case went untested");
      },
    },
    {
      name: "#52d — the revealing hit lands on whatever the brick became",
      fn(a) {
        // Resolving happens at the top of brickHit(), so the same hit then
        // applies to the new type rather than being spent on the reveal.
        const g = mysteryBoard(999);
        const silver = g.T.state.bricks.filter((b) => b.type === "S" || b.type === "Sc");
        a.gt(silver.length, 0, "this seed must produce silver or the case is untested");
        a.empty(
          silver.filter((b) => b.type === "S" && b.hp === 2).map(() => "undamaged"),
          "a mystery that turned into silver should have taken the revealing hit, not shrugged it off"
        );
      },
    },
    {
      name: "#52e — a board of mystery bricks can still be cleared",
      fn(a) {
        // End to end: whatever the board resolves into, destroying everything
        // destroyable must drive the counter to zero and clear the level. If a
        // resolved wall were still counted this would hang at a non-zero count.
        const g = mysteryBoard(999, 20);
        for (const b of g.T.state.bricks) {
          // Bricks already down and waiting to regenerate were taken off the
          // counter when they fell, so cancelling their return must not
          // decrement again — only what is standing is still counted.
          b.regenTimer = 0;
          b.regenLeft = 0;
          if (b.alive && b.hp !== Infinity) {
            b.alive = false;
            g.T.state.remainingBricks -= 1;
          }
        }
        a.eq(g.T.state.remainingBricks, 0, "clearing everything destroyable must reach zero");
        g.frame();
        a.eq(g.T.state.phase, "levelclear", "and the level should then clear");
      },
    },

    // -----------------------------------------------------------------------
    // #58 — impact feedback: screen shake, hit-stop, paddle squash
    // -----------------------------------------------------------------------
    {
      name: "#58a — an explosion shakes the screen, and the shake settles",
      fn(a) {
        const { g, at, blast, idle } = gridLevel();
        at(1, 4).type = "X";
        a.eq(g.T.state.shake.remaining, 0, "nothing should be shaking before the blast");
        blast(at(1, 4));
        a.gt(g.T.state.shake.remaining, 0, "an explosion should kick the camera");
        a.gt(g.T.state.shake.mag, 0);
        idle(g.T.CONFIG.impact.explosionShake.duration + 0.2);
        a.eq(g.T.state.shake.remaining, 0, "and it must settle rather than rattle forever");
      },
    },
    {
      name: "#58b — hit-stop freezes the simulation for a few frames, then releases it",
      fn(a) {
        const { g, at, blast } = gridLevel();
        at(1, 4).type = "X";
        blast(at(1, 4));
        a.gt(g.T.state.hitStop, 0, "a blast should freeze time briefly");
        const ball = g.T.state.balls[0];
        const held = ball.y;
        g.frame();
        a.eq(ball.y, held, "nothing may move while the freeze lasts");

        // The freeze is spent from real elapsed time, so it ends on its own —
        // a freeze that only a game event could clear would be a hang.
        let frames = 0;
        while (g.T.state.hitStop > 0 && frames < 30) { g.frame(); frames++; }
        a.lt(frames, 30, "the freeze must run out by itself, within a handful of frames");
        const resumed = ball.y;
        g.frame();
        a.ne(ball.y, resumed, "and play must carry on afterwards");
      },
    },
    {
      name: "#58c — a paddle bounce squashes the paddle, and it springs back",
      fn(a) {
        const g = boot().start();
        const paddle = g.T.state.paddle;
        const ball = g.T.state.balls[0];
        // Drop the ball onto the paddle's top face from just above it, which is
        // the branch of updateBalls that steers a bounce.
        ball.attached = false;
        ball.x = paddle.x + 20;
        ball.y = paddle.y - ball.r - 1;
        ball.dx = 0;
        ball.dy = 1;
        ball.speed = 200;
        g.frame();
        a.gt(g.T.state.paddleSquash, 0, "landing on the paddle should squash it");

        g.runAlive(g.T.CONFIG.impact.squashDuration + 0.1);
        a.eq(g.T.state.paddleSquash, 0, "and the squash should spring all the way back");
      },
    },
    {
      name: "#58d — prefers-reduced-motion turns the whole impact layer off",
      fn(a) {
        // The finding made this a condition of shipping: the shake is exactly
        // the kind of motion the setting exists to suppress.
        const { g, at, blast } = gridLevel({ reducedMotion: true });
        at(1, 4).type = "X";
        blast(at(1, 4));
        a.ok(!at(1, 4).alive, "the explosion itself must still happen");
        a.eq(g.T.state.shake.remaining, 0, "but it must not shake the screen");
        a.eq(g.T.state.hitStop, 0, "nor freeze any frames");
        a.eq(g.T.state.paddleSquash, 0, "nor squash the paddle");
      },
    },
    {
      name: "#58e — a cascade of explosions cannot stall the game",
      fn(a) {
        // Hit-stop is set, not accumulated. Summed across a chain it would put
        // the game to sleep for a third of a second and read as a hang.
        const { g, at, blast, deadCells } = gridLevel();
        [2, 3, 4, 5, 6].forEach((c) => { at(1, c).type = "X"; });
        blast(at(1, 4));
        a.gt(deadCells().length, 9, "this must actually be a chain, not a single blast");
        a.lte(g.T.state.hitStop, g.T.CONFIG.impact.hitStop,
          "five chained explosives must freeze the game no longer than one does");
      },
    },
    {
      name: "#58f — drawing the shake consumes no randomness",
      fn(a) {
        // The offset is derived from the shake's own timer rather than rand()
        // on purpose. Rolling for it inside draw() would make what the game
        // rolls — power-up drops, mystery resolutions — depend on how many
        // frames it happened to paint.
        const { g, at, blast } = gridLevel();
        at(1, 4).type = "X";
        blast(at(1, 4));
        a.gt(g.T.state.shake.remaining, 0, "the frame under test must be a shaking one");

        const real = Math.random;
        let rolls = 0;
        Math.random = () => { rolls++; return real(); };
        try {
          g.frame(); // frozen by the blast, so this frame is draw() and nothing else
        } finally {
          Math.random = real;
        }
        a.eq(rolls, 0, "painting a shaking frame must not touch the RNG stream");
      },
    },

    // -----------------------------------------------------------------------
    // #59 — music bed, per-type brick voices, combo pitch ladder
    //
    // Sound is only observable as the notes the game queues, which the stub
    // records (g.notes). Two facts make the assertions below readable: the bed
    // only plays while the phase is "playing", and at a broken combo it is the
    // bass alone — triangle notes below the level's root, which for level 0 is
    // 220 Hz. So "notes above 220 Hz" is exactly the sound effects, and
    // "triangle notes above 220 Hz" exactly the brick voice under test.
    // -----------------------------------------------------------------------
    {
      name: "#59a — the music bed runs during play and stops when the game does",
      fn(a) {
        const g = boot();
        g.run(1);
        a.empty(g.notes, "the start screen must be silent — nothing has been played yet");

        g.start();
        // Park the ball on the paddle: every note from here is the bed itself,
        // with no brick hits mixed in.
        g.T.state.balls.forEach((b) => { b.attached = true; });
        const before = g.notes.length;
        g.run(2);
        a.gt(g.notes.length - before, 3, "the bed should have queued notes during play");

        g.key("KeyP");
        const paused = g.notes.length;
        g.run(2);
        a.eq(g.notes.length, paused, "a paused game must not go on playing music");

        g.key("KeyP");
        g.run(2);
        a.gt(g.notes.length, paused, "and resuming must bring it back");
      },
    },
    {
      name: "#59b — voices join as the combo climbs, and leave once it breaks",
      fn(a) {
        const g = boot().start();
        g.T.state.balls.forEach((b) => { b.attached = true; });
        const over = (seconds) => {
          const before = g.notes.length;
          g.run(seconds);
          return g.notes.length - before;
        };

        g.T.state.combo = 0;
        const bare = over(2);
        g.T.state.combo = 20; // past every threshold in CONFIG.music.voiceCombo
        const full = over(2);
        a.gt(full, bare * 2, `a long streak should thicken the arrangement (${bare} -> ${full})`);

        // Voices leave slowly — a combo dies on every paddle touch, and an
        // arrangement that dropped one each time would flicker.
        g.T.state.combo = 0;
        over(1);
        a.gt(over(2), bare, "one paddle touch must not strip the arrangement instantly");
        over(10);
        a.lt(over(2), full, "but a streak that stays broken should thin back out");
      },
    },
    {
      name: "#59c — mute silences the music as well as the sound effects",
      fn(a) {
        const g = boot({ storage: { "neonbreak-muted": "1" } }).start();
        g.runAlive(2);
        a.empty(g.notes, "a muted game must not queue a single note");

        g.el("btn-mute").click(1);
        // Parked on the paddle, so the only thing left that can sound is the bed.
        g.T.state.balls.forEach((b) => { b.attached = true; });
        g.run(2);
        a.gt(g.notes.length, 0, "unmuting mid-play should bring the music back");
      },
    },
    {
      name: "#59d — each brick type is struck in its own voice",
      fn(a) {
        const { g, at, blast } = gridLevel();
        // Above the root is the brick; below it is the bass — see the note above.
        const struck = (brick, type) => {
          if (type) {
            brick.type = type;
            brick.hp = type === "#" ? Infinity : type === "S" ? 2 : 1;
          }
          g.T.state.combo = 0; // same rung of the ladder for every type
          const from = g.notes.length;
          blast(brick);
          return g.notes.slice(from);
        };
        const above = (list) => list.filter((n) => n.freq > 220);

        const cyan = above(struck(at(3, 0), "1"));
        const lime = above(struck(at(3, 1), "4"));
        a.eq(cyan.length, 1, "destroying a brick should sound one note");
        a.eq(lime.length, 1);
        a.ne(cyan[0].freq, lime[0].freq, "two brick types sounded at the same pitch");
        a.ne(cyan[0].type, lime[0].type, "two brick types sounded in the same timbre");

        // Silver rings rather than beeps: a second oscillator, detuned.
        const silver = above(struck(at(3, 2), "S"));
        a.eq(silver.length, 2, "silver should ring — two detuned oscillators");
        a.ne(silver[1].detune, 0);

        // A wall refuses: a low thud that slides down, and nothing bright.
        const wall = struck(at(3, 3), "#");
        a.empty(above(wall), "an indestructible wall must not sound like a hit");
        a.ok(wall.some((n) => n.slide > 0 && n.slide < n.freq),
          "the wall thud should slide downward");
      },
    },
    {
      name: "#59e — consecutive hits climb a pitch ladder, which then holds",
      fn(a) {
        const { g, at, blast } = gridLevel();
        // Row 3 of level 0 is ten bricks of one type, so every difference in
        // pitch below comes from the combo and nothing else.
        const climb = [];
        for (let c = 0; c < 10; c++) {
          const from = g.notes.length;
          blast(at(3, c));
          const voice = g.notes.slice(from).filter((n) => n.type === "triangle" && n.freq > 220);
          a.eq(voice.length, 1, `hit ${c + 1} should have sounded exactly once`);
          climb.push(voice[0].freq);
        }
        a.eq(g.T.state.combo, 10, "the streak must not have been broken by a paddle touch");
        for (let i = 1; i < climb.length; i++) {
          a.gt(climb[i], climb[i - 1], `hit ${i + 1} did not climb above hit ${i}`);
        }
        a.lt(climb[climb.length - 1] / climb[0], 8,
          "the ladder has to stop climbing somewhere, or a long streak leaves the audible range");

        // And it does stop: row 2 is a second single-type row, so two hits at
        // combos past the top of the ladder are comparable to each other.
        const atCombo = (brick, combo) => {
          g.T.state.combo = combo;
          const from = g.notes.length;
          blast(brick);
          return g.notes.slice(from).filter((n) => n.type === "triangle" && n.freq > 220)[0].freq;
        };
        a.eq(atCombo(at(2, 1), 60), atCombo(at(2, 0), 30),
          "past the top of the ladder the pitch should hold rather than keep rising");
      },
    },
    {
      name: "#59f — a long stall resyncs the bed instead of queuing every missed beat",
      fn(a) {
        const g = boot().start();
        g.T.state.balls.forEach((b) => { b.attached = true; });
        g.run(1);
        const before = g.notes.length;
        g.clock += 30000; // 30s of audio clock with no frames — a backgrounded tab
        g.frame();
        a.lt(g.notes.length - before, 10,
          "the scheduler caught up note by note; 30 seconds of bar would arrive at once");
      },
    },
    {
      name: "#59g — the music consumes no randomness",
      fn(a) {
        // Same hazard as #58f: rolling for a note would make what the game rolls
        // — drop chances, mystery resolutions — depend on how long it played.
        const g = boot().start();
        g.T.state.balls.forEach((b) => { b.attached = true; });
        const real = Math.random;
        let rolls = 0;
        Math.random = () => { rolls++; return real(); };
        try {
          g.run(3);
        } finally {
          Math.random = real;
        }
        a.eq(rolls, 0, "queuing the bed must not touch the RNG stream");
      },
    },

    // -----------------------------------------------------------------------
    // #70 — the bed is a phrase with a pulse, and the material belongs to the act
    //
    // Level 0 is act I, which plays at the base tempo with the voices #59
    // shipped — so the arithmetic below (a step is 60/tempo/4 seconds) holds
    // exactly there, and only there.
    // -----------------------------------------------------------------------
    {
      name: "#70a — the bed is a phrase, not one bar looped forever",
      fn(a) {
        const g = boot().start();
        // Park the ball and buy the whole arrangement before the first frame,
        // so every note from here belongs to the bed and the intensity never
        // moves under the measurement.
        g.T.state.balls.forEach((b) => { b.attached = true; });
        g.T.state.combo = 20;

        const stepDur = 60 / g.T.CONFIG.music.tempo / 4;
        const barDur = stepDur * g.T.MUSIC_STEPS;
        g.run(barDur * (g.T.MUSIC_BARS + 1) + 0.3);

        // The bed starts on step 0 of bar 0, so the first note dates the phrase.
        const t0 = g.notes[0].at;
        const bar = (i) => g.notes
          .filter((n) => n.at >= t0 + i * barDur - 1e-6 && n.at < t0 + (i + 1) * barDur - 1e-6)
          .map((n) => Math.round((n.at - t0 - i * barDur) / stepDur) +
                      ":" + n.type + ":" + Math.round(n.freq))
          .join(" ");

        const bars = [];
        for (let i = 0; i < g.T.MUSIC_BARS; i++) bars.push(bar(i));
        a.ok(bars.every((b) => b.length > 0), "every bar of the phrase should have sounded");
        // The whole point of #70: at 132bpm one bar is 1.8 seconds, and a level
        // is minutes long.
        a.eq(new Set(bars).size, g.T.MUSIC_BARS,
          `the phrase should not repeat inside itself (${new Set(bars).size} distinct bars)`);
        a.eq(bar(g.T.MUSIC_BARS), bars[0], "and it must come back round rather than wander off");
      },
    },
    {
      name: "#70b — a kick carries the pulse whatever the combo, and the hat is bought with it",
      fn(a) {
        const g = boot().start();
        g.T.state.balls.forEach((b) => { b.attached = true; });
        g.T.state.combo = 0;
        g.run(8);

        const kicks = g.notes.filter((n) => n.type === "sine" && n.freq < 220 && n.slide > 0);
        a.gt(kicks.length, 8,
          "the kick is unconditional — it is what lets the melodic voices thin out");
        a.empty(g.notes.filter((n) => n.type === "noise"), "the hat has to be earned");

        g.T.state.combo = 20;
        const from = g.notes.length;
        g.run(8);
        const hats = g.notes.slice(from).filter((n) => n.type === "noise");
        a.gt(hats.length, 8, "a streak should buy the hat");
        a.gt(hats[0].filterFreq, 2000, "a hat is noise band-limited high, not a rumble");
        a.gt(hats[0].vol, 0);
      },
    },
    {
      name: "#70c — the score turns over with the act, not with every level",
      fn(a) {
        const bedOf = (level) => {
          const g = boot().start();
          g.T.startLevel(level);
          g.key("Space");
          g.T.state.balls.forEach((b) => { b.attached = true; });
          g.T.state.combo = 20;
          g.notes.length = 0;
          g.run(3);
          return g.notes;
        };
        // One step is the closest two notes ever get, so the tempo is readable
        // off the notes themselves without the test knowing the act's multiplier.
        const stepMs = (notes) => {
          const times = Array.from(new Set(notes.map((n) => n.at))).sort((x, y) => x - y);
          let min = Infinity;
          for (let i = 1; i < times.length; i++) min = Math.min(min, times[i] - times[i - 1]);
          return Math.round(min * 1000);
        };
        const voices = (notes) => Array.from(new Set(notes.map((n) => n.type))).sort().join(",");

        const one = bedOf(0);      // act I
        const three = bedOf(4);    // act III — a different backdrop (#60)
        a.ne(stepMs(one), stepMs(three), "a new act should not run at the same tempo");
        a.ne(voices(one), voices(three), "nor in the same voices");

        // Within an act the material holds: level 2 is level 1 in a new key, and
        // a key change across a level break is not something anyone hears.
        const oneAgain = bedOf(1);
        a.eq(stepMs(oneAgain), stepMs(one));
        a.eq(voices(oneAgain), voices(one));
      },
    },
    {
      name: "#70d — a longer phrase and a noise buffer still roll no dice",
      fn(a) {
        // #59g, extended to cover the two things #70 added: the phrase itself,
        // and the sample buffer behind the hat — filled from seededRandom() for
        // exactly this reason.
        const g = boot().start();
        g.T.state.balls.forEach((b) => { b.attached = true; });
        g.T.state.combo = 20; // the hat included; the buffer is built on its first hit
        const real = Math.random;
        let rolls = 0;
        Math.random = () => { rolls++; return real(); };
        try {
          g.run(20); // more than one full phrase
        } finally {
          Math.random = real;
        }
        a.gt(g.notes.filter((n) => n.type === "noise").length, 0,
          "the run has to have reached the noise path for this to prove anything");
        a.eq(rolls, 0, "queuing the bed must not touch the RNG stream");
      },
    },

    // -----------------------------------------------------------------------
    // #65 — achievements
    // -----------------------------------------------------------------------
    {
      name: "#65a — an achievement unlocks once, not once a frame, and survives a reload",
      fn(a) {
        const { g, at, blast } = gridLevel();
        a.empty(g.T.state.achievements, "a fresh install has unlocked nothing");

        blast(at(3, 0));
        a.includes(g.T.state.achievements, "firstCrack", "the first brick should unlock the first one");
        a.eq(g.store["neonbreak-achievements"], JSON.stringify(["firstCrack"]),
          "and it should have been written straight away, not at the end of the run");

        // The check runs every frame; the unlock must not.
        const toasts = g.T.state.achToasts.length;
        g.T.state.balls.forEach((b) => { b.attached = true; });
        g.run(1);
        a.eq(g.T.state.achievements.filter((id) => id === "firstCrack").length, 1,
          "a predicate that stays true must not unlock again on the next frame");
        a.eq(g.T.state.achToasts.length, toasts, "nor queue a second banner");

        const reloaded = boot({ storage: g.store });
        a.includes(reloaded.T.state.achievements, "firstCrack", "it should still be unlocked next visit");
      },
    },
    {
      name: "#65b — a jumped run unlocks nothing, and the screen says why",
      fn(a) {
        const g = boot();
        chord(g);
        g.el("leveljump-input").value = "5";
        g.el("btn-leveljump-go").click(1);
        g.key("Space");
        // Conditions that would unlock several at once on an ordinary run.
        g.T.state.achStats.bricks = 100;
        g.T.state.combo = 30;
        g.T.state.lives = g.T.state.maxLives;
        g.run(1);
        a.empty(g.T.state.achievements, "#69's exclusion covers achievements too");
        a.not(g.store["neonbreak-achievements"], "and nothing should have been persisted");

        g.el("btn-view-ach").click(1);
        a.eq(g.T.state.phase, "achievements");
        a.eq(g.el("ach-jumped").textContent, g.T.t("achievements.jumped"),
          "a silent exclusion is indistinguishable from a bug — that was #72");

        // And an ordinary run in the same conditions does unlock.
        const plain = boot().start();
        plain.T.state.combo = 30;
        plain.run(1);
        a.includes(plain.T.state.achievements, "untouchedTen");
      },
    },
    {
      name: "#65c — storage of the wrong shape leaves an empty set rather than breaking the game",
      fn(a) {
        // Same hazard loadHallOfFame() guards: valid JSON that is not what we
        // put there — a manual edit, another app sharing the origin.
        a.empty(boot({ storage: { "neonbreak-achievements": '{"nope":1}' } }).T.state.achievements);
        a.empty(boot({ storage: { "neonbreak-achievements": "not json at all" } }).T.state.achievements);
        a.empty(boot({ storage: { "neonbreak-achievements": "[1,2,3]" } }).T.state.achievements,
          "entries that are not strings are not ids");

        // An id that is no longer in the roster is dropped, so retiring an
        // achievement cannot leave a row nothing can render.
        const g = boot({ storage: { "neonbreak-achievements": '["firstCrack","retiredLongAgo"]' } });
        a.eq(g.T.state.achievements.join(","), "firstCrack");
        g.el("btn-view-ach").click(1);
        a.includes(g.el("ach-list").innerHTML, g.T.t("ach.firstCrack.name"));
      },
    },
    {
      name: "#65d — the layer is presentation: unlocking changes nothing the game simulates",
      fn(a) {
        // Same seed, same inputs, once with everything already unlocked (so
        // nothing can fire) and once from scratch (so a dozen do).
        const every = JSON.stringify(boot().T.ACHIEVEMENTS.map((x) => x.id));
        const play = (storage) => {
          const g = boot({ seed: 4242, storage: storage }).start();
          g.runAlive(6);
          return {
            score: g.T.state.score,
            bricks: g.T.state.remainingBricks,
            drops: g.T.state.drops.length,
            lives: g.T.state.lives,
            ball: Math.round(g.T.state.balls.length && g.T.state.balls[0].x * 1000)
          };
        };
        const unlocking = play({});
        const quiet = play({ "neonbreak-achievements": every });
        a.eq(JSON.stringify(unlocking), JSON.stringify(quiet),
          "an unlock must not move the ball, the score, the drops or anything else");
      },
    },
    {
      name: "#65e — every achievement in the roster has a name and a condition in both languages",
      fn(a) {
        const { ACHIEVEMENTS, STRINGS, SUPPORTED_LANGS } = boot().T;
        const missing = [];
        ACHIEVEMENTS.forEach((ach) => {
          SUPPORTED_LANGS.forEach((lang) => {
            ["name", "desc"].forEach((part) => {
              const key = "ach." + ach.id + "." + part;
              if (!(key in STRINGS[lang])) missing.push(lang + ":" + key);
            });
          });
        });
        a.empty(missing, `roster entries with no string: ${missing.join(", ")}`);
        a.gt(ACHIEVEMENTS.length, 0, "an empty roster would pass the above vacuously");
        // Ids are what the persisted file holds, so a duplicate is a silent
        // overwrite rather than a visible bug.
        a.eq(new Set(ACHIEVEMENTS.map((x) => x.id)).size, ACHIEVEMENTS.length, "duplicate id in the roster");
      },
    },
    {
      name: "#65f — the roster is reachable from the end screens and returns to them",
      fn(a) {
        const g = boot({ storage: { "neonbreak-hall-of-fame": FULL_HOF } }).start();
        g.T.state.score = 30;
        g.T.state.lives = 1;
        g.loseBall();
        a.eq(g.T.state.phase, "gameover");
        a.eq(g.doc.activeElement, g.el("btn-restart"), "restart stays the call to action (#26)");

        g.el("btn-view-ach-over").click(1);
        a.eq(g.T.state.phase, "achievements");
        g.el("btn-ach-continue").click(1);
        a.eq(g.T.state.phase, "gameover", "continue must return to the run that just ended");

        // And from the start screen, where it is the only route in.
        const menu = boot();
        menu.el("btn-view-ach").click(1);
        a.eq(menu.T.state.phase, "achievements");
        menu.el("btn-ach-continue").click(1);
        a.eq(menu.T.state.phase, "start");
      },
    },
    {
      name: "#65i — every overlay in PHASE_OVERLAY is one showOverlay() can hide again",
      fn(a) {
        // The achievements panel shipped able to open and never close:
        // showOverlay() adds `show` by id, but the loop that clears it walked a
        // second, hand-written list of overlays that had never heard of the new
        // one. Asserting the phase alone did not see it — the phase changed, the
        // panel just stayed on screen. So this walks every phase there is.
        const g = boot();
        const phases = Object.keys(g.T.PHASE_OVERLAY);
        a.gt(phases.length, 5, "the map should cover the whole machine");
        phases.forEach((phase) => {
          const entry = g.T.PHASE_OVERLAY[phase];
          g.T.setPhase(phase);
          const shown = g.shownOverlays();
          if (entry && entry.overlay) {
            a.eq(shown.join(","), entry.overlay, `"${phase}" should show only its own overlay`);
          } else {
            a.empty(shown, `"${phase}" shows no overlay, so nothing should be left up`);
          }
        });
      },
    },
    {
      name: "#65g — several unlocking in one frame are queued, not collapsed into the last one",
      fn(a) {
        const g = boot().start();
        g.T.state.achStats.bricks = 1;      // firstCrack
        g.T.state.combo = 30;               // untouchedTen + untouchedTwentyFive
        g.frame();
        a.eq(g.T.state.achToasts.length, 3, "three unlocked, so three banners are owed");
        a.eq(g.el("ach-toast-name").textContent, g.T.t("ach.firstCrack.name"),
          "the first one queued is the one on screen");

        // The queue drains one at a time rather than overlapping.
        g.run(g.T.CONFIG.achievements.toastLife + 0.1);
        a.eq(g.T.state.achToasts.length, 2);
        a.eq(g.el("ach-toast-name").textContent, g.T.t("ach.untouchedTen.name"));
      },
    },
    {
      name: "#65h — with storage unavailable, unlocks still happen; only remembering them fails",
      fn(a) {
        // Safari private browsing throws on every access. storageGet/storageSet
        // swallow it, so the run should be unaffected apart from persistence.
        const g = boot({ storageThrows: true }).start();
        g.T.state.combo = 30;
        g.frame();
        a.includes(g.T.state.achievements, "untouchedTen", "the unlock itself must still happen");
        a.gt(g.T.state.achToasts.length, 0, "and still be shown");
      },
    },

    // -----------------------------------------------------------------------
    // #60 — per-act palettes and the parallax field
    // -----------------------------------------------------------------------
    {
      name: "#60a — each act has its own palette, and the level picks it",
      fn(a) {
        const g = boot();
        const themes = [];
        for (let i = 0; i < g.T.LEVELS.length; i++) {
          g.T.startLevel(i);
          themes.push(g.T.state.theme);
        }
        themes.forEach((t, i) => {
          a.ok(t && t.top && t.bottom && t.grid && t.horizon && t.star,
            `level ${i + 1} has an incomplete palette`);
        });
        a.eq(themes[0], themes[1], "levels in the same act should share a palette");
        a.ne(themes[1], themes[2], "a new act should not look like the one before it");
        const distinct = new Set(themes.map((t) => t.top));
        a.gte(distinct.size, 4,
          `only ${distinct.size} distinct skies across ${themes.length} levels — progress has to be visible`);
      },
    },
    {
      name: "#60b — the field drifts with time, and holds still under prefers-reduced-motion",
      fn(a) {
        const g = boot().start();
        const before = g.T.state.bgScroll;
        g.runAlive(1);
        a.gt(g.T.state.bgScroll, before, "the parallax should drift while the game runs");

        const still = boot({ reducedMotion: true }).start();
        still.runAlive(1);
        a.eq(still.T.state.bgScroll, 0, "reduced motion must hold the field still");
        a.ok(still.T.state.theme.top, "but the act should keep its palette — that part is not motion");

        // And it follows the OS setting changing mid-session, as #25 and #58d do.
        const live = boot().start();
        live.runAlive(0.5);
        live.fireMedia("(prefers-reduced-motion: reduce)", true);
        const held = live.T.state.bgScroll;
        live.runAlive(1);
        a.eq(live.T.state.bgScroll, held, "turning reduced motion on should stop the drift at once");
      },
    },
    {
      name: "#60c — a level's star field is the same every time it is entered",
      fn(a) {
        const g = boot();
        g.T.startLevel(3);
        const third = JSON.stringify(g.T.state.stars);
        g.T.startLevel(1);
        const first = JSON.stringify(g.T.state.stars);
        g.T.startLevel(3);
        a.eq(JSON.stringify(g.T.state.stars), third,
          "re-entering a level laid out a different field, which reads as a glitch rather than a retry");
        a.ne(first, third, "two levels should not share the same field");

        // Same field under a different RNG seed: it is derived from the level,
        // not drawn from the stream the rest of the game rolls against.
        const other = boot({ seed: 4242 });
        other.T.startLevel(3);
        a.eq(JSON.stringify(other.T.state.stars), third, "the field must not depend on the RNG stream");

        g.T.state.stars.forEach((layer, l) => {
          a.gt(layer.length, 0, `star layer ${l} is empty`);
          layer.forEach((s) => {
            a.ok(s.x >= 0 && s.x <= g.T.GAME_W && s.y >= 0 && s.y <= g.T.GAME_H,
              `a star fell outside the field at ${s.x},${s.y}`);
          });
        });
      },
    },
    {
      name: "#60d — building and painting the field consumes no randomness",
      fn(a) {
        // Same hazard as #58f and #59g: a background that rolls would make what
        // the game rolls depend on how long it had been on screen.
        const g = boot();
        const real = Math.random;
        let rolls = 0;
        Math.random = () => { rolls++; return real(); };
        try {
          g.T.startLevel(4); // a new act: new palette, new field
          g.frame();
        } finally {
          Math.random = real;
        }
        a.eq(rolls, 0, "entering a level and painting it must not touch the RNG stream");
      },
    },

    // -----------------------------------------------------------------------
    // #41 — the 100-level campaign: 90 generated levels past the authored 10
    // -----------------------------------------------------------------------
    {
      name: "#41a — the campaign runs to totalLevels and then victory",
      fn(a) {
        const total = boot().T.CONFIG.progression.totalLevels;
        a.gt(total, boot().T.LEVELS.length, "the campaign has to be longer than the authored table");

        const g = boot();
        g.el("btn-start").click(1);
        g.T.startLevel(total - 2); // the second-to-last level
        g.key("Space");
        clearBricks(g);
        g.frame();
        a.eq(g.T.state.phase, "levelclear", "there should still be a level after this one");

        const w = boot();
        w.el("btn-start").click(1);
        w.T.startLevel(total - 1); // the last one
        w.key("Space");
        clearBricks(w);
        w.frame();
        a.eq(w.T.state.phase, "victory", "clearing the final level should win the game");
      },
    },
    {
      name: "#41b — every level in the campaign loads, is destructible and fits the field",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        for (let i = 0; i < g.T.CONFIG.progression.totalLevels; i++) {
          g.T.startLevel(i);
          a.eq(g.T.state.levelIndex, i);
          // #44: a boss level clears through state.boss, not remainingBricks —
          // its arena can legitimately have nothing destructible in it.
          if (g.T.state.boss) {
            a.ok(g.T.state.boss.parts.some((p) => p.maxHp > 0), `level ${i + 1}: the boss has no hit points`);
          } else {
            a.gt(g.T.state.bricks.filter((b) => b.hp !== Infinity).length, 0,
              `level ${i + 1} has nothing to destroy`);
          }
          for (const b of g.T.state.bricks) {
            a.gte(b.x, 0, `level ${i + 1}: brick off the left edge`);
            a.lte(b.x + b.w, g.T.GAME_W, `level ${i + 1}: brick off the right edge`);
            a.gt(b.y, 0, `level ${i + 1}: brick above the field`);
            a.lt(b.y + b.h, g.T.state.paddle.y, `level ${i + 1}: brick overlapping the paddle`);
          }
        }
      },
    },
    {
      name: "#41c — every destructible brick in a generated level is reachable",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        for (let i = g.T.LEVELS.length; i < g.T.CONFIG.progression.totalLevels; i++) {
          if ((i + 1) % 10 === 0) continue; // #44: a boss level's arena isn't generated, and its cover bricks don't gate the level anyway
          g.T.startLevel(i);
          for (const cell of walledOffBricks(g)) {
            a.ok(false, `level ${i + 1}: a destructible brick at row ${cell.r}, column ${cell.c} is walled off`);
          }
        }
      },
    },
    {
      name: "#41d — a generated level is the same layout for every player",
      fn(a) {
        // Level 47 has to be level 47 whoever loads it, so it cannot come out of
        // the shared Math.random() stream. Two boots with different RNG seeds.
        const layout = (seed) => {
          const g = boot({ seed });
          g.el("btn-start").click(1);
          g.T.startLevel(46);
          return {
            bricks: g.T.state.bricks.map((b) => `${b.type}@${b.x},${b.y}`).join("|"),
            speed: g.T.state.balls[0].speed,
          };
        };
        const one = layout(11), two = layout(999999);
        a.eq(one.bricks, two.bricks, "the same level index produced two different layouts");
        a.eq(one.speed, two.speed, "and two different speeds");
        a.gt(one.bricks.length, 0, "the level should actually have bricks to compare");
      },
    },
    {
      name: "#41e — the speed curve is monotonic and stays under its cap",
      fn(a) {
        // The tunnelling case at the campaign's top speed is #38's test, which
        // now runs at level totalLevels rather than level 10.
        const g = boot();
        g.el("btn-start").click(1);
        const p = g.T.CONFIG.progression;
        let prev = 0;
        for (let i = 0; i < p.totalLevels; i++) {
          g.T.startLevel(i);
          const mult = g.T.state.balls[0].speed / g.T.state.baseBallSpeed;
          a.gte(mult, prev, `level ${i + 1} is slower than the level before it`);
          a.lt(mult, p.speedCap, `level ${i + 1} broke the speed cap`);
          prev = mult;
        }
        a.gt(prev, g.T.LEVELS[g.T.LEVELS.length - 1].speed,
          "the last level should be faster than the last authored one");
      },
    },
    {
      name: "#41f — generating a level consumes no randomness",
      fn(a) {
        // Same hazard as #58f, #59g and #60d: rolling a layout from the shared
        // stream would make drop chances and mystery resolutions depend on how
        // many levels had been generated before it.
        const g = boot();
        g.el("btn-start").click(1);
        const real = Math.random;
        let rolls = 0;
        Math.random = () => { rolls++; return real(); };
        try {
          g.T.startLevel(59); // never generated in this boot before now
          g.frame();
        } finally {
          Math.random = real;
        }
        a.eq(rolls, 0, "generating a level must not touch the RNG stream");
      },
    },
    {
      name: "#41g — brick value is unchanged through the authored levels and saturates after them",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        const authored = g.T.LEVELS.length;
        const p = g.T.CONFIG.progression;
        // The first brick of a level is scored at combo 1, so the points are
        // exactly 10 x the level multiplier — which is what this reads back.
        const firstBrickValue = (idx) => {
          g.T.startLevel(idx);
          g.key("Space");
          const brick = g.T.state.bricks.find(
            (b) => b.alive && b.hp === 1 && "1234".includes(b.type));
          a.ok(brick, `level ${idx + 1} should contain a plain brick`);
          const before = g.T.state.score;
          const ball = g.T.state.balls[0];
          ball.attached = false;
          ball.x = brick.x + brick.w / 2;
          ball.y = brick.y + brick.h + ball.r - 2;
          ball.dx = 0;
          ball.dy = -1;
          ball.speed = 1;
          g.frame();
          a.eq(brick.alive, false, `the probe brick on level ${idx + 1} should have broken`);
          return g.T.state.score - before;
        };

        for (let n = 1; n <= authored; n++) {
          a.eq(firstBrickValue(n - 1), 10 * n,
            `level ${n} must still score exactly 10 x ${n}`);
        }
        let prev = 10 * authored;
        // #44: every one of authored+1/20/50/totalLevels is now a boss level
        // (10/20/50/100) whose arena may have no plain brick at all — probe
        // the ordinary generated level right next to each instead.
        for (const n of [authored + 2, 21, 51, p.totalLevels - 1]) {
          const v = firstBrickValue(n - 1);
          a.gte(v, prev, `level ${n} scores less than the level before it`);
          a.lte(v, 10 * p.scoreCap, `level ${n} broke the score cap`);
          prev = v;
        }
        a.gt(prev, 10 * authored, "the multiplier should still grow past the authored levels");
      },
    },
    {
      name: "#41h — a milestone level awards an extra life, capped at maxLives",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        const every = g.T.CONFIG.progression.extraLifeEvery;
        g.T.startLevel(every - 1); // the last level of the first milestone block
        g.key("Space");
        g.T.state.lives = 3;
        clearBricks(g);
        g.frame();
        a.eq(g.T.state.phase, "levelclear");
        a.eq(g.T.state.lives, 4, "clearing a milestone level should hand back a life");

        g.el("btn-next").click(1); // and the level after it should not
        const lives = g.T.state.lives;
        clearBricks(g);
        g.frame();
        a.eq(g.T.state.lives, lives, "an ordinary level must not award anything");

        const cap = boot();
        cap.el("btn-start").click(1);
        cap.T.startLevel(every * 2 - 1);
        cap.key("Space");
        cap.T.state.lives = cap.T.state.maxLives;
        clearBricks(cap);
        cap.frame();
        a.eq(cap.T.state.lives, cap.T.state.maxLives, "the milestone life must respect the cap");
      },
    },

    // -----------------------------------------------------------------------
    // #68 — an authored level the ball could not finish
    // -----------------------------------------------------------------------
    {
      name: "#68 — every authored level can actually be cleared",
      fn(a) {
        // The original finding: level 10's first two rows were offset
        // ("#S#S#S#S#S" over "S#S#S#S#S#"), which boxed each of the top row's
        // five silvers in on all four sides — walls left, right and below,
        // the ceiling above. With a 7px ball and 3px brick margins there is no
        // diagonal squeeze, so the level could never be cleared and the
        // campaign stopped dead there. ensureReachable() only guards
        // generated levels, so an authored layout needs this check instead.
        //
        // That specific level left the authored table when it became a boss
        // (#44), so this now checks every remaining authored layout in
        // general rather than pinning the one row shape that used to be
        // broken — the guard the finding actually needs is "every
        // destructible brick is reachable", not "this one level in
        // particular is fine".
        const g = boot();
        g.el("btn-start").click(1);
        for (let i = 0; i < g.T.LEVELS.length; i++) {
          g.T.startLevel(i);
          for (const cell of walledOffBricks(g)) {
            a.ok(false, `level ${i + 1}: a destructible brick at row ${cell.r}, column ${cell.c} is walled off`);
          }
        }
      },
    },

    // -----------------------------------------------------------------------
    // #69 — the developer level jump (S+E+B)
    // -----------------------------------------------------------------------
    {
      name: "#69a — S+E+B opens the level prompt from any phase, but not while typing",
      fn(a) {
        // Every phase the chord has to answer from, and how to get there.
        const reach = {
          start: (g) => g,
          ready: (g) => (g.el("btn-start").click(1), g),
          playing: (g) => g.start(),
          paused: (g) => (g.start(), g.T.togglePause(), g),
          levelclear: (g) => {
            g.start();
            clearBricks(g);
            g.frame();
            return g;
          },
          halloffame: (g) => (g.el("btn-view-hof").click(1), g),
          gameover: (g) => {
            g.start();
            g.T.state.lives = 1;
            g.loseBall();
            return g;
          },
        };
        for (const [phase, go] of Object.entries(reach)) {
          const g = go(boot({ storage: { "neonbreak-hall-of-fame": FULL_HOF } }));
          a.eq(g.T.state.phase, phase, `fixture for ${phase} did not land there`);
          chord(g);
          a.eq(g.T.state.phase, "leveljump", `the chord did not open the prompt from ${phase}`);
          a.eq(g.shownOverlays()[0], "overlay-leveljump");
          a.eq(g.doc.activeElement, g.el("leveljump-input"),
            "the number field should be focused, like every overlay's primary control (#26)");
        }

        // The guard is deliberately narrower than isTypingTarget(): a focused
        // BUTTON must not block the chord, or it would never fire from a menu
        // at all, since every overlay focuses its own button.
        const typing = boot().start();
        typing.T.setPhase("nameentry");
        a.eq(typing.doc.activeElement, typing.el("nameentry-input"));
        chord(typing);
        a.eq(typing.T.state.phase, "nameentry",
          "typing SEB into the name field must enter a name, not fire the chord");
      },
    },
    {
      name: "#69b — a valid level number starts that level, an invalid one does not",
      fn(a) {
        const g = boot();
        const total = g.T.CONFIG.progression.totalLevels;
        for (const bad of ["", "  ", "0", "abc", "12abc", "1e2", "-3", "3.5", String(total + 1)]) {
          chord(g);
          g.el("leveljump-input").value = bad;
          g.el("btn-leveljump-go").click(1);
          a.eq(g.T.state.phase, "leveljump", `"${bad}" should have been rejected`);
          a.ok(g.el("leveljump-error").textContent, `"${bad}" should have said why`);
          g.el("btn-leveljump-cancel").click(1);
        }

        chord(g);
        g.el("leveljump-input").value = "84";
        g.el("btn-leveljump-go").click(1);
        a.eq(g.T.state.phase, "ready", "a valid number should start the level");
        a.eq(g.T.state.levelIndex, 83, "level 84 is index 83");
        a.gt(g.T.state.bricks.length, 0, "and it should actually be built");

        const last = boot();
        chord(last);
        last.el("leveljump-input").value = String(total);
        last.key("Enter"); // Enter submits too, like the name field (#42)
        a.eq(last.T.state.levelIndex, total - 1, "the last level must be reachable");
      },
    },
    {
      name: "#69c — cancelling restores the phase it interrupted, and never resumes play",
      fn(a) {
        const g = boot();
        chord(g);
        g.el("btn-leveljump-cancel").click(1);
        a.eq(g.T.state.phase, "start", "cancelling from the menu should go back to the menu");

        const p = boot().start();
        a.eq(p.T.state.phase, "playing");
        chord(p);
        p.key("Escape"); // Escape dismisses as well as the cancel button
        a.eq(p.T.state.phase, "paused",
          "cancelling from play must pause, not drop the player back into a live ball");

        const c = boot().start();
        clearBricks(c);
        c.frame();
        a.eq(c.T.state.phase, "levelclear");
        chord(c);
        c.el("btn-leveljump-cancel").click(1);
        a.eq(c.T.state.phase, "levelclear");
      },
    },
    {
      name: "#69d — a jumped-to level clears and advances like any other",
      fn(a) {
        const g = boot();
        chord(g);
        g.el("leveljump-input").value = "37";
        g.el("btn-leveljump-go").click(1);
        a.eq(g.T.state.phase, "ready");
        // The jump field must not still hold focus here: "ready" has no button
        // of its own, so a focused input would swallow Space via
        // isTypingTarget() and the ball could never be launched.
        a.ne(g.doc.activeElement, g.el("leveljump-input"),
          "the jump field must release focus so Space can launch the ball");
        g.key("Space");
        a.eq(g.T.state.phase, "playing", "Space should launch after a jump");

        clearBricks(g);
        g.frame();
        a.eq(g.T.state.phase, "levelclear");
        g.el("btn-next").click(1);
        a.eq(g.T.state.levelIndex, 37, "clearing level 37 should lead to level 38");
        a.eq(g.T.state.phase, "ready");
      },
    },
    {
      name: "#69e — a jumped run reaches neither the hall of fame nor the best score",
      fn(a) {
        // Empty board and a positive score: without the jump this is exactly
        // the case #42a says must detour through nameentry.
        const g = boot();
        chord(g);
        g.el("leveljump-input").value = "90";
        g.el("btn-leveljump-go").click(1);
        g.key("Space");
        g.T.state.score = 500000;
        g.T.state.lives = 1;
        g.loseBall();
        a.eq(g.T.state.phase, "gameover", "a jumped run must not be offered the board");
        a.eq(g.T.state.best, 0, "and must not set the best score either");
        a.not(g.store["neonbreak-best-score"], "nothing should have been persisted");

        // Sticky for the whole run: a jump on an early level still taints a
        // score submitted much later.
        const early = boot();
        chord(early);
        early.el("leveljump-input").value = "2";
        early.el("btn-leveljump-go").click(1);
        early.key("Space");
        early.T.startLevel(50); // played on from there
        early.key("Space");     // startLevel leaves it "ready", where balls do not move
        early.T.state.score = 1000;
        early.T.state.lives = 1;
        early.loseBall();
        a.eq(early.T.state.phase, "gameover", "the flag must survive later levels");

        // And a fresh game clears it.
        early.el("btn-restart").click(1);
        a.eq(early.T.state.jumped, false, "starting a new run should make it eligible again");
        early.key("Space");
        early.T.state.score = 700;
        early.T.state.lives = 1;
        early.loseBall();
        a.eq(early.T.state.phase, "nameentry", "an ordinary run should still qualify");
      },
    },

    // -----------------------------------------------------------------------
    // #71 — the lost-ball beat: burst, sting, and time for both
    // -----------------------------------------------------------------------
    {
      name: "#71a — a lost ball holds a beat before the next serve, and before game over",
      fn(a) {
        // Losing the ball used to resolve in the frame it happened — the ball
        // vanished and the "Ready?" overlay was already up, leaving nowhere for
        // the loss to land.
        const g = boot().start();
        const lives = g.T.state.lives;
        g.T.state.balls.length = 0;
        g.frame();
        a.eq(g.T.state.phase, "lifelost", "the game should hold on the field, not serve immediately");
        a.eq(g.T.state.lives, lives - 1, "the life is spent when the ball is lost, not when the beat ends");
        a.empty(g.shownOverlays(), "no overlay during the beat — the point is to see the field");
        // It has to be real elapsed time, not a phase the very next frame steps
        // straight back out of: otherwise there is still nowhere for the burst
        // and the sting to happen, which was the whole bug.
        const spent = beatFrames(g);
        a.gt(spent, 1, "the beat should span more than a single frame");
        a.near(spent * 0.016, g.T.CONFIG.impact.lifeLostBeat, 0.05,
          "and should last about as long as CONFIG.impact.lifeLostBeat says");
        a.eq(g.T.state.phase, "ready", "and then serve");
        a.eq(g.T.state.balls.length, 1, "with a fresh ball");

        // The last life takes the same beat before the run ends.
        const last = boot({ storage: { "neonbreak-hall-of-fame": FULL_HOF } }).start();
        last.T.state.lives = 1;
        last.T.state.balls.length = 0;
        last.frame();
        a.eq(last.T.state.phase, "lifelost", "the run ending deserves the beat most of all");
        last.runLossBeat();
        a.eq(last.T.state.phase, "gameover");
      },
    },
    {
      name: "#71b — the loss bursts, and reduced motion changes the visuals but not the pacing",
      fn(a) {
        const g = boot().start();
        const ball = g.T.state.balls[0];
        ball.attached = false;
        ball.x = 123;
        ball.y = g.T.GAME_H + 30; // past the floor
        g.T.state.particles.length = 0;
        g.frame();
        a.gt(g.T.state.particles.length, 0, "losing the ball should burst");
        // Spawned mid-frame, so they have a frame of drift on them by now — a
        // few px of slack, not an exact position. The bug this guards against is
        // bursting at the ball's real y, which is 30px below the canvas.
        for (const p of g.T.state.particles) {
          a.near(p.x, 123, 5, "the burst should be at the ball's last x");
          a.near(p.y, g.T.GAME_H, 10, "and on the floor, not below it where nobody sees it");
        }
        // Captured before spending the beat — particles outlive neither.
        const fullBurst = g.T.state.particles.length;
        const beat = g.T.state.lifeLost.remaining;
        const frames = beatFrames(g);

        // #58's rule: the feedback layer switches off, the game does not change.
        // The burst thins out and the shake is suppressed — but the beat is
        // pacing, not motion, so it must last exactly as long either way.
        const rm = boot({ reducedMotion: true }).start();
        rm.T.state.particles.length = 0;
        rm.T.state.balls.length = 0;
        rm.frame();
        a.gt(rm.T.state.particles.length, 0, "reduced motion thins the burst, it does not remove it");
        a.lt(rm.T.state.particles.length, fullBurst, "and it should be thinner");
        a.eq(rm.T.state.shake.remaining, 0, "the shake stays suppressed (#58)");
        a.near(rm.T.state.lifeLost.remaining, beat, 1e-9, "the beat must not depend on the setting");
        a.eq(beatFrames(rm), frames, "and neither must how long it actually takes");
      },
    },
    {
      name: "#71c — the loss plays a descending sting in the level's key, and nothing when muted",
      fn(a) {
        // updateMusic() queues the bed before updateBalls() loses the ball, so
        // the sting is whatever was scheduled last in the frame.
        const stingOf = (level) => {
          const g = boot();
          g.el("btn-start").click(1);
          g.T.startLevel(level);
          g.key("Space");
          g.notes.length = 0;
          g.T.state.balls.length = 0;
          g.frame();
          return g.notes.slice(-4);
        };

        const one = stingOf(0);
        a.eq(one.length, 4, "the sting should be four notes");
        for (let i = 1; i < one.length; i++) {
          a.lt(one[i].freq, one[i - 1].freq, "the figure has to fall — that is what makes it a loss");
          a.near(one[i].at - one[i - 1].at, one[1].at - one[0].at, 1e-6,
            "and be evenly spaced, placed against the audio clock rather than by frames");
        }

        // Pitched from musicRoot() like everything else in #59, so it lands in
        // the level's key: a different level is the same figure transposed.
        const two = stingOf(1);
        const ratio = two[0].freq / one[0].freq;
        a.ne(Math.round(ratio * 1000), 1000, "a different level should be a different key");
        for (let i = 0; i < one.length; i++) {
          a.near(two[i].freq / one[i].freq, ratio, 1e-6,
            "every note should shift by the same interval — a transposition, not a new tune");
        }

        const muted = boot({ storage: { "neonbreak-muted": "1" } }).start();
        muted.notes.length = 0;
        muted.T.state.balls.length = 0;
        muted.frame();
        a.empty(muted.notes, "mute has to cover the sting like everything else");
      },
    },
    {
      name: "#71d — nothing simulates during the beat, but the paddle still answers",
      fn(a) {
        const g = boot().start();
        g.T.state.balls.length = 0;
        g.frame();
        a.eq(g.T.state.phase, "lifelost");

        const score = g.T.state.score;
        const remaining = g.T.state.remainingBricks;
        const alive = g.T.state.bricks.filter((b) => b.alive).length;
        g.T.state.drops.push({ x: 100, y: 100, def: g.T.POWERUPS[0] });
        const dropY = g.T.state.drops[0].y;

        g.frame();
        a.eq(g.T.state.balls.length, 0, "no ball is in play during the beat");
        a.eq(g.T.state.score, score, "nothing scores");
        a.eq(g.T.state.remainingBricks, remaining, "no brick state moves");
        a.eq(g.T.state.bricks.filter((b) => b.alive).length, alive);
        a.eq(g.T.state.drops[0].y, dropY, "and drops hold still");

        // The paddle is the exception: freezing input for most of a second
        // reads as a stall, and there is no ball for it to affect.
        const before = g.T.state.paddle.x;
        g.mouseMove(before + 80);
        g.frame();
        a.ne(g.T.state.paddle.x, before, "the paddle should still track during the beat");
      },
    },

    // -----------------------------------------------------------------------
    // #72 — a jumped run is told why it was disqualified
    // -----------------------------------------------------------------------
    {
      name: "#72a — a jumped run's gameover screen carries the explanation, an ordinary one's does not",
      fn(a) {
        // The bug as reported was "entering a name does not display the hall of
        // fame": #69's exclusion firing with nothing on screen to say so.
        const jumped = boot();
        chord(jumped);
        jumped.el("leveljump-input").value = "90";
        jumped.el("btn-leveljump-go").click(1);
        jumped.key("Space");
        jumped.T.state.score = 30;
        jumped.T.state.lives = 1;
        jumped.loseBall();
        a.eq(jumped.T.state.phase, "gameover");
        a.eq(jumped.el("gameover-jumped").textContent, jumped.T.t("run.jumped"),
          "the screen where the exclusion bites must say the exclusion happened");

        // Same score, same ending, no jump — and nothing to explain. FULL_HOF
        // keeps it off the nameentry detour so both runs end on gameover.
        const plain = boot({ storage: { "neonbreak-hall-of-fame": FULL_HOF } }).start();
        plain.T.state.score = 30;
        plain.T.state.lives = 1;
        plain.loseBall();
        a.eq(plain.T.state.phase, "gameover");
        a.eq(plain.el("gameover-jumped").textContent, "",
          "an ordinary run must not be told it was excluded");
      },
    },
    {
      name: "#72b — the same line reaches victory, which a jumped run can still finish on",
      fn(a) {
        const total = boot().T.CONFIG.progression.totalLevels;

        const jumped = boot();
        chord(jumped);
        jumped.el("leveljump-input").value = String(total);
        jumped.el("btn-leveljump-go").click(1);
        jumped.key("Space");
        clearBricks(jumped);
        jumped.frame();
        a.eq(jumped.T.state.phase, "victory", "clearing the last level ends on victory, not gameover");
        a.eq(jumped.el("victory-jumped").textContent, jumped.T.t("run.jumped"),
          "victory needs the line too — gameover alone would miss every jumped run that finishes");

        const plain = boot().start();
        plain.T.startLevel(total - 1);
        plain.key("Space");
        clearBricks(plain);
        plain.frame();
        a.eq(plain.T.state.phase, "victory");
        a.eq(plain.el("victory-jumped").textContent, "");
      },
    },
    {
      name: "#72c — restarting clears it, because the exclusion is per run and not for good",
      fn(a) {
        const g = boot();
        chord(g);
        g.el("leveljump-input").value = "90";
        g.el("btn-leveljump-go").click(1);
        g.key("Space");
        g.T.state.lives = 1;
        g.loseBall();
        a.ne(g.el("gameover-jumped").textContent, "");

        g.el("btn-restart").click(1);
        a.eq(g.T.state.jumped, false);
        a.eq(g.el("gameover-jumped").textContent, "",
          "a player who thinks they have permanently broken their game stops playing");
        g.key("Space");
        g.T.state.score = 700;
        g.T.state.lives = 1;
        g.loseBall();
        a.eq(g.T.state.phase, "nameentry", "and the next run really is eligible again");
      },
    },

    // -----------------------------------------------------------------------
    // #73 — the board is reachable from the screens a run ends on
    // -----------------------------------------------------------------------
    {
      name: "#73a — from gameover the board opens and continue comes back to gameover",
      fn(a) {
        const g = boot({ storage: { "neonbreak-hall-of-fame": FULL_HOF } }).start();
        g.T.state.score = 30;
        g.T.state.lives = 1;
        g.loseBall();
        a.eq(g.T.state.phase, "gameover");
        // Checking the board used to cost a restart, which replaced the score
        // you wanted to compare against.
        a.eq(g.doc.activeElement, g.el("btn-restart"), "restart stays the overlay's call to action (#26)");

        g.el("btn-view-hof-over").click(1);
        a.eq(g.T.state.phase, "halloffame");
        a.includes(g.el("hof-list").innerHTML, "CPU", "the board should have been rendered, not left stale");
        g.el("btn-hof-continue").click(1);
        a.eq(g.T.state.phase, "gameover", "continue must return to the run that just ended, not to start");
      },
    },
    {
      name: "#73b — the same from victory",
      fn(a) {
        const g = boot({ storage: { "neonbreak-hall-of-fame": FULL_HOF } }).start();
        g.T.startLevel(g.T.CONFIG.progression.totalLevels - 1);
        g.key("Space");
        clearBricks(g);
        g.frame();
        a.eq(g.T.state.phase, "victory");
        a.eq(g.doc.activeElement, g.el("btn-restart-win"));

        g.el("btn-view-hof-win").click(1);
        a.eq(g.T.state.phase, "halloffame");
        g.el("btn-hof-continue").click(1);
        a.eq(g.T.state.phase, "victory");
      },
    },
    {
      name: "#73c — a qualifying run that already detoured through the board still routes back",
      fn(a) {
        // endGame() sets returnPhase for the detour; the button has to set it
        // again rather than trust what is left over from that.
        const g = boot().start();
        g.T.state.score = 10;
        g.T.state.lives = 1;
        g.loseBall();
        a.eq(g.T.state.phase, "nameentry");
        g.el("btn-nameentry-submit").click(1);
        g.el("btn-hof-continue").click(1);
        a.eq(g.T.state.phase, "gameover");

        g.el("btn-view-hof-over").click(1);
        a.eq(g.T.state.phase, "halloffame");
        g.el("btn-hof-continue").click(1);
        a.eq(g.T.state.phase, "gameover", "the second visit must not fall back to a stale returnPhase");
      },
    },
  ],
};
