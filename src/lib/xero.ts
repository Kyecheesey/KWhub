/**
 * Xero integration via a "Custom Connection" (OAuth2 client credentials,
 * single organisation). Needs XERO_CLIENT_ID + XERO_CLIENT_SECRET from a
 * custom-connection app on developer.xero.com with the
 * accounting.reports.read and accounting.transactions.read scopes.
 * Everything degrades gracefully when unconfigured or unreachable.
 */

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

let cachedToken: { token: string; expires: number } | null = null;

async function xeroToken(): Promise<string | null> {
  const id = process.env.XERO_CLIENT_ID;
  const secret = process.env.XERO_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.token;
  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "accounting.reports.read accounting.transactions.read accounting.settings.read",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  cachedToken = { token: data.access_token, expires: Date.now() + (data.expires_in ?? 1800) * 1000 };
  return data.access_token;
}

async function xeroGet<T>(token: string, path: string): Promise<T | null> {
  const res = await fetch(`https://api.xero.com/api.xro/2.0/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
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
  const token = await xeroToken().catch(() => null);
  if (!token) {
    return {
      configured: false,
      error: process.env.XERO_CLIENT_ID
        ? "Couldn't reach Xero — check the custom connection credentials."
        : "Xero isn't connected yet. Add XERO_CLIENT_ID and XERO_CLIENT_SECRET from a custom connection app.",
    };
  }
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [org, pl, invoices] = await Promise.all([
      xeroGet<{ Organisations?: { Name?: string }[] }>(token, "Organisation"),
      xeroGet<ReportResponse>(token, `Reports/ProfitAndLoss?fromDate=${fyStart()}&toDate=${today}`),
      xeroGet<{ Invoices?: { AmountDue?: number; DueDateString?: string }[] }>(
        token,
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
