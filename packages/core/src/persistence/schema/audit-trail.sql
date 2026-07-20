-- ============================================================
-- BehaviorOS Persistent Audit Trail — SQLite Schema
-- Version: 1.0.0
-- ============================================================
--
-- Append-only hash-chain audit trail with tamper evidence.
-- Designed for WAL mode with high-throughput sequential writes.
--
-- Design principles:
--   1. Append-only: rows are never updated, only inserted/deleted
--   2. Hash chain: each row's hash links to the previous row
--   3. Monotonic sequence: sequence_num never reuses values
--   4. Retention: old entries pruned by sequence, not by content
--   5. Verification: chain integrity verifiable from any point
-- ============================================================

-- Main audit trail table
CREATE TABLE IF NOT EXISTS audit_trail (
  id            TEXT PRIMARY KEY,                          -- UUID v4
  sequence_num  INTEGER NOT NULL,                         -- Monotonic, never reused (gap-tolerant)
  timestamp     TEXT NOT NULL,                            -- ISO-8601 UTC
  agent_id      TEXT NOT NULL,                            -- Agent that produced this entry
  action        TEXT NOT NULL,                            -- Action label (e.g. 'deploy', 'commit')
  pipeline_id   TEXT,                                     -- Pipeline run ID (nullable for non-pipeline entries)
  layer_index   INTEGER,                                  -- Layer index within pipeline (nullable)
  layer_id      TEXT,                                     -- Layer ID (nullable)
  previous_hash TEXT NOT NULL,                            -- SHA-256 of predecessor entry (genesis: '')
  hash          TEXT NOT NULL,                            -- SHA-256 of this entry
  payload       TEXT,                                     -- JSON-serialized details (nullable for lightweight entries)
  metadata      TEXT,                                     -- JSON-serialized metadata (nullable)
  signature     TEXT,                                     -- Optional HMAC-SHA256 signature
  version       INTEGER NOT NULL DEFAULT 1,               -- Schema version for future evolution
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))    -- Row creation time (for retention queries)
);

-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_trail_sequence   ON audit_trail(sequence_num);
CREATE INDEX IF NOT EXISTS idx_audit_trail_timestamp  ON audit_trail(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_trail_agent      ON audit_trail(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_pipeline   ON audit_trail(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_action     ON audit_trail(action);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at ON audit_trail(created_at);

-- Composite index for chain verification (scan from sequence N onward)
CREATE INDEX IF NOT EXISTS idx_audit_trail_chain ON audit_trail(sequence_num, hash, previous_hash);

-- Metadata table for chain state (persists across restarts)
CREATE TABLE IF NOT EXISTS audit_trail_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Stored key-value pairs for chain metadata:
--   'last_sequence_num'  → INTEGER  (last assigned sequence number)
--   'last_hash'          → TEXT     (hash of the most recent entry)
--   'chain_length'       → INTEGER  (total entries including pruned)
--   'pruned_count'       → INTEGER  (entries removed by retention)
--   'last_verified_seq'  → INTEGER  (last sequence number verified)
--   'schema_version'     → INTEGER  (current schema version)

-- Retention policy table (configurable per-deployment)
CREATE TABLE IF NOT EXISTS audit_trail_retention (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  policy_name TEXT NOT NULL UNIQUE,                       -- e.g. 'default', 'compliance'
  max_entries INTEGER,                                    -- Keep at most N entries (NULL = unlimited)
  max_age_days INTEGER,                                   -- Keep entries for at most N days (NULL = unlimited)
  enabled     INTEGER NOT NULL DEFAULT 1,                 -- 0 = disabled, 1 = enabled
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Default retention policy: keep last 100,000 entries, 365 days
INSERT OR IGNORE INTO audit_trail_retention (policy_name, max_entries, max_age_days)
VALUES ('default', 100000, 365);
