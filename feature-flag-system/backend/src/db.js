/**
 * Persistence layer.
 *
 * We use sql.js (pure WASM SQLite, no native compilation) instead of a
 * binary-dependent driver like better-sqlite3/sqlite3. Trade-off, written
 * down explicitly because it's a deliberate engineering choice, not an
 * oversight: sql.js keeps the whole database in memory and we serialize it
 * to a single .sqlite file on disk after every write. That's perfectly fine
 * for an assignment-scale app with light write volume and a single process,
 * but it would NOT scale to concurrent writers or large datasets — a real
 * deployment would swap this module for better-sqlite3/pg without touching
 * any route code, since everything else talks to db.js through query()/run().
 */

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const config = require('./config');

let SQL = null;
let db = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

INSERT OR IGNORE INTO roles (id, name) VALUES (1, 'super_admin');
INSERT OR IGNORE INTO roles (id, name) VALUES (2, 'org_admin');
INSERT OR IGNORE INTO roles (id, name) VALUES (3, 'end_user');

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feature_flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(org_id, key)
);
`;

function persist() {
  const data = db.export();
  fs.writeFileSync(config.DB_FILE, Buffer.from(data));
}

async function init() {
  if (db) return db;
  SQL = await initSqlJs();

  if (fs.existsSync(config.DB_FILE)) {
    const fileBuffer = fs.readFileSync(config.DB_FILE);
    db = new SQL.Database(fileBuffer);
  } else {
    fs.mkdirSync(path.dirname(config.DB_FILE), { recursive: true });
    db = new SQL.Database();
  }

  db.run(SCHEMA);
  persist();
  return db;
}

/** Run a write statement (INSERT/UPDATE/DELETE). Persists to disk afterwards. */
function run(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
  persist();
  return {
    lastInsertRowid: db.exec('SELECT last_insert_rowid() AS id')[0]?.values[0][0] ?? null,
  };
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = query(sql, params);
  return rows[0];
}

module.exports = { init, run, query, queryOne };
