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
  // Seed initial users — DO NOTHING so passwords changed in-app persist
  await sql`
    INSERT INTO users (name, username, password_hash) VALUES
      ('Kye',   'kye',   '$2b$12$TnpKR02s9ccbpccZl.pTTe.7arxp2d7il62Hu/977YM1RfK4OMKHm'),
      ('Luka',  'luka',  '$2b$12$9JBWUvk1qxzyEga97FnPLen6BDthAmyPr/QSx8JSPZImok.9jUnpS'),
      ('Aksel', 'aksel', '$2b$12$CZlj6jJ4PJzqhtsqtejYH.Htm9VuASa3l/4adS/PAd2P6j1Z9Mdo2'),
      ('Kaylie', 'kaylie', '$2b$12$x.lBrw1rX2Wnoz2e0IIBzuKF5xqxEg/x.R0PSAdKZHOnHdAeKjAqS')
    ON CONFLICT (username) DO NOTHING
  `;
  // One-shot migration: rotate Kye's password off the old seeded hash.
  // Matches only the previous hash, so it can never overwrite a later change.
  await sql`
    UPDATE users
    SET password_hash = '$2b$12$TnpKR02s9ccbpccZl.pTTe.7arxp2d7il62Hu/977YM1RfK4OMKHm'
    WHERE username = 'kye'
      AND password_hash = '$2b$12$pyhjXNv65tTkz5u8cAHw7u2N0KXOzZVV5jWkEtDGgO9lSaWVs70ne'
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
      notes            TEXT,
      status           TEXT DEFAULT 'new',
      assigned_to      TEXT,
      contact_method   TEXT,
      follow_up_date   DATE,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE potentials ADD COLUMN IF NOT EXISTS contact_method TEXT`;
  await sql`ALTER TABLE potentials ADD COLUMN IF NOT EXISTS follow_up_date DATE`;
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
  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT,
      status      TEXT DEFAULT 'pending',
      priority    TEXT DEFAULT 'medium',
      assigned_to TEXT NOT NULL,
      assigned_by TEXT,
      due_date    DATE,
      completed_at TIMESTAMPTZ,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS activities (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT,
      status      TEXT DEFAULT 'todo',
      priority    TEXT DEFAULT 'medium',
      assigned_to TEXT,
      due_date    DATE,
      tags        TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS checklist (
      id         SERIAL PRIMARY KEY,
      text       TEXT NOT NULL,
      done       BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'staff'`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS client_id INTEGER`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`UPDATE users SET email = 'director@kwinnovations.com.au' WHERE username = 'kye' AND email IS NULL`;
  await sql`
    CREATE TABLE IF NOT EXISTS password_resets (
      id         SERIAL PRIMARY KEY,
      username   TEXT NOT NULL,
      code_hash  TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts   INTEGER DEFAULT 0,
      used       BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS portal_messages (
      id          SERIAL PRIMARY KEY,
      client_id   INTEGER NOT NULL,
      author      TEXT,
      author_role TEXT,
      body        TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS portal_messages_client_idx ON portal_messages (client_id)`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_url TEXT`;
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id         SERIAL PRIMARY KEY,
      client_id  INTEGER NOT NULL,
      name       TEXT NOT NULL,
      stage      INTEGER DEFAULT 0,
      notes      TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS approvals (
      id            SERIAL PRIMARY KEY,
      client_id     INTEGER NOT NULL,
      title         TEXT NOT NULL,
      description   TEXT,
      status        TEXT DEFAULT 'pending',
      response_note TEXT,
      created_by    TEXT,
      responded_at  TIMESTAMPTZ,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id           SERIAL PRIMARY KEY,
      client_id    INTEGER NOT NULL,
      number       TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      due_date     DATE,
      status       TEXT DEFAULT 'due',
      pdf_url      TEXT,
      pay_url      TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS portal_files (
      id          SERIAL PRIMARY KEY,
      client_id   INTEGER NOT NULL,
      filename    TEXT NOT NULL,
      url         TEXT NOT NULL,
      size_bytes  INTEGER,
      uploaded_by TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS client_checklist (
      id         SERIAL PRIMARY KEY,
      client_id  INTEGER NOT NULL,
      text       TEXT NOT NULL,
      done       BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS events (
      id          SERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id   INTEGER,
      entity_name TEXT,
      actor       TEXT,
      action      TEXT NOT NULL,
      detail      TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS events_entity_idx ON events (entity_type, entity_id)`;
}
