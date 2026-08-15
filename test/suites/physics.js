"use strict";
/*
  Ball movement and collision.

  Two kinds of test here. The first are deterministic single-bounce cases with
  the ball placed by hand. The second is a randomised sweep: thousands of seeded
  frames with an auto-player keeping the ball alive, asserting a set of
  invariants after every single frame. The sweep is what catches the failures
  unit tests miss — a direction vector that slowly denormalises, a ball that
  settles into an unwinnable horizontal loop, an occasional NaN.
*/

const { boot } = require("../dom-stub");

// Put a single ball exactly where we want it, with a known direction.
function place(g, { x, y, dx, dy, speed }) {
  const b = g.T.state.balls[0];
  b.x = x;
  b.y = y;
  b.dx = dx;
  b.dy = dy;
  b.attached = false;
  if (speed !== undefined) b.speed = speed;
  return b;
}

function len(b) { return Math.hypot(b.dx, b.dy); }

// The levels the randomised sweeps below run over: every authored level, plus a
// spread of generated ones (#41). Sweeping all 100 would triple a suite that
// runs in ~1.3s today for coverage the sample already gives — the generated
// levels differ by archetype and type mix, not one by one.
function sweptLevels(g) {
  const authored = g.T.LEVELS.length;
  const sampled = [15, 30, 50, 75, 100].map((n) => n - 1);
  return Array.from({ length: authored }, (_, i) => i).concat(sampled);
}

// Auto-player: keep the paddle under the ball so a sweep can run for a long time.
function autoplay(g) {
  const b = g.T.state.balls[0];
  if (b) g.T.state.pointerX = b.x;
}

function checkInvariants(a, g, opts) {
  const { GAME_W, GAME_H } = g.T;
  const strictDy = opts && opts.strictDy;
  for (const b of g.T.state.balls) {
    a.ok(isFinite(b.x) && isFinite(b.y), `ball position went non-finite: ${b.x},${b.y}`);
    a.ok(isFinite(b.dx) && isFinite(b.dy), `ball direction went non-finite: ${b.dx},${b.dy}`);
    // An attached ball (serving, or caught by the sticky powerup, #30) is
    // stationary by design — dx/dy are deliberately 0, not a unit vector.
    if (!b.attached) {
      a.near(len(b), 1, 1e-9, "the direction vector stopped being a unit vector");
    }
    a.gte(b.x, -b.r - 1, "ball escaped through the left wall");
    a.lte(b.x, GAME_W + b.r + 1, "ball escaped through the right wall");
    a.gte(b.y, -b.r - 1, "ball escaped through the ceiling");
    a.lte(b.y, GAME_H + b.r + 200, "ball is implausibly far below the floor");
    if (strictDy) {
      // The paddle bounce maps to at most ±1.05 rad from vertical, so |dy| can
      // never legitimately fall below sin(pi/2 - 1.05) ≈ 0.497. A ball that goes
      // flatter than that is trapped bouncing between the side walls forever.
      a.gte(Math.abs(b.dy), 0.49,
        `ball is nearly horizontal (dy=${b.dy.toFixed(4)}) and cannot make progress`);
    }
  }
  const p = g.T.state.paddle;
  a.gte(p.x, 0, "the paddle left the field on the left");
  a.lte(p.x, GAME_W - g.T.paddleWidth() + 1e-9, "the paddle left the field on the right");
}

module.exports = {
  name: "physics — collision and invariants",
  tests: [
    {
      name: "bounces off the left wall and stays inside it",
      fn(a) {
        const g = boot().start();
        const b = place(g, { x: 8, y: 300, dx: -1, dy: 0.0001, speed: 400 });
        g.frame();
        a.gt(b.dx, 0, "should now be travelling right");
        a.gte(b.x, b.r, "should be repositioned inside the wall");
      },
    },
    {
      name: "bounces off the right wall and stays inside it",
      fn(a) {
        const g = boot().start();
        const b = place(g, { x: g.T.GAME_W - 8, y: 300, dx: 1, dy: 0.0001, speed: 400 });
        g.frame();
        a.lt(b.dx, 0, "should now be travelling left");
        a.lte(b.x, g.T.GAME_W - b.r, "should be repositioned inside the wall");
      },
    },
    {
      name: "bounces off the ceiling",
      fn(a) {
        const g = boot().start();
        // Below the brick field so only the ceiling is in play.
        const b = place(g, { x: 240, y: 8, dx: 0.0001, dy: -1, speed: 400 });
        g.frame();
        a.gt(b.dy, 0, "should now be travelling down");
        a.gte(b.y, b.r);
      },
    },
    {
      name: "a descending ball bounces off the paddle",
      fn(a) {
        const g = boot().start();
        const p = g.T.state.paddle;
        const b = place(g, { x: p.x + g.T.paddleWidth() / 2, y: p.y - 10, dx: 0, dy: 1, speed: 300 });
        g.frame();
        a.lt(b.dy, 0, "the ball should be sent back up");
        a.lt(b.y, p.y, "the ball should end up above the paddle");
      },
    },
    {
      name: "where the ball hits the paddle steers it",
      fn(a) {
        const g = boot().start();
        const p = g.T.state.paddle;
        const w = g.T.paddleWidth();

        const hit = (offsetFraction) => {
          const b = place(g, {
            x: p.x + w / 2 + (w / 2) * offsetFraction,
            y: p.y - 10, dx: 0, dy: 1, speed: 300,
          });
          g.frame();
          return b.dx;
        };

        a.lt(hit(-0.9), -0.1, "a hit near the left edge should send the ball left");
        a.gt(hit(0.9), 0.1, "a hit near the right edge should send the ball right");
        a.near(hit(0), 0, 0.05, "a centre hit should go nearly straight up");
      },
    },
    {
      name: "the ball always leaves the paddle travelling upward",
      fn(a) {
        const g = boot().start();
        const p = g.T.state.paddle;
        const w = g.T.paddleWidth();
        for (let f = -1; f <= 1; f += 0.25) {
          const b = place(g, {
            x: p.x + w / 2 + (w / 2) * f, y: p.y - 10, dx: 0, dy: 1, speed: 300,
          });
          g.frame();
          a.lt(b.dy, 0, `hit at offset ${f} did not send the ball upward`);
          a.near(Math.hypot(b.dx, b.dy), 1, 1e-9, "paddle bounce denormalised the direction");
        }
      },
    },
    {
      name: "hitting a brick from below reverses vertical travel",
      fn(a) {
        const g = boot().start();
        const brick = g.T.state.bricks.find((b) => b.alive && b.hp !== Infinity);
        const b = place(g, {
          x: brick.x + brick.w / 2,
          y: brick.y + brick.h + 5,
          dx: 0, dy: -1, speed: 200,
        });
        g.frame();
        a.gt(b.dy, 0, "should be deflected back downward");
      },
    },
    {
      name: "hitting a brick from the side reverses horizontal travel",
      fn(a) {
        const g = boot().start();
        const brick = g.T.state.bricks.find((b) => b.alive && b.hp !== Infinity);
        const b = place(g, {
          x: brick.x - 6,
          y: brick.y + brick.h / 2,
          dx: 1, dy: 0.0001, speed: 100,
        });
        g.frame();
        a.lt(b.dx, 0, "should be deflected back to the left");
      },
    },
    {
      name: "a ball that falls past the floor is lost",
      fn(a) {
        const g = boot().start();
        const lost = place(g, { x: 240, y: g.T.GAME_H + 20, dx: 0, dy: 1, speed: 300 });
        const lives = g.T.state.lives;
        g.frame();
        // The ball is removed, then loseLife() serves a fresh one once #71's
        // beat has been spent — so assert on identity and lives, not on the
        // array length.
        a.eq(g.T.state.balls.indexOf(lost), -1, "the lost ball should no longer be in play");
        a.eq(g.T.state.lives, lives - 1, "a life should have been deducted");
        g.runLossBeat();
        a.eq(g.T.state.phase, "ready", "should be waiting to serve again");
      },
    },
    {
      name: "extra balls can be lost without costing a life",
      fn(a) {
        const g = boot().start();
        g.T.applyPowerup({ type: "multi" });
        a.gt(g.T.state.balls.length, 1, "multi-ball should have added balls");
        const lives = g.T.state.lives;
        // Drop all but one off the bottom.
        g.T.state.balls.slice(1).forEach((b) => { b.y = g.T.GAME_H + 50; b.dy = 1; });
        g.frame();
        a.eq(g.T.state.lives, lives, "losing a spare ball must not cost a life");
        a.eq(g.T.state.phase, "playing", "play should continue while a ball remains");
      },
    },
    {
      // #38: this used to be paper math — asserting the displacement formula
      // stayed under the paddle's thickness — which missed that the mid-level
      // difficulty ramp (state.difficultyMult) also multiplies into that same
      // displacement, on top of level speed and the fast power-up. Drive the
      // actual worst case through the real collision code instead.
      name: "the ball cannot tunnel through the paddle at the worst-case combined speed",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        g.T.startLevel(g.T.CONFIG.progression.totalLevels - 1); // fastest level
        g.key("Space");
        g.T.applyPowerup({ type: "fast" });   // speed-up power-up...
        g.T.state.difficultyMult = g.T.CONFIG.difficulty.max; // ...stacked with the ramp at its cap

        const ball = g.T.state.balls[0];
        const paddle = g.T.state.paddle;
        ball.x = paddle.x + g.T.paddleWidth() / 2;
        ball.y = paddle.y - ball.r - 1; // just above the paddle, heading straight down
        ball.dx = 0;
        ball.dy = 1;
        ball.attached = false;

        g.frame(33); // the frame loop clamps dt to this

        a.lt(ball.dy, 0, "the ball should have bounced off the paddle, not tunneled through it");
        a.lt(ball.y, paddle.y, "the ball should end up above the paddle, not past it");
      },
    },
    {
      name: "invariants hold over a long randomised run on every level",
      fn(a) {
        for (const level of sweptLevels(boot())) {
          const g = boot({ seed: 1000 + level });
          g.el("btn-start").click(1);
          g.T.startLevel(level);
          g.key("Space");
          for (let i = 0; i < 900; i++) {
            autoplay(g);
            // Power-ups are exercised in effects.js; clearing drops keeps this
            // sweep about collision alone, which lets the |dy| floor be strict.
            g.T.state.drops.length = 0;
            g.frame();
            if (g.T.state.phase !== "playing") break;
            checkInvariants(a, g, { strictDy: true });
          }
        }
      },
    },
    {
      name: "invariants still hold when power-ups are in play",
      fn(a) {
        // Same sweep, but every drop is collected the instant it appears. The
        // |dy| floor is not asserted here: multi-ball clones are spawned at an
        // angle offset that can legitimately produce a shallow ball (finding #12).
        for (const level of sweptLevels(boot())) {
          const g = boot({ seed: 7000 + level });
          g.el("btn-start").click(1);
          g.T.startLevel(level);
          g.key("Space");
          for (let i = 0; i < 700; i++) {
            autoplay(g);
            while (g.T.state.drops.length) {
              g.T.applyPowerup(g.T.state.drops.pop().def);
            }
            g.frame();
            if (g.T.state.phase !== "playing") break;
            checkInvariants(a, g, { strictDy: false });
          }
        }
      },
    },
    {
      name: "the ball never comes to rest inside a live brick",
      fn(a) {
        const g = boot({ seed: 4242 });
        g.el("btn-start").click(1);
        g.key("Space");
        for (let i = 0; i < 900; i++) {
          autoplay(g);
          g.T.state.drops.length = 0;
          g.frame();
          if (g.T.state.phase !== "playing") break;
          for (const b of g.T.state.balls) {
            for (const brick of g.T.state.bricks) {
              if (!brick.alive) continue;
              const inside =
                b.x > brick.x && b.x < brick.x + brick.w &&
                b.y > brick.y && b.y < brick.y + brick.h;
              a.not(inside, `ball centre ended a frame inside a live ${brick.type} brick`);
            }
          }
        }
      },
    },
  ],
};
