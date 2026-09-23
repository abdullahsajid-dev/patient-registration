'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/patients.db';

// Ensure the data directory exists
const dbDir = path.dirname(path.resolve(DB_PATH));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─────────────────────────────────────────────
// Schema Migration
// ─────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id          TEXT PRIMARY KEY,
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,       -- ISO 8601: YYYY-MM-DD
    phone       TEXT NOT NULL UNIQUE,  -- normalized E.164 format
    email       TEXT,
    address     TEXT,
    city        TEXT,
    state       TEXT,
    zip         TEXT,
    reason_for_visit TEXT,
    call_transcript  TEXT,             -- optional JSON transcript
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    deleted_at  TEXT                   -- soft-delete timestamp
  );

  CREATE TABLE IF NOT EXISTS call_logs (
    id          TEXT PRIMARY KEY,
    patient_id  TEXT REFERENCES patients(id),
    vapi_call_id TEXT,
    started_at  TEXT,
    ended_at    TEXT,
    duration_seconds INTEGER,
    outcome     TEXT,    -- 'registered' | 'updated' | 'abandoned'
    summary     TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
  CREATE INDEX IF NOT EXISTS idx_patients_deleted ON patients(deleted_at);
`);

console.log(`✅ Database initialized at: ${path.resolve(DB_PATH)}`);

module.exports = db;
