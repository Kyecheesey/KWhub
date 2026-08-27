import { sql, migrate } from "@/lib/db";
import { resolvePortalScope } from "@/lib/portalAuth";
import { notifyStaff } from "@/lib/portalNotify";

// GET /api/portal/posts/comments?post_id= — thread on a client-visible post
export async function GET(request: Request) {
  await migrate();
  const r = await resolvePortalScope(request);
  if ("error" in r) return r.error;
  const postId = new URL(request.url).searchParams.get("post_id");
  if (!postId) return Response.json({ error: "post_id is required" }, { status: 400 });
  const rows = await sql`
    SELECT pc.* FROM post_comments pc
    JOIN posts po ON po.id = pc.post_id
    WHERE pc.post_id = ${postId} AND po.client_id = ${r.scope.clientId} AND po.status != 'draft'
    ORDER BY pc.created_at ASC
  `;
  return Response.json(rows);
}

export async function POST(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  if (!body.post_id || !body.body?.trim()) {
    return Response.json({ error: "post_id and body are required" }, { status: 400 });
  }
  const post = (await sql`
    SELECT id, title, caption FROM posts
    WHERE id = ${body.post_id} AND client_id = ${r.scope.clientId} AND status != 'draft'
  `)[0] as { id: number; title: string | null; caption: string | null } | undefined;
  if (!post) return Response.json({ error: "Post not found" }, { status: 404 });

  const rows = await sql`
    INSERT INTO post_comments (post_id, author, author_role, body)
    VALUES (${post.id}, ${r.scope.name}, ${r.scope.role}, ${body.body.trim()})
    RETURNING *
  `;
  if (r.scope.role === "client") {
    const label = post.title || post.caption?.slice(0, 60) || "a post";
    await notifyStaff(
      r.scope.clientId,
      `Client commented on ${label}`,
      `${r.scope.name ?? "The client"} commented on "${label}":\n\n${body.body.trim()}`
    );
  }
  return Response.json(rows[0], { status: 201 });
}
