import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../../auth";
import { publishPost } from "@/lib/social/publish";

// POST /api/posts/[id]/publish — publish now (staff), regardless of schedule
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const session = await auth();
  if (!session?.user || session.user.role === "client") {
    return Response.json({ error: "Staff only" }, { status: 403 });
  }
  const { id } = await params;
  const post = (await sql`SELECT id, status FROM posts WHERE id = ${id}`)[0] as { id: number; status: string } | undefined;
  if (!post) return Response.json({ error: "Post not found" }, { status: 404 });
  const result = await publishPost(post.id);
  return Response.json(result);
}
