import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../auth";
import { xeroPnl, xeroRedirectUri, xeroSnapshot } from "@/lib/xero";
import { growthSnapshot } from "@/lib/growth";

const CACHE_KEY = "directions_xero_cache";
const CACHE_TTL_MS = 10 * 60 * 1000; // Xero data is cached 10 min; Refresh busts it

/**
 * The Directions snapshot: Xero financials + full P&L + growth numbers.
 * Kye-only (middleware enforces it too). Growth is always live (local DB);
 * the Xero half is cached briefly so the page opens instantly.
 */
export async function GET(request: Request) {
  await migrate();
  const session = await auth();
  if ((session?.user?.name ?? "").toLowerCase() !== "kye") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const fresh = url.searchParams.get("fresh") === "1";

  type XeroPayload = { xero: Awaited<ReturnType<typeof xeroSnapshot>>; pnl: Awaited<ReturnType<typeof xeroPnl>> };
  let payload: XeroPayload | null = null;

  if (!fresh) {
    try {
      const rows = await sql`SELECT value FROM settings WHERE key = ${CACHE_KEY}`;
      const raw = (rows[0] as { value: string | null } | undefined)?.value;
      if (raw) {
        const cached = JSON.parse(raw) as { ts: number; data: XeroPayload };
        if (Date.now() - cached.ts < CACHE_TTL_MS && cached.data?.xero?.configured) payload = cached.data;
      }
    } catch { /* cache is best effort */ }
  }

  if (!payload) {
    const [xero, pnl] = await Promise.all([xeroSnapshot(), xeroPnl()]);
    payload = { xero, pnl };
    if (xero.configured && !xero.error) {
      await sql`
        INSERT INTO settings (key, value) VALUES (${CACHE_KEY}, ${JSON.stringify({ ts: Date.now(), data: payload })})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `;
    }
  }

  const growth = await growthSnapshot();
  const redirectUri = payload.xero.configured ? undefined : xeroRedirectUri(url.origin);
  return Response.json({ xero: { ...payload.xero, redirect_uri: redirectUri }, pnl: payload.pnl, growth });
}
