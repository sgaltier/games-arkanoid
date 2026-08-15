"use strict";
/*
  Localisation: the string tables, locale detection, and the toggle.

  The static checks at the top are the important ones. The realistic failure mode
  for translation work is not a broken toggle — it is a key that exists in one
  table and not the other, which surfaces to the player as a raw key like
  "gameover.title" on screen. Those checks make that impossible to miss.
*/

const { boot, BODY, SCRIPT } = require("../dom-stub");

const placeholders = (s) => (String(s).match(/\{(\w+)\}/g) || []).sort().join(",");

module.exports = {
  name: "i18n — string tables, detection, toggle",
  tests: [
    {
      name: "every language table defines exactly the same keys",
      fn(a) {
        const { STRINGS, SUPPORTED_LANGS } = boot().T;
        const reference = Object.keys(STRINGS[SUPPORTED_LANGS[0]]).sort();
        for (const lang of SUPPORTED_LANGS) {
          const keys = Object.keys(STRINGS[lang]).sort();
          const missing = reference.filter((k) => !keys.includes(k));
          const extra = keys.filter((k) => !reference.includes(k));
          a.empty(missing, `${lang} is missing: ${missing.join(", ")}`);
          a.empty(extra, `${lang} has keys no other language has: ${extra.join(", ")}`);
        }
      },
    },
    {
      name: "placeholders match across languages",
      fn(a) {
        const { STRINGS, SUPPORTED_LANGS } = boot().T;
        const base = SUPPORTED_LANGS[0];
        const problems = [];
        for (const key of Object.keys(STRINGS[base])) {
          for (const lang of SUPPORTED_LANGS.slice(1)) {
            if (placeholders(STRINGS[base][key]) !== placeholders(STRINGS[lang][key])) {
              problems.push(`${key}: ${base}="${STRINGS[base][key]}" vs ${lang}="${STRINGS[lang][key]}"`);
            }
          }
        }
        a.empty(problems, problems.join("; "));
      },
    },
    {
      name: "every key referenced from the markup exists",
      fn(a) {
        const { STRINGS, SUPPORTED_LANGS } = boot().T;
        const used = new Set();
        for (const m of BODY.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) used.add(m[1]);
        for (const m of BODY.matchAll(/data-i18n-attr="([^"]+)"/g)) {
          m[1].split("|").forEach((pair) => {
            const bits = pair.split(":");
            if (bits[1]) used.add(bits[1]);
          });
        }
        a.gt(used.size, 0, "no i18n keys found in the markup at all");
        const unknown = [...used].filter((k) => !(k in STRINGS[SUPPORTED_LANGS[0]]));
        a.empty(unknown, `markup references unknown keys: ${unknown.join(", ")}`);
      },
    },
    {
      name: "every key referenced from a t() call exists",
      fn(a) {
        const { STRINGS, SUPPORTED_LANGS } = boot().T;
        const called = new Set();
        for (const m of SCRIPT.matchAll(/\bt\(\s*"([^"]+)"/g)) called.add(m[1]);
        a.gt(called.size, 0, "no t() calls found");
        const unknown = [...called].filter((k) => !(k in STRINGS[SUPPORTED_LANGS[0]]));
        a.empty(unknown, `code references unknown keys: ${unknown.join(", ")}`);
      },
    },
    {
      name: "no string table entry is left empty",
      fn(a) {
        const { STRINGS, SUPPORTED_LANGS } = boot().T;
        const empty = [];
        for (const lang of SUPPORTED_LANGS) {
          for (const [k, v] of Object.entries(STRINGS[lang])) {
            if (!String(v).trim()) empty.push(`${lang}.${k}`);
          }
        }
        a.empty(empty, `empty translations: ${empty.join(", ")}`);
      },
    },
    {
      name: "an unknown key returns itself rather than 'undefined'",
      fn(a) {
        const g = boot();
        a.eq(g.T.t("no.such.key"), "no.such.key",
          "a missing key should be visibly wrong, not silently undefined");
      },
    },

    // --- detection ---------------------------------------------------------
    {
      name: "a French browser starts in French",
      fn(a) {
        a.eq(boot({ langs: ["fr-FR"] }).T.state.lang, "fr");
        a.eq(boot({ langs: ["fr-CA"] }).T.state.lang, "fr");
        a.eq(boot({ langs: ["fr"] }).T.state.lang, "fr");
      },
    },
    {
      name: "an English browser starts in English",
      fn(a) {
        a.eq(boot({ langs: ["en-GB"] }).T.state.lang, "en");
        a.eq(boot({ langs: ["en-US"] }).T.state.lang, "en");
      },
    },
    {
      name: "an unsupported locale falls back to the default",
      fn(a) {
        const { DEFAULT_LANG } = boot().T;
        a.eq(boot({ langs: ["de-DE"] }).T.state.lang, DEFAULT_LANG);
        a.eq(boot({ langs: ["ja"] }).T.state.lang, DEFAULT_LANG);
        a.eq(boot({ langs: [""] }).T.state.lang, DEFAULT_LANG);
      },
    },
    {
      name: "the browser's preference order is respected",
      fn(a) {
        a.eq(boot({ langs: ["de-DE", "fr-FR", "en-GB"] }).T.state.lang, "fr",
          "French appears before English in the list and should win");
        a.eq(boot({ langs: ["de-DE", "en-GB", "fr-FR"] }).T.state.lang, "en",
          "English appears before French in the list and should win");
      },
    },
    {
      name: "a stored preference overrides detection",
      fn(a) {
        const g = boot({ langs: ["fr-FR"], storage: { "neonbreak-lang": "en" } });
        a.eq(g.T.state.lang, "en", "the stored choice should win over the browser locale");
      },
    },
    {
      name: "a corrupt stored preference falls back to detection",
      fn(a) {
        const g = boot({ langs: ["fr-FR"], storage: { "neonbreak-lang": "klingon" } });
        a.eq(g.T.state.lang, "fr", "a value outside the supported set must be ignored");
      },
    },

    // --- toggling ----------------------------------------------------------
    {
      name: "the toggle switches language and marks the active button",
      fn(a) {
        const g = boot({ langs: ["fr-FR"] });
        const fr = g.langButton("fr");
        const en = g.langButton("en");
        a.ok(fr && en, "both language buttons should exist");
        a.eq(fr.getAttribute("aria-pressed"), "true");
        a.eq(en.getAttribute("aria-pressed"), "false");

        en.click(1);
        a.eq(g.T.state.lang, "en");
        a.eq(fr.getAttribute("aria-pressed"), "false");
        a.eq(en.getAttribute("aria-pressed"), "true");
      },
    },
    {
      name: "switching updates static text, attributes and markup strings",
      fn(a) {
        const g = boot({ langs: ["fr-FR"] });
        a.eq(g.byKey("hud.best").textContent, "Meilleur");
        g.langButton("en").click(1);
        a.eq(g.byKey("hud.best").textContent, "Best");
        a.eq(g.el("game").getAttribute("aria-label"), "Blokrush play area",
          "attribute strings should translate too");
        const hint = g.registry.find((e) => e._attrs["data-i18n-html"]);
        a.match(hint.innerHTML, /<kbd>/, "markup strings must keep their markup");
        a.match(hint.innerHTML, /Space/, "and be translated");
      },
    },
    {
      name: "switching updates the document language and title",
      fn(a) {
        const g = boot({ langs: ["fr-FR"] });
        a.eq(g.doc.documentElement.lang, "fr");
        g.langButton("en").click(1);
        a.eq(g.doc.documentElement.lang, "en", "screen readers rely on this");
        a.match(g.doc.title, /Brick Breaker/);
      },
    },
    {
      name: "the choice is persisted",
      fn(a) {
        const g = boot({ langs: ["fr-FR"] });
        g.langButton("en").click(1);
        a.eq(g.store["neonbreak-lang"], "en");
      },
    },
    {
      name: "the toggle does not keep focus after a pointer click",
      fn(a) {
        const g = boot();
        g.doc.activeElement = g.langButton("en");
        g.langButton("en").click(1);
        a.eq(g.doc.activeElement, g.doc.body,
          "a focused toggle would swallow the Space used to launch");
      },
    },

    // --- interpolation -----------------------------------------------------
    {
      name: "French keeps its typographic space before a colon, English does not",
      fn(a) {
        const g = boot({ langs: ["fr-FR"] });
        g.T.state.score = 420;
        g.T.renderDynamicText();
        a.eq(g.el("gameover-score").textContent, "Score : 420");
        g.T.applyLanguage("en");
        a.eq(g.el("gameover-score").textContent, "Score: 420");
      },
    },
    {
      name: "interpolated values are substituted everywhere",
      fn(a) {
        const g = boot({ langs: ["fr-FR"] });
        g.T.state.score = 77;
        g.T.state.best = 999;
        g.T.renderDynamicText();
        const leftovers = g.registry.filter((e) => /\{\w+\}/.test(e.textContent));
        a.empty(leftovers.map((e) => e.textContent), "unsubstituted placeholders reached the DOM");
        a.eq(g.el("ready-eyebrow").textContent, `Niveau 1 / ${g.T.CONFIG.progression.totalLevels}`);
        a.eq(g.el("gameover-best").textContent, "Meilleur score : 999");
      },
    },
    {
      name: "switching language mid-game re-renders the overlay already on screen",
      fn(a) {
        // Hall-of-fame board pre-filled with higher scores (#42) so the run
        // below goes straight to gameover, not a "nameentry" detour — this
        // test is about live re-rendering, not the hall of fame.
        const fullHof = JSON.stringify(
          Array.from({ length: 10 }, (_, i) => ({ name: "CPU", score: 999000 - i }))
        );
        const g = boot({ langs: ["fr-FR"], storage: { "neonbreak-hall-of-fame": fullHof } }).start();
        g.T.state.score = 77;
        g.T.state.lives = 1;
        g.T.state.balls.length = 0;
        g.frame();
        a.eq(g.T.state.phase, "gameover");
        a.eq(g.el("gameover-score").textContent, "Score : 77");
        g.langButton("en").click(1);
        a.eq(g.el("gameover-score").textContent, "Score: 77",
          "a visible overlay must update immediately, not on the next state change");
      },
    },
    {
      name: "the mute button label tracks both language and mute state",
      fn(a) {
        const g = boot({ langs: ["fr-FR"] });
        const mute = g.el("btn-mute");
        a.eq(mute.getAttribute("aria-label"), "Couper le son");
        mute.click(1);
        a.eq(mute.getAttribute("aria-label"), "Activer le son",
          "the label must not still say 'mute' once muted");
        g.T.applyLanguage("en");
        a.eq(mute.getAttribute("aria-label"), "Unmute sound");
        mute.click(1);
        a.eq(mute.getAttribute("aria-label"), "Mute sound");
      },
    },
    {
      name: "level numbering in the overlays follows the level actually loaded",
      fn(a) {
        const g = boot({ langs: ["en-GB"] });
        g.el("btn-start").click(1);
        g.T.startLevel(2);
        a.eq(g.el("ready-eyebrow").textContent, `Level 3 / ${g.T.CONFIG.progression.totalLevels}`);
      },
    },
  ],
};
