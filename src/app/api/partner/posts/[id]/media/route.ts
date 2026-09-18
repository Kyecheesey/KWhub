import { put, del } from "@vercel/blob";
import { sql, migrate } from "@/lib/db";
import { requirePartner } from "@/lib/partnerAuth";

const MAX_BYTES = 15 * 1024 * 1024; // 15MB, same cap as the KWI planner

async function ownedPost(partnerId: number, id: string) {
  const rows = await sql`
    SELECT po.id, po.client_id FROM posts po
    JOIN clients c ON c.id = po.client_id
    WHERE po.id = ${id} AND c.partner_id = ${partnerId}
  `;
  return (rows[0] as { id: number; client_id: number } | undefined) ?? null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: "File storage isn't configured yet." }, { status: 503 });
  }
  const { id } = await params;
  const post = await ownedPost(r.scope.partnerId, id);
  if (!post) return Response.json({ error: "Post not found" }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "file is required" }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "File is too large (15MB max)." }, { status: 400 });

  const blob = await put(`content/${post.client_id}/${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });
  const rows = await sql`
    INSERT INTO post_media (post_id, filename, url, content_type, size_bytes)
    VALUES (${id}, ${file.name}, ${blob.url}, ${file.type || null}, ${file.size})
    RETURNING *
  `;
  return Response.json(rows[0], { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const { id } = await params;
  const post = await ownedPost(r.scope.partnerId, id);
  if (!post) return Response.json({ error: "Post not found" }, { status: 404 });
  const body = await request.json();
  const rows = await sql`
    DELETE FROM post_media WHERE id = ${body.media_id} AND post_id = ${id} RETURNING url
  `;
  const removed = rows[0] as { url: string } | undefined;
  if (removed && process.env.BLOB_READ_WRITE_TOKEN) {
    try { await del(removed.url); } catch { /* blob already gone */ }
  }
  return Response.json({ ok: true });
}
