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
          g.T.state.balls.length = 0;
          g.frame();
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
        a.eq(widthLabel.textContent, "W");
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
        g.T.startLevel(g.T.LEVELS.length - 1); // fastest level
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
        const total = g.T.LEVELS.length;
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
        g.T.state.balls.length = 0;
        g.frame();
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
        g.T.state.balls.length = 0;
        g.frame(); // state.score is still 0
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
        tie.T.state.balls.length = 0;
        tie.frame();
        a.eq(tie.T.state.phase, "gameover", "a tie with the lowest entry should not bump it");

        const beats = boot({ storage: { "neonbreak-hall-of-fame": full } }).start();
        beats.T.state.score = 92; // beats the lowest by one point
        beats.T.state.lives = 1;
        beats.T.state.balls.length = 0;
        beats.frame();
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
        g.T.state.balls.length = 0;
        g.frame();
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
      name: "#42e — an empty name submission falls back to a placeholder",
      fn(a) {
        const g = boot().start();
        g.T.state.score = 10;
        g.T.state.lives = 1;
        g.T.state.balls.length = 0;
        g.frame();
        a.eq(g.T.state.phase, "nameentry");
        // nameentry-input's .value is never set — mimics submitting with nothing typed.
        g.el("btn-nameentry-submit").click(1);
        a.eq(g.T.state.hallOfFame[0].name, "???",
          "an empty name should fall back to a placeholder, not save blank");
      },
    },
    {
      name: "#42f — a submitted name containing HTML never gets interpreted as markup",
      fn(a) {
        const g = boot().start();
        g.T.state.score = 10;
        g.T.state.lives = 1;
        g.T.state.balls.length = 0;
        g.frame();
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
        g.T.startLevel(g.T.LEVELS.length - 1); // final level, so clearing it wins
        g.key("Space");
        g.T.state.score = 10;
        g.T.state.bricks.forEach((b) => { if (b.hp !== Infinity) b.alive = false; });
        g.T.state.remainingBricks = 0;
        g.frame();
        a.eq(g.T.state.phase, "nameentry", "a qualifying score should still detour on a win");
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
        g.T.state.balls.length = 0;
        g.frame();
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
        g.T.state.balls.length = 0;
        g.frame();
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
        g.T.state.balls.length = 0;
        g.frame();
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
        g.T.state.balls.length = 0;
        g.frame();
        a.eq(g.T.state.phase, "nameentry");
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
        g.T.state.balls.length = 0;
        g.frame();
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
        g.T.state.balls.length = 0;
        g.frame();
        g.el("btn-nameentry-submit").click(1);
        await g.settle();
        a.eq(g.T.state.sessionToken, null, "the token should be cleared once spent");
        const before = g.apiCalls.filter((c) => c.init && c.init.method === "POST").length;
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
        g.T.state.balls.length = 0;
        g.frame();
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
        g.T.state.balls.length = 0;
        g.frame();
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
        g.T.state.balls.length = 0;
        g.frame();
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
  ],
};
