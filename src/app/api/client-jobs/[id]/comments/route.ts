import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../../auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const { id } = await params;
  const rows = await sql`SELECT * FROM job_comments WHERE job_id = ${id} ORDER BY created_at ASC`;
  return Response.json(rows);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const { id } = await params;
  const { body } = await req.json();
  if (!body?.trim()) return Response.json({ error: "Comment required" }, { status: 400 });
  const session = await auth();
  const rows = await sql`
    INSERT INTO job_comments (job_id, author, body)
    VALUES (${id}, ${session?.user?.name ?? null}, ${body.trim()})
    RETURNING *
  `;
  return Response.json(rows[0], { status: 201 });
}
