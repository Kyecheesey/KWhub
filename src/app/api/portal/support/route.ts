import { sql, migrate } from "@/lib/db";
import { resolvePortalScope } from "@/lib/portalAuth";
import { notifyStaff } from "@/lib/portalNotify";

/**
 * IT Support requests — stored as client_jobs (kind = 'support') so they land
 * straight on the team's Client Jobs board with statuses the client can track.
 */

export async function GET(request: Request) {
  await migrate();
  const r = await resolvePortalScope(request);
  if ("error" in r) return r.error;
  const rows = await sql`
    SELECT id, title, description, status, priority, due_date, created_at, updated_at
    FROM client_jobs
    WHERE client_id = ${r.scope.clientId} AND kind = 'support'
    ORDER BY (status != 'done') DESC, created_at DESC
  `;
  return Response.json(rows);
}

export async function POST(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  if (!body.title?.trim()) return Response.json({ error: "Please describe the issue" }, { status: 400 });
  const priority = ["low", "medium", "high"].includes(body.priority) ? body.priority : "medium";
  const rows = await sql`
    INSERT INTO client_jobs (client_id, title, description, status, priority, kind, visible_to_client)
    VALUES (${r.scope.clientId}, ${body.title.trim()}, ${body.description?.trim() || null},
            'todo', ${priority}, 'support', TRUE)
    RETURNING id, title, description, status, priority, due_date, created_at, updated_at
  `;
  await notifyStaff(
    r.scope.clientId,
    `New IT support request: ${body.title.trim()}`,
    `${r.scope.name ?? "A client"} raised a support request${priority === "high" ? " (HIGH priority)" : ""}:\n\n${body.title.trim()}${body.description ? `\n\n${body.description.trim()}` : ""}\n\nIt's on the Client Jobs board.`
  );
  return Response.json(rows[0], { status: 201 });
}
