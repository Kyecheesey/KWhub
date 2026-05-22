"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus, X, Pencil, Trash2, Flag, Calendar,
  UserCircle2, Tag, CheckCircle2,
} from "lucide-react";

interface Activity {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  due_date: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS = [
  { key: "todo",        label: "To Do",       color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.2)"  },
  { key: "in_progress", label: "In Progress",  color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.2)"  },
  { key: "in_review",   label: "In Review",    color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.2)" },
  { key: "done",        label: "Done",         color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.2)"  },
];

const PRIORITIES = [
  { key: "low",    label: "Low",    color: "#60a5fa" },
  { key: "medium", label: "Medium", color: "#fbbf24" },
  { key: "high",   label: "High",   color: "#f87171" },
];

const TEAM = ["Kye", "Luka", "Aksel"];

type Form = {
  title: string; description: string; status: string;
  priority: string; assigned_to: string; due_date: string; tags: string;
};
const BLANK: Form = { title: "", description: "", status: "todo", priority: "medium", assigned_to: "", due_date: "", tags: "" };

function priorityOf(key: string) { return PRIORITIES.find((p) => p.key === key) ?? PRIORITIES[1]; }
function columnOf(key: string)   { return COLUMNS.find((c) => c.key === key) ?? COLUMNS[0]; }

function isOverdue(due_date: string | null) {
  if (!due_date) return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}

function formatDate(due_date: string | null) {
  if (!due_date) return null;
  return new Date(due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [filterAgent, setFilterAgent] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");

  // Drag state
  const dragId = useRef<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await fetch("/api/activities").then((r) => r.json());
    setActivities(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd(defaultStatus = "todo") {
    setEditId(null);
    setForm({ ...BLANK, status: defaultStatus });
    setShowForm(true);
  }

  function openEdit(a: Activity) {
    setEditId(a.id);
    setForm({
      title: a.title, description: a.description ?? "",
      status: a.status, priority: a.priority,
      assigned_to: a.assigned_to ?? "",
      due_date: a.due_date ? a.due_date.slice(0, 10) : "",
      tags: a.tags ?? "",
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.title.trim()) return;
    const url = editId ? `/api/activities/${editId}` : "/api/activities";
    await fetch(url, {
      method: editId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowForm(false);
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this activity?")) return;
    await fetch(`/api/activities/${id}`, { method: "DELETE" });
    load();
  }

  async function moveStatus(a: Activity, status: string) {
    setActivities((prev) => prev.map((x) => x.id === a.id ? { ...x, status } : x));
    await fetch(`/api/activities/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  // Drag handlers
  function onDragStart(id: number) { dragId.current = id; }
  function onDragEnd() { dragId.current = null; setDragOverCol(null); }
  function onDragOver(e: React.DragEvent, col: string) { e.preventDefault(); setDragOverCol(col); }
  async function onDrop(e: React.DragEvent, col: string) {
    e.preventDefault(); setDragOverCol(null);
    if (dragId.current == null) return;
    const a = activities.find((x) => x.id === dragId.current);
    if (!a || a.status === col) return;
    await moveStatus(a, col);
    dragId.current = null;
  }

  const agents = Array.from(new Set(activities.map((a) => a.assigned_to).filter(Boolean))) as string[];

  const filtered = activities.filter((a) => {
    const matchAgent = filterAgent === "all" ? true
      : filterAgent === "unassigned" ? !a.assigned_to
      : a.assigned_to === filterAgent;
    const matchPriority = filterPriority === "all" || a.priority === filterPriority;
    return matchAgent && matchPriority;
  });

  const totalDone = activities.filter((a) => a.status === "done").length;
  const totalOverdue = activities.filter((a) => isOverdue(a.due_date) && a.status !== "done").length;

  return (
    <div style={{ padding: "2rem", maxWidth: "none" }}>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a78bfa", marginBottom: "0.35rem" }}>KW | Innovations</p>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>Activities</h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginTop: "0.3rem" }}>
            {loading ? "Loading…" : `${activities.length} activities · ${totalDone} done${totalOverdue ? ` · ${totalOverdue} overdue` : ""}`}
          </p>
        </div>
        <div className="page-header-actions">
          <button onClick={() => openAdd()} className="btn-primary">
            <Plus size={15} /> New Activity
          </button>
        </div>
      </div>

      {/* ── Stats row ── */}
      {!loading && (
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {COLUMNS.map((col) => {
            const count = activities.filter((a) => a.status === col.key).length;
            return (
              <div key={col.key} style={{ background: "var(--surface)", border: `1px solid ${col.border}`, borderRadius: 12, padding: "0.75rem 1.1rem", display: "flex", alignItems: "center", gap: "0.6rem", flex: "1 1 120px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--text-1)", lineHeight: 1 }}>{count}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-3)", fontWeight: 600 }}>{col.label}</div>
                </div>
              </div>
            );
          })}
          {totalOverdue > 0 && (
            <div style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 12, padding: "0.75rem 1.1rem", display: "flex", alignItems: "center", gap: "0.6rem", flex: "1 1 120px" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f87171", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#f87171", lineHeight: 1 }}>{totalOverdue}</div>
                <div style={{ fontSize: "0.7rem", color: "#f87171", fontWeight: 600, opacity: 0.7 }}>Overdue</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1.25rem" }}>
        {/* Agent */}
        {agents.length > 0 && (
          <div className="stage-pills" style={{ marginBottom: 0 }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)", alignSelf: "center", whiteSpace: "nowrap" }}>Assignee:</span>
            {["all", ...agents, ...(activities.some((a) => !a.assigned_to) ? ["unassigned"] : [])].map((agent) => (
              <button key={agent} onClick={() => setFilterAgent(agent)} style={{ padding: "0.3rem 0.75rem", borderRadius: 99, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", background: filterAgent === agent ? "rgba(167,139,250,0.15)" : "var(--surface)", border: `1px solid ${filterAgent === agent ? "rgba(167,139,250,0.35)" : "var(--border)"}`, color: filterAgent === agent ? "#a78bfa" : "var(--text-2)", whiteSpace: "nowrap", textTransform: "capitalize" }}>
                {agent === "all" ? `All (${activities.length})` : agent}
              </button>
            ))}
          </div>
        )}
        {/* Priority */}
        <div className="stage-pills" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)", alignSelf: "center", whiteSpace: "nowrap" }}>Priority:</span>
          {[{ key: "all", label: "All", color: "var(--text-2)" }, ...PRIORITIES].map((p) => (
            <button key={p.key} onClick={() => setFilterPriority(p.key)} style={{ padding: "0.3rem 0.75rem", borderRadius: 99, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", background: filterPriority === p.key ? `${p.color}20` : "var(--surface)", border: `1px solid ${filterPriority === p.key ? `${p.color}40` : "var(--border)"}`, color: filterPriority === p.key ? p.color : "var(--text-2)", whiteSpace: "nowrap" }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Kanban Board ── */}
      {loading ? (
        <div style={{ textAlign: "center", color: "var(--text-3)", padding: "4rem" }}>Loading…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(240px, 1fr))", gap: "0.75rem", overflowX: "auto", paddingBottom: "1rem" }}>
          {COLUMNS.map((col) => {
            const cards = filtered.filter((a) => a.status === col.key);
            const isDragTarget = dragOverCol === col.key;
            return (
              <div
                key={col.key}
                onDragOver={(e) => onDragOver(e, col.key)}
                onDrop={(e) => onDrop(e, col.key)}
                onDragLeave={() => setDragOverCol(null)}
                style={{
                  display: "flex", flexDirection: "column", gap: "0.5rem",
                  background: isDragTarget ? `${col.color}08` : "transparent",
                  border: `2px dashed ${isDragTarget ? col.color : "transparent"}`,
                  borderRadius: 14, padding: "0.5rem",
                  transition: "all 0.15s", minHeight: 300,
                }}
              >
                {/* Column header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.25rem 0.25rem 0.6rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text-1)" }}>{col.label}</span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: col.color, background: `${col.color}18`, border: `1px solid ${col.color}30`, padding: "0.1rem 0.45rem", borderRadius: 99 }}>{cards.length}</span>
                  </div>
                  <button onClick={() => openAdd(col.key)} title={`Add to ${col.label}`} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex", padding: "0.2rem", borderRadius: 6 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = col.color)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Cards */}
                {cards.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: "0.75rem", padding: "2rem 0", gap: "0.5rem", opacity: 0.4, cursor: "pointer" }} onClick={() => openAdd(col.key)}>
                    <Plus size={18} />
                    <span>Add activity</span>
                  </div>
                ) : (
                  cards.map((a) => {
                    const pri = priorityOf(a.priority);
                    const overdue = isOverdue(a.due_date) && a.status !== "done";
                    const done = a.status === "done";
                    const tagList = a.tags ? a.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
                    return (
                      <div
                        key={a.id}
                        draggable
                        onDragStart={() => onDragStart(a.id)}
                        onDragEnd={onDragEnd}
                        style={{
                          background: "var(--surface)",
                          border: `1px solid ${overdue ? "rgba(248,113,113,0.3)" : "var(--border)"}`,
                          borderRadius: 12, overflow: "hidden",
                          cursor: "grab", userSelect: "none",
                          opacity: done ? 0.65 : 1,
                          transition: "box-shadow 0.15s, transform 0.15s",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                      >
                        {/* Priority stripe */}
                        <div style={{ height: 3, background: pri.color }} />

                        <div style={{ padding: "0.8rem" }}>
                          {/* Title row */}
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.4rem", marginBottom: "0.4rem" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.4rem", flex: 1, minWidth: 0 }}>
                              {done && <CheckCircle2 size={13} style={{ color: "#34d399", flexShrink: 0, marginTop: 2 }} />}
                              <span style={{ fontWeight: 700, fontSize: "0.85rem", lineHeight: 1.35, textDecoration: done ? "line-through" : "none", color: done ? "var(--text-3)" : "var(--text-1)" }}>
                                {a.title}
                              </span>
                            </div>
                            {/* Priority badge */}
                            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: pri.color, background: `${pri.color}18`, border: `1px solid ${pri.color}30`, padding: "0.1rem 0.4rem", borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0 }}>
                              {pri.label}
                            </span>
                          </div>

                          {/* Description */}
                          {a.description && (
                            <p style={{ fontSize: "0.75rem", color: "var(--text-3)", lineHeight: 1.5, marginBottom: "0.5rem", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {a.description}
                            </p>
                          )}

                          {/* Meta */}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: tagList.length ? "0.5rem" : 0 }}>
                            {a.assigned_to && (
                              <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.7rem", color: "#818cf8" }}>
                                <UserCircle2 size={10} /> {a.assigned_to}
                              </span>
                            )}
                            {a.due_date && (
                              <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.7rem", color: overdue ? "#f87171" : "var(--text-3)", fontWeight: overdue ? 700 : 400 }}>
                                <Calendar size={10} /> {formatDate(a.due_date)}{overdue ? " ⚠" : ""}
                              </span>
                            )}
                          </div>

                          {/* Tags */}
                          {tagList.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.5rem" }}>
                              {tagList.map((tag) => (
                                <span key={tag} style={{ display: "flex", alignItems: "center", gap: "0.2rem", fontSize: "0.65rem", fontWeight: 600, color: "#a78bfa", background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.2)", padding: "0.1rem 0.45rem", borderRadius: 99 }}>
                                  <Tag size={8} /> {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Actions */}
                          <div style={{ display: "flex", gap: "0.35rem", paddingTop: "0.6rem", borderTop: "1px solid var(--border)" }}>
                            {/* Quick status move */}
                            {COLUMNS.filter((c) => c.key !== a.status).slice(0, 1).map((c) => (
                              <button key={c.key} onClick={() => moveStatus(a, c.key)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 6, padding: "0.3rem 0.4rem", cursor: "pointer", fontSize: "0.68rem", fontWeight: 700, color: c.color, whiteSpace: "nowrap" }}>
                                → {c.label}
                              </button>
                            ))}
                            <button onClick={() => openEdit(a)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--text-3)" }}>
                              <Pencil size={11} />
                            </button>
                            <button onClick={() => remove(a.id)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6, cursor: "pointer", color: "#f87171" }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal ── */}
      {showForm && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.15rem", margin: 0 }}>{editId ? "Edit Activity" : "New Activity"}</h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost" style={{ padding: "0.4rem" }}><X size={16} /></button>
            </div>
            <div style={{ display: "grid", gap: "1rem" }}>
              {/* Title */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>
                  Title <span style={{ color: "#a78bfa" }}>*</span>
                </label>
                <input className="field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs to be done?" autoFocus />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>Description</label>
                <textarea className="field" rows={3} style={{ resize: "vertical" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="More detail, context, steps…" />
              </div>

              {/* Status + Priority row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>Status</label>
                  <select className="field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {COLUMNS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>
                    <Flag size={11} style={{ display: "inline", marginRight: 4 }} />Priority
                  </label>
                  <select className="field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    {PRIORITIES.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </div>
              </div>

              {/* Assignee + Due date row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>
                    <UserCircle2 size={11} style={{ display: "inline", marginRight: 4 }} />Assign To
                  </label>
                  <select className="field" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                    <option value="">— Unassigned —</option>
                    {TEAM.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>
                    <Calendar size={11} style={{ display: "inline", marginRight: 4 }} />Due Date
                  </label>
                  <input type="date" className="field" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>
                  <Tag size={11} style={{ display: "inline", marginRight: 4 }} />Tags <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(comma separated)</span>
                </label>
                <input className="field" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="e.g. follow-up, proposal, urgent" />
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
              <button onClick={save} className="btn-primary" style={{ flex: 1, justifyContent: "center", background: "linear-gradient(135deg, #a78bfa, #7c3aed)" }}>
                {editId ? "Save Changes" : "Create Activity"}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
