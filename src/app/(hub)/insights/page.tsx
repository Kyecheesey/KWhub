"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Target, Award, CalendarPlus, Timer } from "lucide-react";

interface Pot {
  id: number;
  business_name: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

const STAGES = [
  { key: "new",       label: "New",       color: "#60a5fa" },
  { key: "contacted", label: "Contacted", color: "#d97706" },
  { key: "qualified", label: "Qualified", color: "#7c3aed" },
  { key: "proposal",  label: "Proposal",  color: "#ea580c" },
  { key: "won",       label: "Won",       color: "#059669" },
  { key: "lost",      label: "Lost",      color: "#e11d48" },
];

const ACTIVE = ["new", "contacted", "qualified", "proposal"];
const SERIES = { active: "#7c85f3", won: "#10b981" };
const DAY = 86400000;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function InsightsPage() {
  const [pots, setPots] = useState<Pot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/potentials")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) { setPots(Array.isArray(data) ? data : []); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, []);

  /* ── Headline metrics ── */
  const won = pots.filter((p) => p.status === "won");
  const lost = pots.filter((p) => p.status === "lost");
  const decided = won.length + lost.length;
  const winRate = decided > 0 ? Math.round((won.length / decided) * 100) : null;

  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const addedThisMonth = pots.filter((p) => new Date(p.created_at) >= monthStart).length;

  const closeDays = won
    .map((p) => (new Date(p.updated_at).getTime() - new Date(p.created_at).getTime()) / DAY)
    .filter((d) => d >= 0);
  const avgClose = closeDays.length > 0 ? Math.round(closeDays.reduce((a, b) => a + b, 0) / closeDays.length) : null;

  const tiles = [
    { label: "In Pipeline", value: pots.filter((p) => ACTIVE.includes(p.status)).length, icon: Target, color: "#7c85f3" },
    { label: "Win Rate", value: winRate === null ? "—" : `${winRate}%`, icon: Award, color: "#10b981", sub: decided > 0 ? `${won.length} won · ${lost.length} lost` : "No decided deals yet" },
    { label: "Added This Month", value: addedThisMonth, icon: CalendarPlus, color: "#0891b2" },
    { label: "Avg Days to Win", value: avgClose === null ? "—" : avgClose, icon: Timer, color: "#ea580c", sub: avgClose === null ? "No wins yet" : "From created to won" },
  ];

  /* ── Funnel ── */
  const stageCounts = STAGES.map((s) => ({ ...s, count: pots.filter((p) => p.status === s.key).length }));
  const maxStage = Math.max(...stageCounts.map((s) => s.count), 1);

  /* ── Per person ── */
  const agents = Array.from(new Set(pots.map((p) => p.assigned_to).filter(Boolean))) as string[];
  const perAgent = agents.map((name) => ({
    name,
    active: pots.filter((p) => p.assigned_to === name && ACTIVE.includes(p.status)).length,
    won: pots.filter((p) => p.assigned_to === name && p.status === "won").length,
  })).sort((a, b) => (b.active + b.won) - (a.active + a.won));
  const maxAgent = Math.max(...perAgent.map((a) => Math.max(a.active, a.won)), 1);

  /* ── Monthly trend (last 6 months) ── */
  const months: { key: string; label: string; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1); d.setMonth(d.getMonth() - i);
    months.push({
      key: monthKey(d),
      label: d.toLocaleDateString("en-AU", { month: "short" }),
      count: 0,
    });
  }
  for (const p of pots) {
    const k = monthKey(new Date(p.created_at));
    const m = months.find((x) => x.key === k);
    if (m) m.count++;
  }
  const maxMonth = Math.max(...months.map((m) => m.count), 1);

  const sectionTitle = (text: string) => (
    <h2 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.75rem" }}>
      {text}
    </h2>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: "0.35rem" }}>KW | Innovations</p>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 900, letterSpacing: "-0.02em", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <TrendingUp size={24} style={{ color: "var(--accent)" }} /> Insights
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginTop: "0.3rem" }}>
            {loading ? "Loading…" : `Pipeline analytics across ${pots.length} potentials`}
          </p>
        </div>
      </div>

      {/* ── Stat tiles ── */}
      <div className="stat-grid">
        {tiles.map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="stat-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.7rem" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
              <Icon size={15} color={color} />
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 900, lineHeight: 1, color: "var(--text-1)" }}>
              {loading ? "–" : value}
            </div>
            {sub && <div style={{ fontSize: "0.7rem", color: "var(--text-3)", marginTop: "0.35rem" }}>{loading ? "" : sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Funnel ── */}
      {sectionTitle("Pipeline by Stage")}
      <div className="card" style={{ padding: "1.25rem", marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          {stageCounts.map(({ key, label, color, count }) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }} title={`${label}: ${count} potential${count !== 1 ? "s" : ""}`}>
              <div style={{ width: 90, fontSize: "0.78rem", fontWeight: 600, color: "var(--text-2)", flexShrink: 0 }}>{label}</div>
              <div style={{ flex: 1, height: 22, background: "var(--surface-2)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{
                  width: count === 0 ? "0%" : `${Math.max((count / maxStage) * 100, 4)}%`,
                  height: "100%", background: color, borderRadius: 6,
                  transition: "width 0.4s ease",
                }} />
              </div>
              <div style={{ width: 32, textAlign: "right", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-1)" }}>{count}</div>
            </div>
          ))}
        </div>
        {/* Table view for accessibility */}
        <details style={{ marginTop: "1rem" }}>
          <summary style={{ fontSize: "0.72rem", color: "var(--text-3)", cursor: "pointer" }}>View as table</summary>
          <table className="data-table" style={{ marginTop: "0.5rem" }}>
            <thead><tr><th>Stage</th><th style={{ textAlign: "right" }}>Count</th><th style={{ textAlign: "right" }}>Share</th></tr></thead>
            <tbody>
              {stageCounts.map(({ key, label, count }) => (
                <tr key={key}>
                  <td>{label}</td>
                  <td style={{ textAlign: "right" }}>{count}</td>
                  <td style={{ textAlign: "right" }}>{pots.length > 0 ? `${Math.round((count / pots.length) * 100)}%` : "0%"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>

      <div className="dashboard-grid" style={{ marginBottom: "1.75rem" }}>
        {/* ── Per person ── */}
        <div>
          {sectionTitle("By Team Member")}
          <div className="card" style={{ padding: "1.25rem" }}>
            {/* Legend */}
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
              {[["Active", SERIES.active], ["Won", SERIES.won]].map(([label, color]) => (
                <span key={label} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "var(--text-2)", fontWeight: 600 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: color as string, display: "inline-block" }} />
                  {label}
                </span>
              ))}
            </div>
            {perAgent.length === 0 && !loading && (
              <p style={{ fontSize: "0.82rem", color: "var(--text-3)" }}>No potentials assigned yet.</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              {perAgent.map(({ name, active, won: w }) => (
                <div key={name}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-1)", marginBottom: "0.3rem" }}>{name}</div>
                  {[
                    { label: "Active", val: active, color: SERIES.active },
                    { label: "Won", val: w, color: SERIES.won },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: 3 }} title={`${name} — ${label}: ${val}`}>
                      <div style={{ flex: 1, height: 14, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: val === 0 ? "0%" : `${Math.max((val / maxAgent) * 100, 3)}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.4s ease" }} />
                      </div>
                      <span style={{ width: 24, textAlign: "right", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-1)" }}>{val}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Monthly trend ── */}
        <div>
          {sectionTitle("Added per Month")}
          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", height: 140 }}>
              {months.map(({ key, label, count }) => (
                <div key={key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem", height: "100%", justifyContent: "flex-end" }} title={`${label}: ${count} added`}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-1)" }}>{count}</span>
                  <div style={{
                    width: "100%", maxWidth: 36,
                    height: count === 0 ? 2 : `${Math.max((count / maxMonth) * 100, 4)}%`,
                    background: count === 0 ? "var(--surface-3)" : "var(--accent)",
                    borderRadius: "4px 4px 0 0",
                    transition: "height 0.4s ease",
                  }} />
                  <span style={{ fontSize: "0.68rem", color: "var(--text-3)", fontWeight: 600 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
