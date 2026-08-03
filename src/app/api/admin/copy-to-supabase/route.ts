import postgres from "postgres";

// TEMPORARY one-shot migration endpoint — copies all data from the current
// DATABASE_URL (Neon) into the new Supabase database. Delete this file after
// the cutover. Guarded by a single-use token.

const TOKEN = "fb707c8280611bd1f789fd2f5910a5e4";
// Candidate Supabase connection strings — pooler cluster varies by project.
const TARGET_CANDIDATES = [
  "postgresql://postgres.uvvbuqkjpdqvyigdiupn:D3Rmnz8quHzy0cex@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres",
  "postgresql://postgres.uvvbuqkjpdqvyigdiupn:D3Rmnz8quHzy0cex@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres",
  "postgresql://postgres.uvvbuqkjpdqvyigdiupn:D3Rmnz8quHzy0cex@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres",
  "postgresql://postgres.uvvbuqkjpdqvyigdiupn:D3Rmnz8quHzy0cex@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres",
];

const TABLES = [
  "users", "clients", "potentials", "team_members", "call_list", "tasks",
  "activities", "roster_shifts", "checklist", "password_resets",
  "portal_messages", "projects", "approvals", "invoices", "portal_files",
  "client_checklist", "settings", "events", "client_jobs",
];

export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("token") !== TOKEN) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: "DATABASE_URL not set" }, { status: 500 });
  }
  if (process.env.DATABASE_URL.includes("supabase.com")) {
    return Response.json({ error: "DATABASE_URL already points at Supabase — nothing to copy. Delete this route." }, { status: 400 });
  }

  // Find the pooler host that accepts this project
  let dst: ReturnType<typeof postgres> | null = null;
  let workingUrl = "";
  const attempts: Record<string, string> = {};
  for (const candidate of TARGET_CANDIDATES) {
    const c = postgres(candidate, { prepare: false, max: 1, connect_timeout: 8 });
    try {
      await c.unsafe("SELECT 1");
      dst = c;
      workingUrl = candidate;
      break;
    } catch (err) {
      attempts[candidate.split("@")[1]] = err instanceof Error ? err.message : String(err);
      await c.end({ timeout: 1 });
    }
  }
  if (!dst) {
    return Response.json({ ok: false, error: "Could not connect to Supabase on any candidate host", attempts }, { status: 502 });
  }

  const src = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
  const copied: Record<string, number | string> = {};

  try {
    for (const table of TABLES) {
      let rows;
      try {
        rows = await src.unsafe(`SELECT * FROM ${table}`);
      } catch {
        copied[table] = "not in source, skipped";
        continue;
      }
      await dst.unsafe(`DELETE FROM ${table}`);
      for (const row of rows) {
        const cols = Object.keys(row);
        const vals = cols.map((_, i) => `$${i + 1}`).join(", ");
        await dst.unsafe(
          `INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${vals})`,
          cols.map((c) => row[c] as never),
        );
      }
      if (rows.length > 0 && "id" in rows[0]) {
        await dst.unsafe(
          `SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${table}))`,
        );
      }
      copied[table] = rows.length;
    }
    return Response.json({
      ok: true,
      copied,
      use_this_database_url: workingUrl,
      next: "Update DATABASE_URL in Vercel to the value in use_this_database_url and redeploy.",
    });
  } catch (err) {
    return Response.json({ ok: false, copied, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  } finally {
    await src.end();
    await dst.end();
  }
}
