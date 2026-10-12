import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

// Local persistent state (SQLite via Node's built-in node:sqlite).
// Suitable for a local demo. Not for ephemeral serverless filesystems.

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  stage TEXT NOT NULL,
  contract_json TEXT NOT NULL,
  contract_hash TEXT NOT NULL,
  fault_injection INTEGER NOT NULL,
  planner TEXT NOT NULL,
  final_attempt_id TEXT,
  outcome_json TEXT,
  trace_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  seq INTEGER NOT NULL,
  provider_id TEXT NOT NULL,
  quote_micro TEXT NOT NULL,
  status TEXT NOT NULL,
  decision_json TEXT NOT NULL,
  delivery_json TEXT,
  verification_json TEXT,
  dispute_json TEXT,
  reservation_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (job_id, seq)
);

CREATE TABLE IF NOT EXISTS events (
  job_id TEXT NOT NULL REFERENCES jobs(id),
  seq INTEGER NOT NULL,
  ts TEXT NOT NULL,
  stage TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  data_json TEXT,
  PRIMARY KEY (job_id, seq)
);

-- Simulated escrow ledger
CREATE TABLE IF NOT EXISTS budgets (
  job_id TEXT PRIMARY KEY REFERENCES jobs(id),
  budget_micro TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  attempt_id TEXT NOT NULL UNIQUE,
  payee TEXT NOT NULL,
  amount_micro TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reserved','released','refunded','held')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
-- One final settlement (release) per job, enforced by the database.
CREATE UNIQUE INDEX IF NOT EXISTS one_release_per_job ON reservations(job_id) WHERE status = 'released';

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id),
  reservation_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('budget','reserve','release','refund','hold')),
  amount_micro TEXT NOT NULL,
  mode TEXT NOT NULL,
  receipt_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Idempotency: every value-moving operation carries a key. Replays return the stored result.
CREATE TABLE IF NOT EXISTS idempotency (
  key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed','unknown')),
  result_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export type Db = DatabaseSync;

export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}

/** Run fn inside BEGIN IMMEDIATE ... COMMIT. fn must be synchronous. */
export function tx<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export const nowIso = () => new Date().toISOString();
