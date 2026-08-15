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
const NAME_MAX = 12;

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
// limits rather than trusting the input element's maxlength. Control characters
// are stripped outright; the client escapes on render, but a name that can
// never contain them is one less thing depending on that.
function cleanName(raw) {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, NAME_MAX);
  return name.length ? name : null;
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
  if (score > (age / 1000) * MAX_POINTS_PER_SEC) return json({ error: "implausible" }, 403);

  const name = cleanName(body.name);
  if (!name) return json({ error: "bad_name" }, 400);

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const ipHash = await hashIp(secret, ip);
  const now = Date.now();

  try {
    const recent = await env.DB
      .prepare("SELECT COUNT(*) AS n FROM submissions WHERE ip_hash = ? AND created_at > ?")
      .bind(ipHash, now - RATE_WINDOW_MS)
      .first();
    if (recent && recent.n >= RATE_MAX_SUBMISSIONS) return json({ error: "rate_limited" }, 429);

    // The UNIQUE constraint on nonce is the replay defence: a token that has
    // already bought a score fails here instead of inserting a duplicate.
    await env.DB
      .prepare("INSERT INTO scores (name, score, nonce, created_at) VALUES (?, ?, ?, ?)")
      .bind(name, score, session.nonce, now)
      .run();
    await env.DB
      .prepare("INSERT INTO submissions (ip_hash, created_at) VALUES (?, ?)")
      .bind(ipHash, now)
      .run();
  } catch (e) {
    if (String(e && e.message).includes("UNIQUE")) return json({ error: "already_submitted" }, 409);
    return json({ error: "unavailable" }, 503);
  }

  return json({ scores: await readBoard(env.DB) });
}
