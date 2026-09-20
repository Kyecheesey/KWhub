import { sql } from "./db";

/**
 * Xero integration via the standard OAuth 2.0 web flow (no paid Custom
 * Connection). Kye connects once from Directions (/api/xero/connect →
 * consent → /api/xero/callback); tokens live in the settings table and the
 * server refreshes them automatically. Access tokens last 30 minutes and
 * refresh tokens rotate on every refresh, so the stored set is replaced
 * each time. Needs XERO_CLIENT_ID + XERO_CLIENT_SECRET (web app on
 * developer.xero.com) and the app's redirect URI registered exactly.
 */

// Granular scopes (new-style Xero apps): org settings for the name, the
// P&L report, and invoices for receivables. offline_access gives the
// refresh token.
export const XERO_SCOPES =
  "offline_access accounting.settings.read accounting.reports.profitandloss.read accounting.invoices.read";

const SETTINGS_KEY = "xero_tokens";

export interface XeroTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
  tenant_id: string;
  tenant_name?: string;
}

export function xeroRedirectUri(origin?: string): string {
  return (
    process.env.XERO_REDIRECT_URI ??
    `${(origin ?? "https://kwinnovationshub.com.au").replace(/\/$/, "")}/api/xero/callback`
  );
}

export async function saveXeroTokens(tokens: XeroTokens): Promise<void> {
  await sql`
    INSERT INTO settings (key, value) VALUES (${SETTINGS_KEY}, ${JSON.stringify(tokens)})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}

async function loadXeroTokens(): Promise<XeroTokens | null> {
  try {
    const rows = await sql`SELECT value FROM settings WHERE key = ${SETTINGS_KEY}`;
    const raw = (rows[0] as { value: string | null } | undefined)?.value;
    return raw ? (JSON.parse(raw) as XeroTokens) : null;
  } catch {
    return null;
  }
}

export async function clearXeroTokens(): Promise<void> {
  await sql`DELETE FROM settings WHERE key = ${SETTINGS_KEY}`;
}

function basicAuth(): string | null {
  const id = process.env.XERO_CLIENT_ID;
  const secret = process.env.XERO_CLIENT_SECRET;
  if (!id || !secret) return null;
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

/** Exchange an authorization code (callback route) for tokens. */
export async function exchangeXeroCode(code: string, redirectUri: string): Promise<
  { ok: true; access_token: string; refresh_token: string; expires_in: number } | { ok: false; error: string }
> {
  const auth = basicAuth();
  if (!auth) return { ok: false, error: "XERO_CLIENT_ID / XERO_CLIENT_SECRET aren't set." };
  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string; refresh_token?: string; expires_in?: number; error?: string;
  };
  if (!res.ok || !data.access_token || !data.refresh_token) {
    return { ok: false, error: data.error ?? `Token exchange failed (${res.status})` };
  }
  return { ok: true, access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in ?? 1800 };
}

/** The organisations this token can access (to pick the tenant id). */
export async function xeroConnections(accessToken: string): Promise<{ tenantId: string; tenantName?: string }[]> {
  const res = await fetch("https://api.xero.com/connections", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { tenantId: string; tenantName?: string }[];
  return Array.isArray(data) ? data : [];
}

/**
 * A valid access token + tenant, refreshing (and persisting the rotated
 * refresh token) when the stored one is stale.
 */
async function xeroAccess(): Promise<{ token: string; tenantId: string } | { error: string } | null> {
  const stored = await loadXeroTokens();
  if (!stored) return null; // not connected
  if (stored.expires_at > Date.now() + 60_000) {
    return { token: stored.access_token, tenantId: stored.tenant_id };
  }
  const auth = basicAuth();
  if (!auth) return { error: "XERO_CLIENT_ID / XERO_CLIENT_SECRET aren't set." };
  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: stored.refresh_token }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string; refresh_token?: string; expires_in?: number;
  };
  if (!res.ok || !data.access_token || !data.refresh_token) {
    // Refresh token expired or revoked — needs a fresh Connect Xero
    return { error: "Xero session expired — reconnect from the Directions page." };
  }
  const next: XeroTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token, // rotated — must replace the old one
    expires_at: Date.now() + (data.expires_in ?? 1800) * 1000,
    tenant_id: stored.tenant_id,
    tenant_name: stored.tenant_name,
  };
  await saveXeroTokens(next);
  return { token: next.access_token, tenantId: next.tenant_id };
}

export interface XeroSnapshot {
  configured: boolean;
  error?: string;
  org_name?: string;
  revenue_fytd?: number;
  net_profit_fytd?: number;
  receivables_outstanding?: number;
  receivables_overdue?: number;
  overdue_invoice_count?: number;
}

async function xeroGet<T>(token: string, tenantId: string, path: string): Promise<T | null> {
  const res = await fetch(`https://api.xero.com/api.xro/2.0/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Xero-Tenant-Id": tenantId,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

interface ReportCell { Value?: string }
interface ReportRow { RowType?: string; Cells?: ReportCell[]; Rows?: ReportRow[]; Title?: string }
interface ReportResponse { Reports?: { ReportTitles?: string[]; Rows?: ReportRow[] }[] }

/** Walk a Xero report and pull the last-cell number of the row whose first cell matches. */
function reportValue(report: ReportResponse | null, rowLabel: RegExp): number | undefined {
  const walk = (rows: ReportRow[] | undefined): number | undefined => {
    for (const row of rows ?? []) {
      const first = row.Cells?.[0]?.Value;
      if (first && rowLabel.test(first)) {
        const last = row.Cells?.[row.Cells.length - 1]?.Value;
        const n = last != null ? Number(last) : NaN;
        if (!Number.isNaN(n)) return n;
      }
      const nested = walk(row.Rows);
      if (nested !== undefined) return nested;
    }
    return undefined;
  };
  return walk(report?.Reports?.[0]?.Rows);
}

/** Australian financial year to date (1 July → today). */
function fyStart(): string {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-07-01`;
}

export async function xeroSnapshot(): Promise<XeroSnapshot> {
  const access = await xeroAccess().catch(() => null);
  if (!access) {
    return { configured: false, error: "Xero isn't connected yet." };
  }
  if ("error" in access) {
    return { configured: false, error: access.error };
  }
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { token, tenantId } = access;
    const [org, pl, invoices] = await Promise.all([
      xeroGet<{ Organisations?: { Name?: string }[] }>(token, tenantId, "Organisation"),
      xeroGet<ReportResponse>(token, tenantId, `Reports/ProfitAndLoss?fromDate=${fyStart()}&toDate=${today}`),
      xeroGet<{ Invoices?: { AmountDue?: number; DueDateString?: string }[] }>(
        token, tenantId,
        `Invoices?where=${encodeURIComponent('Type=="ACCREC" AND Status=="AUTHORISED"')}&summaryOnly=true&page=1`,
      ),
    ]);

    let outstanding = 0, overdue = 0, overdueCount = 0;
    const now = Date.now();
    for (const inv of invoices?.Invoices ?? []) {
      const due = inv.AmountDue ?? 0;
      outstanding += due;
      if (inv.DueDateString && new Date(inv.DueDateString).getTime() < now && due > 0) {
        overdue += due;
        overdueCount += 1;
      }
    }

    return {
      configured: true,
      org_name: org?.Organisations?.[0]?.Name,
      revenue_fytd: reportValue(pl, /^Total (Income|Revenue|Trading Income)/i),
      net_profit_fytd: reportValue(pl, /^Net Profit/i),
      receivables_outstanding: Math.round(outstanding * 100) / 100,
      receivables_overdue: Math.round(overdue * 100) / 100,
      overdue_invoice_count: overdueCount,
    };
  } catch {
    return { configured: true, error: "Xero request failed — try again shortly." };
  }
}
