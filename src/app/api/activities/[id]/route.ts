import { sql, migrate } from "@/lib/db";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const { id } = await params;
  const { title, description, status, priority, assigned_to, due_date, tags } = await req.json();
  const rows = await sql`
    UPDATE activities SET
      title       = ${title},
      description = ${description || null},
      status      = ${status},
      priority    = ${priority},
      assigned_to = ${assigned_to || null},
      due_date    = ${due_date || null},
      tags        = ${tags || null},
      updated_at  = NOW()
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
    UPDATE activities SET
      status     = COALESCE(${body.status ?? null}, status),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return Response.json(rows[0]);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const { id } = await params;
  await sql`DELETE FROM activities WHERE id = ${id}`;
  return Response.json({ ok: true });
}
