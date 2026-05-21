import { getDb } from "@/lib/db";

// Mark a call-list entry as called (or un-called)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { called, called_by } = await request.json();
  const db = getDb();
  db.prepare(
    `UPDATE call_list SET called = ?, called_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END, called_by = ? WHERE id = ?`
  ).run(called ? 1 : 0, called ? 1 : 0, called_by ?? null, id);
  return Response.json({ success: true });
}
