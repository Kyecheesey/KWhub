import { sql, migrate } from "@/lib/db";
import { resolvePortalScope } from "@/lib/portalAuth";

/** Jobs the client is allowed to see — only cards flagged visible_to_client. */
export async function GET(request: Request) {
  await migrate();
  const r = await resolvePortalScope(request);
  if ("error" in r) return r.error;
  const rows = await sql`
    SELECT id, title, description, status, due_date, updated_at
    FROM client_jobs
    WHERE client_id = ${r.scope.clientId} AND visible_to_client = TRUE
    ORDER BY
      CASE status WHEN 'in_progress' THEN 0 WHEN 'in_review' THEN 1 WHEN 'todo' THEN 2 ELSE 3 END,
      updated_at DESC
  `;
  return Response.json(rows);
}
