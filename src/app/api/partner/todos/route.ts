import { sql, migrate } from "@/lib/db";
import { requirePartner } from "@/lib/partnerAuth";

// Personal to-do list inside the partner workspace — private to each login.

export async function GET() {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const rows = await sql`
    SELECT id, text, done, created_at FROM partner_todos
    WHERE partner_id = ${r.scope.partnerId} AND username = ${r.scope.username ?? ""}
    ORDER BY done ASC, created_at DESC
  `;
  return Response.json(rows);
}

export async function POST(request: Request) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const { text } = await request.json();
  if (!text?.trim()) return Response.json({ error: "text is required" }, { status: 400 });
  const rows = await sql`
    INSERT INTO partner_todos (partner_id, username, text)
    VALUES (${r.scope.partnerId}, ${r.scope.username ?? ""}, ${text.trim()})
    RETURNING id, text, done, created_at
  `;
  return Response.json(rows[0], { status: 201 });
}

export async function PATCH(request: Request) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const { id, done, text } = await request.json();
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });
  const rows = await sql`
    UPDATE partner_todos SET
      done = COALESCE(${typeof done === "boolean" ? done : null}, done),
      text = COALESCE(${text?.trim() || null}, text)
    WHERE id = ${id} AND partner_id = ${r.scope.partnerId} AND username = ${r.scope.username ?? ""}
    RETURNING id, text, done, created_at
  `;
  if (rows.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(rows[0]);
}

export async function DELETE(request: Request) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const { id } = await request.json();
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });
  await sql`
    DELETE FROM partner_todos
    WHERE id = ${id} AND partner_id = ${r.scope.partnerId} AND username = ${r.scope.username ?? ""}
  `;
  return Response.json({ ok: true });
}
