import { sql, migrate } from "@/lib/db";
import { resolvePortalScope } from "@/lib/portalAuth";

export async function GET(request: Request) {
  await migrate();
  const r = await resolvePortalScope(request);
  if ("error" in r) return r.error;
  const rows = await sql`
    SELECT * FROM client_checklist WHERE client_id = ${r.scope.clientId} ORDER BY created_at ASC
  `;
  return Response.json(rows);
}

export async function POST(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  if (!body.text?.trim()) return Response.json({ error: "Text is required" }, { status: 400 });
  const rows = await sql`
    INSERT INTO client_checklist (client_id, text) VALUES (${r.scope.clientId}, ${body.text.trim()})
    RETURNING *
  `;
  return Response.json(rows[0], { status: 201 });
}

export async function PATCH(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  const rows = await sql`
    UPDATE client_checklist SET done = ${!!body.done}
    WHERE id = ${body.id} AND client_id = ${r.scope.clientId}
    RETURNING *
  `;
  if (rows.length === 0) return Response.json({ error: "Item not found" }, { status: 404 });
  return Response.json(rows[0]);
}

export async function DELETE(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  await sql`DELETE FROM client_checklist WHERE id = ${body.id} AND client_id = ${r.scope.clientId}`;
  return Response.json({ ok: true });
}
