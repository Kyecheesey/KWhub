import { sql, migrate } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const { id } = await params;
  const { done } = await req.json();
  const rows = await sql`
    UPDATE checklist SET done = ${done} WHERE id = ${id} RETURNING *
  `;
  return Response.json(rows[0]);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const { id } = await params;
  await sql`DELETE FROM checklist WHERE id = ${id}`;
  return Response.json({ ok: true });
}
