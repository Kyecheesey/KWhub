import { sql, migrate } from "@/lib/db";
import { requirePartner, partnerOwnsClient } from "@/lib/partnerAuth";

// Jobs board for a partner's clients — same client_jobs table as the KWI
// hub (partner-owned clients are excluded from the KWI board), so support
// requests raised in their clients' portals land here too.

// GET ?client_id= → jobs across this partner's clients
export async function GET(request: Request) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const p = new URL(request.url).searchParams;
  const clientId = p.get("client_id") ? parseInt(p.get("client_id")!, 10) : null;
  const rows = await sql`
    SELECT j.*, c.business_name,
      (SELECT COUNT(*)::int FROM job_comments jc WHERE jc.job_id = j.id) AS comment_count
    FROM client_jobs j
    JOIN clients c ON c.id = j.client_id
    WHERE c.partner_id = ${r.scope.partnerId}
      AND (${clientId}::int IS NULL OR j.client_id = ${clientId})
    ORDER BY (j.status != 'done') DESC, j.created_at DESC
  `;
  return Response.json(rows);
}

// POST {client_id, title, description?, priority?, due_date?, visible_to_client?}
export async function POST(request: Request) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const b = await request.json();
  const clientId = parseInt(b.client_id, 10);
  if (!clientId || !b.title?.trim()) {
    return Response.json({ error: "client_id and title are required" }, { status: 400 });
  }
  const owned = await partnerOwnsClient(r.scope.partnerId, clientId);
  if (!owned) return Response.json({ error: "Not one of your clients" }, { status: 403 });
  const priority = ["low", "medium", "high"].includes(b.priority) ? b.priority : "medium";
  const rows = await sql`
    INSERT INTO client_jobs (client_id, title, description, status, priority, assigned_to, due_date, visible_to_client)
    VALUES (${clientId}, ${b.title.trim()}, ${b.description?.trim() || null}, 'todo', ${priority},
            ${r.scope.name ?? null}, ${b.due_date || null}, ${b.visible_to_client ?? false})
    RETURNING *
  `;
  return Response.json(rows[0], { status: 201 });
}
