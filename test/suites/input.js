"use strict";
/*
  Keyboard, mouse and touch.
*/

const { boot } = require("../dom-stub");

module.exports = {
  name: "input — keyboard, mouse, touch",
  tests: [
    {
      name: "ArrowRight moves the paddle right, ArrowLeft moves it left",
      fn(a) {
        const g = boot().start();
        const start = g.T.state.paddle.x;
        g.hold("ArrowRight");
        g.run(0.1);
        const right = g.T.state.paddle.x;
        a.gt(right, start, "ArrowRight did not move the paddle right");
        g.release("ArrowRight");
        g.hold("ArrowLeft");
        g.run(0.1);
        a.lt(g.T.state.paddle.x, right, "ArrowLeft did not move the paddle left");
      },
    },
    {
      name: "A and D work as movement aliases",
      fn(a) {
        const g = boot().start();
        const start = g.T.state.paddle.x;
        g.hold("KeyD");
        g.run(0.1);
        a.gt(g.T.state.paddle.x, start, "KeyD should move right");
        const afterD = g.T.state.paddle.x;
        g.release("KeyD");
        g.hold("KeyA");
        g.run(0.1);
        a.lt(g.T.state.paddle.x, afterD, "KeyA should move left");
      },
    },
    {
      name: "releasing a key stops the paddle",
      fn(a) {
        const g = boot().start();
        g.hold("ArrowRight");
        g.run(0.1);
        g.release("ArrowRight");
        const parked = g.T.state.paddle.x;
        g.run(0.5);
        a.eq(g.T.state.paddle.x, parked, "the paddle kept moving after keyup");
      },
    },
    {
      name: "the paddle is clamped to the play field at both edges",
      fn(a) {
        const g = boot().start();
        g.hold("ArrowLeft");
        g.run(3);
        a.eq(g.T.state.paddle.x, 0, "should stop at the left wall");
        g.release("ArrowLeft");
        g.hold("ArrowRight");
        g.run(3);
        a.eq(g.T.state.paddle.x, g.T.GAME_W - g.T.paddleWidth(), "should stop at the right wall");
      },
    },
    {
      name: "moving the mouse centres the paddle on the pointer",
      fn(a) {
        const g = boot().start();
        g.mouseMove(200);
        g.frame();
        a.near(g.T.state.paddle.x + g.T.paddleWidth() / 2, 200, 0.001,
          "the paddle should centre on the pointer");
      },
    },
    {
      name: "the pointer overrides held keys until a movement key is pressed again",
      fn(a) {
        const g = boot().start();
        g.hold("ArrowLeft");
        g.mouseMove(300);
        g.run(0.2);
        a.near(g.T.state.paddle.x + g.T.paddleWidth() / 2, 300, 0.001,
          "the mouse should win while it is the most recent input");
        // Pressing a movement key hands control back to the keyboard.
        g.key("ArrowLeft");
        g.run(0.1);
        a.lt(g.T.state.paddle.x + g.T.paddleWidth() / 2, 300,
          "pressing a movement key should reclaim control from a stale pointer");
      },
    },
    {
      name: "the mouse leaving the canvas releases pointer control",
      fn(a) {
        const g = boot().start();
        g.mouseMove(300);
        g.frame();
        g.canvasEvent("mouseleave", {});
        a.eq(g.T.state.pointerX, null, "pointerX should be cleared on mouseleave");
      },
    },
    {
      name: "a touch aims the paddle and launches the ball",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        a.eq(g.T.state.phase, "ready");
        g.touch("touchstart", 150);
        a.eq(g.T.state.phase, "playing", "a touch should launch from ready");
        a.eq(g.T.state.pointerX, 150, "the touch should set the pointer position");
      },
    },
    {
      name: "dragging a touch moves the paddle and suppresses page scrolling",
      fn(a) {
        const g = boot().start();
        const ev = g.touch("touchmove", 400);
        a.eq(ev.defaultPrevented, true, "touchmove must preventDefault or the page scrolls");
        g.frame();
        a.near(g.T.state.paddle.x + g.T.paddleWidth() / 2, 400, 0.001);
      },
    },
    {
      name: "losing window focus clears every held key",
      fn(a) {
        const g = boot().start();
        g.hold("ArrowRight");
        g.hold("KeyD");
        g.fireWin("blur");
        a.empty(Object.keys(g.T.state.keys), "held keys survived a blur");
        const parked = g.T.state.paddle.x;
        g.run(0.5);
        a.eq(g.T.state.paddle.x, parked, "the paddle drifted after focus loss");
      },
    },
    {
      name: "Space launches and suppresses page scrolling when nothing is focused",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        g.doc.activeElement = g.doc.body;
        const ev = g.key("Space");
        a.eq(g.T.state.phase, "playing");
        a.eq(ev.defaultPrevented, true, "Space must preventDefault or the page scrolls");
      },
    },
    {
      name: "Space is handed to a focused button instead of launching",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        g.doc.activeElement = g.el("btn-restart");
        const ev = g.key("Space");
        a.eq(g.T.state.phase, "ready", "Space should not launch while a button has focus");
        a.eq(ev.defaultPrevented, false, "suppressing the default would stop the button activating");
      },
    },
    {
      name: "deck buttons drop focus after a pointer click but keep it for keyboard",
      fn(a) {
        const g = boot().start();
        g.doc.activeElement = g.el("btn-pause");
        g.el("btn-pause").click(1);
        a.eq(g.doc.activeElement, g.doc.body, "a pointer click should leave the button unfocused");

        g.doc.activeElement = g.el("btn-mute");
        g.el("btn-mute").click(0);
        a.eq(g.doc.activeElement, g.el("btn-mute"), "keyboard activation must not steal focus");
      },
    },
    {
      name: "#7 — arrow keys suppress page scrolling",
      fn(a) {
        const g = boot().start();
        for (const code of ["ArrowLeft", "ArrowRight"]) {
          a.eq(g.key(code).defaultPrevented, true,
            `${code} should preventDefault so the page does not scroll under the paddle`);
        }
      },
    },
    {
      name: "#8 — only the primary mouse button launches the ball",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        g.mouseDown(2); // right button
        a.eq(g.T.state.phase, "ready", "a right-click should not launch the ball");
      },
    },
  ],
};
