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
CREATE TABLE IF NOT EXISTS contacts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
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
  return db;
}
