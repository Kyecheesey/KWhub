import { sql, migrate } from "@/lib/db";
import { resolvePortalScope } from "@/lib/portalAuth";
import { notifyClient } from "@/lib/portalNotify";

/**
 * Per-service portal content for the SEO, Cybersecurity, AI and Systems
 * sections: headline metrics staff keep current, plus a feed of work
 * updates. Clients read; staff write.
 */

const SERVICES = ["websites", "apps", "seo", "cybersecurity", "ai", "systems"] as const;
const SERVICE_LABEL: Record<string, string> = {
  websites: "Websites", apps: "Apps", seo: "SEO", cybersecurity: "Cybersecurity", ai: "AI", systems: "Systems",
};
const TRENDS = ["up", "down", "flat"];

function validService(s: unknown): s is (typeof SERVICES)[number] {
  return typeof s === "string" && (SERVICES as readonly string[]).includes(s);
}

// GET → { metrics, updates } for every service at once (+ source config for staff)
export async function GET(request: Request) {
  await migrate();
  const r = await resolvePortalScope(request);
  if ("error" in r) return r.error;
  const [metrics, updates] = await Promise.all([
    sql`SELECT * FROM service_metrics WHERE client_id = ${r.scope.clientId} ORDER BY service, id ASC`,
    sql`SELECT * FROM service_updates WHERE client_id = ${r.scope.clientId} ORDER BY created_at DESC LIMIT 100`,
  ]);
  if (r.scope.role !== "staff") return Response.json({ metrics, updates });
  const cfg = await sql`SELECT website, gsc_site, vercel_project_id FROM clients WHERE id = ${r.scope.clientId}`;
  return Response.json({ metrics, updates, config: cfg[0] ?? null });
}

// PUT {gsc_site?, vercel_project_id?} → save live-metric sources (staff only)
export async function PUT(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  const rows = await sql`
    UPDATE clients SET
      gsc_site = ${body.gsc_site?.trim() || null},
      vercel_project_id = ${body.vercel_project_id?.trim() || null}
    WHERE id = ${r.scope.clientId}
    RETURNING gsc_site, vercel_project_id
  `;
  if (rows.length === 0) return Response.json({ error: "Client not found" }, { status: 404 });
  return Response.json(rows[0]);
}

// POST {kind:'metric', service, label, value, trend?, trend_note?}
//    | {kind:'update', service, title, body?} — staff only
export async function POST(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  if (!validService(body.service)) {
    return Response.json({ error: `service must be one of: ${SERVICES.join(", ")}` }, { status: 400 });
  }

  if (body.kind === "metric") {
    if (!body.label?.trim() || !String(body.value ?? "").trim()) {
      return Response.json({ error: "label and value are required" }, { status: 400 });
    }
    const trend = TRENDS.includes(body.trend) ? body.trend : null;
    const rows = await sql`
      INSERT INTO service_metrics (client_id, service, label, value, trend, trend_note)
      VALUES (${r.scope.clientId}, ${body.service}, ${body.label.trim()}, ${String(body.value).trim()}, ${trend}, ${body.trend_note?.trim() || null})
      RETURNING *
    `;
    return Response.json(rows[0], { status: 201 });
  }

  if (body.kind === "update") {
    if (!body.title?.trim()) return Response.json({ error: "title is required" }, { status: 400 });
    const rows = await sql`
      INSERT INTO service_updates (client_id, service, title, body, created_by)
      VALUES (${r.scope.clientId}, ${body.service}, ${body.title.trim()}, ${body.body?.trim() || null}, ${r.scope.name})
      RETURNING *
    `;
    const label = SERVICE_LABEL[body.service];
    await notifyClient(
      r.scope.clientId,
      `${label} update from KW Innovations: ${body.title.trim()}`,
      `${body.title.trim()}\n\n${body.body?.trim() ?? ""}\n\nSee the ${label} section of your portal: https://kwinnovationshub.com.au/portal`,
    );
    return Response.json(rows[0], { status: 201 });
  }

  return Response.json({ error: "kind must be 'metric' or 'update'" }, { status: 400 });
}

// PATCH {kind:'metric', id, label?, value?, trend?, trend_note?} — staff only
export async function PATCH(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  if (body.kind !== "metric" || !body.id) {
    return Response.json({ error: "kind 'metric' and id are required" }, { status: 400 });
  }
  // trend: absent = keep, null = clear, 'up'/'down'/'flat' = set
  const setTrend = body.trend === null || TRENDS.includes(body.trend);
  const rows = await sql`
    UPDATE service_metrics SET
      label = COALESCE(${body.label?.trim() || null}, label),
      value = COALESCE(${body.value != null ? String(body.value).trim() : null}, value),
      trend = CASE WHEN ${setTrend} THEN ${setTrend ? body.trend : null}::text ELSE trend END,
      trend_note = COALESCE(${body.trend_note?.trim() || null}, trend_note),
      updated_at = NOW()
    WHERE id = ${body.id} AND client_id = ${r.scope.clientId}
    RETURNING *
  `;
  if (rows.length === 0) return Response.json({ error: "Metric not found" }, { status: 404 });
  return Response.json(rows[0]);
}

// DELETE {kind:'metric'|'update', id} — staff only
export async function DELETE(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  if (!body.id) return Response.json({ error: "id is required" }, { status: 400 });
  if (body.kind === "metric") {
    await sql`DELETE FROM service_metrics WHERE id = ${body.id} AND client_id = ${r.scope.clientId}`;
  } else if (body.kind === "update") {
    await sql`DELETE FROM service_updates WHERE id = ${body.id} AND client_id = ${r.scope.clientId}`;
  } else {
    return Response.json({ error: "kind must be 'metric' or 'update'" }, { status: 400 });
  }
  return Response.json({ ok: true });
}
