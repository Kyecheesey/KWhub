import { sql, migrate } from "@/lib/db";
import { resolvePortalScope } from "@/lib/portalAuth";
import { logEvent } from "@/lib/events";
import { POLICIES_VERSION } from "@/lib/policies";

// GET → orientation status for the client (current = accepted the latest policies)
export async function GET(request: Request) {
  await migrate();
  const r = await resolvePortalScope(request);
  if ("error" in r) return r.error;
  const rows = await sql`
    SELECT orientation_completed_at, policies_version, policies_accepted_by
    FROM clients WHERE id = ${r.scope.clientId}
  `;
  const row = rows[0] as { orientation_completed_at: string | null; policies_version: string | null; policies_accepted_by: string | null } | undefined;
  if (!row) return Response.json({ error: "Client not found" }, { status: 404 });
  return Response.json({
    completed_at: row.orientation_completed_at,
    accepted_version: row.policies_version,
    accepted_by: row.policies_accepted_by,
    current_version: POLICIES_VERSION,
    current: !!row.orientation_completed_at && row.policies_version === POLICIES_VERSION,
  });
}

// POST {accept: true} → the client finishes orientation and accepts the policies.
// Only the client can accept; staff previewing the portal can't do it for them.
export async function POST(request: Request) {
  await migrate();
  const body = await request.json().catch(() => ({}));
  const r = await resolvePortalScope(request);
  if ("error" in r) return r.error;
  if (r.scope.role !== "client") {
    return Response.json({ error: "Only the client can accept the policies" }, { status: 403 });
  }
  if (body.accept !== true) {
    return Response.json({ error: "accept must be true" }, { status: 400 });
  }
  const acceptedBy = r.scope.name ?? r.scope.username;
  const rows = await sql`
    UPDATE clients SET orientation_completed_at = NOW(), policies_version = ${POLICIES_VERSION},
      policies_accepted_by = ${acceptedBy}
    WHERE id = ${r.scope.clientId}
    RETURNING business_name, orientation_completed_at
  `;
  const row = rows[0] as { business_name: string; orientation_completed_at: string } | undefined;
  if (!row) return Response.json({ error: "Client not found" }, { status: 404 });
  await logEvent({
    entity_type: "client", entity_id: r.scope.clientId, entity_name: row.business_name,
    action: "accepted policies", detail: `Finished portal orientation (policies ${POLICIES_VERSION})`,
    actor: acceptedBy,
  });
  return Response.json({ completed_at: row.orientation_completed_at, accepted_version: POLICIES_VERSION, accepted_by: acceptedBy, current_version: POLICIES_VERSION, current: true });
}

// DELETE {client_id} → staff reset, so the client goes through orientation again
export async function DELETE(request: Request) {
  await migrate();
  const body = await request.json().catch(() => ({}));
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  await sql`
    UPDATE clients SET orientation_completed_at = NULL, policies_version = NULL, policies_accepted_by = NULL
    WHERE id = ${r.scope.clientId}
  `;
  return Response.json({ ok: true });
}
