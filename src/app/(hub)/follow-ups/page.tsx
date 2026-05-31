"use client";

import { useEffect, useState } from "react";
import { Bell, CalendarClock, CheckCheck, Pencil, RefreshCw, UserCircle2, Phone, Mail, X, Search } from "lucide-react";

/* ─── Types ─── */
interface Potential {
  id: number;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: string;
  assigned_to: string | null;
  contact_method: string | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
}

const STAGES = [
  { key: "new",         label: "New",          color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.2)"  },
  { key: "contacted",   label: "Contacted",     color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.2)"  },
  { key: "qualified",   label: "Qualified",     color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.2)" },
  { key: "proposal",    label: "Proposal Sent", color: "#fb923c", bg: "rgba(251,146,60,0.1)",  border: "rgba(251,146,60,0.2)"  },
  { key: "won",         label: "Won",           color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.2)"  },
  { key: "lost",        label: "Lost",          color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.2)" },
];

const AGENTS = ["All", "Kye", "Luka", "Aksel"];

/* ─── Helpers ─── */
function followUpStatus(p: Potential): "overdue" | "due_today" | "upcoming" | "none" {
  const refDate = p.follow_up_date
    ? new Date(p.follow_up_date)
    : (() => {
        if (!["contacted", "qualified", "proposal", "new"].includes(p.status)) return null;
        const d = new Date(p.updated_at);
        d.setDate(d.getDate() + 5);
        return d;
      })();
  if (!refDate) return "none";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(refDate); due.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return "overdue";
  if (diff === 0) return "due_today";
  if (diff <= 3) return "upcoming";
  return "none";
}

function followUpLabel(p: Potential): string {
  const refDate = p.follow_up_date
    ? new Date(p.follow_up_date)
    : (() => { const d = new Date(p.updated_at); d.setDate(d.getDate() + 5); return d; })();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(refDate); due.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Due today";
  return `Due in ${diff}d`;
}

function followUpDueDate(p: Potential): string {
  const refDate = p.follow_up_date
    ? new Date(p.follow_up_date)
    : (() => { const d = new Date(p.updated_at); d.setDate(d.getDate() + 5); return d; })();
  return new Date(refDate).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

const STATUS_COLOR: Record<string, string> = {
  overdue: "#f87171", due_today: "#fbbf24", upcoming: "#2dd4e8",
};
const STATUS_LABEL: Record<string, string> = {
  overdue: "Overdue", due_today: "Due Today", upcoming: "Upcoming",
};
const STATUS_ORDER = ["overdue", "due_today", "upcoming"];

export default function FollowUpsPage() {
  const [potentials, setPotentials] = useState<Potential[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterAgent, setFilterAgent] = useState("All");
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  async function load() {
    setLoading(true);
    const data = await fetch("/api/potentials").then(r => r.json());
    setPotentials(Array.isArray(data) ? data : []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  /* Filter to only follow-up items */
  const followUps = potentials.filter(p => {
    const st = followUpStatus(p);
    if (st === "none") return false;
    if (filterStatus !== "all" && st !== filterStatus) return false;
    if (filterAgent !== "All" && p.assigned_to !== filterAgent) return false;
    if (search && !p.business_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const overdue  = followUps.filter(p => followUpStatus(p) === "overdue");
  const dueToday = followUps.filter(p => followUpStatus(p) === "due_today");
  const upcoming = followUps.filter(p => followUpStatus(p) === "upcoming");

  async function snooze(p: Potential, days = 5) {
    const next = new Date(); next.setDate(next.getDate() + days);
    const dateStr = next.toISOString().slice(0, 10);
    setPotentials(prev => prev.map(x => x.id === p.id ? { ...x, follow_up_date: dateStr } : x));
    await fetch(`/api/potentials/${p.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, follow_up_date: dateStr }),
    });
  }

  async function markDone(p: Potential) {
    const next = new Date(); next.setDate(next.getDate() + 5);
    const dateStr = next.toISOString().slice(0, 10);
    setPotentials(prev => prev.map(x => x.id === p.id ? { ...x, follow_up_date: dateStr } : x));
    await fetch(`/api/potentials/${p.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, follow_up_date: dateStr }),
    });
  }

  const grouped: Record<string, Potential[]> = { overdue, due_today: dueToday, upcoming };

  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text-1)", margin: 0 }}>
            Follow-ups
          </h1>
          <p style={{ color: "var(--text-3)", fontSize: "0.82rem", margin: "0.25rem 0 0" }}>
            {loading ? "Loading…" : `${overdue.length} overdue · ${dueToday.length} due today · ${upcoming.length} upcoming`}
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-ghost" style={{ gap: "0.4rem" }}>
          <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* ── Stat pills ── */}
      <div style={{ display: "flex", gap: "0.65rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {[
          { key: "all",      label: "All",       count: followUps.length, color: "var(--text-2)" },
          { key: "overdue",  label: "Overdue",   count: overdue.length,   color: "#f87171" },
          { key: "due_today",label: "Due Today",  count: dueToday.length,  color: "#fbbf24" },
          { key: "upcoming", label: "Upcoming",  count: upcoming.length,  color: "#2dd4e8" },
        ].map(({ key, label, count, color }) => (
          <button
            key={key}
            onClick={() => setFilterStatus(key)}
            style={{
              display: "flex", alignItems: "center", gap: "0.45rem",
              padding: "0.4rem 0.85rem", borderRadius: 99, cursor: "pointer", fontSize: "0.8rem", fontWeight: 600,
              background: filterStatus === key ? `${color}18` : "var(--surface)",
              border: `1px solid ${filterStatus === key ? color : "var(--border)"}`,
              color: filterStatus === key ? color : "var(--text-2)",
              transition: "all 0.12s",
            }}
          >
            {label}
            <span style={{ fontSize: "0.72rem", fontWeight: 800, background: filterStatus === key ? `${color}25` : "var(--surface-2)", color: filterStatus === key ? color : "var(--text-3)", borderRadius: 99, padding: "0.05rem 0.45rem" }}>{count}</span>
          </button>
        ))}
      </div>

      {/* ── Filters row ── */}
      <div style={{ display: "flex", gap: "0.65rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
        {/* Search */}
        <div className="search-wrap" style={{ margin: 0, flex: 1, minWidth: 180 }}>
          <Search size={14} />
          <input className="field" placeholder="Search businesses…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: "2.2rem" }} />
        </div>
        {/* Agent filter */}
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {AGENTS.map(a => (
            <button key={a} onClick={() => setFilterAgent(a)} style={{
              padding: "0.4rem 0.8rem", borderRadius: 99, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer",
              background: filterAgent === a ? "rgba(129,140,248,0.15)" : "var(--surface)",
              border: `1px solid ${filterAgent === a ? "rgba(129,140,248,0.4)" : "var(--border)"}`,
              color: filterAgent === a ? "#818cf8" : "var(--text-2)",
            }}>{a}</button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ textAlign: "center", color: "var(--text-3)", padding: "5rem" }}>Loading…</div>
      ) : followUps.length === 0 ? (
        <div style={{ textAlign: "center", padding: "5rem 2rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎉</div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-1)", marginBottom: "0.4rem" }}>All caught up!</div>
          <div style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>No follow-ups due right now.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {STATUS_ORDER.map(statusKey => {
            const items = grouped[statusKey];
            if (items.length === 0) return null;
            const col = STATUS_COLOR[statusKey];
            const lbl = STATUS_LABEL[statusKey];
            return (
              <div key={statusKey}>
                {/* Group header */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.65rem" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: col, flexShrink: 0 }} />
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: col }}>{lbl}</span>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>— {items.length} lead{items.length !== 1 ? "s" : ""}</span>
                  <div style={{ flex: 1, height: 1, background: `${col}25` }} />
                </div>

                {/* Cards */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                  {items.map((p, i) => {
                    const stageInfo = STAGES.find(s => s.key === p.status);
                    const lbl = followUpLabel(p);
                    const dueDate = followUpDueDate(p);
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: "flex", alignItems: "center", gap: "1rem",
                          padding: "0.9rem 1.1rem",
                          borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none",
                          borderLeft: `3px solid ${col}`,
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}
                      >
                        {/* Avatar */}
                        <div style={{
                          width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                          background: `${col}20`, border: `1.5px solid ${col}40`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "0.75rem", fontWeight: 800, color: col,
                        }}>
                          {p.business_name.slice(0, 2).toUpperCase()}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.business_name}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                            {p.assigned_to && (
                              <span style={{ fontSize: "0.72rem", color: "#818cf8", display: "flex", alignItems: "center", gap: "0.2rem" }}>
                                <UserCircle2 size={11} /> {p.assigned_to}
                              </span>
                            )}
                            {stageInfo && (
                              <span style={{ fontSize: "0.68rem", fontWeight: 700, color: stageInfo.color, background: stageInfo.bg, border: `1px solid ${stageInfo.border}`, borderRadius: 5, padding: "0.1rem 0.4rem" }}>
                                {stageInfo.label}
                              </span>
                            )}
                            {p.phone && (
                              <a href={`tel:${p.phone}`} style={{ fontSize: "0.72rem", color: "var(--text-3)", display: "flex", alignItems: "center", gap: "0.2rem", textDecoration: "none" }}>
                                <Phone size={10} /> {p.phone}
                              </a>
                            )}
                            {p.email && (
                              <a href={`mailto:${p.email}`} style={{ fontSize: "0.72rem", color: "var(--text-3)", display: "flex", alignItems: "center", gap: "0.2rem", textDecoration: "none" }}>
                                <Mail size={10} /> {p.email}
                              </a>
                            )}
                          </div>
                          {p.notes && (
                            <div style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: "0.3rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {p.notes}
                            </div>
                          )}
                        </div>

                        {/* Due date */}
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.8rem", fontWeight: 700, color: col, justifyContent: "flex-end" }}>
                            <CalendarClock size={13} /> {lbl}
                          </div>
                          <div style={{ fontSize: "0.68rem", color: "var(--text-3)", marginTop: "0.15rem" }}>{dueDate}</div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                          <button
                            onClick={() => snooze(p)}
                            title="Snooze 5 days"
                            style={{
                              padding: "0.35rem 0.65rem", borderRadius: 8, cursor: "pointer",
                              background: "var(--surface-2)", border: "1px solid var(--border-2)",
                              fontSize: "0.72rem", fontWeight: 700, color: "var(--text-2)",
                              transition: "all 0.12s",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-3)"; e.currentTarget.style.color = "var(--text-1)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "var(--surface-2)"; e.currentTarget.style.color = "var(--text-2)"; }}
                          >+5d</button>
                          <button
                            onClick={() => markDone(p)}
                            title="Mark as followed up"
                            style={{
                              padding: "0.35rem 0.65rem", borderRadius: 8, cursor: "pointer",
                              background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)",
                              fontSize: "0.72rem", fontWeight: 700, color: "#34d399",
                              display: "flex", alignItems: "center", gap: "0.3rem",
                              transition: "all 0.12s",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "rgba(52,211,153,0.15)"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "rgba(52,211,153,0.08)"; }}
                          ><CheckCheck size={12} /> Done</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
