"use strict";
/*
  Loads the real index.html into a fake DOM so its game loop can be driven and
  inspected from Node, with no dependencies.

  The game lives inside an IIFE, so nothing is reachable from outside. boot()
  injects a handle just before the closing `})();` exposing the names listed in
  SEAM below. That is the deliberate test seam: it couples the tests to internal
  names, which is the price of being able to test the physics at all. Keep the
  list short — adding to it should be a decision, not a reflex.

  index.html itself is never modified; the injection happens on an in-memory
  copy of the extracted script text.
*/

const fs = require("fs");
const path = require("path");

const GAME_FILE = path.join(__dirname, "..", "html", "index.html");
const HTML = fs.readFileSync(GAME_FILE, "utf8");

const SCRIPT = (HTML.match(/<script>([\s\S]*?)<\/script>/) || [])[1];
if (!SCRIPT) throw new Error("could not find the <script> block in index.html");

const BODY_START = HTML.indexOf("<body>");
const BODY_END = HTML.indexOf("</body>");
const BODY = BODY_START !== -1 && BODY_END !== -1 ? HTML.slice(BODY_START, BODY_END) : "";

const SEAM = [
  "state", "frame", "LEVELS", "POWERUPS", "GAME_W", "GAME_H", "CONFIG",
  "setPhase", "startLevel", "newGame", "launchBall", "togglePause",
  "applyPowerup", "paddleWidth", "ballSpeedMult", "circleRectCollide",
  "applyLanguage", "detectLang", "renderDynamicText", "t",
  "STRINGS", "SUPPORTED_LANGS", "DEFAULT_LANG", "handleLaunchOrResume", "PHASE_OVERLAY",
];

const TAIL = "})();";
const cutAt = SCRIPT.lastIndexOf(TAIL);
if (cutAt === -1) throw new Error("could not find the IIFE tail in the game script");
const INSTRUMENTED =
  SCRIPT.slice(0, cutAt) +
  `  globalThis.__seam = { ${SEAM.join(", ")} };\n` +
  SCRIPT.slice(cutAt);

// ---------------------------------------------------------------------------
// Parse the markup into element descriptors so querySelectorAll resolves against
// the real document rather than hand-registered stubs.
// ---------------------------------------------------------------------------
function parseElements(html) {
  const out = [];
  const tagRe = /<(\w+)((?:\s+[-\w]+(?:="[^"]*")?)*)\s*\/?>/g;
  let m;
  while ((m = tagRe.exec(html))) {
    const attrs = {};
    const attrRe = /([-\w]+)(?:="([^"]*)")?/g;
    let a;
    while ((a = attrRe.exec(m[2]))) attrs[a[1]] = a[2] === undefined ? "" : a[2];
    out.push({ tag: m[1].toUpperCase(), attrs });
  }
  return out;
}
const PARSED = parseElements(BODY);

// ---------------------------------------------------------------------------
// Deterministic RNG so physics runs are reproducible.
// ---------------------------------------------------------------------------
const REAL_RANDOM = Math.random;
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
function boot(opts) {
  opts = opts || {};
  const langs = opts.langs || ["fr-FR"];
  const store = Object.assign({}, opts.storage || {});
  const storageThrows = !!opts.storageThrows;
  const winL = {};
  const docL = {};

  const counters = {
    getComputedStyle: 0,
    textWrites: 0,
    attrWrites: 0,
    canvasOps: 0,
    audioResumes: 0,
    reset() {
      this.getComputedStyle = 0;
      this.textWrites = 0;
      this.attrWrites = 0;
      this.canvasOps = 0;
      this.audioResumes = 0;
    },
  };

  // Canvas context: every method call and property write is counted.
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      return function () { counters.canvasOps++; };
    },
    set(target, key, value) {
      target[key] = value;
      counters.canvasOps++;
      return true;
    },
  });

  const registry = [];

  // Every note the game scheduled, in order — see the AudioContext stub below.
  // Sound is only observable as the notes queued for it, and since #59 that is
  // a real feature surface (per-type brick voices, the combo ladder, the music
  // bed) rather than incidental blips.
  const notes = [];
  const AUDIO_EPOCH = 1000; // handle.clock's starting value; see handle.clock
  function audioNow() { return (handle.clock - AUDIO_EPOCH) / 1000; }

  function makeEl(tag, attrs) {
    const el = {
      tagName: tag,
      _attrs: Object.assign({}, attrs || {}),
      _text: "",
      _html: "",
      _handlers: {},
      style: {},
      width: 0,
      height: 0,
      getAttribute(k) { return k in el._attrs ? el._attrs[k] : null; },
      setAttribute(k, v) { el._attrs[k] = String(v); counters.attrWrites++; },
      removeAttribute(k) { delete el._attrs[k]; },
      addEventListener(type, fn) { (el._handlers[type] || (el._handlers[type] = [])).push(fn); },
      blur() { if (doc.activeElement === el) doc.activeElement = doc.body; },
      focus() { doc.activeElement = el; },
      getContext() { return ctx; },
      getBoundingClientRect() { return { left: 0, top: 0, width: 480, height: 680 }; },
      // detail > 0 mimics a pointer click; detail === 0 mimics keyboard activation.
      click(detail) {
        const ev = {
          detail: detail === undefined ? 1 : detail,
          currentTarget: el,
          target: el,
          button: 0,
          preventDefault() { ev.defaultPrevented = true; },
          defaultPrevented: false,
        };
        (el._handlers.click || []).forEach((f) => f.call(el, ev));
        return ev;
      },
      fire(type, ev) {
        (el._handlers[type] || []).forEach((f) => f.call(el, ev || {}));
      },
      hasHandler(type) { return !!(el._handlers[type] && el._handlers[type].length); },
    };

    Object.defineProperty(el, "id", { get: () => el._attrs.id });
    Object.defineProperty(el, "textContent", {
      get: () => el._text,
      set: (v) => { el._text = String(v); counters.textWrites++; },
    });
    Object.defineProperty(el, "innerHTML", {
      get: () => el._html,
      set: (v) => { el._html = String(v); counters.textWrites++; },
    });

    const classes = new Set(String((attrs && attrs.class) || "").split(/\s+/).filter(Boolean));
    el.classList = {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)),
    };
    el._classes = classes;

    registry.push(el);
    return el;
  }

  PARSED.forEach((p) => makeEl(p.tag, p.attrs));

  // Every stub element reports a fixed 480x680 rect by default (see makeEl
  // above). #17 depends on the canvas's *displayed* size differing from its
  // logical GAME_W/GAME_H, so let a test narrow it — e.g. to emulate a phone
  // where the canvas renders well under 480 CSS px wide.
  if (opts.canvasWidth) {
    const canvasStub = registry.find((e) => e._attrs.id === "game");
    if (canvasStub) {
      canvasStub.getBoundingClientRect = () => ({
        left: 0, top: 0,
        width: opts.canvasWidth, height: opts.canvasWidth * (680 / 480),
      });
    }
  }

  const doc = {
    hidden: false,
    title: "",
    documentElement: { lang: "" },
    getElementById(id) {
      let el = registry.find((e) => e._attrs.id === id);
      if (!el) el = makeEl("DIV", { id });
      return el;
    },
    querySelectorAll(sel) {
      if (sel.startsWith("[") && sel.endsWith("]")) {
        const name = sel.slice(1, -1);
        return registry.filter((e) => name in e._attrs);
      }
      if (sel.startsWith(".")) {
        const c = sel.slice(1);
        return registry.filter((e) => e._classes.has(c));
      }
      if (sel.startsWith("#")) {
        const id = sel.slice(1);
        return registry.filter((e) => e._attrs.id === id);
      }
      const tag = sel.toUpperCase();
      return registry.filter((e) => e.tagName === tag);
    },
    querySelector(sel) { return doc.querySelectorAll(sel)[0] || null; },
    addEventListener(type, fn) { (docL[type] || (docL[type] = [])).push(fn); },
  };
  doc.body = makeEl("BODY", {});
  doc.activeElement = doc.body;

  // Minimal matchMedia: one MediaQueryList per distinct query string, kept
  // around by reference so a later fireMedia() mutates the same object the
  // game already holds (mirroring how a real browser updates .matches on the
  // MediaQueryList it handed out, rather than firing events at a new one).
  const mediaQueries = {};
  function getOrCreateMQL(query) {
    if (!mediaQueries[query]) {
      const listeners = [];
      const mql = {
        media: query,
        matches: query.indexOf("prefers-reduced-motion") !== -1 && !!opts.reducedMotion,
        addEventListener(type, fn) { listeners.push(fn); },
        removeEventListener(type, fn) {
          const i = listeners.indexOf(fn);
          if (i !== -1) listeners.splice(i, 1);
        },
      };
      mediaQueries[query] = { mql, listeners };
    }
    return mediaQueries[query];
  }

  globalThis.window = {
    devicePixelRatio: opts.dpr || 1,
    addEventListener(type, fn) { (winL[type] || (winL[type] = [])).push(fn); },
    matchMedia(query) { return getOrCreateMQL(query).mql; },
    AudioContext: function () {
      // Real browsers may hand back a context that starts "suspended" unless
      // its construction happens directly inside a user-gesture handler —
      // default to that worst case so a missing resume() call (finding #20)
      // shows up as silence rather than passing by accident.
      const actx = {
        state: "suspended",
        // The game schedules against actx.currentTime, so the audio clock has
        // to track the fake frame clock. A context frozen at 0 would let #59's
        // scheduler queue its first notes and then wait forever for a moment
        // that never arrives.
        get currentTime() { return audioNow(); },
        destination: {},
        createGain() {
          const node = {
            _peak: 0,
            gain: {
              value: 0,
              setValueAtTime(v) { node._peak = Math.max(node._peak, v); node.gain.value = v; },
              linearRampToValueAtTime(v) { node._peak = Math.max(node._peak, v); },
              exponentialRampToValueAtTime() {},
            },
            connect() {},
          };
          return node;
        },
        createOscillator() {
          const osc = {
            type: "square",
            frequency: {
              value: 0,
              setValueAtTime(v) { osc.frequency.value = v; },
              exponentialRampToValueAtTime(v) { osc._slide = v; },
              linearRampToValueAtTime(v) { osc._slide = v; },
            },
            detune: { value: 0, setValueAtTime(v) { osc.detune.value = v; } },
            connect(dest) { osc._gain = dest; },
            // Recorded on start(), which is the moment the note is committed:
            // pitch, timbre and gain are all set by then.
            start(at) {
              notes.push({
                freq: osc.frequency.value,
                slide: osc._slide || 0,
                type: osc.type,
                detune: osc.detune.value,
                at: at === undefined ? actx.currentTime : at,
                vol: osc._gain ? osc._gain._peak : 0,
              });
            },
            stop() {},
          };
          return osc;
        },
        resume() { actx.state = "running"; counters.audioResumes++; },
      };
      return actx;
    },
  };
  globalThis.document = doc;

  // Node 22 defines globalThis.navigator as a getter-only accessor reporting the
  // host's real locale, so plain assignment silently no-ops and every locale test
  // would quietly measure this machine instead of the value under test. This cost
  // an afternoon of false passes once; do not "simplify" it back to `=`.
  Object.defineProperty(globalThis, "navigator", {
    value: { languages: langs.slice(), language: langs[0] },
    configurable: true,
    writable: true,
  });

  globalThis.localStorage = {
    getItem(k) {
      if (storageThrows) throw new Error("SecurityError: storage is not available");
      return k in store ? store[k] : null;
    },
    setItem(k, v) {
      if (storageThrows) throw new Error("SecurityError: storage is not available");
      store[k] = String(v);
    },
    removeItem(k) {
      if (storageThrows) throw new Error("SecurityError: storage is not available");
      delete store[k];
    },
  };

  globalThis.performance = { now: () => 0 };
  globalThis.getComputedStyle = () => {
    counters.getComputedStyle++;
    return { fontFamily: "monospace" };
  };
  globalThis.requestAnimationFrame = () => 0; // frames are driven by hand

  // #67: the global hall of fame API. Offline by default — every suite written
  // before it existed must keep exercising the local-board fallback, and a test
  // that wants the world board has to say so. opts.api is a handler taking
  // (url, init) and returning the object to serve as JSON; returning null (or
  // throwing) reproduces an unreachable endpoint.
  const apiCalls = [];
  globalThis.fetch = (url, init) => {
    apiCalls.push({ url, init, body: init && init.body ? JSON.parse(init.body) : null });
    if (!opts.api) return Promise.reject(new Error("offline"));
    let payload;
    try { payload = opts.api(url, init); }
    catch (e) { return Promise.reject(e); }
    if (payload === null || payload === undefined) {
      return Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve(null) });
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload) });
  };

  Math.random = makeRng(opts.seed === undefined ? 12345 : opts.seed);

  new Function(INSTRUMENTED)();
  const T = globalThis.__seam;

  const handle = {
    T,
    doc,
    store,
    registry,
    counters,
    // Every fetch the game made, in order: { url, init, body }. body is the
    // parsed request JSON, so a test can assert what was submitted.
    apiCalls,
    // Every note scheduled, in order: { freq, slide, type, detune, at, vol }.
    // Never reset — take a length before the action under test and slice.
    notes,
    // The API paths are promise-chained, so their effects land a few microtasks
    // after the call that triggered them. Await this before asserting on
    // anything the network was supposed to change.
    settle: () => new Promise((resolve) => setImmediate(resolve)),
    // The clock deliberately starts non-zero. The game computes its delta as
    // `(now - (state.lastTime || now))`, so a lastTime of 0 reads as "unset" and
    // yields dt === 0. Priming below with a non-zero timestamp means the first
    // frame a test drives already has a real delta and the ball actually moves.
    clock: 1000,

    el: (id) => doc.getElementById(id),
    // Labels carry no id; find them by their i18n key instead.
    byKey: (key) => registry.find((e) => e._attrs["data-i18n"] === key),
    byAttr: (name, value) => registry.find((e) => e._attrs[name] === value),
    langButton: (lang) => registry.find((e) => e._attrs["data-lang"] === lang),

    fireWin(type, ev) { (winL[type] || []).forEach((f) => f(ev || {})); },
    fireDoc(type, ev) { (docL[type] || []).forEach((f) => f(ev || {})); },
    // Flip a MediaQueryList's .matches and notify anyone who addEventListener'd
    // "change" on it — for simulating the OS-level setting changing mid-session.
    fireMedia(query, matches) {
      const entry = mediaQueries[query];
      if (!entry) return;
      entry.mql.matches = matches;
      entry.listeners.forEach((f) => f({ matches, media: query }));
    },

    key(code, opts2) {
      const ev = Object.assign({ code, preventDefault() { ev.defaultPrevented = true; } },
        opts2 || {});
      ev.defaultPrevented = false;
      (winL.keydown || []).forEach((f) => f(ev));
      return ev;
    },
    keyUp(code) {
      (winL.keyup || []).forEach((f) => f({ code }));
    },
    hold(code) { this.key(code); },
    release(code) { this.keyUp(code); },

    canvasEvent(type, ev) {
      const canvas = doc.getElementById("game");
      canvas.fire(type, ev);
    },
    mouseMove(x, y) {
      this.canvasEvent("mousemove", { clientX: x, clientY: y === undefined ? 0 : y });
    },
    mouseDown(button) {
      const ev = { button: button === undefined ? 0 : button, preventDefault() {} };
      this.canvasEvent("mousedown", ev);
      return ev;
    },
    // touchesLeft overrides how many fingers e.touches reports still being
    // down; defaults to matching real touch events — empty by "touchend"
    // (the lifted finger is gone), one finger otherwise. Pass it explicitly
    // to simulate a second finger still down when the primary one lifts (#35).
    touch(type, x, y, touchesLeft) {
      const point = { clientX: x, clientY: y === undefined ? 0 : y };
      const touches = touchesLeft === undefined
        ? (type === "touchend" ? [] : [point])
        : Array.from({ length: touchesLeft }, () => point);
      const ev = {
        touches,
        changedTouches: [point],
        preventDefault() { ev.defaultPrevented = true; },
        defaultPrevented: false,
      };
      this.canvasEvent(type, ev);
      return ev;
    },

    // Advance the loop by `seconds` from a monotonic clock.
    run(seconds, step) {
      step = step || 16;
      const n = Math.max(1, Math.round((seconds * 1000) / step));
      for (let i = 0; i < n; i++) {
        this.clock += step;
        T.frame(this.clock);
      }
      return this;
    },
    // Same, but with the paddle tracking the ball so play continues. Use this
    // when the test is about something other than survival — otherwise the ball
    // is lost within a couple of seconds and loseLife() resets state underneath
    // whatever you were measuring.
    runAlive(seconds, step) {
      step = step || 16;
      const n = Math.max(1, Math.round((seconds * 1000) / step));
      for (let i = 0; i < n; i++) {
        const ball = T.state.balls[0];
        if (ball) T.state.pointerX = ball.x;
        this.clock += step;
        T.frame(this.clock);
      }
      return this;
    },

    // One frame, for per-frame budget measurement.
    frame(step) {
      this.clock += step || 16;
      T.frame(this.clock);
      return this;
    },

    // Which overlays are currently visible.
    shownOverlays() {
      return registry
        .filter((e) => /^overlay-/.test(e._attrs.id || "") && e._classes.has("show"))
        .map((e) => e._attrs.id);
    },

    // Drive to the point where a ball is in play.
    start() {
      this.el("btn-start").click(1);
      this.key("Space");
      return this;
    },
  };

  // Prime state.lastTime. Harmless: the phase is still "start", so this frame
  // only paints.
  T.frame(handle.clock);
  counters.reset();

  return handle;
}

function restoreRandom() {
  Math.random = REAL_RANDOM;
}

module.exports = { boot, restoreRandom, HTML, BODY, SCRIPT, GAME_FILE, SEAM, makeRng };
