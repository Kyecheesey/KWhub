import { sql, migrate } from "@/lib/db";
import { requirePartner } from "@/lib/partnerAuth";

async function owns(partnerId: number, id: string) {
  const rows = await sql`
    SELECT 1 FROM posts po JOIN clients c ON c.id = po.client_id
    WHERE po.id = ${id} AND c.partner_id = ${partnerId}
  `;
  return rows.length > 0;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const { id } = await params;
  if (!(await owns(r.scope.partnerId, id))) return Response.json({ error: "Post not found" }, { status: 404 });
  const rows = await sql`SELECT * FROM post_comments WHERE post_id = ${id} ORDER BY created_at ASC`;
  return Response.json(rows);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const { id } = await params;
  if (!(await owns(r.scope.partnerId, id))) return Response.json({ error: "Post not found" }, { status: 404 });
  const { body } = await req.json();
  if (!body?.trim()) return Response.json({ error: "Comment required" }, { status: 400 });
  // author_role 'staff' so the client portal renders it as the managing side
  const rows = await sql`
    INSERT INTO post_comments (post_id, author, author_role, body)
    VALUES (${id}, ${r.scope.name ?? null}, 'staff', ${body.trim()})
    RETURNING *
  `;
  return Response.json(rows[0], { status: 201 });
}
