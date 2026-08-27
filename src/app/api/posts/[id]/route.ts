import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../auth";
import { notifyClient } from "@/lib/portalNotify";

const STATUSES = ["draft", "pending_approval", "approved", "changes_requested", "published"];

// PATCH /api/posts/[id] — edit fields, replace channels, move through statuses
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const session = await auth();
  if (!session?.user || session.user.role === "client") {
    return Response.json({ error: "Staff only" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();

  const existing = (await sql`SELECT * FROM posts WHERE id = ${id}`)[0] as
    | { id: number; client_id: number; title: string | null; caption: string | null; status: string }
    | undefined;
  if (!existing) return Response.json({ error: "Post not found" }, { status: 404 });

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

  if (Array.isArray(body.channels)) {
    // Replace the channel set, keeping publish state on unchanged platforms
    const wanted = new Set((body.channels as { platform: string }[]).map((c) => c?.platform).filter(Boolean));
    const current = (await sql`SELECT id, platform FROM post_channels WHERE post_id = ${id}`) as unknown as { id: number; platform: string }[];
    for (const ch of current) {
      if (!wanted.has(ch.platform)) await sql`DELETE FROM post_channels WHERE id = ${ch.id}`;
    }
    for (const ch of body.channels as { platform: string; social_account_id?: number | null }[]) {
      if (!ch?.platform) continue;
      const found = current.filter((c) => c.platform === ch.platform);
      if (found.length === 0) {
        await sql`
          INSERT INTO post_channels (post_id, platform, social_account_id)
          VALUES (${id}, ${ch.platform}, ${ch.social_account_id ?? null})
        `;
      } else {
        await sql`
          UPDATE post_channels SET social_account_id = ${ch.social_account_id ?? null}
          WHERE post_id = ${id} AND platform = ${ch.platform}
        `;
      }
    }
  }

  // Sending to the client for sign-off → email them
  if (status === "pending_approval" && existing.status !== "pending_approval") {
    const label = (body.title ?? existing.title) || (body.caption ?? existing.caption)?.slice(0, 60) || "a new post";
    await notifyClient(
      existing.client_id,
      `Content ready for your review: ${label}`,
      `KW Innovations has ${existing.status === "changes_requested" ? "updated" : "scheduled"} "${label}" and it's waiting for your approval.\n\nSign in to your portal → Marketing to review it.`
    );
  }
  return Response.json(rows[0]);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const session = await auth();
  if (!session?.user || session.user.role === "client") {
    return Response.json({ error: "Staff only" }, { status: 403 });
  }
  const { id } = await params;
  await sql`DELETE FROM post_channels WHERE post_id = ${id}`;
  await sql`DELETE FROM post_media WHERE post_id = ${id}`;
  await sql`DELETE FROM post_comments WHERE post_id = ${id}`;
  await sql`DELETE FROM posts WHERE id = ${id}`;
  return Response.json({ ok: true });
}
