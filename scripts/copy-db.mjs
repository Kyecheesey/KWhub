#!/usr/bin/env node
// One-shot data copy between two Postgres databases (e.g. Neon → Supabase).
//
// Usage:
//   OLD_DATABASE_URL='postgres://…neon…' NEW_DATABASE_URL='postgres://…supabase…' node scripts/copy-db.mjs
//
// Copies every KWhub table's rows verbatim (preserving ids), replacing any
// rows already in the target, then resets the id sequences. The target must
// already have the schema (deploy the app once, or run its migrate()).

import postgres from "postgres";

const TABLES = [
  "users", "clients", "potentials", "team_members", "call_list", "tasks",
  "activities", "roster_shifts", "checklist", "password_resets",
  "portal_messages", "projects", "approvals", "invoices", "portal_files",
  "client_checklist", "settings", "events", "client_jobs",
];

const oldUrl = process.env.OLD_DATABASE_URL;
const newUrl = process.env.NEW_DATABASE_URL;
if (!oldUrl || !newUrl) {
  console.error("Set OLD_DATABASE_URL and NEW_DATABASE_URL environment variables.");
  process.exit(1);
}

const src = postgres(oldUrl, { prepare: false, max: 1 });
const dst = postgres(newUrl, { prepare: false, max: 1 });

try {
  for (const table of TABLES) {
    let rows;
    try {
      rows = await src.unsafe(`SELECT * FROM ${table}`);
    } catch {
      console.log(`- ${table}: not in source, skipped`);
      continue;
    }
    await dst.unsafe(`DELETE FROM ${table}`);
    for (const row of rows) {
      const cols = Object.keys(row);
      const vals = cols.map((_, i) => `$${i + 1}`).join(", ");
      await dst.unsafe(
        `INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${vals})`,
        cols.map((c) => row[c]),
      );
    }
    // Reset the serial sequence so new inserts don't collide with copied ids
    if (rows.length > 0 && "id" in rows[0]) {
      await dst.unsafe(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${table}))`,
      );
    }
    console.log(`✓ ${table}: ${rows.length} rows`);
  }
  console.log("Done.");
} finally {
  await src.end();
  await dst.end();
}
