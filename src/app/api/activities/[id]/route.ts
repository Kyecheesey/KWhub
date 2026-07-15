import { sql, migrate } from "@/lib/db";
import { logEvent } from "@/lib/events";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const { id } = await params;
  const { title, description, status, priority, assigned_to, due_date, tags } = await req.json();
  const prev = await sql`SELECT status FROM activities WHERE id = ${id}`;
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
  const old = prev[0] as { status: string } | undefined;
  await logEvent({
    entity_type: "activity", entity_id: Number(id), entity_name: title,
    action: old && old.status !== status ? "status_changed" : "updated",
    detail: old && old.status !== status ? `${old.status} → ${status}` : null,
  });
  return Response.json(rows[0]);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const { id } = await params;
  const body = await req.json();
  const prev = await sql`SELECT status, title FROM activities WHERE id = ${id}`;
  const rows = await sql`
    UPDATE activities SET
      status     = COALESCE(${body.status ?? null}, status),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  const old = prev[0] as { status: string; title: string } | undefined;
  if (old && body.status && old.status !== body.status) {
    await logEvent({
      entity_type: "activity", entity_id: Number(id), entity_name: old.title,
      action: "status_changed", detail: `${old.status} → ${body.status}`,
    });
  }
  return Response.json(rows[0]);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const { id } = await params;
  const prev = await sql`SELECT title FROM activities WHERE id = ${id}`;
  await sql`DELETE FROM activities WHERE id = ${id}`;
  await logEvent({
    entity_type: "activity", entity_id: Number(id),
    entity_name: (prev[0] as { title: string } | undefined)?.title ?? null,
    action: "deleted",
  });
  return Response.json({ ok: true });
}
