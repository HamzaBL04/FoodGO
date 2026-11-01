'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const SCHEMA = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Opens (or creates) the database and applies the schema and migrations.
 * ':memory:' is used by the tests.
 */
function openDatabase(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  applyMigrations(db);
  return db;
}

function applyMigrations(db) {
  if (!fs.existsSync(MIGRATIONS_DIR)) return;
  db.exec('CREATE TABLE IF NOT EXISTS schema_migration (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const applied = new Set(db.prepare('SELECT name FROM schema_migration').all().map((r) => r.name));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const name of files) {
    if (applied.has(name)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migration (name, applied_at) VALUES (?, ?)').run(name, new Date().toISOString());
    })();
  }
}

module.exports = { openDatabase };
