"use strict";
/*
  The phase machine, and the coupling between a phase and the overlay it shows.

  The overlay invariant matters more than it looks: three call sites still assign
  `state.phase` and call `showOverlay` directly instead of going through
  setPhase() (finding #18). These tests pin the current, correct pairing so that
  refactor can be made without silently desyncing the two.
*/

const { boot } = require("../dom-stub");

// The overlay each phase must show. `null` means no overlay at all.
const OVERLAY_FOR = {
  start: "overlay-start",
  ready: "overlay-ready",
  playing: null,
  paused: "overlay-pause",
  levelclear: "overlay-levelclear",
  nameentry: "overlay-nameentry",
  halloffame: "overlay-halloffame",
  victory: "overlay-victory",
  gameover: "overlay-gameover",
};

// A hall-of-fame board already full of higher scores than anything these
// tests set — seeded via the storage boot option so a run ending mid-test
// goes straight to victory/gameover as it always has, rather than detouring
// through "nameentry" (#42). Tests that are actually about the hall of fame
// live in regressions.js and boot with an empty board on purpose instead.
const FULL_HOF = JSON.stringify(
  Array.from({ length: 10 }, (_, i) => ({ name: "CPU", score: 999000 - i }))
);

function assertPhase(a, g, phase) {
  a.eq(g.T.state.phase, phase, `expected phase "${phase}"`);
  const expected = OVERLAY_FOR[phase];
  const shown = g.shownOverlays();
  if (expected === null) {
    a.empty(shown, `phase "${phase}" should show no overlay, showing ${shown.join(", ")}`);
  } else {
    a.eq(shown.length, 1, `phase "${phase}" should show exactly one overlay, showing ${shown.join(", ") || "none"}`);
    a.eq(shown[0], expected, `phase "${phase}" shows the wrong overlay`);
  }
}

// Kill every destructible brick, leaving indestructible walls standing.
// Bypassing brickHit means the remainingBricks counter it maintains (see
// #16) has to be kept in sync by hand here.
function clearBricks(g) {
  g.T.state.bricks.forEach((b) => { if (b.hp !== Infinity) b.alive = false; });
  g.T.state.remainingBricks = 0;
}

module.exports = {
  name: "state — phase machine and overlays",
  tests: [
    {
      name: "boots into the start phase with the start overlay",
      fn(a) {
        const g = boot();
        assertPhase(a, g, "start");
      },
    },
    {
      name: "start button moves to ready",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        assertPhase(a, g, "ready");
        a.eq(g.T.state.levelIndex, 0);
      },
    },
    {
      name: "Space launches from ready into playing",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        g.key("Space");
        assertPhase(a, g, "playing");
        a.eq(g.T.state.balls[0].attached, false, "the ball should be released");
      },
    },
    {
      name: "P pauses and resumes",
      fn(a) {
        const g = boot().start();
        g.key("KeyP");
        assertPhase(a, g, "paused");
        g.key("KeyP");
        assertPhase(a, g, "playing");
      },
    },
    {
      name: "Escape pauses",
      fn(a) {
        const g = boot().start();
        g.key("Escape");
        assertPhase(a, g, "paused");
      },
    },
    {
      name: "the deck pause button pauses, and the resume button resumes",
      fn(a) {
        const g = boot().start();
        g.el("btn-pause").click(1);
        assertPhase(a, g, "paused");
        g.el("btn-resume").click(1);
        assertPhase(a, g, "playing");
      },
    },
    {
      name: "clicking the screen resumes from paused",
      fn(a) {
        const g = boot().start();
        g.key("KeyP");
        g.mouseDown(0);
        assertPhase(a, g, "playing");
      },
    },
    {
      name: "pausing is a no-op outside play",
      fn(a) {
        const g = boot();
        g.key("KeyP");
        assertPhase(a, g, "start");
        g.el("btn-start").click(1);
        g.key("KeyP");
        assertPhase(a, g, "ready");
      },
    },
    {
      name: "clearing every brick reaches level-clear",
      fn(a) {
        const g = boot().start();
        clearBricks(g);
        g.frame();
        assertPhase(a, g, "levelclear");
      },
    },
    {
      name: "the next-level button advances and returns to ready",
      fn(a) {
        const g = boot().start();
        clearBricks(g);
        g.frame();
        g.el("btn-next").click(1);
        assertPhase(a, g, "ready");
        a.eq(g.T.state.levelIndex, 1, "should have advanced one level");
        a.gt(g.T.state.bricks.length, 0, "the new level should have bricks");
      },
    },
    {
      name: "clearing the final level wins the game",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        g.T.startLevel(g.T.CONFIG.progression.totalLevels - 1);
        g.key("Space");
        clearBricks(g);
        g.frame();
        assertPhase(a, g, "victory");
      },
    },
    {
      name: "losing the last ball with lives left returns to ready",
      fn(a) {
        const g = boot().start();
        const before = g.T.state.lives;
        g.T.state.balls.length = 0;
        g.frame();
        a.eq(g.T.state.lives, before - 1, "should have lost exactly one life");
        assertPhase(a, g, "ready");
      },
    },
    {
      name: "losing the last life ends the game",
      fn(a) {
        const g = boot().start();
        g.T.state.lives = 1;
        g.T.state.balls.length = 0;
        g.frame();
        assertPhase(a, g, "gameover");
      },
    },
    {
      name: "restarting from game over resets score, lives and level",
      fn(a) {
        const g = boot({ storage: { "neonbreak-hall-of-fame": FULL_HOF } }).start();
        g.T.state.score = 500;
        g.T.state.levelIndex = 2;
        g.T.state.lives = 1;
        g.T.state.balls.length = 0;
        g.frame();
        assertPhase(a, g, "gameover");
        g.el("btn-restart").click(1);
        assertPhase(a, g, "ready");
        a.eq(g.T.state.score, 0, "score should reset");
        a.eq(g.T.state.lives, 3, "lives should reset");
        a.eq(g.T.state.levelIndex, 0, "should return to level 1");
      },
    },
    {
      name: "restarting after a win resets too",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        g.T.startLevel(g.T.CONFIG.progression.totalLevels - 1);
        g.key("Space");
        clearBricks(g);
        g.frame();
        g.el("btn-restart-win").click(1);
        assertPhase(a, g, "ready");
        a.eq(g.T.state.levelIndex, 0);
      },
    },
    {
      name: "every phase shows exactly its own overlay",
      fn(a) {
        // Walk the machine and check the invariant at each stop rather than
        // trusting any single transition.
        const g = boot();
        assertPhase(a, g, "start");
        g.el("btn-start").click(1);
        assertPhase(a, g, "ready");
        g.key("Space");
        assertPhase(a, g, "playing");
        g.key("KeyP");
        assertPhase(a, g, "paused");
        g.key("KeyP");
        assertPhase(a, g, "playing");
        clearBricks(g);
        g.frame();
        assertPhase(a, g, "levelclear");
      },
    },
    {
      name: "the ball stays attached to the paddle while in ready",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        const ball = g.T.state.balls[0];
        a.eq(ball.attached, true);
        g.hold("ArrowRight");
        g.run(0.2);
        a.near(ball.x, g.T.state.paddle.x + g.T.paddleWidth() / 2, 0.001,
          "the attached ball should track the paddle centre");
      },
    },
    {
      name: "nothing moves while paused",
      fn(a) {
        const g = boot().start();
        g.run(0.2);
        g.key("KeyP");
        const ball = g.T.state.balls[0];
        const snapshot = { x: ball.x, y: ball.y };
        g.run(2.0);
        a.eq(ball.x, snapshot.x, "the ball moved while paused");
        a.eq(ball.y, snapshot.y, "the ball moved while paused");
      },
    },
  ],
};
