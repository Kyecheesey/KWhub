import postgres, { type Sql } from "postgres";

let _sql: Sql | null = null;

function client(): Sql {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set. Add it to .env.local (dev) or Vercel environment variables (production).");
    }
    // Supabase transaction-mode pooler (port 6543) doesn't support prepared statements.
    // Fail fast on connect issues instead of hanging until the function times out.
    _sql = postgres(process.env.DATABASE_URL, {
      prepare: false,
      max: 1,
      connect_timeout: 10,
      idle_timeout: 20,
    });
  }
  return _sql;
}

export function sql(strings: TemplateStringsArray, ...params: unknown[]): Promise<Record<string, unknown>[]> {
  return client()(strings, ...(params as never[])) as unknown as Promise<Record<string, unknown>[]>;
}

// Ensure all tables exist + seed initial users — called at the start of each handler.
// Runs the full migration only once per server instance; later calls return instantly.
let _migrated: Promise<void> | null = null;

// Bump whenever a statement is added/changed below, so existing databases re-run the set.
const SCHEMA_VERSION = "2026-08-27.1";

export function migrate(): Promise<void> {
  if (!_migrated) {
    _migrated = runMigrations().catch((err) => {
      _migrated = null;
      throw err;
    });
  }
  return _migrated;
}

async function runMigrations() {
  // Fast path: an up-to-date database costs one query per cold start instead of ~50.
  try {
    const rows = await sql`SELECT value FROM settings WHERE key = 'schema_version'`;
    if ((rows[0] as { value: string } | undefined)?.value === SCHEMA_VERSION) return;
  } catch {
    // settings table doesn't exist yet — first run, do the full migration
  }
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
    CREATE TABLE IF NOT EXISTS roster_shifts (
      id         SERIAL PRIMARY KEY,
      day        TEXT NOT NULL,
      time       TEXT NOT NULL,
      person     TEXT NOT NULL,
      hours      REAL NOT NULL DEFAULT 0,
      focus      TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
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
  await sql`
    UPDATE users SET email = username || '@kwinnovations.com.au'
    WHERE email IS NULL AND username IN ('kye', 'luka', 'aksel', 'kaylie')
  `;
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
  // One-shot cleanup: scraped imports that saved page blurbs or "Visit …" links as business names
  await sql`
    DELETE FROM clients
    WHERE source = 'scraped'
      AND (LENGTH(business_name) > 60 OR business_name ILIKE 'visit %')
  `;
  await sql`
    INSERT INTO clients (business_name, website, source)
    SELECT 'L&V Civil Contracting', 'https://lvcivilcontracting.com.au', 'manual'
    WHERE NOT EXISTS (SELECT 1 FROM clients WHERE business_name ILIKE '%L&V Civil%')
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS client_jobs (
      id          SERIAL PRIMARY KEY,
      client_id   INTEGER NOT NULL,
      title       TEXT NOT NULL,
      description TEXT,
      status      TEXT DEFAULT 'todo',
      priority    TEXT DEFAULT 'medium',
      assigned_to TEXT,
      due_date    DATE,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS client_jobs_client_idx ON client_jobs (client_id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS job_comments (
      id         SERIAL PRIMARY KEY,
      job_id     INTEGER NOT NULL,
      author     TEXT,
      body       TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS job_comments_job_idx ON job_comments (job_id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS job_time_entries (
      id         SERIAL PRIMARY KEY,
      job_id     INTEGER NOT NULL,
      person     TEXT,
      hours      REAL NOT NULL,
      note       TEXT,
      entry_date DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS job_time_job_idx ON job_time_entries (job_id)`;
  await sql`ALTER TABLE client_jobs ADD COLUMN IF NOT EXISTS visible_to_client BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE potentials ADD COLUMN IF NOT EXISTS value_cents INTEGER`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence TEXT`;
  await sql`ALTER TABLE job_comments ENABLE ROW LEVEL SECURITY`;
  await sql`ALTER TABLE job_time_entries ENABLE ROW LEVEL SECURITY`;
  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         SERIAL PRIMARY KEY,
      username   TEXT NOT NULL,
      endpoint   TEXT NOT NULL UNIQUE,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY`;
  // Per-client portal module toggles (JSON array of module keys; NULL = default set)
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_modules TEXT`;
  // Support requests reuse client_jobs; kind distinguishes them on the board
  await sql`ALTER TABLE client_jobs ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'job'`;
  // ── Content planner / social scheduling ──
  await sql`
    CREATE TABLE IF NOT EXISTS social_accounts (
      id               SERIAL PRIMARY KEY,
      client_id        INTEGER NOT NULL,
      platform         TEXT NOT NULL,
      account_name     TEXT NOT NULL,
      account_ref      TEXT,
      access_token     TEXT,
      refresh_token    TEXT,
      token_expires_at TIMESTAMPTZ,
      status           TEXT DEFAULT 'connected',
      connected_by     TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS social_accounts_client_idx ON social_accounts (client_id)`;
  await sql`ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY`;
  await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id            SERIAL PRIMARY KEY,
      client_id     INTEGER NOT NULL,
      title         TEXT,
      caption       TEXT,
      scheduled_at  TIMESTAMPTZ,
      status        TEXT DEFAULT 'draft',
      created_by    TEXT,
      approval_note TEXT,
      responded_at  TIMESTAMPTZ,
      published_at  TIMESTAMPTZ,
      publish_error TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS posts_client_idx ON posts (client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS posts_sched_idx ON posts (status, scheduled_at)`;
  await sql`ALTER TABLE posts ENABLE ROW LEVEL SECURITY`;
  await sql`
    CREATE TABLE IF NOT EXISTS post_channels (
      id                SERIAL PRIMARY KEY,
      post_id           INTEGER NOT NULL,
      social_account_id INTEGER,
      platform          TEXT NOT NULL,
      publish_status    TEXT DEFAULT 'pending',
      external_post_id  TEXT,
      published_at      TIMESTAMPTZ,
      error             TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS post_channels_post_idx ON post_channels (post_id)`;
  await sql`ALTER TABLE post_channels ENABLE ROW LEVEL SECURITY`;
  await sql`
    CREATE TABLE IF NOT EXISTS post_media (
      id           SERIAL PRIMARY KEY,
      post_id      INTEGER NOT NULL,
      filename     TEXT NOT NULL,
      url          TEXT NOT NULL,
      content_type TEXT,
      size_bytes   INTEGER,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS post_media_post_idx ON post_media (post_id)`;
  await sql`ALTER TABLE post_media ENABLE ROW LEVEL SECURITY`;
  await sql`
    CREATE TABLE IF NOT EXISTS post_comments (
      id          SERIAL PRIMARY KEY,
      post_id     INTEGER NOT NULL,
      author      TEXT,
      author_role TEXT,
      body        TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS post_comments_post_idx ON post_comments (post_id)`;
  await sql`ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY`;
  await sql`
    INSERT INTO settings (key, value) VALUES ('schema_version', ${SCHEMA_VERSION})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}
