import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../../auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const session = await auth();
  if (!session?.user || session.user.role === "client") {
    return Response.json({ error: "Staff only" }, { status: 403 });
  }
  const { id } = await params;
  const rows = await sql`SELECT * FROM post_comments WHERE post_id = ${id} ORDER BY created_at ASC`;
  return Response.json(rows);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const session = await auth();
  if (!session?.user || session.user.role === "client") {
    return Response.json({ error: "Staff only" }, { status: 403 });
  }
  const { id } = await params;
  const { body } = await req.json();
  if (!body?.trim()) return Response.json({ error: "Comment required" }, { status: 400 });
  const rows = await sql`
    INSERT INTO post_comments (post_id, author, author_role, body)
    VALUES (${id}, ${session.user.name ?? null}, 'staff', ${body.trim()})
    RETURNING *
  `;
  return Response.json(rows[0], { status: 201 });
}
