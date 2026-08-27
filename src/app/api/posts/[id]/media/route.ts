import { put, del } from "@vercel/blob";
import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../../auth";

const MAX_BYTES = 15 * 1024 * 1024; // 15MB, same cap as portal files

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const session = await auth();
  if (!session?.user || session.user.role === "client") {
    return Response.json({ error: "Staff only" }, { status: 403 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ error: "File storage isn't configured yet (BLOB_READ_WRITE_TOKEN missing)." }, { status: 503 });
  }
  const { id } = await params;
  const post = (await sql`SELECT client_id FROM posts WHERE id = ${id}`)[0] as { client_id: number } | undefined;
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
  const session = await auth();
  if (!session?.user || session.user.role === "client") {
    return Response.json({ error: "Staff only" }, { status: 403 });
  }
  const { id } = await params;
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
