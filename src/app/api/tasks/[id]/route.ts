import { sql, migrate } from "@/lib/db";
import { logEvent } from "@/lib/events";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const { id } = await params;
  const { title, description, status, priority, assigned_to, assigned_by, due_date } = await req.json();
  const prev = await sql`SELECT status FROM tasks WHERE id = ${id}`;
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
  const old = prev[0] as { status: string } | undefined;
  await logEvent({
    entity_type: "task", entity_id: Number(id), entity_name: title,
    action: old && old.status !== status ? "status_changed" : "updated",
    detail: old && old.status !== status ? `${old.status} → ${status}` : null,
  });
  return Response.json(rows[0]);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const { id } = await params;
  const body = await req.json();
  const prev = await sql`SELECT status, title FROM tasks WHERE id = ${id}`;
  const rows = await sql`
    UPDATE tasks SET
      status       = COALESCE(${body.status ?? null}, status),
      completed_at = CASE WHEN ${body.status ?? null} = 'done' THEN NOW() ELSE completed_at END,
      updated_at   = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  const old = prev[0] as { status: string; title: string } | undefined;
  if (old && body.status && old.status !== body.status) {
    await logEvent({
      entity_type: "task", entity_id: Number(id), entity_name: old.title,
      action: "status_changed", detail: `${old.status} → ${body.status}`,
    });
  }
  return Response.json(rows[0]);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const { id } = await params;
  const prev = await sql`SELECT title FROM tasks WHERE id = ${id}`;
  await sql`DELETE FROM tasks WHERE id = ${id}`;
  await logEvent({
    entity_type: "task", entity_id: Number(id),
    entity_name: (prev[0] as { title: string } | undefined)?.title ?? null,
    action: "deleted",
  });
  return Response.json({ ok: true });
}
