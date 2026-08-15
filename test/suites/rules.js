"use strict";
/*
  Scoring, brick durability, level progression and power-up effects on game state.
*/

const { boot } = require("../dom-stub");

// A hall-of-fame board already full of higher scores than anything set below
// — seeded via the storage boot option so ending a run goes straight to
// victory/gameover, not a "nameentry" detour (#42); hall-of-fame behaviour
// itself is covered in regressions.js.
const FULL_HOF = JSON.stringify(
  Array.from({ length: 10 }, (_, i) => ({ name: "CPU", score: 999000 - i }))
);

// Drive the ball into a specific brick. Placed overlapping with a near-zero
// speed so the frame resolves the collision without moving anywhere else.
function hitBrick(g, brick) {
  const b = g.T.state.balls[0];
  b.attached = false;
  b.x = brick.x + brick.w / 2;
  b.y = brick.y + brick.h + b.r - 2;
  b.dx = 0;
  b.dy = -1;
  b.speed = 1;
  g.frame();
}

function findBrick(g, type) {
  return g.T.state.bricks.find((b) => b.alive && b.type === type);
}

module.exports = {
  name: "rules — scoring, bricks, lives, power-ups",
  tests: [
    {
      name: "destroying a brick scores and removes it",
      fn(a) {
        const g = boot().start();
        const brick = findBrick(g, "1");
        a.ok(brick, "level 1 should contain a plain brick");
        a.eq(g.T.state.score, 0);
        hitBrick(g, brick);
        a.eq(brick.alive, false, "the brick should be destroyed");
        a.eq(g.T.state.score, 10, "a plain brick on level 1 scores 10");
      },
    },
    {
      name: "brick value scales with the level number",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        g.T.startLevel(2); // third level
        g.key("Space");
        const brick = findBrick(g, "1") || findBrick(g, "2");
        hitBrick(g, brick);
        a.eq(g.T.state.score, 30, "a plain brick on level 3 should score 10 × 3");
      },
    },
    {
      name: "a silver brick takes two hits and scores more",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        g.T.startLevel(1); // first level containing silver
        g.key("Space");
        const brick = findBrick(g, "S");
        a.ok(brick, "level 2 should contain a silver brick");

        hitBrick(g, brick);
        a.eq(brick.alive, true, "silver should survive the first hit");
        a.eq(brick.type, "Sc", "silver should show its cracked state");
        a.eq(g.T.state.score, 0, "a cracked brick scores nothing yet");

        hitBrick(g, brick);
        a.eq(brick.alive, false, "silver should break on the second hit");
        a.eq(g.T.state.score, 30, "a cracked silver on level 2 scores 15 × 2");
      },
    },
    {
      name: "indestructible bricks never break",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        g.T.startLevel(3); // first level containing walls
        g.key("Space");
        const wall = findBrick(g, "#");
        a.ok(wall, "level 4 should contain an indestructible brick");
        for (let i = 0; i < 5; i++) hitBrick(g, wall);
        a.eq(wall.alive, true, "an indestructible brick must survive any number of hits");
        a.eq(g.T.state.score, 0, "hitting a wall must not score");
      },
    },
    {
      name: "indestructible bricks do not block level completion",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        g.T.startLevel(3);
        g.key("Space");
        const walls = g.T.state.bricks.filter((b) => b.hp === Infinity);
        a.gt(walls.length, 0, "this level should have walls");
        // Bypassing brickHit means the remainingBricks counter it maintains
        // (see #16) has to be kept in sync by hand here.
        g.T.state.bricks.forEach((b) => { if (b.hp !== Infinity) b.alive = false; });
        g.T.state.remainingBricks = 0;
        g.frame();
        a.eq(g.T.state.phase, "levelclear", "walls left standing should not prevent a clear");
        a.ok(walls.every((w) => w.alive), "the walls should still be there");
      },
    },
    {
      name: "a level is not complete while any destructible brick stands",
      fn(a) {
        const g = boot().start();
        const bricks = g.T.state.bricks.filter((b) => b.hp !== Infinity);
        bricks.forEach((b, i) => { b.alive = i === 0; }); // leave exactly one
        // Bypassing brickHit means the remainingBricks counter it maintains
        // (see #16) has to be kept in sync by hand here.
        g.T.state.remainingBricks = 1;
        g.frame();
        a.eq(g.T.state.phase, "playing", "one brick left should keep the level going");
        bricks[0].alive = false;
        g.T.state.remainingBricks = 0;
        g.frame();
        a.eq(g.T.state.phase, "levelclear");
      },
    },
    {
      name: "every level is loadable and has at least one destructible brick",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        for (let i = 0; i < g.T.CONFIG.progression.totalLevels; i++) {
          g.T.startLevel(i);
          const destructible = g.T.state.bricks.filter((b) => b.hp !== Infinity);
          a.gt(destructible.length, 0, `level ${i + 1} has nothing to destroy`);
          a.eq(g.T.state.levelIndex, i);
        }
      },
    },
    {
      name: "bricks are laid out inside the play field",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        for (let i = 0; i < g.T.CONFIG.progression.totalLevels; i++) {
          g.T.startLevel(i);
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
      name: "the extra-life power-up is capped",
      fn(a) {
        const g = boot().start();
        for (let i = 0; i < 10; i++) g.T.applyPowerup({ type: "life" });
        a.eq(g.T.state.lives, g.T.state.maxLives, "lives should stop at maxLives");
      },
    },
    {
      name: "multi-ball adds balls but never exceeds the cap",
      fn(a) {
        const g = boot().start();
        a.eq(g.T.state.balls.length, 1);
        for (let i = 0; i < 10; i++) g.T.applyPowerup({ type: "multi" });
        a.lte(g.T.state.balls.length, 5, "the ball count must stay within the cap");
        a.gt(g.T.state.balls.length, 1, "multi-ball should actually add balls");
      },
    },
    {
      name: "multi-ball clones inherit the speed of the ball in play",
      fn(a) {
        const g = boot().start();
        const base = g.T.state.balls[0];
        g.T.applyPowerup({ type: "multi" });
        for (const b of g.T.state.balls) {
          a.eq(b.speed, base.speed, "clones should share the source ball's speed");
          a.near(Math.hypot(b.dx, b.dy), 1, 1e-9, "clones should have a unit direction");
        }
      },
    },
    {
      name: "a drop caught by the paddle is collected, one that misses is discarded",
      fn(a) {
        const g = boot().start();
        const p = g.T.state.paddle;
        const def = g.T.POWERUPS.find((d) => d.type === "widen");

        g.T.state.drops.push({ x: p.x + g.T.paddleWidth() / 2, y: p.y - 4, def });
        g.frame();
        a.empty(g.T.state.drops, "the drop should have been collected");
        a.ok(g.T.state.widthEffect, "collecting widen should start the effect");

        g.T.state.widthEffect = null;
        g.T.state.drops.push({ x: 5, y: g.T.GAME_H + 30, def });
        g.frame();
        a.empty(g.T.state.drops, "a drop past the floor should be discarded");
        a.not(g.T.state.widthEffect, "a missed drop must not apply its effect");
      },
    },
    {
      name: "drops fall downward",
      fn(a) {
        const g = boot().start();
        const def = g.T.POWERUPS[0];
        g.T.state.drops.push({ x: 100, y: 100, def });
        const before = g.T.state.drops[0].y;
        g.frame();
        a.gt(g.T.state.drops[0].y, before, "drops should move down the screen");
      },
    },
    {
      name: "the best score tracks and survives a restart",
      fn(a) {
        const g = boot({ storage: { "neonbreak-hall-of-fame": FULL_HOF } }).start();
        g.T.state.score = 1234;
        g.T.state.lives = 1;
        g.T.state.balls.length = 0;
        g.frame();
        a.eq(g.T.state.phase, "gameover");
        a.eq(g.T.state.best, 1234, "the best score should have been updated");
        a.eq(g.store["neonbreak-best-score"], "1234", "and persisted");
        g.el("btn-restart").click(1);
        a.eq(g.T.state.score, 0, "the running score resets");
        a.eq(g.T.state.best, 1234, "the best score does not");
      },
    },
    {
      name: "a lower score does not overwrite the best",
      fn(a) {
        const g = boot({ storage: { "neonbreak-best-score": "5000" } });
        a.eq(g.T.state.best, 5000);
        g.start();
        g.T.state.score = 10;
        g.T.state.lives = 1;
        g.T.state.balls.length = 0;
        g.frame();
        a.eq(g.T.state.best, 5000, "the best score should not have been lowered");
      },
    },
    {
      name: "power-up drop definitions are well formed",
      fn(a) {
        for (const p of boot().T.POWERUPS) {
          a.ok(typeof p.type === "string" && p.type, "each power-up needs a type");
          a.match(p.color, /^#[0-9a-f]{6}$/i, `power-up ${p.type} needs a hex colour`);
          a.gt(p.weight, 0, `power-up ${p.type} needs a positive weight`);
          a.ok(typeof p.label === "string" && p.label.length <= 2,
            `power-up ${p.type} needs a short label`);
        }
      },
    },
  ],
};
