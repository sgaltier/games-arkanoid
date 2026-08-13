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

const { boot, HTML } = require("../dom-stub");

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
  ],
};
