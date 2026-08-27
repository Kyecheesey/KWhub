import { sql, migrate } from "@/lib/db";
import { resolvePortalScope } from "@/lib/portalAuth";
import { PORTAL_MODULES, parseModules } from "@/lib/modules";

export async function GET(request: Request) {
  await migrate();
  const r = await resolvePortalScope(request);
  if ("error" in r) return r.error;
  const rows = await sql`SELECT portal_modules FROM clients WHERE id = ${r.scope.clientId}`;
  const raw = (rows[0] as { portal_modules: string | null } | undefined)?.portal_modules ?? null;
  return Response.json({ enabled: parseModules(raw), all: PORTAL_MODULES });
}

// Staff toggle which service modules the client's dashboard shows
export async function PATCH(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  if (!Array.isArray(body.modules)) {
    return Response.json({ error: "modules must be an array of module keys" }, { status: 400 });
  }
  const valid = new Set(PORTAL_MODULES.map((m) => m.key));
  const keys = body.modules.filter((k: unknown): k is string => typeof k === "string" && valid.has(k));
  if (!keys.includes("overview")) keys.unshift("overview");
  await sql`UPDATE clients SET portal_modules = ${JSON.stringify(keys)} WHERE id = ${r.scope.clientId}`;
  return Response.json({ enabled: keys });
}
