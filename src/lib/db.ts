import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "kwhub.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  migrate(_db);
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_name TEXT NOT NULL,
      contact_name TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      notes TEXT,
      source TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS potentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_name TEXT NOT NULL,
      contact_name TEXT,
      phone TEXT,
      email TEXT,
      notes TEXT,
      status TEXT DEFAULT 'new',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS call_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_type TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      added_by TEXT,
      notes TEXT,
      called INTEGER DEFAULT 0,
      called_at TEXT,
      called_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(record_type, record_id)
    );
  `);

  // Non-destructive column additions for existing DBs
  const safeAdd = (table: string, col: string, def: string) => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`); } catch { /* already exists */ }
  };

  safeAdd("clients",   "assigned_to",  "TEXT");
  safeAdd("potentials","assigned_to",  "TEXT");
}
