"use strict";
/*
  Per-frame budgets, measured with the counters the DOM stub keeps.
*/

const { boot } = require("../dom-stub");

// A frame with drops on screen, which is where the render loop is at its worst.
function frameWithDrops(g, count) {
  const def = g.T.POWERUPS[0];
  for (let i = 0; i < (count || 3); i++) {
    g.T.state.drops.push({ x: 60 + i * 60, y: 200, def });
  }
  g.counters.reset();
  g.frame();
  return g.counters;
}

module.exports = {
  name: "perf — per-frame budgets",
  tests: [
    {
      name: "#14 — the render loop never forces a style recalculation",
      fn(a) {
        const g = boot().start();
        const c = frameWithDrops(g, 3);
        a.eq(c.getComputedStyle, 0,
          `drawDrops called getComputedStyle ${c.getComputedStyle} time(s) in one frame; ` +
          `each call forces a synchronous style recalculation`);
      },
    },
    {
      name: "#15 — a frame with no state change writes nothing to the DOM",
      fn(a) {
        const g = boot().start();
        g.runAlive(0.2);
        g.counters.reset();
        g.frame();
        a.eq(g.counters.textWrites, 0,
          `an idle frame wrote to the DOM ${g.counters.textWrites} time(s); the HUD only needs ` +
          `rewriting when a displayed value actually changes`);
      },
    },
    {
      name: "the per-frame canvas work stays bounded as bricks are destroyed",
      fn(a) {
        const g = boot().start();
        g.counters.reset();
        g.frame();
        const full = g.counters.canvasOps;

        g.T.state.bricks.forEach((b, i) => { if (i % 2) b.alive = false; });
        g.counters.reset();
        g.frame();
        const half = g.counters.canvasOps;

        a.lt(half, full, "destroyed bricks should stop costing draw calls");
      },
    },
    {
      name: "particles are cleaned up rather than accumulating",
      fn(a) {
        const g = boot().start();
        // Bursts come from brick hits; drive a long run and watch the ceiling.
        let peak = 0;
        for (let i = 0; i < 600; i++) {
          const ball = g.T.state.balls[0];
          if (ball) g.T.state.pointerX = ball.x;
          g.frame();
          peak = Math.max(peak, g.T.state.particles.length);
          if (g.T.state.phase !== "playing") break;
        }
        a.lt(peak, 400, `particle count peaked at ${peak}, which suggests they are not expiring`);
        g.runAlive(2);
        a.lt(g.T.state.particles.length, peak || 1,
          "particles should drain once the bursts stop");
      },
    },
    {
      name: "drops do not accumulate off-screen",
      fn(a) {
        const g = boot().start();
        const def = g.T.POWERUPS[0];
        // Track identity: normal play keeps spawning fresh drops, so asserting
        // the array is empty at the end would be testing the wrong thing.
        const mine = [];
        for (let i = 0; i < 20; i++) {
          const drop = { x: 10 + i, y: g.T.GAME_H - 40, def };
          mine.push(drop);
          g.T.state.drops.push(drop);
        }
        g.runAlive(3);
        const stuck = mine.filter((d) => g.T.state.drops.includes(d));
        a.empty(stuck, `${stuck.length} drops were still held after falling past the floor`);
      },
    },
  ],
};
