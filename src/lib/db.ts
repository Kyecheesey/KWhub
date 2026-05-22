import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

export function sql(...args: Parameters<NeonQueryFunction<false, false>>) {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set. Add it to .env.local (dev) or Vercel environment variables (production).");
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql(...args);
}

// Ensure all tables exist + seed initial users — called at the start of each handler
export async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Seed initial users — DO UPDATE ensures passwords reset to known values
  await sql`
    INSERT INTO users (name, username, password_hash) VALUES
      ('Kye',   'kye',   '$2b$12$pyhjXNv65tTkz5u8cAHw7u2N0KXOzZVV5jWkEtDGgO9lSaWVs70ne'),
      ('Luka',  'luka',  '$2b$12$9JBWUvk1qxzyEga97FnPLen6BDthAmyPr/QSx8JSPZImok.9jUnpS'),
      ('Aksel', 'aksel', '$2b$12$CZlj6jJ4PJzqhtsqtejYH.Htm9VuASa3l/4adS/PAd2P6j1Z9Mdo2')
    ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id            SERIAL PRIMARY KEY,
      business_name TEXT NOT NULL,
      contact_name  TEXT,
      phone         TEXT,
      email         TEXT,
      website       TEXT,
      notes         TEXT,
      assigned_to   TEXT,
      source        TEXT DEFAULT 'manual',
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS potentials (
      id            SERIAL PRIMARY KEY,
      business_name TEXT NOT NULL,
      contact_name  TEXT,
      phone         TEXT,
      email         TEXT,
      notes         TEXT,
      status        TEXT DEFAULT 'new',
      assigned_to   TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS team_members (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      role       TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS call_list (
      id          SERIAL PRIMARY KEY,
      record_type TEXT NOT NULL,
      record_id   INTEGER NOT NULL,
      notes       TEXT,
      called      BOOLEAN DEFAULT FALSE,
      called_at   TIMESTAMPTZ,
      called_by   TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(record_type, record_id)
    )
  `;
}
