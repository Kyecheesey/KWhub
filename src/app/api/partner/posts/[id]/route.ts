import { sql, migrate } from "@/lib/db";
import { requirePartner } from "@/lib/partnerAuth";
import { notifyClient } from "@/lib/portalNotify";

const STATUSES = ["draft", "pending_approval", "approved", "changes_requested", "published"];

async function ownedPost(partnerId: number, id: string) {
  const rows = await sql`
    SELECT po.* FROM posts po
    JOIN clients c ON c.id = po.client_id
    WHERE po.id = ${id} AND c.partner_id = ${partnerId}
  `;
  return (rows[0] as { id: number; client_id: number; title: string | null; caption: string | null; status: string } | undefined) ?? null;
}

// PATCH /api/partner/posts/[id] — edit fields / move through statuses
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const { id } = await params;
  const existing = await ownedPost(r.scope.partnerId, id);
  if (!existing) return Response.json({ error: "Post not found" }, { status: 404 });
  const body = await request.json();

  const status = body.status !== undefined ? body.status : existing.status;
  if (!STATUSES.includes(status)) return Response.json({ error: "Invalid status" }, { status: 400 });

  const rows = await sql`
    UPDATE posts SET
      title = ${body.title !== undefined ? (body.title?.trim() || null) : existing.title},
      caption = ${body.caption !== undefined ? (body.caption?.trim() || null) : existing.caption},
      scheduled_at = ${body.scheduled_at !== undefined ? (body.scheduled_at || null) : sql`scheduled_at`},
      status = ${status},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  if (status === "pending_approval" && existing.status !== "pending_approval") {
    const label = (body.title ?? existing.title) || (body.caption ?? existing.caption)?.slice(0, 60) || "a new post";
    await notifyClient(
      existing.client_id,
      `Content ready for your review: ${label}`,
      `"${label}" is waiting for your approval.\n\nSign in to your portal → Marketing to review it.`
    );
  }
  return Response.json(rows[0]);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const { id } = await params;
  const existing = await ownedPost(r.scope.partnerId, id);
  if (!existing) return Response.json({ error: "Post not found" }, { status: 404 });
  await sql`DELETE FROM post_channels WHERE post_id = ${id}`;
  await sql`DELETE FROM post_media WHERE post_id = ${id}`;
  await sql`DELETE FROM post_comments WHERE post_id = ${id}`;
  await sql`DELETE FROM posts WHERE id = ${id}`;
  return Response.json({ ok: true });
}
