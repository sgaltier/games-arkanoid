"use strict";
/*
  Zero-dependency test runner for Neon Break.

    node test/run.js              run everything
    node test/run.js physics      run only the named suite(s)

  A suite is a module in test/suites/ exporting { name, tests }, where each test
  is { name, fn, pending? }. `fn` receives the assertion helper and signals
  failure by throwing.

  Pending tests encode findings from docs/todo.md that are known to be
  unfixed. They run, report as PEND and do not fail the build — but if one starts
  passing the runner reports FIXED? and exits non-zero, so a resolved finding
  cannot go unnoticed.
*/

const fs = require("fs");
const path = require("path");

const SUITE_DIR = path.join(__dirname, "suites");

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------
class AssertionError extends Error {
  constructor(message) {
    super(message);
    this.name = "AssertionError";
  }
}

function fmt(v) {
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean" || v == null) return String(v);
  try {
    const s = JSON.stringify(v);
    return s === undefined ? String(v) : s.length > 120 ? s.slice(0, 117) + "..." : s;
  } catch (e) {
    return String(v);
  }
}

function fail(msg, detail) {
  throw new AssertionError(detail ? `${msg}: ${detail}` : msg);
}

const assert = {
  ok(cond, msg) {
    if (!cond) fail(msg || "expected a truthy value");
  },
  not(cond, msg) {
    if (cond) fail(msg || "expected a falsy value", `got ${fmt(cond)}`);
  },
  eq(actual, expected, msg) {
    if (!Object.is(actual, expected)) {
      fail(msg || "values differ", `expected ${fmt(expected)}, got ${fmt(actual)}`);
    }
  },
  ne(actual, unexpected, msg) {
    if (Object.is(actual, unexpected)) fail(msg || "values should differ", `both ${fmt(actual)}`);
  },
  near(actual, expected, tol, msg) {
    if (typeof actual !== "number" || !isFinite(actual)) {
      fail(msg || "not a finite number", `got ${fmt(actual)}`);
    }
    if (Math.abs(actual - expected) > tol) {
      fail(msg || "outside tolerance", `expected ${expected} ±${tol}, got ${actual}`);
    }
  },
  lt(a, b, msg) {
    if (!(a < b)) fail(msg || "expected a < b", `${fmt(a)} !< ${fmt(b)}`);
  },
  lte(a, b, msg) {
    if (!(a <= b)) fail(msg || "expected a <= b", `${fmt(a)} !<= ${fmt(b)}`);
  },
  gt(a, b, msg) {
    if (!(a > b)) fail(msg || "expected a > b", `${fmt(a)} !> ${fmt(b)}`);
  },
  gte(a, b, msg) {
    if (!(a >= b)) fail(msg || "expected a >= b", `${fmt(a)} !>= ${fmt(b)}`);
  },
  match(str, re, msg) {
    if (!re.test(String(str))) fail(msg || "pattern did not match", `${re} against ${fmt(str)}`);
  },
  includes(haystack, needle, msg) {
    if (haystack.indexOf(needle) === -1) fail(msg || "not found", `${fmt(needle)} in ${fmt(haystack)}`);
  },
  empty(arr, msg) {
    if (arr.length) fail(msg || "expected empty", fmt(arr));
  },
  throws(fn, msg) {
    let threw = false;
    try { fn(); } catch (e) { threw = true; }
    if (!threw) fail(msg || "expected the call to throw");
  },
  doesNotThrow(fn, msg) {
    try {
      fn();
    } catch (e) {
      fail(msg || "unexpected throw", e && e.message);
    }
  },
};

// ---------------------------------------------------------------------------
// Suite discovery
// ---------------------------------------------------------------------------
function loadSuites(filters) {
  const files = fs.readdirSync(SUITE_DIR).filter((f) => f.endsWith(".js")).sort();
  const suites = [];
  for (const file of files) {
    const mod = require(path.join(SUITE_DIR, file));
    const key = file.replace(/\.js$/, "");
    if (filters.length && !filters.includes(key) && !filters.includes(mod.name)) continue;
    if (!mod.name || !Array.isArray(mod.tests)) {
      throw new Error(`suite ${file} must export { name, tests: [] }`);
    }
    suites.push({ key, ...mod });
  }
  return suites;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
function main() {
  const filters = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const suites = loadSuites(filters);

  if (!suites.length) {
    console.error(filters.length ? `no suite matched: ${filters.join(", ")}` : "no suites found");
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;
  let pending = 0;
  const problems = [];
  const started = Date.now();

  for (const suite of suites) {
    console.log(`\n${suite.name}`);
    for (const test of suite.tests) {
      let err = null;
      try {
        test.fn(assert);
      } catch (e) {
        err = e;
      }

      if (test.pending) {
        if (err) {
          pending++;
          console.log(`  PEND   ${test.name}  (${test.pending} still open)`);
        } else {
          failed++;
          problems.push({
            suite: suite.name,
            name: test.name,
            message:
              `pending test for ${test.pending} now passes — the finding looks fixed. ` +
              `Remove the \`pending\` marker and move it from docs/todo.md to docs/done.md.`,
          });
          console.log(`  FIXED? ${test.name}  (${test.pending})`);
        }
        continue;
      }

      if (err) {
        failed++;
        problems.push({
          suite: suite.name,
          name: test.name,
          message: err.message,
          stack: err instanceof AssertionError ? null : err.stack,
        });
        console.log(`  FAIL   ${test.name}`);
        console.log(`         ${err.message}`);
      } else {
        passed++;
        console.log(`  PASS   ${test.name}`);
      }
    }
  }

  const ms = Date.now() - started;
  console.log("\n" + "-".repeat(64));
  if (problems.length) {
    console.log(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}:\n`);
    for (const p of problems) {
      console.log(`  ${p.suite} › ${p.name}`);
      console.log(`    ${p.message}`);
      if (p.stack) console.log(p.stack.split("\n").slice(1, 4).join("\n"));
      console.log("");
    }
  }
  const parts = [`${passed} passed`, `${failed} failed`];
  if (pending) parts.push(`${pending} pending`);
  console.log(`${parts.join(", ")}  (${ms}ms)\n`);

  process.exit(failed ? 1 : 0);
}

main();
