"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Compass, RefreshCw, TrendingUp, Building2, Receipt, Users, Target,
  Rocket, Briefcase, Sparkles, Send, AlertTriangle, ChevronDown,
  BarChart3, Table2, FileSpreadsheet, ShieldCheck,
} from "lucide-react";

/**
 * Directions — Kye-only strategy view: live Xero financials with the full
 * P&L embedded, a monthly income/expenses trend, hub growth numbers, and an
 * AI advisor grounded in both.
 */

interface XeroSnapshot {
  configured: boolean;
  error?: string;
  org_name?: string;
  revenue_fytd?: number;
  net_profit_fytd?: number;
  receivables_outstanding?: number;
  receivables_overdue?: number;
  overdue_invoice_count?: number;
  redirect_uri?: string;
}
interface PnlRow { label: string; values: number[] }
interface PnlSection { title: string; rows: PnlRow[]; summary?: PnlRow }
interface Pnl {
  statement?: { columns: string[]; sections: PnlSection[] };
  monthly?: { months: string[]; income: number[]; expenses: number[]; net: number[] };
}
interface GrowthSnapshot {
  clients_total: number;
  clients_new_30d: number;
  signups_30d: number;
  pipeline_active: number;
  pipeline_value_cents: number;
  won_90d: number;
  jobs_open: number;
  invoices_unpaid_cents: number;
}
interface ChatMsg { role: "user" | "assistant"; text: string }

const aud = (n: number) =>
  n.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const aud2 = (n: number) =>
  n.toLocaleString("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SUGGESTIONS = [
  "Where should we focus to grow recurring revenue?",
  "Read the current numbers — what's the biggest risk right now?",
  "Which of our seven services should we push hardest this quarter?",
  "How do we improve cash flow from receivables?",
];

// Chart series colors — dataviz reference palette slots 1 & 2 (validated
// adjacent pair, light + dark steps)
const VIZ_CSS = `
  .dir-viz { --viz-income: #2a78d6; --viz-expenses: #eb6834; }
  @media (prefers-color-scheme: dark) {
    .dir-viz { --viz-income: #3987e5; --viz-expenses: #d95926; }
  }
`;

function monthLabel(raw: string): string {
  // Xero column headers look like "30 Sep 26" or "Sep-26" — show "Sep 26"
  const m = raw.match(/([A-Za-z]{3})[a-z]*[\s-]*'?(\d{2,4})?/);
  if (!m) return raw;
  const yr = m[2] ? ` ${m[2].slice(-2)}` : "";
  return `${m[1]}${yr}`;
}

function Tile({ icon: Icon, label, value, note, warn }: {
  icon: React.FC<{ size?: number; color?: string }>;
  label: string; value: string; note?: string; warn?: boolean;
}) {
  return (
    <div className="card" style={{ padding: "1rem 1.1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.35rem" }}>
        <Icon size={13} color={warn ? "#d97706" : "var(--accent)"} />
        <span style={{ fontSize: "0.64rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-3)" }}>{label}</span>
      </div>
      <div style={{ fontSize: "1.45rem", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{value}</div>
      {note && (
        <div style={{ marginTop: "0.35rem", fontSize: "0.7rem", fontWeight: 600, color: warn ? "#d97706" : "var(--text-3)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
          {warn && <AlertTriangle size={11} />} {note}
        </div>
      )}
    </div>
  );
}

/** Monthly income vs expenses — grouped bars, hover tooltip, table toggle. */
function TrendChart({ monthly }: { monthly: NonNullable<Pnl["monthly"]> }) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...monthly.income, ...monthly.expenses);
  const H = 150;

  return (
    <div className="card dir-viz" style={{ padding: "1.15rem 1.25rem", marginBottom: "0.9rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.9rem", flexWrap: "wrap" }}>
        <BarChart3 size={15} color="var(--accent)" />
        <div style={{ fontWeight: 800, fontSize: "0.92rem" }}>Income vs expenses · monthly</div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginLeft: "auto", fontSize: "0.7rem", fontWeight: 600, color: "var(--text-2)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--viz-income)" }} /> Income
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--viz-expenses)" }} /> Expenses
          </span>
          <button onClick={() => setView(view === "chart" ? "table" : "chart")} className="btn-ghost"
            style={{ minHeight: 0, padding: "0.28rem 0.6rem", fontSize: "0.68rem" }}>
            {view === "chart" ? <><Table2 size={11} /> Table</> : <><BarChart3 size={11} /> Chart</>}
          </button>
        </div>
      </div>

      {view === "chart" ? (
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: H, borderBottom: "1px solid var(--border)" }}>
            {monthly.months.map((m, i) => {
              const inc = Math.max(0, monthly.income[i] ?? 0);
              const exp = Math.max(0, monthly.expenses[i] ?? 0);
              return (
                <div key={m + i}
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  style={{
                    flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 2,
                    height: "100%", cursor: "default", borderRadius: 6,
                    background: hover === i ? "var(--surface-2)" : "transparent",
                  }}>
                  <div style={{ width: "38%", maxWidth: 16, height: Math.max(2, (inc / max) * (H - 12)), background: "var(--viz-income)", borderRadius: "4px 4px 0 0" }} />
                  <div style={{ width: "38%", maxWidth: 16, height: Math.max(2, (exp / max) * (H - 12)), background: "var(--viz-expenses)", borderRadius: "4px 4px 0 0" }} />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 5 }}>
            {monthly.months.map((m, i) => (
              <div key={m + i} style={{ flex: 1, textAlign: "center", fontSize: "0.6rem", fontWeight: 600, color: hover === i ? "var(--text-1)" : "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden" }}>
                {monthLabel(m)}
              </div>
            ))}
          </div>
          {hover !== null && (
            <div style={{
              position: "absolute", bottom: H + 26,
              left: `${((hover + 0.5) / monthly.months.length) * 100}%`, transform: "translateX(-50%)",
              background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 10,
              padding: "0.5rem 0.7rem", boxShadow: "0 8px 24px rgba(23,42,94,0.18)", zIndex: 5,
              fontSize: "0.72rem", whiteSpace: "nowrap", pointerEvents: "none",
            }}>
              <div style={{ fontWeight: 800, marginBottom: 3 }}>{monthLabel(monthly.months[hover])}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--viz-income)" }} />
                Income <strong style={{ marginLeft: "auto", paddingLeft: 10 }}>{aud(monthly.income[hover] ?? 0)}</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--viz-expenses)" }} />
                Expenses <strong style={{ marginLeft: "auto", paddingLeft: 10 }}>{aud(monthly.expenses[hover] ?? 0)}</strong>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", marginTop: 4, paddingTop: 4, display: "flex" }}>
                Net <strong style={{ marginLeft: "auto", paddingLeft: 10, color: (monthly.net[hover] ?? 0) >= 0 ? "#059669" : "#dc2626" }}>{aud(monthly.net[hover] ?? 0)}</strong>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ color: "var(--text-3)", textAlign: "right" }}>
                <th style={{ textAlign: "left", padding: "0.3rem 0.4rem", fontWeight: 700 }}>Month</th>
                <th style={{ padding: "0.3rem 0.4rem", fontWeight: 700 }}>Income</th>
                <th style={{ padding: "0.3rem 0.4rem", fontWeight: 700 }}>Expenses</th>
                <th style={{ padding: "0.3rem 0.4rem", fontWeight: 700 }}>Net</th>
              </tr>
            </thead>
            <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
              {monthly.months.map((m, i) => (
                <tr key={m + i} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.3rem 0.4rem", fontWeight: 600 }}>{monthLabel(m)}</td>
                  <td style={{ padding: "0.3rem 0.4rem", textAlign: "right" }}>{aud(monthly.income[i] ?? 0)}</td>
                  <td style={{ padding: "0.3rem 0.4rem", textAlign: "right" }}>{aud(monthly.expenses[i] ?? 0)}</td>
                  <td style={{ padding: "0.3rem 0.4rem", textAlign: "right", fontWeight: 700, color: (monthly.net[i] ?? 0) >= 0 ? "#059669" : "#dc2626" }}>{aud(monthly.net[i] ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** The embedded P&L statement — collapsible sections, highlighted totals. */
function PnlStatement({ statement, orgName }: { statement: NonNullable<Pnl["statement"]>; orgName?: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (t: string) => open[t] !== false; // default open
  const netSection = statement.sections.find((s) => /net profit/i.test(s.summary?.label ?? s.title));

  return (
    <div className="card" style={{ marginBottom: "1.25rem", overflow: "hidden" }}>
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <FileSpreadsheet size={15} color="var(--accent)" />
        <div>
          <div style={{ fontWeight: 800, fontSize: "0.92rem" }}>Profit &amp; Loss · financial year to date</div>
          <div style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>
            {orgName ?? "Xero"} · live from Xero{statement.columns[0] ? ` · to ${statement.columns[0]}` : ""}
          </div>
        </div>
      </div>
      <div style={{ padding: "0.5rem 0" }}>
        {statement.sections.map((s) => {
          const title = s.title || s.summary?.label || "—";
          const isNet = s === netSection;
          if (isNet && s.rows.length === 0) return null; // rendered as the closing band below
          return (
            <div key={title}>
              <button onClick={() => setOpen((o) => ({ ...o, [title]: !isOpen(title) }))}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer",
                  background: "none", border: "none", padding: "0.55rem 1.25rem",
                  fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-3)",
                }}>
                <ChevronDown size={12} style={{ transform: isOpen(title) ? "none" : "rotate(-90deg)", transition: "transform 0.15s" }} />
                {title}
              </button>
              {isOpen(title) && s.rows.map((r) => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: "0.32rem 1.25rem 0.32rem 2.4rem", fontSize: "0.83rem" }}>
                  <span style={{ color: "var(--text-2)" }}>{r.label}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{aud2(r.values[0] ?? 0)}</span>
                </div>
              ))}
              {s.summary && (
                <div style={{
                  display: "flex", justifyContent: "space-between", gap: "1rem",
                  padding: "0.45rem 1.25rem", margin: "0.2rem 0",
                  borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
                  fontSize: "0.84rem", fontWeight: 800, background: "var(--surface-2)",
                }}>
                  <span>{s.summary.label}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{aud2(s.summary.values[0] ?? 0)}</span>
                </div>
              )}
            </div>
          );
        })}
        {netSection?.summary && netSection.rows.length === 0 && (
          <div style={{
            display: "flex", justifyContent: "space-between", gap: "1rem",
            margin: "0.6rem 1.25rem 0.85rem", padding: "0.7rem 1rem", borderRadius: 12,
            background: (netSection.summary.values[0] ?? 0) >= 0 ? "rgba(5,150,105,0.10)" : "rgba(220,38,38,0.08)",
            border: `1px solid ${(netSection.summary.values[0] ?? 0) >= 0 ? "rgba(5,150,105,0.3)" : "rgba(220,38,38,0.25)"}`,
            fontSize: "0.95rem", fontWeight: 900,
          }}>
            <span>{netSection.summary.label}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", color: (netSection.summary.values[0] ?? 0) >= 0 ? "#059669" : "#dc2626" }}>
              {aud2(netSection.summary.values[0] ?? 0)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DirectionsPage() {
  const [xero, setXero] = useState<XeroSnapshot | null>(null);
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [growth, setGrowth] = useState<GrowthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const [chatError, setChatError] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  // loading starts true, so the initial effect only fetches (no sync setState)
  const fetchSnapshot = (fresh = false) =>
    fetch(`/api/directions${fresh ? "?fresh=1" : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.xero) setXero(d.xero);
        if (d?.pnl) setPnl(d.pnl);
        if (d?.growth) setGrowth(d.growth);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  useEffect(() => { fetchSnapshot(); }, []);
  const load = () => { setLoading(true); fetchSnapshot(true); };

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [chat, thinking]);

  const margin = useMemo(() => {
    if (xero?.revenue_fytd && xero.revenue_fytd > 0 && xero.net_profit_fytd != null) {
      return Math.round((xero.net_profit_fytd / xero.revenue_fytd) * 100);
    }
    return null;
  }, [xero]);

  async function ask(q?: string) {
    const text = (q ?? question).trim();
    if (!text || thinking) return;
    setChatError("");
    setQuestion("");
    const history = chat;
    setChat((prev) => [...prev, { role: "user", text }]);
    setThinking(true);
    const res = await fetch("/api/directions/advise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text, history }),
    });
    const data = await res.json().catch(() => null);
    setThinking(false);
    if (!res.ok) {
      setChatError(data?.error ?? "The advisor couldn't answer — try again.");
      return;
    }
    setChat((prev) => [...prev, { role: "assistant", text: data.answer }]);
  }

  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <style>{VIZ_CSS}</style>

      {/* ── Hero ── */}
      <div style={{
        position: "relative", overflow: "hidden", borderRadius: 18, marginBottom: "1.25rem",
        background: "linear-gradient(135deg, #0f1830 0%, #1e1b4b 55%, #172554 100%)",
        padding: "1.5rem 1.6rem",
      }}>
        <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", top: -130, right: -60, background: "rgba(79,70,229,0.35)", filter: "blur(10px)" }} />
        <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", bottom: -120, left: "30%", background: "rgba(8,145,178,0.25)", filter: "blur(10px)" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <p style={{ fontSize: "0.66rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(165,180,252,0.9)", margin: "0 0 0.3rem" }}>
              Director only
            </p>
            <h1 style={{ fontSize: "1.55rem", fontWeight: 900, letterSpacing: "-0.02em", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem", color: "#fff" }}>
              <Compass size={22} style={{ color: "#818cf8" }} /> Directions
            </h1>
            <p style={{ color: "rgba(226,232,240,0.75)", fontSize: "0.85rem", margin: "0.3rem 0 0" }}>
              The money, the growth, and an advisor that reads both.
            </p>
          </div>
          {xero?.configured && !xero.error && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "0.35rem",
              fontSize: "0.7rem", fontWeight: 700, color: "#6ee7b7",
              background: "rgba(5,150,105,0.18)", border: "1px solid rgba(110,231,183,0.35)",
              borderRadius: 999, padding: "0.3rem 0.75rem",
            }}>
              <ShieldCheck size={12} /> Xero connected · {xero.org_name ?? "live"}
            </span>
          )}
          <button onClick={load} disabled={loading}
            style={{
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.28)",
              borderRadius: 10, padding: "0.5rem 0.9rem", fontSize: "0.78rem", fontWeight: 700,
              color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.4rem",
            }}>
            <RefreshCw size={13} style={loading ? { animation: "spin 1s linear infinite" } : undefined} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Financials (Xero) ── */}
      {loading && !xero ? (
        <div className="card" style={{ padding: "1.25rem", fontSize: "0.82rem", color: "var(--text-3)" }}>Reading the numbers…</div>
      ) : xero && !xero.configured ? (
        <div className="card" style={{ padding: "1.25rem 1.35rem", fontSize: "0.85rem", color: "var(--text-2)", lineHeight: 1.6 }}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)", marginBottom: "0.3rem" }}>
            Xero isn&apos;t connected yet
          </div>
          <p style={{ margin: "0 0 0.9rem", maxWidth: 480 }}>
            Connect KW | Innovations to display live financial data and business insights.
            {xero.error && xero.error !== "Xero isn't connected yet." ? ` (${xero.error})` : ""}
          </p>
          <a href="/api/xero/connect" className="btn-primary" style={{ fontSize: "0.82rem", textDecoration: "none" }}>
            Connect Xero
          </a>
          {xero.redirect_uri && (
            <p style={{ margin: "0.9rem 0 0", fontSize: "0.72rem", color: "var(--text-3)" }}>
              If Xero says &ldquo;Invalid redirect_uri&rdquo;, add this exact URI to the app&apos;s
              OAuth 2.0 redirect URIs at developer.xero.com:
              <code style={{ display: "block", marginTop: "0.3rem", userSelect: "all" }}>{xero.redirect_uri}</code>
            </p>
          )}
        </div>
      ) : xero?.error ? (
        <div className="card" style={{ padding: "1.1rem 1.25rem", fontSize: "0.82rem", color: "#d97706", marginBottom: "1rem" }}>{xero.error}</div>
      ) : xero ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "0.9rem" }}>
            {xero.revenue_fytd != null && <Tile icon={TrendingUp} label="Revenue (FYTD)" value={aud(xero.revenue_fytd)} note="from Xero P&L" />}
            {xero.net_profit_fytd != null && (
              <Tile icon={Building2} label="Net profit (FYTD)" value={aud(xero.net_profit_fytd)}
                note={margin != null ? `${margin}% margin` : "from Xero P&L"} />
            )}
            {xero.receivables_outstanding != null && <Tile icon={Receipt} label="Receivables" value={aud(xero.receivables_outstanding)} note="awaiting payment" />}
            {xero.receivables_overdue != null && (
              <Tile icon={Receipt} label="Overdue" value={aud(xero.receivables_overdue)}
                note={xero.overdue_invoice_count ? `${xero.overdue_invoice_count} invoice${xero.overdue_invoice_count === 1 ? "" : "s"} past due` : "nothing past due"}
                warn={(xero.receivables_overdue ?? 0) > 0} />
            )}
          </div>

          {pnl?.monthly && pnl.monthly.months.length > 1 && <TrendChart monthly={pnl.monthly} />}
          {pnl?.statement && <PnlStatement statement={pnl.statement} orgName={xero.org_name} />}
        </>
      ) : null}

      {/* ── Growth (hub data) ── */}
      <h2 style={{ fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)", margin: "0.5rem 0 0.6rem" }}>Growth</h2>
      {growth && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <Tile icon={Users} label="Clients" value={String(growth.clients_total)} note={`${growth.clients_new_30d} new in 30 days`} />
          <Tile icon={Rocket} label="Self sign-ups (30d)" value={String(growth.signups_30d)} note="via /signup" />
          <Tile icon={Target} label="Pipeline" value={String(growth.pipeline_active)}
            note={growth.pipeline_value_cents > 0 ? `${aud(growth.pipeline_value_cents / 100)} potential value` : "active potentials"} />
          <Tile icon={TrendingUp} label="Won (90d)" value={String(growth.won_90d)} note="closed potentials" />
          <Tile icon={Briefcase} label="Open jobs" value={String(growth.jobs_open)} note="on the board" />
          <Tile icon={Receipt} label="Unpaid (portal)" value={aud(growth.invoices_unpaid_cents / 100)}
            note="hub invoices" warn={growth.invoices_unpaid_cents > 0} />
        </div>
      )}

      {/* ── AI advisor ── */}
      <div className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.15rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Sparkles size={16} color="var(--accent)" />
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.92rem" }}>Growth advisor</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>Claude, briefed with the live numbers above — ask it how to grow the business.</div>
          </div>
        </div>

        <div ref={threadRef} style={{ maxHeight: 420, overflowY: "auto", padding: "1rem 1.15rem", display: "grid", gap: "0.75rem" }}>
          {chat.length === 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} disabled={thinking} className="btn-ghost"
                  style={{ minHeight: 0, padding: "0.4rem 0.7rem", fontSize: "0.74rem", textAlign: "left" }}>
                  {s}
                </button>
              ))}
            </div>
          )}
          {chat.map((m, i) => (
            <div key={i} style={{
              justifySelf: m.role === "user" ? "end" : "start", maxWidth: "85%",
              padding: "0.65rem 0.9rem", borderRadius: 12, fontSize: "0.84rem", lineHeight: 1.6, whiteSpace: "pre-wrap",
              background: m.role === "user" ? "linear-gradient(135deg, rgba(45,212,232,0.12), rgba(124,133,243,0.1))" : "var(--surface-2)",
              border: "1px solid var(--border-2)",
            }}>{m.text}</div>
          ))}
          {thinking && <div style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>Reading the numbers…</div>}
          {chatError && (
            <div style={{ padding: "0.55rem 0.8rem", borderRadius: 9, fontSize: "0.8rem", background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", color: "#dc2626" }}>{chatError}</div>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); ask(); }}
          style={{ display: "flex", gap: "0.5rem", padding: "0.85rem 1.15rem", borderTop: "1px solid var(--border)" }}
        >
          <input className="field" placeholder="Ask about growing the business…" value={question}
            onChange={(e) => setQuestion(e.target.value)} style={{ flex: 1 }} />
          <button type="submit" className="btn-primary" disabled={thinking || !question.trim()}>
            <Send size={14} /> {thinking ? "Thinking…" : "Ask"}
          </button>
        </form>
      </div>
    </div>
  );
}
