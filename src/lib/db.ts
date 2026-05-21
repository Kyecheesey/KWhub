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

// Ensure all tables exist — called at the start of each GET/POST handler
export async function migrate() {
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
