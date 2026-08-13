"use strict";
/*
  One test per fixed finding from docs/code-review.md.

  This is the file that grows every time a bug is fixed. The convention is in
  docs/testing.md: write the test, watch it fail against the unfixed code, then
  fix the bug and watch it pass. A regression test that has never been seen
  failing proves nothing.

  Tests elsewhere in the suite may cover the same ground more thoroughly; the
  point of this file is to state, in one place and in the finding's own terms,
  what must never come back.
*/

const { boot, HTML, SCRIPT } = require("../dom-stub");

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
        const g = boot().start();
        for (const id of ["btn-pause", "btn-mute"]) {
          g.doc.activeElement = g.el(id);
          g.el(id).click(1);
          a.eq(g.doc.activeElement, g.doc.body, `${id} kept focus after a pointer click`);
        }
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
  ],
};
