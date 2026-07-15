"use client";

import { useState, useEffect, useRef } from "react";
import { Trash2, Plus, Check, RefreshCw, PhoneCall, ClipboardList, TrendingUp, AlertCircle, ScrollText } from "lucide-react";

/* ─── types ─── */
interface Task   { id: number; title: string; status: string; priority: string; assigned_to: string; due_date?: string; }
interface Pot    { id: number; business_name: string; status: string; assigned_to?: string; }
interface Call   { id: number; called: boolean; }
interface Item   { id: number; text: string; done: boolean; }
interface EventRow {
  id: number; entity_type: string; entity_id: number | null; entity_name: string | null;
  actor: string | null; action: string; detail: string | null; created_at: string;
}

const ENTITY_LABEL: Record<string,string> = { client: "Client", potential: "Potential", task: "Task", activity: "Activity" };
const ENTITY_COLOR: Record<string,string> = { client: "#22d3ee", potential: "#818cf8", task: "#fb923c", activity: "#34d399" };
const ACTION_LABEL: Record<string,string> = {
  created: "Created", updated: "Updated", deleted: "Deleted",
  stage_changed: "Stage changed", status_changed: "Status changed",
  reassigned: "Reassigned", contacted: "Contacted",
};

function auditTime(iso: string) {
  return new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/* ─── Audit log section ─── */
function AuditLog() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterActor, setFilterActor] = useState("all");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/events?limit=150")
      .then(r => r.json())
      .then(data => { if (!cancelled) { setEvents(Array.isArray(data) ? data : []); setLoaded(true); } });
    return () => { cancelled = true; };
  }, []);

  const actors = Array.from(new Set(events.map(e => e.actor).filter(Boolean))) as string[];
  const filtered = events.filter(e =>
    (filterType === "all" || e.entity_type === filterType) &&
    (filterActor === "all" || e.actor === filterActor)
  );

  const pillStyle = (active: boolean, color = "var(--text-1)") => ({
    padding: "0.25rem 0.7rem", borderRadius: 99, fontSize: "0.75rem", fontWeight: 600 as const,
    cursor: "pointer", whiteSpace: "nowrap" as const,
    background: active ? "var(--surface-3)" : "var(--surface)",
    border: `1px solid ${active ? "var(--border-3)" : "var(--border)"}`,
    color: active ? color : "var(--text-3)",
  });

  return (
    <>
      <h2 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <ScrollText size={14} /> Audit Log
      </h2>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", marginBottom: "1.5rem" }}>
        {/* Filters */}
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => setFilterType("all")} style={pillStyle(filterType === "all")}>All types</button>
          {Object.entries(ENTITY_LABEL).map(([key, label]) => (
            <button key={key} onClick={() => setFilterType(filterType === key ? "all" : key)} style={pillStyle(filterType === key, ENTITY_COLOR[key])}>
              {label}s
            </button>
          ))}
          {actors.length > 1 && (
            <>
              <span style={{ width: 1, height: 18, background: "var(--border-2)", margin: "0 0.3rem" }} />
              <button onClick={() => setFilterActor("all")} style={pillStyle(filterActor === "all")}>Everyone</button>
              {actors.map(a => (
                <button key={a} onClick={() => setFilterActor(filterActor === a ? "all" : a)} style={pillStyle(filterActor === a)}>
                  {a}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Rows */}
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {!loaded ? (
            <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-3)", fontSize: "0.85rem" }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-3)", fontSize: "0.85rem" }}>
              No events yet — changes across the hub will appear here.
            </div>
          ) : filtered.map(ev => (
            <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: "0.7rem", padding: "0.6rem 1rem", borderBottom: "1px solid var(--border)" }}>
              <span style={{
                fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                color: ENTITY_COLOR[ev.entity_type] ?? "var(--text-3)",
                background: `${ENTITY_COLOR[ev.entity_type] ?? "#8b95c0"}14`,
                border: `1px solid ${ENTITY_COLOR[ev.entity_type] ?? "#8b95c0"}30`,
                padding: "0.12rem 0.45rem", borderRadius: 5, flexShrink: 0, width: 72, textAlign: "center",
              }}>
                {ENTITY_LABEL[ev.entity_type] ?? ev.entity_type}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-1)" }}>
                  {ev.entity_name ?? `#${ev.entity_id ?? "?"}`}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-2)" }}>
                  {" "}— {ACTION_LABEL[ev.action] ?? ev.action}{ev.detail ? `: ${ev.detail}` : ""}
                </span>
              </div>
              <span style={{ fontSize: "0.72rem", color: "var(--text-3)", flexShrink: 0 }}>
                {ev.actor ? `${ev.actor} · ` : ""}{auditTime(ev.created_at)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

const TEAM = ["Kye", "Luka", "Aksel"];
const STAGES = ["new","contacted","qualified","proposal","won","lost"];
const STAGE_LABEL: Record<string,string> = {
  new:"New", contacted:"Contacted", qualified:"Qualified",
  proposal:"Proposal", won:"Won", lost:"Lost",
};
const STAGE_COLOR: Record<string,string> = {
  new:"#60a5fa", contacted:"#fbbf24", qualified:"#a78bfa",
  proposal:"#fb923c", won:"#34d399", lost:"#f87171",
};

function greet() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function ManagementPage() {
  const [tasks,     setTasks]     = useState<Task[]>([]);
  const [pots,      setPots]      = useState<Pot[]>([]);
  const [calls,     setCalls]     = useState<Call[]>([]);
  const [checklist, setChecklist] = useState<Item[]>([]);
  const [newItem,   setNewItem]   = useState("");
  const [loading,   setLoading]   = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  function load() {
    return Promise.all([
      fetch("/api/tasks").then(r => r.json()),
      fetch("/api/potentials").then(r => r.json()),
      fetch("/api/call-list").then(r => r.json()),
      fetch("/api/checklist").then(r => r.json()),
    ]).then(([t, p, c, ch]) => {
      setTasks(Array.isArray(t) ? t : []);
      setPots(Array.isArray(p) ? p : []);
      setCalls(Array.isArray(c) ? c : []);
      setChecklist(Array.isArray(ch) ? ch : []);
      setLoading(false);
    });
  }

  function refresh() {
    setLoading(true);
    load();
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/tasks").then(r => r.json()),
      fetch("/api/potentials").then(r => r.json()),
      fetch("/api/call-list").then(r => r.json()),
      fetch("/api/checklist").then(r => r.json()),
    ]).then(([t, p, c, ch]) => {
      setTasks(Array.isArray(t) ? t : []);
      setPots(Array.isArray(p) ? p : []);
      setCalls(Array.isArray(c) ? c : []);
      setChecklist(Array.isArray(ch) ? ch : []);
      setLoading(false);
    });
  }, []);

  /* ─── checklist actions ─── */
  async function addItem() {
    const text = newItem.trim();
    if (!text) return;
    const res = await fetch("/api/checklist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    const item = await res.json();
    setChecklist(prev => [...prev, item]);
    setNewItem("");
    inputRef.current?.focus();
  }

  async function toggleItem(item: Item) {
    setChecklist(prev => prev.map(i => i.id === item.id ? { ...i, done: !i.done } : i));
    await fetch(`/api/checklist/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: !item.done }) });
  }

  async function deleteItem(id: number) {
    setChecklist(prev => prev.filter(i => i.id !== id));
    await fetch(`/api/checklist/${id}`, { method: "DELETE" });
  }

  /* ─── derived stats ─── */
  const now = new Date();
  function teamStats(name: string) {
    const myTasks = tasks.filter(t => t.assigned_to?.toLowerCase() === name.toLowerCase());
    const open     = myTasks.filter(t => t.status !== "done").length;
    const done     = myTasks.filter(t => t.status === "done").length;
    const overdue  = myTasks.filter(t => t.status !== "done" && t.due_date && new Date(t.due_date) < now).length;
    const myPots   = pots.filter(p => p.assigned_to?.toLowerCase() === name.toLowerCase()).length;
    return { open, done, overdue, myPots };
  }

  const totalOpen    = tasks.filter(t => t.status !== "done").length;
  const totalDone    = tasks.filter(t => t.status === "done").length;
  const totalPending = calls.filter((c: Call) => !c.called).length;
  const totalClosed  = pots.filter(p => p.status === "won").length;

  const stageCount = STAGES.map(s => ({ stage: s, count: pots.filter(p => p.status === s).length }));
  const maxStage   = Math.max(...stageCount.map(s => s.count), 1);

  const doneItems  = checklist.filter(i => i.done).length;

  return (
    <div className="page">
      {/* ── Header ── */}
      <div className="page-header" style={{ marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-1)", margin: 0 }}>
            {greet()}, Kye 👋
          </h1>
          <p style={{ color: "var(--text-3)", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
            Here&apos;s your management overview
          </p>
        </div>
        <button onClick={refresh} disabled={loading} style={{
          display: "flex", alignItems: "center", gap: "0.4rem",
          padding: "0.5rem 0.9rem", borderRadius: 10, fontSize: "0.82rem", fontWeight: 600,
          background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-2)", cursor: "pointer",
        }}>
          <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* ── Top stats ── */}
      <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
        {[
          { label: "Open Tasks",      value: totalOpen,    icon: ClipboardList, color: "#22d3ee" },
          { label: "Tasks Done",      value: totalDone,    icon: Check,         color: "#34d399" },
          { label: "Calls Pending",   value: totalPending, icon: PhoneCall,     color: "#818cf8" },
          { label: "Deals Won",       value: totalClosed,  icon: TrendingUp,    color: "#fb923c" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem 1.15rem",
            display: "flex", flexDirection: "column", gap: "0.4rem",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
              <Icon size={15} color={color} />
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color, lineHeight: 1 }}>{loading ? "–" : value}</div>
          </div>
        ))}
      </div>

      {/* ── Team performance ── */}
      <h2 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.75rem" }}>
        Team Performance
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {TEAM.map(name => {
          const s = teamStats(name);
          const initials = name.slice(0, 2).toUpperCase();
          const gradients: Record<string,string> = { Kye: "#22d3ee,#0ea5e9", Luka: "#818cf8,#6366f1", Aksel: "#34d399,#059669" };
          const grad = gradients[name] || "#818cf8,#6366f1";
          return (
            <div key={name} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1.1rem 1.15rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "0.9rem" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg,${grad})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 800, color: "#0b0d14", flexShrink: 0 }}>{initials}</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)" }}>{name}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>{s.myPots} potentials assigned</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem", textAlign: "center" }}>
                {[
                  { label: "Open",   val: s.open,   col: "#22d3ee" },
                  { label: "Done",   val: s.done,   col: "#34d399" },
                  { label: "Overdue",val: s.overdue, col: s.overdue > 0 ? "#f87171" : "var(--text-3)" },
                ].map(({ label, val, col }) => (
                  <div key={label} style={{ background: "var(--surface-2)", borderRadius: 10, padding: "0.5rem 0.25rem" }}>
                    <div style={{ fontSize: "1.2rem", fontWeight: 900, color: col }}>{val}</div>
                    <div style={{ fontSize: "0.62rem", color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase" }}>{label}</div>
                  </div>
                ))}
              </div>
              {s.overdue > 0 && (
                <div style={{ marginTop: "0.65rem", display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: "#f87171", background: "rgba(248,113,113,0.1)", borderRadius: 8, padding: "0.35rem 0.6rem" }}>
                  <AlertCircle size={12} />
                  {s.overdue} overdue task{s.overdue > 1 ? "s" : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Pipeline funnel ── */}
      <h2 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.75rem" }}>
        Pipeline Overview
      </h2>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "1.15rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
          {stageCount.map(({ stage, count }) => (
            <div key={stage} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ width: 90, fontSize: "0.78rem", fontWeight: 600, color: "var(--text-2)", flexShrink: 0 }}>{STAGE_LABEL[stage]}</div>
              <div style={{ flex: 1, height: 22, background: "var(--surface-2)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{
                  width: count === 0 ? "0%" : `${Math.max((count / maxStage) * 100, 4)}%`,
                  height: "100%", background: STAGE_COLOR[stage],
                  borderRadius: 6, transition: "width 0.4s ease",
                  display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6,
                }}>
                  {count > 0 && <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#0b0d14" }}>{count}</span>}
                </div>
              </div>
              <div style={{ width: 28, textAlign: "right", fontSize: "0.82rem", fontWeight: 700, color: STAGE_COLOR[stage] }}>{count}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "0.85rem", paddingTop: "0.85rem", borderTop: "1px solid var(--border)", display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          <div style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>Total: <span style={{ fontWeight: 800, color: "var(--text-1)" }}>{pots.length}</span></div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>Won: <span style={{ fontWeight: 800, color: "#34d399" }}>{totalClosed}</span></div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>Active: <span style={{ fontWeight: 800, color: "#22d3ee" }}>{pots.filter(p => ["contacted","qualified","proposal"].includes(p.status)).length}</span></div>
        </div>
      </div>

      {/* ── Calendar (full width) ── */}
      <h2 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.75rem" }}>
        Calendar
      </h2>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
        overflow: "hidden", marginBottom: "1.5rem",
        boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
      }}>
        {/* Card header */}
        <div style={{
          padding: "1rem 1.25rem",
          background: "linear-gradient(135deg, rgba(34,211,238,0.08), rgba(129,140,248,0.08))",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: "linear-gradient(135deg,#22d3ee,#818cf8)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0b0d14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)" }}>My Calendar</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>Brisbane · Google Calendar</div>
            </div>
          </div>
          <a
            href="https://calendar.google.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "0.75rem", fontWeight: 600, color: "var(--text-3)",
              textDecoration: "none", padding: "0.3rem 0.7rem",
              background: "var(--surface-2)", border: "1px solid var(--border)",
              borderRadius: 8, display: "flex", alignItems: "center", gap: "0.3rem",
            }}
          >
            Open ↗
          </a>
        </div>

        {/* iframe wrapper with rounded clip */}
        <div style={{ position: "relative", background: "#fff", lineHeight: 0 }}>
          <iframe
            src="https://calendar.google.com/calendar/embed?height=800&wkst=1&ctz=Australia%2FBrisbane&showPrint=0&showTitle=0&showNav=1&showDate=1&showTabs=1&showCalendars=0&mode=WEEK&src=NTM1MTliY2RmYzBjNThkNjZmM2JkMDVhZDdkYjdjZjdhMjhmODQxODlkYmFiZjIwMDlkMGM0ODJkZDFkMDAyNkBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&src=ZW4tZ2IuYXVzdHJhbGlhbiNob2xpZGF5QGdyb3VwLnYuY2FsZW5kYXIuZ29vZ2xlLmNvbQ&color=%23795548&color=%230b8043"
            style={{
              width: "100%", height: 580, border: "none", display: "block",
            }}
            title="Google Calendar"
          />
        </div>
      </div>

      {/* ── Audit log ── */}
      <AuditLog />

      {/* ── Bottom row: checklist ── */}
      <h2 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.75rem" }}>
        My Checklist
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "start" }} className="mgmt-bottom-grid">

        {/* Checklist */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.15rem 0.75rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)" }}>Checklist</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>{doneItems}/{checklist.length} done</div>
            </div>
          </div>

          {/* Add item */}
          <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", display: "flex", gap: "0.5rem" }}>
            <input
              ref={inputRef}
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addItem()}
              placeholder="Add a task…"
              style={{
                flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "0.45rem 0.75rem", fontSize: "0.85rem",
                color: "var(--text-1)", outline: "none",
              }}
            />
            <button onClick={addItem} style={{
              background: "linear-gradient(135deg,#22d3ee,#0ea5e9)", border: "none",
              borderRadius: 8, padding: "0.45rem 0.7rem", cursor: "pointer",
              display: "flex", alignItems: "center", color: "#0b0d14",
            }}>
              <Plus size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* Items */}
          <div style={{ maxHeight: 340, overflowY: "auto" }}>
            {checklist.length === 0 && (
              <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-3)", fontSize: "0.85rem" }}>
                No items yet — add one above
              </div>
            )}
            {checklist.map(item => (
              <div key={item.id} style={{
                display: "flex", alignItems: "center", gap: "0.65rem",
                padding: "0.7rem 1rem", borderBottom: "1px solid var(--border)",
                opacity: item.done ? 0.55 : 1, transition: "opacity 0.2s",
              }}>
                <button onClick={() => toggleItem(item)} style={{
                  width: 20, height: 20, borderRadius: 6, flexShrink: 0, cursor: "pointer",
                  border: `2px solid ${item.done ? "#34d399" : "var(--border)"}`,
                  background: item.done ? "#34d399" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}>
                  {item.done && <Check size={11} color="#0b0d14" strokeWidth={3} />}
                </button>
                <span style={{
                  flex: 1, fontSize: "0.87rem", color: "var(--text-1)",
                  textDecoration: item.done ? "line-through" : "none",
                }}>
                  {item.text}
                </span>
                <button onClick={() => deleteItem(item.id)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-3)", padding: "0.2rem", borderRadius: 4,
                  display: "flex", opacity: 0.6,
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 767px) {
          .mgmt-bottom-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
