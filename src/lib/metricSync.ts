import { SignJWT, importPKCS8 } from "jose";
import { sql } from "./db";

/**
 * Live metric sources for the client-portal service sections.
 * Each sync upserts service_metrics rows keyed by (client_id, source_key),
 * so re-running refreshes values in place and never duplicates tiles.
 *
 * Sources:
 *  - Uptime: the hub pings each client's website itself (no account needed).
 *  - Google Search Console: service account (GSC_CLIENT_EMAIL + GSC_PRIVATE_KEY)
 *    added as a user to the client's property (clients.gsc_site).
 *  - Vercel Web Analytics: VERCEL_API_TOKEN (+ optional VERCEL_TEAM_ID) and the
 *    client's project id (clients.vercel_project_id).
 */

interface ClientRow {
  id: number;
  website: string | null;
  gsc_site: string | null;
  vercel_project_id: string | null;
}

async function upsertMetric(
  clientId: number,
  service: string,
  sourceKey: string,
  m: { label: string; value: string; trend?: "up" | "down" | "flat" | null; trend_note?: string | null },
) {
  await sql`
    INSERT INTO service_metrics (client_id, service, label, value, trend, trend_note, source_key)
    VALUES (${clientId}, ${service}, ${m.label}, ${m.value}, ${m.trend ?? null}, ${m.trend_note ?? null}, ${sourceKey})
    ON CONFLICT (client_id, source_key) WHERE source_key IS NOT NULL
    DO UPDATE SET service = EXCLUDED.service, label = EXCLUDED.label, value = EXCLUDED.value,
                  trend = EXCLUDED.trend, trend_note = EXCLUDED.trend_note, updated_at = NOW()
  `;
}

/* ── Uptime: ping the client's site, record the check, refresh the tiles ── */

export async function syncUptime(client: ClientRow): Promise<string | null> {
  const raw = client.website?.trim();
  if (!raw) return null;
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let ok = false;
  let status: number | null = null;
  const started = Date.now();
  try {
    const res = await fetch(url, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(10_000) });
    ok = res.ok;
    status = res.status;
  } catch {
    ok = false;
  }
  const latency = Date.now() - started;
  await sql`INSERT INTO uptime_checks (client_id, ok, status, latency_ms) VALUES (${client.id}, ${ok}, ${status}, ${latency})`;
  await sql`DELETE FROM uptime_checks WHERE client_id = ${client.id} AND checked_at < NOW() - INTERVAL '60 days'`;

  const [stats] = await sql`
    SELECT
      ROUND(100.0 * COUNT(*) FILTER (WHERE ok) / COUNT(*), 2)                              AS uptime_30d,
      COUNT(*) FILTER (WHERE NOT ok)                                                       AS incidents_30d,
      ROUND(AVG(latency_ms) FILTER (WHERE ok AND checked_at > NOW() - INTERVAL '7 days'))  AS avg_latency_7d
    FROM uptime_checks
    WHERE client_id = ${client.id} AND checked_at > NOW() - INTERVAL '30 days'
  ` as { uptime_30d: string | null; incidents_30d: string; avg_latency_7d: string | null }[];

  const uptime = stats?.uptime_30d != null ? Number(stats.uptime_30d) : null;
  const incidents = Number(stats?.incidents_30d ?? 0);
  if (uptime != null) {
    await upsertMetric(client.id, "systems", "uptime_30d", {
      label: "Website uptime (30 days)",
      value: `${uptime}%`,
      trend: uptime >= 99.5 ? "up" : uptime >= 99 ? "flat" : "down",
      trend_note: "checked automatically every hour",
    });
  }
  if (stats?.avg_latency_7d != null) {
    await upsertMetric(client.id, "systems", "response_ms", {
      label: "Avg response time (7 days)",
      value: `${stats.avg_latency_7d} ms`,
      trend_note: "measured from our monitoring",
    });
  }
  await upsertMetric(client.id, "cybersecurity", "monitoring", {
    label: "Site monitoring",
    value: ok ? "Online" : "DOWN",
    trend: ok ? "up" : "down",
    trend_note: ok ? "last check passed" : `last check failed${status ? ` (HTTP ${status})` : ""}`,
  });
  await upsertMetric(client.id, "cybersecurity", "incidents_30d", {
    label: "Incidents (30 days)",
    value: String(incidents),
    trend: incidents === 0 ? "up" : "down",
    trend_note: incidents === 0 ? "no failed checks" : "failed availability checks",
  });
  return "uptime";
}

/* ── Google Search Console (service account) ── */

async function gscToken(): Promise<string | null> {
  const email = process.env.GSC_CLIENT_EMAIL;
  const key = process.env.GSC_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) return null;
  const pk = await importPKCS8(key, "RS256");
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/webmasters.readonly" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(pk);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) return null;
  return ((await res.json()) as { access_token?: string }).access_token ?? null;
}

async function gscQuery(token: string, site: string, startDate: string, endDate: string) {
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { rows?: { clicks: number; impressions: number; position: number }[] };
  return data.rows?.[0] ?? { clicks: 0, impressions: 0, position: 0 };
}

const day = (offset: number) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
const pctNote = (cur: number, prev: number, what: string) => {
  if (prev <= 0) return `last 28 days`;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% ${what} vs previous 28 days`;
};

export async function syncSearchConsole(client: ClientRow): Promise<string | null> {
  const site = client.gsc_site?.trim();
  if (!site) return null;
  const token = await gscToken();
  if (!token) return null;

  // GSC data lags ~2 days; compare the last full 28-day window to the one before
  const [cur, prev] = await Promise.all([
    gscQuery(token, site, day(30), day(2)),
    gscQuery(token, site, day(58), day(30)),
  ]);
  if (!cur) return null;

  await upsertMetric(client.id, "seo", "gsc_clicks", {
    label: "Google clicks (28 days)",
    value: cur.clicks.toLocaleString("en-AU"),
    trend: !prev || prev.clicks === cur.clicks ? "flat" : cur.clicks > prev.clicks ? "up" : "down",
    trend_note: prev ? pctNote(cur.clicks, prev.clicks, "clicks") : "last 28 days",
  });
  await upsertMetric(client.id, "seo", "gsc_impressions", {
    label: "Search impressions (28 days)",
    value: cur.impressions.toLocaleString("en-AU"),
    trend: !prev || prev.impressions === cur.impressions ? "flat" : cur.impressions > prev.impressions ? "up" : "down",
    trend_note: prev ? pctNote(cur.impressions, prev.impressions, "impressions") : "last 28 days",
  });
  if (cur.position > 0) {
    // Lower position = better ranking, so the arrow follows improvement
    const improved = prev && prev.position > 0 ? prev.position - cur.position : 0;
    await upsertMetric(client.id, "seo", "gsc_position", {
      label: "Avg. Google position",
      value: cur.position.toFixed(1),
      trend: improved > 0.05 ? "up" : improved < -0.05 ? "down" : "flat",
      trend_note: improved > 0.05 ? `improved ${improved.toFixed(1)} spots vs previous 28 days`
        : improved < -0.05 ? `slipped ${Math.abs(improved).toFixed(1)} spots vs previous 28 days`
        : "steady vs previous 28 days",
    });
  }
  return "search-console";
}

/* ── Vercel Web Analytics ── */

async function vercelCount(projectId: string, since: number, until: number) {
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) return null;
  const params = new URLSearchParams({
    projectId,
    since: new Date(since).toISOString(),
    until: new Date(until).toISOString(),
  });
  if (process.env.VERCEL_TEAM_ID) params.set("teamId", process.env.VERCEL_TEAM_ID);
  const res = await fetch(`https://api.vercel.com/v1/query/web-analytics/visits/count?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { data?: { pageviews?: number; visitors?: number } };
  return data.data ?? null;
}

export async function syncVercel(client: ClientRow): Promise<string | null> {
  const projectId = client.vercel_project_id?.trim();
  if (!projectId) return null;
  const now = Date.now();
  const D28 = 28 * 86400000;
  const [cur, prev] = await Promise.all([
    vercelCount(projectId, now - D28, now),
    vercelCount(projectId, now - 2 * D28, now - D28),
  ]);
  if (!cur) return null;

  const pv = cur.pageviews ?? 0;
  const vis = cur.visitors ?? 0;
  await upsertMetric(client.id, "websites", "vercel_visitors", {
    label: "Visitors (28 days)",
    value: vis.toLocaleString("en-AU"),
    trend: !prev || prev.visitors === vis ? "flat" : vis > (prev.visitors ?? 0) ? "up" : "down",
    trend_note: prev ? pctNote(vis, prev.visitors ?? 0, "visitors") : "last 28 days",
  });
  await upsertMetric(client.id, "websites", "vercel_pageviews", {
    label: "Page views (28 days)",
    value: pv.toLocaleString("en-AU"),
    trend: !prev || prev.pageviews === pv ? "flat" : pv > (prev.pageviews ?? 0) ? "up" : "down",
    trend_note: prev ? pctNote(pv, prev.pageviews ?? 0, "page views") : "last 28 days",
  });
  return "vercel";
}

/* ── Orchestration ── */

export async function syncClientMetrics(clientId: number) {
  const rows = await sql`SELECT id, website, gsc_site, vercel_project_id FROM clients WHERE id = ${clientId}`;
  const client = rows[0] as unknown as ClientRow | undefined;
  if (!client) return { synced: [] as string[] };
  const results = await Promise.allSettled([syncUptime(client), syncSearchConsole(client), syncVercel(client)]);
  const synced = results
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((v): v is string => v != null);
  return { synced };
}

export async function syncAllClients() {
  const clients = (await sql`
    SELECT id, website, gsc_site, vercel_project_id FROM clients
    WHERE website IS NOT NULL OR gsc_site IS NOT NULL OR vercel_project_id IS NOT NULL
  `) as unknown as ClientRow[];
  const out: Record<number, string[]> = {};
  for (const c of clients) {
    const results = await Promise.allSettled([syncUptime(c), syncSearchConsole(c), syncVercel(c)]);
    out[c.id] = results.map((r) => (r.status === "fulfilled" ? r.value : null)).filter((v): v is string => v != null);
  }
  return out;
}
