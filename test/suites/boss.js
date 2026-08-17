"use strict";
/*
  Boss levels (#44): the ten fights at levels 10, 20, ..., 100, each replacing
  the layout that used to sit there.

  Regressions.js already covers the places bosses touch findings that predate
  them (#41, #42, #68, #72, #73 — see clearBricks()'s boss branch there). This
  suite is the feature's own area: the roster's shape, level identification,
  the boss surviving a lost ball, damage and defeat, and the two hazard kinds
  (a shot aimed at the paddle, a minion the ball can destroy).
*/

const { boot } = require("../dom-stub");

// A hall-of-fame board already full of higher scores than a boss fight's
// score/kill-bonus haul can reach — seeded so a win routes straight to
// victory instead of detouring through nameentry (#42); that detour is
// regressions.js's territory (#72b/#73b already cover it for a boss level).
const FULL_HOF = JSON.stringify(
  Array.from({ length: 10 }, (_, i) => ({ name: "CPU", score: 999000 - i }))
);

// Drive a ball straight up into a boss part, overlapping it, at a speed low
// enough that one frame resolves the hit without also crossing the paddle or
// a wall — the same trick rules.js's hitBrick() uses for ordinary bricks.
function hitPart(g, part) {
  const b = g.T.state.balls[0];
  b.attached = false;
  b.x = part.x + part.w / 2;
  b.y = part.y + part.h + b.r - 2;
  b.dx = 0;
  b.dy = -1;
  b.speed = 1;
  g.frame();
}

// Stub every alive part but one directly (hp/alive set by hand, like
// clearBricks() does for ordinary bricks), then land one real hit on what's
// left — that final blow goes through the genuine bossPartHit() path, so
// onPartDown/onDepleted/bossDefeated all fire for real rather than being
// simulated by the test. Polls briefly first in case the one remaining part
// is mid-shield or mid-blink when picked, rather than assuming it is
// hittable the instant it is chosen.
//
function landFinalHit(g) {
  const parts = g.T.state.boss.parts.filter((p) => p.alive);
  parts.slice(0, -1).forEach((p) => { p.hp = 0; p.alive = false; });
  const last = parts[parts.length - 1];
  last.hp = 1;
  for (let i = 0; i < 200 && !(last.alive && last.solid && last.vulnerable); i++) g.frame();
  hitPart(g, last);
}

// #74: a kill that reaches bossDefeated() no longer clears the level on the
// same frame — it opens state.boss.deathBeat (explosion, then fanfare)
// first. Fast-forward through that here too, so callers asserting the level
// actually cleared don't each have to know about the beat.
function finishBoss(g) {
  landFinalHit(g);
  for (let i = 0; i < 500 && g.T.state.boss.deathBeat; i++) g.frame();
}

function enterBoss(bossNumber) {
  // bossNumber 1..10 -> level index 9, 19, ..., 99.
  const g = boot();
  g.el("btn-start").click(1);
  g.T.startLevel(bossNumber * 10 - 1);
  g.key("Space");
  return g;
}

module.exports = {
  name: "boss — the ten boss levels",
  tests: [
    {
      name: "the roster has ten well-formed entries, one per language string",
      fn(a) {
        const { BOSSES, STRINGS, SUPPORTED_LANGS } = boot().T;
        a.eq(BOSSES.length, 10, "one boss per level ending in 0, 10 through 100");
        const missing = [];
        BOSSES.forEach((def) => {
          a.ok(typeof def.id === "string" && def.id, "every boss needs an id");
          a.ok(Array.isArray(def.arena), `${def.id}: arena must be a row array`);
          def.arena.forEach((row) => a.eq(row.length, 10, `${def.id}: arena row must be 10 columns wide`));
          a.gt(def.killBonus, 0, `${def.id}: needs a positive kill bonus`);
          a.eq(typeof def.spawn, "function", `${def.id}: needs spawn()`);
          a.eq(typeof def.update, "function", `${def.id}: needs update()`);
          a.eq(typeof def.fire, "function", `${def.id}: needs fire()`);
          SUPPORTED_LANGS.forEach((lang) => {
            const key = "boss." + def.id + ".name";
            if (!(key in STRINGS[lang])) missing.push(lang + ":" + key);
          });
        });
        a.empty(missing, `roster entries with no name string: ${missing.join(", ")}`);
        a.eq(new Set(BOSSES.map((x) => x.id)).size, BOSSES.length, "duplicate id in the roster");
      },
    },
    {
      name: "every tenth level is a boss, and only those",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        for (let i = 0; i < g.T.CONFIG.progression.totalLevels; i++) {
          g.T.startLevel(i);
          const shouldBeBoss = (i + 1) % 10 === 0;
          a.eq(!!g.T.state.boss, shouldBeBoss, `level ${i + 1}: boss presence disagrees with the cadence`);
          if (shouldBeBoss) {
            a.eq(g.T.state.boss.defIdx, (i + 1) / 10 - 1, `level ${i + 1}: wrong boss selected`);
          }
        }
      },
    },
    {
      name: "a fresh boss has all its parts alive and at full health",
      fn(a) {
        for (let n = 1; n <= 10; n++) {
          const g = enterBoss(n);
          const b = g.T.state.boss;
          a.ok(b.parts.length > 0, `boss ${n}: no parts spawned`);
          b.parts.forEach((p) => {
            a.eq(p.alive, true, `boss ${n}: a part starts dead`);
            a.eq(p.hp, p.maxHp, `boss ${n}: a part starts damaged`);
          });
        }
      },
    },
    {
      name: "the level does not clear while the boss still stands",
      fn(a) {
        const g = enterBoss(1);
        g.frame();
        a.eq(g.T.state.phase, "playing", "an untouched boss should not end the level");
        a.eq(g.T.state.remainingBricks, 0, "a boss level's arena never gates completion");
      },
    },
    {
      name: "a ball striking a vulnerable part damages it, scores, and bounces off",
      fn(a) {
        const g = enterBoss(1); // Sentinel — always vulnerable, no shield/blink
        const part = g.T.state.boss.parts[0];
        const before = { hp: part.hp, score: g.T.state.score };
        const ball = g.T.state.balls[0];
        hitPart(g, part);
        a.eq(part.hp, before.hp - 1, "the hit part should have lost one hit point");
        a.gt(g.T.state.score, before.score, "a vulnerable hit should score");
        // The ball approached from underneath (like hitBrick() does for an
        // ordinary brick), so a bounce off that face sends it back down.
        a.gt(ball.dy, 0, "the ball should bounce off the boss's underside");
      },
    },
    {
      name: "defeating the boss clears the level and awards the kill bonus",
      fn(a) {
        const g = enterBoss(1);
        const before = g.T.state.score;
        finishBoss(g);
        a.eq(g.T.state.boss.dead, true);
        a.eq(g.T.state.phase, "levelclear");
        a.gt(g.T.state.score, before, "the kill bonus should have been added");
      },
    },
    {
      name: "clearing the last boss (Omega) wins the campaign",
      fn(a) {
        const g = boot({ storage: { "neonbreak-hall-of-fame": FULL_HOF } });
        g.el("btn-start").click(1);
        g.T.startLevel(g.T.CONFIG.progression.totalLevels - 1);
        g.key("Space");
        // Omega has three phases; finishBoss() only empties the current one.
        // Run it three times, letting the transition beat pass in between.
        for (let phase = 0; phase < 3; phase++) {
          finishBoss(g);
          if (g.T.state.boss.transition) g.run(g.T.CONFIG.boss.roarDuration + 0.1);
        }
        a.eq(g.T.state.phase, "victory", "beating Omega's third phase should win the game");
      },
    },
    {
      name: "a boss's hit points survive losing a ball, but its hazards do not",
      fn(a) {
        const g = enterBoss(1);
        const part = g.T.state.boss.parts[0];
        hitPart(g, part);
        const hpAfterHit = part.hp;
        g.T.state.bossShots.push({ x: 1, y: 1, vx: 0, vy: 0, kind: "drop", onPaddle: "narrow", r: 6, telegraph: 0, dur: 0, active: 0 });
        g.T.state.minions.push({ x: 1, y: 1, vx: 0, vy: 0, r: 9, kind: "drift" });
        g.T.state.lives = 3;
        g.loseBall();
        a.eq(g.T.state.boss.parts[0].hp, hpAfterHit, "the boss's damage must not reset on a lost ball");
        a.empty(g.T.state.bossShots, "leftover hazards must not carry into the next serve");
        a.empty(g.T.state.minions, "leftover minions must not carry into the next serve");
      },
    },
    {
      name: "a boss shot that reaches the paddle applies its hazard",
      fn(a) {
        const g = enterBoss(2); // Salvo — a simple falling "drop" shot
        const p = g.T.state.paddle;
        g.T.state.bossShots = [{
          x: p.x + g.T.paddleWidth() / 2, y: p.y - 1, vx: 0, vy: 50,
          kind: "drop", onPaddle: "narrow", r: 6, telegraph: 0, dur: 0, active: 0,
        }];
        a.not(g.T.state.widthEffect, "narrow should not be active yet");
        g.frame();
        a.empty(g.T.state.bossShots, "the shot should have been consumed on the hit");
        a.ok(g.T.state.widthEffect, "narrow should now be active");
        a.lt(g.T.state.widthEffect.mult, 1, "narrow should shrink the paddle");
      },
    },
    {
      name: "Leviathan's shot costs a life outright",
      fn(a) {
        const g = enterBoss(9);
        const p = g.T.state.paddle;
        const before = g.T.state.lives;
        g.T.state.bossShots = [{
          x: p.x + g.T.paddleWidth() / 2, y: p.y - 1, vx: 0, vy: 50,
          kind: "drop", onPaddle: "life", r: 6, telegraph: 0, dur: 0, active: 0,
        }];
        g.frame();
        a.eq(g.T.state.lives, before - 1, "a Leviathan shot should cost exactly one life");
      },
    },
    {
      name: "a minion can be destroyed by the ball, and scores",
      fn(a) {
        const g = enterBoss(6); // The Hive — the boss that spawns minions
        g.T.state.minions = [{ x: 200, y: 200, vx: 0, vy: 0, r: 9, kind: "drift" }];
        const ball = g.T.state.balls[0];
        ball.attached = false;
        ball.x = 200; ball.y = 200; ball.dx = 0; ball.dy = -1; ball.speed = 1;
        const before = g.T.state.score;
        g.frame();
        a.empty(g.T.state.minions, "a ball touching a minion should destroy it");
        a.gt(g.T.state.score, before, "destroying a minion should score");
      },
    },
    {
      name: "a minion reaching the paddle line detonates instead of scoring",
      fn(a) {
        const g = enterBoss(6);
        const p = g.T.state.paddle;
        g.T.state.minions = [{ x: p.x - 200, y: p.y - 1, vx: 0, vy: 0, r: 9, kind: "drift" }];
        const before = g.T.state.score;
        g.frame();
        a.empty(g.T.state.minions, "a minion at the paddle line should be gone");
        a.eq(g.T.state.score, before, "reaching the line should not score like a kill");
        a.ok(g.T.state.widthEffect, "reaching the line should apply its hazard");
      },
    },
    {
      name: "Omega transitions through three phases rather than dying at 2/3",
      fn(a) {
        const g = boot();
        g.el("btn-start").click(1);
        g.T.startLevel(g.T.CONFIG.progression.totalLevels - 1);
        g.key("Space");
        a.eq(g.T.state.boss.phase, 0);
        finishBoss(g);
        a.eq(g.T.state.boss.dead, false, "phase 1 of 3 down should not defeat Omega yet");
        a.ok(g.T.state.boss.transition, "a phase change should open the roar beat");
        g.run(g.T.CONFIG.boss.roarDuration + 0.1);
        a.not(g.T.state.boss.transition, "the roar beat should have ended");
        a.eq(g.T.state.boss.phase, 1, "the boss should have moved to its second phase");
        a.ok(g.T.state.boss.parts.some((p) => p.alive), "the new phase should have live parts");
      },
    },
    {
      name: "defeating a boss marks the achievements it feeds",
      fn(a) {
        const g = enterBoss(3);
        a.eq(g.T.state.achStats.bossesBeaten, 0);
        finishBoss(g);
        a.eq(g.T.state.achStats.bossesBeaten, 1);
        a.eq(g.T.state.achStats.flawlessBoss, true, "no ball was lost this fight");
        const { ACHIEVEMENTS } = g.T;
        const slayer = ACHIEVEMENTS.find((x) => x.id === "bossSlayer");
        a.ok(slayer.when(g.T.state), "bossSlayer's condition should now read true");
      },
    },
    {
      name: "#74 — the boss explodes silently, then the fanfare plays, then the level clears",
      fn(a) {
        const g = enterBoss(1);
        landFinalHit(g);
        a.eq(g.T.state.phase, "playing", "the level must not clear the instant the boss dies");
        a.ok(g.T.state.boss.deathBeat, "a death beat should be running");
        a.eq(g.T.state.boss.deathBeat.stage, "explode", "it should start with the silent explosion");
        const notesAfterHit = g.notes.length; // the hit's own feedback beep, not the fanfare

        g.frame(); g.frame(); g.frame(); // a little further into the explosion, still well under it
        a.eq(g.T.state.boss.deathBeat.stage, "explode", "should still be exploding this soon after the kill");
        a.eq(g.notes.length, notesAfterHit, "no fanfare notes should play during the silent explosion");

        g.run(1.5); // comfortably past the explosion
        a.eq(g.T.state.phase, "playing", "still not cleared — the fanfare is what plays next");
        a.eq(g.T.state.boss.deathBeat.stage, "fanfare", "the explosion should have handed off to the fanfare");
        a.gt(g.notes.length, notesAfterHit + 5, "the fanfare should have started playing");

        g.run(6); // comfortably past the fanfare
        a.not(g.T.state.boss.deathBeat, "the death beat should be over");
        a.eq(g.T.state.phase, "levelclear", "the level should only clear once the fanfare finishes");
      },
    },
    {
      name: "#74 — nothing but the death beat runs while it is playing out",
      fn(a) {
        const g = enterBoss(1);
        landFinalHit(g);
        const ball = { ...g.T.state.balls[0] };
        const paddleX = g.T.state.paddle.x;
        g.T.state.pointerX = paddleX + 200; // would move the paddle if it were still listening
        g.frame();
        a.eq(g.T.state.paddle.x, paddleX, "the paddle must not move during the death beat");
        a.eq(g.T.state.balls[0].x, ball.x, "the ball must not move during the death beat");
        a.eq(g.T.state.balls[0].y, ball.y, "the ball must not move during the death beat");
      },
    },
    {
      name: "#74 — a bigger boss goes out with a bigger burst and a longer shake",
      fn(a) {
        // Runs the death beat's silent "explode" stage to its own end — the
        // moment it hands off to "fanfare" is exactly when the big finishing
        // blast (the part that scales with the boss) has just fired, and
        // before any of it has had time to decay.
        function explosionEffect(g) {
          landFinalHit(g);
          g.T.state.particles.length = 0; // clear the ordinary per-hit feedback burst
          for (let i = 0; i < 200 && g.T.state.boss.deathBeat.stage === "explode"; i++) g.frame();
          return { particles: g.T.state.particles.length, shakeDur: g.T.state.shake.duration };
        }
        const sentinel = explosionEffect(enterBoss(1)); // defIdx 0

        const o = boot();
        o.el("btn-start").click(1);
        o.T.startLevel(o.T.CONFIG.progression.totalLevels - 1); // Omega, defIdx 9
        o.key("Space");
        for (let phase = 0; phase < 2; phase++) {
          finishBoss(o); // phases 0/1 only transition — no death beat to fast-forward through
          if (o.T.state.boss.transition) o.run(o.T.CONFIG.boss.roarDuration + 0.2);
        }
        const omega = explosionEffect(o);

        a.gt(omega.particles, sentinel.particles, "Omega's defeat burst should be bigger than Sentinel's");
        a.gt(omega.shakeDur, sentinel.shakeDur, "Omega's defeat shake should last longer than Sentinel's");
      },
    },
    {
      name: "#74 — the fanfare runs close to five seconds, layers several instruments, and is silent when muted",
      fn(a) {
        const g = enterBoss(1);
        landFinalHit(g);
        g.run(1.5); // past the silent explosion, into the fanfare
        const fanfare = g.notes.slice(-40); // generously more than the fanfare's own note count
        const t0 = Math.min(...fanfare.map((n) => n.at));
        const lastAt = Math.max(...fanfare.map((n) => n.at));
        const span = lastAt - t0;
        a.gt(span, 3.5, "the fanfare should run a real length, not a blip");
        a.lt(span, 6, "and stay close to the requested five seconds");

        const types = new Set(fanfare.map((n) => n.type));
        a.gte(types.size, 3, `the fanfare should layer several instrument voices, found only ${[...types]}`);
        a.ok(fanfare.some((n) => n.type === "noise"), "the fanfare should include the kick/hat percussion");

        const muted = enterBoss(1);
        muted.T.state.muted = true;
        landFinalHit(muted);
        muted.notes.length = 0;
        muted.run(1.5);
        a.empty(muted.notes, "a muted game must not queue a single note, fanfare included");
      },
    },
  ],
};
