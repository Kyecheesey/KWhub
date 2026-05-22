import { sql, migrate } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const { id } = await params;
  const { title, description, status, priority, assigned_to, assigned_by, due_date } = await req.json();
  const completed_at = status === "done" ? "NOW()" : null;
  const rows = await sql`
    UPDATE tasks SET
      title        = ${title},
      description  = ${description || null},
      status       = ${status},
      priority     = ${priority},
      assigned_to  = ${assigned_to},
      assigned_by  = ${assigned_by || null},
      due_date     = ${due_date || null},
      completed_at = ${status === "done" ? sql`NOW()` : null},
      updated_at   = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return Response.json(rows[0]);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const { id } = await params;
  const body = await req.json();
  const rows = await sql`
    UPDATE tasks SET
      status       = COALESCE(${body.status ?? null}, status),
      completed_at = CASE WHEN ${body.status ?? null} = 'done' THEN NOW() ELSE completed_at END,
      updated_at   = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return Response.json(rows[0]);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const { id } = await params;
  await sql`DELETE FROM tasks WHERE id = ${id}`;
  return Response.json({ ok: true });
}
