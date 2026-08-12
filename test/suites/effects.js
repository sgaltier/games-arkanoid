"use strict";
/*
  Timed power-up effects: application, expiry, and the fact that their clocks
  are game time rather than wall time (finding #4).
*/

const { boot } = require("../dom-stub");

module.exports = {
  name: "effects — timed power-ups",
  tests: [
    {
      name: "widen makes the paddle bigger, narrow makes it smaller",
      fn(a) {
        const g = boot().start();
        const base = g.T.paddleWidth();

        g.T.applyPowerup({ type: "widen" });
        a.gt(g.T.paddleWidth(), base, "widen should enlarge the paddle");

        g.T.state.widthEffect = null;
        g.T.applyPowerup({ type: "narrow" });
        a.lt(g.T.paddleWidth(), base, "narrow should shrink the paddle");
      },
    },
    {
      name: "slow and fast change the ball speed multiplier",
      fn(a) {
        const g = boot().start();
        a.eq(g.T.ballSpeedMult(), 1, "no effect means no multiplier");

        g.T.applyPowerup({ type: "slow" });
        a.lt(g.T.ballSpeedMult(), 1, "slow should reduce the multiplier");

        g.T.applyPowerup({ type: "fast" });
        a.gt(g.T.ballSpeedMult(), 1, "fast should raise the multiplier");
      },
    },
    {
      name: "the speed multiplier actually changes how far the ball travels",
      fn(a) {
        const measure = (powerup) => {
          const g = boot().start();
          if (powerup) g.T.applyPowerup({ type: powerup });
          const b = g.T.state.balls[0];
          b.x = 240; b.y = 300; b.dx = 0; b.dy = 1; b.attached = false;
          const before = b.y;
          g.frame();
          return b.y - before;
        };
        const normal = measure(null);
        a.lt(measure("slow"), normal, "slow should shorten each step");
        a.gt(measure("fast"), normal, "fast should lengthen each step");
      },
    },
    {
      name: "effects expire after their duration of play",
      fn(a) {
        const g = boot().start();
        g.T.applyPowerup({ type: "widen" });
        const total = g.T.state.widthEffect.remaining;
        a.gt(total, 0, "the effect should start with time on the clock");

        g.runAlive(total - 0.5);
        a.ok(g.T.state.widthEffect, "the effect ended early");

        g.runAlive(1.0);
        a.not(g.T.state.widthEffect, "the effect should have expired");
        a.eq(g.T.paddleWidth(), g.T.state.paddle.baseW, "the paddle should be back to normal");
      },
    },
    {
      name: "effect clocks are suspended while paused",
      fn(a) {
        const g = boot().start();
        g.T.applyPowerup({ type: "widen" });
        g.runAlive(1.0);
        const remaining = g.T.state.widthEffect.remaining;

        g.key("KeyP");
        g.run(60); // a full minute parked on the pause screen
        a.ok(g.T.state.widthEffect, "the effect expired while the game was paused");
        a.eq(g.T.state.widthEffect.remaining, remaining, "the clock ran while paused");

        g.key("KeyP");
        g.runAlive(0.5);
        a.lt(g.T.state.widthEffect.remaining, remaining, "the clock should resume with play");
      },
    },
    {
      name: "effect clocks are suspended while the tab is hidden",
      fn(a) {
        const g = boot().start();
        g.T.applyPowerup({ type: "slow" });
        const remaining = g.T.state.speedEffect.remaining;
        g.doc.hidden = true;
        g.fireDoc("visibilitychange");
        g.run(60);
        a.ok(g.T.state.speedEffect, "the effect expired while the tab was hidden");
        a.eq(g.T.state.speedEffect.remaining, remaining);
      },
    },
    {
      name: "a later power-up of the same kind replaces the earlier one",
      fn(a) {
        const g = boot().start();
        g.T.applyPowerup({ type: "widen" });
        g.runAlive(3);
        const partlySpent = g.T.state.widthEffect.remaining;
        g.T.applyPowerup({ type: "widen" });
        a.gt(g.T.state.widthEffect.remaining, partlySpent, "the clock should have been refreshed");
      },
    },
    {
      name: "narrow overrides an active widen",
      fn(a) {
        const g = boot().start();
        g.T.applyPowerup({ type: "widen" });
        const wide = g.T.paddleWidth();
        g.T.applyPowerup({ type: "narrow" });
        a.lt(g.T.paddleWidth(), wide, "narrow should take over from widen");
      },
    },
    {
      name: "losing a life clears every active effect",
      fn(a) {
        const g = boot().start();
        g.T.applyPowerup({ type: "widen" });
        g.T.applyPowerup({ type: "fast" });
        a.ok(g.T.state.widthEffect && g.T.state.speedEffect);

        g.T.state.balls.length = 0;
        g.frame();

        a.not(g.T.state.widthEffect, "width effect should be cleared on a life loss");
        a.not(g.T.state.speedEffect, "speed effect should be cleared on a life loss");
        a.eq(g.T.paddleWidth(), g.T.state.paddle.baseW);
      },
    },
    {
      name: "starting a level clears effects and pending drops",
      fn(a) {
        const g = boot().start();
        g.T.applyPowerup({ type: "widen" });
        g.T.state.drops.push({ x: 10, y: 10, def: g.T.POWERUPS[0] });
        g.T.startLevel(1);
        a.not(g.T.state.widthEffect, "a new level should start clean");
        a.empty(g.T.state.drops, "drops should not carry across levels");
      },
    },
    {
      name: "the paddle stays inside the field when it grows at the wall",
      fn(a) {
        const g = boot().start();
        g.hold("ArrowRight");
        g.run(3); // park against the right wall
        g.T.applyPowerup({ type: "widen" });
        g.frame();
        a.lte(g.T.state.paddle.x + g.T.paddleWidth(), g.T.GAME_W + 1e-9,
          "growing at the wall pushed the paddle out of the field");
      },
    },
  ],
};
