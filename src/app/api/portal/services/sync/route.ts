import { migrate } from "@/lib/db";
import { resolvePortalScope } from "@/lib/portalAuth";
import { syncClientMetrics } from "@/lib/metricSync";

// POST {client_id} → refresh one client's live metrics now (staff only)
export async function POST(request: Request) {
  await migrate();
  const body = await request.json().catch(() => ({}));
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  const { synced } = await syncClientMetrics(r.scope.clientId);
  return Response.json({ ok: true, synced });
}
