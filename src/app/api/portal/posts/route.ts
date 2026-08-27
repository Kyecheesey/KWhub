import { sql, migrate } from "@/lib/db";
import { resolvePortalScope } from "@/lib/portalAuth";
import { notifyStaff } from "@/lib/portalNotify";

// GET — the client's view of the content calendar (drafts stay internal)
export async function GET(request: Request) {
  await migrate();
  const r = await resolvePortalScope(request);
  if ("error" in r) return r.error;
  const rows = await sql`
    SELECT po.id, po.title, po.caption, po.scheduled_at, po.status, po.approval_note,
           po.published_at, po.created_at,
      COALESCE((SELECT json_agg(json_build_object('platform', pc.platform, 'publish_status', pc.publish_status)
        ORDER BY pc.id) FROM post_channels pc WHERE pc.post_id = po.id), '[]') AS channels,
      COALESCE((SELECT json_agg(json_build_object('url', pm.url, 'content_type', pm.content_type, 'filename', pm.filename)
        ORDER BY pm.id) FROM post_media pm WHERE pm.post_id = po.id), '[]') AS media,
      (SELECT COUNT(*)::int FROM post_comments pcm WHERE pcm.post_id = po.id) AS comment_count
    FROM posts po
    WHERE po.client_id = ${r.scope.clientId} AND po.status != 'draft'
    ORDER BY (po.status = 'pending_approval') DESC, po.scheduled_at NULLS LAST, po.created_at DESC
  `;
  return Response.json(rows);
}

// PATCH — client approves or requests changes on a post
export async function PATCH(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  const { id, status, note } = body;
  if (!id || !["approved", "changes_requested"].includes(status)) {
    return Response.json({ error: "id and a valid status are required" }, { status: 400 });
  }
  const rows = await sql`
    UPDATE posts SET status = ${status}, approval_note = ${note ?? null},
      responded_at = NOW(), updated_at = NOW()
    WHERE id = ${id} AND client_id = ${r.scope.clientId} AND status IN ('pending_approval', 'approved', 'changes_requested')
    RETURNING *
  `;
  if (rows.length === 0) return Response.json({ error: "Post not found" }, { status: 404 });
  const post = rows[0] as { title: string | null; caption: string | null };
  const label = post.title || post.caption?.slice(0, 60) || "Untitled post";

  if (r.scope.role === "client") {
    await sql`
      INSERT INTO portal_messages (client_id, author, author_role, body)
      VALUES (${r.scope.clientId}, ${r.scope.name}, 'client',
              ${`${status === "approved" ? "✅ Approved post" : "✏️ Changes requested on post"}: ${label}${note ? ` — ${note}` : ""}`})
    `;
    await notifyStaff(
      r.scope.clientId,
      `Client ${status === "approved" ? "approved" : "requested changes on"} a post: ${label}`,
      `${r.scope.name ?? "The client"} ${status === "approved" ? "approved" : "requested changes on"} "${label}".${note ? `\n\nNote: ${note}` : ""}\n\nOpen the Content planner to see it.`
    );
  }
  return Response.json(rows[0]);
}
