import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../auth";

async function staffSession() {
  const session = await auth();
  if (!session?.user || session.user.role === "client") return null;
  return session;
}

// GET /api/posts?client_id=&from=&to= — posts with channels + media rolled up
export async function GET(request: Request) {
  await migrate();
  const session = await staffSession();
  if (!session) return Response.json({ error: "Staff only" }, { status: 403 });
  const p = new URL(request.url).searchParams;
  const clientId = p.get("client_id") ? parseInt(p.get("client_id")!, 10) : null;
  const from = p.get("from");
  const to = p.get("to");
  const rows = await sql`
    SELECT po.*,
      COALESCE((SELECT json_agg(json_build_object(
        'id', pc.id, 'platform', pc.platform, 'social_account_id', pc.social_account_id,
        'publish_status', pc.publish_status, 'error', pc.error
      ) ORDER BY pc.id) FROM post_channels pc WHERE pc.post_id = po.id), '[]') AS channels,
      COALESCE((SELECT json_agg(json_build_object(
        'id', pm.id, 'url', pm.url, 'filename', pm.filename, 'content_type', pm.content_type
      ) ORDER BY pm.id) FROM post_media pm WHERE pm.post_id = po.id), '[]') AS media,
      (SELECT COUNT(*)::int FROM post_comments pcm WHERE pcm.post_id = po.id) AS comment_count,
      c.business_name
    FROM posts po
    LEFT JOIN clients c ON c.id = po.client_id
    WHERE (${clientId}::int IS NULL OR po.client_id = ${clientId})
      AND (${from}::timestamptz IS NULL OR po.scheduled_at >= ${from} OR po.scheduled_at IS NULL)
      AND (${to}::timestamptz IS NULL OR po.scheduled_at < ${to} OR po.scheduled_at IS NULL)
    ORDER BY po.scheduled_at NULLS LAST, po.created_at DESC
  `;
  return Response.json(rows);
}

// POST /api/posts — create a draft (optionally straight to pending_approval)
export async function POST(request: Request) {
  await migrate();
  const session = await staffSession();
  if (!session) return Response.json({ error: "Staff only" }, { status: 403 });
  const body = await request.json();
  const clientId = parseInt(body.client_id, 10);
  if (!clientId) return Response.json({ error: "client_id is required" }, { status: 400 });
  if (!body.caption?.trim() && !body.title?.trim()) {
    return Response.json({ error: "A title or caption is required" }, { status: 400 });
  }
  const status = body.status === "pending_approval" ? "pending_approval" : "draft";
  const rows = await sql`
    INSERT INTO posts (client_id, title, caption, scheduled_at, status, created_by)
    VALUES (${clientId}, ${body.title?.trim() || null}, ${body.caption?.trim() || null},
            ${body.scheduled_at || null}, ${status}, ${session.user.name ?? null})
    RETURNING *
  `;
  const post = rows[0] as { id: number };
  const platforms: { platform: string; social_account_id?: number | null }[] = Array.isArray(body.channels) ? body.channels : [];
  for (const ch of platforms) {
    if (!ch?.platform) continue;
    await sql`
      INSERT INTO post_channels (post_id, platform, social_account_id)
      VALUES (${post.id}, ${ch.platform}, ${ch.social_account_id ?? null})
    `;
  }
  return Response.json(rows[0], { status: 201 });
}
