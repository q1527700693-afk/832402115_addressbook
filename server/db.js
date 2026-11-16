import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function resolveDbPath(dbPath = process.env.DB_PATH) {
  if (!dbPath) return path.join(PROJECT_ROOT, 'data', 'addressbook.db');
  if (dbPath === ':memory:') return dbPath;
  return path.resolve(PROJECT_ROOT, dbPath);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL,
  expires_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS contacts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  company     TEXT    NOT NULL DEFAULT '',
  title       TEXT    NOT NULL DEFAULT '',
  birthday    TEXT    NOT NULL DEFAULT '',
  tags        TEXT    NOT NULL DEFAULT '',
  note        TEXT    NOT NULL DEFAULT '',
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_methods (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type       TEXT    NOT NULL,
  label      TEXT    NOT NULL DEFAULT '',
  value      TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_methods_contact
  ON contact_methods(contact_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_contacts_favorite
  ON contacts(is_favorite, name);
`;

function columnExists(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
}

/**
 * Legacy databases predate accounts: their rows keep user_id NULL and are
 * served as the read-only preview. No existing row is rewritten or removed.
 */
function migrate(db) {
  if (!columnExists(db, 'contacts', 'user_id')) {
    db.exec('ALTER TABLE contacts ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id, is_favorite, name)');
}

export function createDatabase(dbPath = resolveDbPath()) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec(SCHEMA);
  migrate(db);
  return db;
}
