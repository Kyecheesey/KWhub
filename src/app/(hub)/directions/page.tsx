"use client";

import { useEffect, useRef, useState } from "react";
import {
  Compass, Sparkles, Send, RefreshCw, TrendingUp, Users, Target,
  Receipt, Briefcase, AlertTriangle, Building2, Rocket,
} from "lucide-react";

/**
 * Directions — Kye-only strategy view: live Xero financials, hub growth
 * numbers, and an AI advisor grounded in both.
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

const SUGGESTIONS = [
  "Where should we focus to grow recurring revenue?",
  "Read the current numbers — what's the biggest risk right now?",
  "Which of our seven services should we push hardest this quarter?",
  "How do we improve cash flow from receivables?",
];

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

export default function DirectionsPage() {
  const [xero, setXero] = useState<XeroSnapshot | null>(null);
  const [growth, setGrowth] = useState<GrowthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const [chatError, setChatError] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  // loading starts true, so the initial effect only fetches (no sync setState)
  const fetchSnapshot = () =>
    fetch("/api/directions")
      .then((r) => r.json())
      .then((d) => {
        if (d?.xero) setXero(d.xero);
        if (d?.growth) setGrowth(d.growth);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  useEffect(() => { fetchSnapshot(); }, []);
  const load = () => { setLoading(true); fetchSnapshot(); };

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [chat, thinking]);

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
      <div className="page-header">
        <div>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: "0.35rem" }}>Director only</p>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.02em", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Compass size={22} style={{ color: "var(--accent)" }} /> Directions
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginTop: "0.3rem" }}>
            The money, the growth, and an advisor that reads both.
          </p>
        </div>
        <button className="btn-ghost" onClick={load} disabled={loading}><RefreshCw size={13} /> Refresh</button>
      </div>

      {/* ── Financials (Xero) ── */}
      <h2 style={{ fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)", margin: "0.5rem 0 0.6rem" }}>
        Financials {xero?.org_name ? `· ${xero.org_name}` : ""}
      </h2>
      {loading && !xero ? (
        <div className="card" style={{ padding: "1.25rem", fontSize: "0.82rem", color: "var(--text-3)" }}>Loading…</div>
      ) : xero && !xero.configured ? (
        <div className="card" style={{ padding: "1.1rem 1.25rem", fontSize: "0.82rem", color: "var(--text-2)", lineHeight: 1.6 }}>
          <strong>Xero isn&apos;t connected yet.</strong> Create a custom connection at developer.xero.com
          (scopes: accounting.reports.read, accounting.transactions.read, accounting.settings.read) and add
          <code style={{ margin: "0 0.25rem" }}>XERO_CLIENT_ID</code> and <code style={{ marginRight: "0.25rem" }}>XERO_CLIENT_SECRET</code>
          to the Vercel environment. Growth numbers and the advisor work in the meantime.
        </div>
      ) : xero?.error ? (
        <div className="card" style={{ padding: "1.1rem 1.25rem", fontSize: "0.82rem", color: "#d97706" }}>{xero.error}</div>
      ) : xero ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
          {xero.revenue_fytd != null && <Tile icon={TrendingUp} label="Revenue (FYTD)" value={aud(xero.revenue_fytd)} note="from Xero P&L" />}
          {xero.net_profit_fytd != null && <Tile icon={Building2} label="Net profit (FYTD)" value={aud(xero.net_profit_fytd)} note="from Xero P&L" />}
          {xero.receivables_outstanding != null && <Tile icon={Receipt} label="Receivables" value={aud(xero.receivables_outstanding)} note="awaiting payment" />}
          {xero.receivables_overdue != null && (
            <Tile icon={Receipt} label="Overdue" value={aud(xero.receivables_overdue)}
              note={xero.overdue_invoice_count ? `${xero.overdue_invoice_count} invoice${xero.overdue_invoice_count === 1 ? "" : "s"} past due` : "nothing past due"}
              warn={(xero.receivables_overdue ?? 0) > 0} />
          )}
        </div>
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
