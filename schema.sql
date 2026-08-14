-- Global hall of fame (#67). Applied to the D1 database bound as DB.
--
-- The board must never be reset once live, so everything here is additive and
-- carries a schema_version: a later format change migrates rows forward rather
-- than dropping the table. Never write a destructive migration against this.

CREATE TABLE IF NOT EXISTS scores (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
  score          INTEGER NOT NULL,
  -- The session nonce the score was submitted with. UNIQUE is what makes a
  -- replayed submission fail at the database rather than needing a separate
  -- "seen tokens" table — one issued token buys exactly one score.
  nonce          TEXT    NOT NULL UNIQUE,
  created_at     INTEGER NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1
);

-- The board query is "top N by score"; ties break toward whoever got there
-- first, which matches the arcade convention already used by hallOfFameRank().
CREATE INDEX IF NOT EXISTS idx_scores_leaderboard ON scores (score DESC, created_at ASC);

-- Per-IP submission log, used only for rate limiting. Rows here are disposable
-- — unlike scores, this table may be pruned freely.
CREATE TABLE IF NOT EXISTS submissions (
  ip_hash    TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_window ON submissions (ip_hash, created_at);
