"use strict";
/*
  Storage behaviour, including the hostile case.

  The headline test here is that the game survives a localStorage that throws.
  That is not hypothetical: Safari private browsing, blocked site data and some
  sandboxed file:// contexts all throw on access, and because the best score is
  read while building `state`, an unguarded throw took down the whole IIFE and
  left a dead black canvas (finding #2).
*/

const { boot } = require("../dom-stub");

module.exports = {
  name: "persistence — storage, including when it is unavailable",
  tests: [
    {
      name: "the game boots when localStorage throws on every access",
      fn(a) {
        a.doesNotThrow(() => boot({ storageThrows: true }),
          "a throwing storage must not prevent the game from loading");
      },
    },
    {
      name: "and is fully playable with storage unavailable",
      fn(a) {
        const g = boot({ storageThrows: true });
        a.eq(g.T.state.phase, "start");
        a.eq(g.T.state.best, 0, "best score should fall back to zero");
        g.start();
        a.eq(g.T.state.phase, "playing");
        g.runAlive(1.0);
        a.eq(g.T.state.phase, "playing", "play should continue normally");
      },
    },
    {
      name: "a game can be completed with storage unavailable",
      fn(a) {
        const g = boot({ storageThrows: true }).start();
        g.T.state.score = 300;
        g.T.state.lives = 1;
        g.T.state.balls.length = 0;
        a.doesNotThrow(() => g.frame(), "writing the best score must not throw out of the loop");
        a.eq(g.T.state.phase, "gameover");
        a.eq(g.T.state.best, 300, "the best score should still update in memory");
      },
    },
    {
      name: "the language toggle works with storage unavailable",
      fn(a) {
        const g = boot({ storageThrows: true, langs: ["fr-FR"] });
        a.doesNotThrow(() => g.langButton("en").click(1));
        a.eq(g.T.state.lang, "en", "the choice should still apply for this session");
      },
    },
    {
      name: "a stored best score is loaded",
      fn(a) {
        const g = boot({ storage: { "neonbreak-best-score": "4321" } });
        a.eq(g.T.state.best, 4321);
      },
    },
    {
      name: "a non-numeric stored best score degrades to zero",
      fn(a) {
        a.eq(boot({ storage: { "neonbreak-best-score": "not-a-number" } }).T.state.best, 0);
        a.eq(boot({ storage: { "neonbreak-best-score": "" } }).T.state.best, 0);
      },
    },
    {
      name: "the best score round-trips through storage",
      fn(a) {
        const first = boot().start();
        first.T.state.score = 2500;
        first.T.state.lives = 1;
        first.T.state.balls.length = 0;
        first.frame();
        a.eq(first.store["neonbreak-best-score"], "2500");

        const second = boot({ storage: first.store });
        a.eq(second.T.state.best, 2500, "a later session should see the stored best");
      },
    },
    {
      name: "the language round-trips through storage",
      fn(a) {
        const first = boot({ langs: ["fr-FR"] });
        first.langButton("en").click(1);
        const second = boot({ langs: ["fr-FR"], storage: first.store });
        a.eq(second.T.state.lang, "en", "the stored language should survive a reload");
      },
    },
    {
      name: "storage keys are namespaced to the game",
      fn(a) {
        const g = boot({ langs: ["fr-FR"] });
        g.langButton("en").click(1);
        g.T.state.score = 5;
        for (const key of Object.keys(g.store)) {
          a.match(key, /^neonbreak-/, `storage key "${key}" is not namespaced`);
        }
      },
    },
    {
      name: "nothing is written to storage before the player does anything",
      fn(a) {
        // Language is applied at boot, so that key is expected. Nothing else
        // should be touched until there is a score worth keeping.
        const g = boot();
        a.not("neonbreak-best-score" in g.store,
          "a fresh session should not write a best score before one exists");
      },
    },
  ],
};
