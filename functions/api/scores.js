// Global hall of fame API (#67). Cloudflare Pages Function, bound to /api/scores.
//
//   GET  -> { scores: [{name, score}, ...], token }
//   POST -> { scores: [...] }   body: { token, name, score }
//
// GET hands out a fresh session token alongside the board because the client
// needs both at the same moments (page load, and again when a run starts). The
// token is what dates a run: it carries a server-issued timestamp, so elapsed
// time is derived from our clock at both ends and a client cannot claim a long
// run to justify a large score.
//
// None of this makes scores trustworthy. The game is client-side, so a patched
// client can still submit a forged score within the plausibility envelope. What
// is here raises the cost above `curl` and stops replay floods; see finding #67
// in docs/done.md for what an actual verification scheme would require.

const BOARD_SIZE = 10;
// Must match CONFIG.hallOfFame.nameMax in index.html (#76) — otherwise a name
// between the two limits shows in full on the local board but arrives
// truncated here on the global one.
const NAME_MAX = 16;

// A token older than this cannot be redeemed. Long enough for a slow full
// playthrough, short enough that stockpiling tokens to age them is pointless.
// #41 made a full run 100 levels — one to two hours of play, with no save and
// resume (#64) — so a lunch break mid-run used to invalidate the submission.
// The UNIQUE constraint on `nonce` is what actually prevents replay, so the
// longer window costs little.
const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// No genuine qualifying run is over in seconds.
const MIN_RUN_MS = 15 * 1000;
// Scoring-rate ceiling. Exists to catch submissions that are wrong by orders of
// magnitude, not to police the margins. #41's 100-level campaign scores roughly
// 1.5M; at 30 seconds a level that is ~504 points per second, which cleared the
// previous ceiling of 500 — a finished run would have been rejected as a
// forgery. 1000 keeps about 2x headroom over real play.
const MAX_POINTS_PER_SEC = 1000;
const ABSOLUTE_MAX_SCORE = 10000000;
// The rate check and the absolute cap cross at ABSOLUTE_MAX_SCORE /
// MAX_POINTS_PER_SEC seconds — 10,000s (2h47m) with the constants above. Past
// that age the rate formula's own threshold exceeds ABSOLUTE_MAX_SCORE, so it
// stops rejecting anything the absolute check wouldn't already catch: for the
// rest of TOKEN_MAX_AGE_MS's 24h window it is dead code (#90). Capping the age
// *used in the rate check only* at the crossing point keeps the formula
// binding for a token's whole redemption window without shortening
// TOKEN_MAX_AGE_MS, which #64's resume-after-a-break case still needs.
const RATE_CHECK_MAX_AGE_MS = (ABSOLUTE_MAX_SCORE / MAX_POINTS_PER_SEC) * 1000;

// Rate limit per client IP.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_SUBMISSIONS = 20;

const json = (body, status) =>
  new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const enc = new TextEncoder();

function b64url(bytes) {
  let s = "";
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i++) s += String.fromCharCode(view[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s) {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
}

async function sign(secret, payload) {
  const key = await hmacKey(secret);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}

// Constant-time compare so a wrong signature leaks nothing through timing.
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function issueToken(secret) {
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const payload = b64url(enc.encode(JSON.stringify({ n: nonce, t: Date.now() })));
  return payload + "." + (await sign(secret, payload));
}

// Returns { nonce, issuedAt } or null. null covers every failure mode —
// malformed, tampered, unparseable — so no caller can accidentally treat a bad
// token as merely expired.
async function readToken(secret, token) {
  if (typeof token !== "string" || token.length > 512) return null;
  const dot = token.indexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const expected = await sign(secret, payload);
  if (!safeEqual(token.slice(dot + 1), expected)) return null;
  try {
    const body = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (typeof body.n !== "string" || typeof body.t !== "number") return null;
    return { nonce: body.n, issuedAt: body.t };
  } catch (e) {
    return null;
  }
}

// Names are world-visible from this change onward, so the server enforces the
// limits rather than trusting the input element's maxlength. Control
// characters, bidi overrides, and zero-width characters (#100) are stripped
// outright; the client escapes on render, but a name that can never contain
// them is one less thing depending on that — and one that cannot be used to
// visually reorder or hide characters on a permanent, world-visible board.
// Must stay mirrored in index.html's submitHallOfFameName() (#100), the way
// PROFANITY_LIST already is (#89c).
function cleanName(raw) {
  if (typeof raw !== "string") return null;
  const stripped = raw
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e]/g, "")
    .trim();
  // Array.from splits on code points rather than UTF-16 units, so slicing to
  // NAME_MAX cannot cut a surrogate pair in half the way a plain .slice() could.
  const name = Array.from(stripped).slice(0, NAME_MAX).join("");
  return name.length ? name : null;
}

// #77: mirrored verbatim from index.html's PROFANITY_LIST/isProfaneName —
// this endpoint is public and reachable directly (curl, not just the game),
// so the client-side check in index.html buys nothing here on its own. The
// two lists must stay in sync or the local and global boards judge the same
// name differently — same "restated in both places" trap the boss/preview-env
// bindings already have (see CLAUDE.md). #89: suffixed/plural forms are no
// longer caught "for free" (see PROFANITY_RE below), so a handful — like
// "asshole" off "ass" — are listed explicitly where it matters.
const PROFANITY_LIST = [
  "fuck", "shit", "bitch", "cunt", "dick", "cock", "pussy", "whore", "slut",
  "ass", "asses", "asshole", "bastard", "rape", "nigger", "nigga", "faggot",
  "retard", "chink", "spic", "kike", "gook", "tranny", "wetback", "sex",
  "porn", "anal", "penis", "vagina", "boob", "cum",
  // French.
  "merde", "putain", "pute", "salope", "connard", "connasse", "encule",
  "bite", "couille", "nique", "batard", "foutre", "branler", "pede",
  "bougnoule", "negre", "youpin",
];
const PROFANITY_CHAR_MAP = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t",
  "@": "a", "$": "s", "+": "t", "|": "i",
  "à": "a", "â": "a", "ä": "a", "é": "e", "è": "e", "ê": "e", "ë": "e",
  "î": "i", "ï": "i", "ô": "o", "ö": "o", "ù": "u", "û": "u", "ü": "u",
  "ç": "c",
};
// A silent substitution, not a 400: the name is well-formed, just not one
// that can go on a permanent, never-reset, world-visible board.
const PROFANITY_FALLBACK_NAME = "Bisounours";

// Folds the usual filter evasions before matching: leetspeak look-alikes
// ("a55" -> "ass") and French accented letters ("nègre" -> "negre") fold to
// their plain equivalent. Unlike #77, anything left that isn't a-z (spaces,
// punctuation) is kept rather than dropped — PROFANITY_RE below treats it as
// a word boundary instead, so "s e x" still matches as one spaced-out root
// but "ass" no longer fires from inside "Cassandra" (#89).
function normalizeForProfanity(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i].toLowerCase();
    out += PROFANITY_CHAR_MAP[ch] || ch;
  }
  return out;
}

// #89: each root has to land on a letter boundary (string start/end, or any
// non-letter) on both sides, so it can only match a whole run of letters —
// never a substring straddling part of one word and part of another. Filler
// between the root's own letters ([^a-z]*) is still allowed, so an evasion
// that spaces or leetspeaks a root apart ("s e x", "a55") still matches it as
// a single word; what it can no longer do is fire from the middle of an
// unrelated word ("Cassandra", "Hitchcock", "Analyst", ...).
const PROFANITY_RE = new RegExp(
  "(?:^|[^a-z])(?:" +
    PROFANITY_LIST.map((w) => w.split("").join("[^a-z]*")).join("|") +
  ")(?:$|[^a-z])"
);

function filterProfanity(name) {
  return PROFANITY_RE.test(normalizeForProfanity(name)) ? PROFANITY_FALLBACK_NAME : name;
}

async function hashIp(secret, ip) {
  const bytes = await crypto.subtle.digest("SHA-256", enc.encode(secret + "|" + ip));
  return b64url(bytes).slice(0, 22);
}

async function readBoard(db) {
  const { results } = await db
    .prepare("SELECT name, score FROM scores ORDER BY score DESC, created_at ASC LIMIT ?")
    .bind(BOARD_SIZE)
    .all();
  return (results || []).map((r) => ({ name: r.name, score: r.score }));
}

// Fail closed: without a secret we cannot tell a real token from a forged one,
// so the endpoint refuses to serve rather than silently accepting anything.
function requireSecret(env) {
  const secret = env.HOF_SECRET;
  return typeof secret === "string" && secret.length >= 16 ? secret : null;
}

export async function onRequestGet({ env }) {
  const secret = requireSecret(env);
  if (!secret) return json({ error: "not_configured" }, 503);
  try {
    return json({ scores: await readBoard(env.DB), token: await issueToken(secret) });
  } catch (e) {
    return json({ error: "unavailable" }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  const secret = requireSecret(env);
  if (!secret) return json({ error: "not_configured" }, 503);

  // #92: without this, a cross-origin page can drive a visitor's browser into
  // POSTing here via a plain form submission (no CORS preflight needed for
  // those content types), burning that visitor's rate-limit budget under a
  // name of the attacker's choosing. There are no CORS response headers for
  // the attacker to read either way, but requiring JSON blocks the form-POST
  // shape outright.
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    return json({ error: "bad_request" }, 400);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "bad_request" }, 400);
  }

  const session = await readToken(secret, body && body.token);
  if (!session) return json({ error: "bad_token" }, 403);

  const age = Date.now() - session.issuedAt;
  // A negative age means a token minted in the future — clock skew or a forgery
  // against a leaked secret. Either way it is not a run we can date.
  if (age < MIN_RUN_MS || age > TOKEN_MAX_AGE_MS) return json({ error: "bad_session_age" }, 403);

  const score = body.score;
  if (!Number.isInteger(score) || score <= 0 || score > ABSOLUTE_MAX_SCORE) {
    return json({ error: "bad_score" }, 400);
  }
  if (score > (Math.min(age, RATE_CHECK_MAX_AGE_MS) / 1000) * MAX_POINTS_PER_SEC) {
    return json({ error: "implausible" }, 403);
  }

  let name = cleanName(body.name);
  if (!name) return json({ error: "bad_name" }, 400);
  name = filterProfanity(name); // #77: silent substitution, not a rejection

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const ipHash = await hashIp(secret, ip);
  const now = Date.now();

  try {
    // #91: opportunistic prune. submissions rows are disposable past the rate
    // window (schema.sql), so there is no cron or second entry point — every
    // request that already touches the table trims it back to real traffic.
    // #100: an IP already over RATE_MAX_SUBMISSIONS still pays for this DELETE
    // and the guarded INSERT below on every request, since GET hands out
    // tokens for free and unmetered. Accepted rather than added a pre-check
    // SELECT: that would reintroduce a second statement on the common
    // (allowed) path to save one only on the abuse path, and any pre-check
    // still has to defer to the same atomic INSERT...WHERE below for actual
    // authorisation (#92), so it could only ever short-circuit, never decide.
    await env.DB
      .prepare("DELETE FROM submissions WHERE created_at < ?")
      .bind(now - RATE_WINDOW_MS)
      .run();

    // #91: counted before the score is stored, so anything that fails between
    // the two inserts — including the UNIQUE-constraint replay rejection below
    // — still costs the submitting IP a rate-limit slot instead of skipping
    // the limiter entirely.
    // #92: the count and the insert are one statement rather than a
    // SELECT-then-INSERT, so two POSTs from the same IP arriving together can
    // no longer both read the same count and both pass — the row only
    // inserts if the subquery's count is still under the limit at insert time.
    const rateInsert = await env.DB
      .prepare(
        "INSERT INTO submissions (ip_hash, created_at) " +
        "SELECT ?, ? WHERE (SELECT COUNT(*) FROM submissions WHERE ip_hash = ? AND created_at > ?) < ?"
      )
      .bind(ipHash, now, ipHash, now - RATE_WINDOW_MS, RATE_MAX_SUBMISSIONS)
      .run();
    if (!rateInsert.meta || rateInsert.meta.changes === 0) {
      return json({ error: "rate_limited" }, 429);
    }
    // The UNIQUE constraint on nonce is the replay defence: a token that has
    // already bought a score fails here instead of inserting a duplicate.
    await env.DB
      .prepare("INSERT INTO scores (name, score, nonce, created_at) VALUES (?, ?, ?, ?)")
      .bind(name, score, session.nonce, now)
      .run();
  } catch (e) {
    if (String(e && e.message).includes("UNIQUE")) return json({ error: "already_submitted" }, 409);
    return json({ error: "unavailable" }, 503);
  }

  // #100: the score is already stored at this point, so a read failure here
  // must not surface as an unhandled throw (a Worker error page) or, worse,
  // as "already_submitted" — it's a separate try, not folded into the one
  // above, so a broken read can never be misreported as the UNIQUE-replay case.
  try {
    return json({ scores: await readBoard(env.DB) });
  } catch (e) {
    return json({ error: "unavailable" }, 503);
  }
}
