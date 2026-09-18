import { sql, migrate } from "@/lib/db";
import { requirePartner, partnerOwnsClient } from "@/lib/partnerAuth";

// Content planner for a partner's clients — same posts pipeline as the KWI
// hub (draft → pending_approval → approved → published) but every query is
// joined to the partner's own clients.

// GET ?client_id= → posts across this partner's clients
export async function GET(request: Request) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const p = new URL(request.url).searchParams;
  const clientId = p.get("client_id") ? parseInt(p.get("client_id")!, 10) : null;
  const rows = await sql`
    SELECT po.*,
      (SELECT COUNT(*)::int FROM post_comments pcm WHERE pcm.post_id = po.id) AS comment_count,
      c.business_name
    FROM posts po
    JOIN clients c ON c.id = po.client_id
    WHERE c.partner_id = ${r.scope.partnerId}
      AND (${clientId}::int IS NULL OR po.client_id = ${clientId})
    ORDER BY po.scheduled_at NULLS LAST, po.created_at DESC
  `;
  return Response.json(rows);
}

// POST {client_id, title?, caption?, scheduled_at?, status?} → create a post
export async function POST(request: Request) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const body = await request.json();
  const clientId = parseInt(body.client_id, 10);
  if (!clientId) return Response.json({ error: "client_id is required" }, { status: 400 });
  const owned = await partnerOwnsClient(r.scope.partnerId, clientId);
  if (!owned) return Response.json({ error: "Not one of your clients" }, { status: 403 });
  if (!body.caption?.trim() && !body.title?.trim()) {
    return Response.json({ error: "A title or caption is required" }, { status: 400 });
  }
  const status = body.status === "pending_approval" ? "pending_approval" : "draft";
  const rows = await sql`
    INSERT INTO posts (client_id, title, caption, scheduled_at, status, created_by)
    VALUES (${clientId}, ${body.title?.trim() || null}, ${body.caption?.trim() || null},
            ${body.scheduled_at || null}, ${status}, ${r.scope.name ?? null})
    RETURNING *
  `;
  return Response.json(rows[0], { status: 201 });
}
