"use strict";
/*
  Static checks on the file text — no game boot required.

  These guard the class of defect that logic tests are blind to: the document
  shell itself. Finding #1 (missing doctype and charset, which mojibaked the
  French text) lived here and would never have shown up in a behavioural test.
*/

const fs = require("fs");
const path = require("path");
const { HTML, SCRIPT, GAME_FILE } = require("../dom-stub");

const DOCS_DIR = path.join(__dirname, "..", "..", "docs");
const GAME_LINES = HTML.split(/\r?\n/);

function docFiles() {
  if (!fs.existsSync(DOCS_DIR)) return [];
  return fs.readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ file: f, text: fs.readFileSync(path.join(DOCS_DIR, f), "utf8") }));
}

module.exports = {
  name: "structure — document shell and docs integrity",
  tests: [
    {
      name: "the doctype is the very first thing in the file",
      fn(a) {
        a.match(HTML.slice(0, 200), /^<!doctype html>/i,
          "without a doctype the page renders in quirks mode");
      },
    },
    {
      name: "declares a charset, and it is utf-8",
      fn(a) {
        const head = HTML.slice(0, HTML.indexOf("</head>"));
        a.match(head, /<meta\s+charset="utf-8">/i,
          "no charset means windows-1252 fallback and mojibaked French");
      },
    },
    {
      name: "has a viewport meta",
      fn(a) {
        a.match(HTML, /<meta\s+name="viewport"[^>]*width=device-width/i);
      },
    },
    {
      name: "has a non-empty <title>",
      fn(a) {
        const m = HTML.match(/<title>([^<]*)<\/title>/i);
        a.ok(m, "no <title> element");
        a.ok(m[1].trim().length > 0, "the <title> is empty");
      },
    },
    {
      name: "the root element carries a lang attribute",
      fn(a) {
        a.match(HTML, /<html\s+lang="(fr|en)"/i);
      },
    },
    {
      name: "head and body are opened and closed",
      fn(a) {
        for (const tag of ["head", "body", "html"]) {
          a.includes(HTML, `<${tag}`, `missing <${tag}>`);
          a.includes(HTML, `</${tag}>`, `missing </${tag}>`);
        }
      },
    },
    {
      name: "exactly one <script> and one <style> block",
      fn(a) {
        a.eq((HTML.match(/<script>/g) || []).length, 1, "expected a single script block");
        a.eq((HTML.match(/<style>/g) || []).length, 1, "expected a single style block");
      },
    },
    {
      name: "the game script parses",
      fn(a) {
        a.doesNotThrow(() => new Function(SCRIPT), "syntax error in the game script");
      },
    },
    {
      name: "the script is in strict mode",
      fn(a) {
        a.match(SCRIPT.slice(0, 200), /"use strict"/);
      },
    },
    {
      name: "no debugger statements or leftover console logging",
      fn(a) {
        const offenders = [];
        SCRIPT.split(/\r?\n/).forEach((line, i) => {
          if (/\bdebugger\b/.test(line)) offenders.push(`line ${i + 1}: debugger`);
          if (/\bconsole\.(log|debug|warn|error)\b/.test(line)) {
            offenders.push(`line ${i + 1}: ${line.trim().slice(0, 50)}`);
          }
        });
        a.empty(offenders, `leftover debug output: ${offenders.join("; ")}`);
      },
    },
    {
      name: "accented text is intact — no mojibake sequences in the source",
      fn(a) {
        a.includes(HTML, "Détruisez", "expected French copy is missing");
        // "Ã©" and friends are what utf-8 read as windows-1252 looks like.
        const bad = HTML.match(/Ã[©¨ª«¢£]/g);
        a.ok(!bad, `found mojibake in the source: ${bad && bad.join(", ")}`);
      },
    },
    {
      name: "the file is read back as valid utf-8",
      fn(a) {
        const raw = fs.readFileSync(GAME_FILE);
        const decoded = raw.toString("utf8");
        // The replacement character only appears if the bytes were not valid utf-8.
        a.ok(decoded.indexOf("�") === -1, "file contains invalid utf-8 byte sequences");
      },
    },
    {
      name: "docs line anchors point inside the file and at real content",
      fn(a) {
        const problems = [];
        for (const { file, text } of docFiles()) {
          for (const m of text.matchAll(/index\.html#L(\d+)(?:-L(\d+))?/g)) {
            const from = Number(m[1]);
            const to = m[2] ? Number(m[2]) : from;
            if (from < 1 || to > GAME_LINES.length) {
              problems.push(`${file}: #L${from}${m[2] ? "-L" + to : ""} is outside 1..${GAME_LINES.length}`);
              continue;
            }
            if (!GAME_LINES[from - 1].trim()) {
              problems.push(`${file}: #L${from} points at a blank line`);
            }
          }
        }
        a.empty(problems, problems.join("; "));
      },
    },
    {
      name: "docs link labels agree with the anchors they point at",
      fn(a) {
        const problems = [];
        const linkRe = /\[(?:index\.html)?:?([\d–-]+)\]\(\.\.\/html\/index\.html#L(\d+)(?:-L(\d+))?\)/g;
        for (const { file, text } of docFiles()) {
          for (const m of text.matchAll(linkRe)) {
            const label = m[1].replace(/–/g, "-");
            const target = m[3] ? `${m[2]}-${m[3]}` : m[2];
            if (label !== target) {
              problems.push(`${file}: label ":${m[1]}" points at #L${target}`);
            }
          }
        }
        a.empty(problems, problems.join("; "));
      },
    },
  ],
};
