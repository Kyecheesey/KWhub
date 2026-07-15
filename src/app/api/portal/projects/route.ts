import { sql, migrate } from "@/lib/db";
import { resolvePortalScope } from "@/lib/portalAuth";
import { logEvent } from "@/lib/events";

export const STAGES = ["Discovery", "Design", "Build", "Review", "Launch"];

export async function GET(request: Request) {
  await migrate();
  const r = await resolvePortalScope(request);
  if ("error" in r) return r.error;
  const rows = await sql`
    SELECT * FROM projects WHERE client_id = ${r.scope.clientId} ORDER BY created_at DESC
  `;
  return Response.json(rows);
}

export async function POST(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  if (!body.name?.trim()) return Response.json({ error: "Project name is required" }, { status: 400 });
  const rows = await sql`
    INSERT INTO projects (client_id, name, stage, notes)
    VALUES (${r.scope.clientId}, ${body.name.trim()}, ${body.stage ?? 0}, ${body.notes ?? null})
    RETURNING *
  `;
  return Response.json(rows[0], { status: 201 });
}

export async function PATCH(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  if (!body.id) return Response.json({ error: "id is required" }, { status: 400 });
  const prev = await sql`SELECT stage, name FROM projects WHERE id = ${body.id} AND client_id = ${r.scope.clientId}`;
  const old = prev[0] as { stage: number; name: string } | undefined;
  if (!old) return Response.json({ error: "Project not found" }, { status: 404 });
  const rows = await sql`
    UPDATE projects SET
      name = COALESCE(${body.name ?? null}, name),
      stage = COALESCE(${body.stage ?? null}, stage),
      notes = COALESCE(${body.notes ?? null}, notes),
      updated_at = NOW()
    WHERE id = ${body.id} AND client_id = ${r.scope.clientId}
    RETURNING *
  `;
  if (typeof body.stage === "number" && body.stage !== old.stage) {
    await logEvent({
      entity_type: "client", entity_id: r.scope.clientId, entity_name: old.name,
      action: "stage_changed",
      detail: `Project "${old.name}": ${STAGES[old.stage] ?? old.stage} → ${STAGES[body.stage] ?? body.stage}`,
    });
  }
  return Response.json(rows[0]);
}

export async function DELETE(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  await sql`DELETE FROM projects WHERE id = ${body.id} AND client_id = ${r.scope.clientId}`;
  return Response.json({ ok: true });
}
