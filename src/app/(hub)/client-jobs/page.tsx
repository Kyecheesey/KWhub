"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus, X, Pencil, Trash2, Flag, Calendar,
  UserCircle2, CheckCircle2, Briefcase,
} from "lucide-react";

interface Client {
  id: number;
  business_name: string;
}

interface Job {
  id: number;
  client_id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS = [
  { key: "todo",        label: "To Do",       color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.2)"  },
  { key: "in_progress", label: "In Progress",  color: "#d97706", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.2)"  },
  { key: "in_review",   label: "In Review",    color: "#4f46e5", bg: "rgba(165,180,252,0.1)", border: "rgba(165,180,252,0.2)" },
  { key: "done",        label: "Done",         color: "#059669", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.2)"  },
];

const PRIORITIES = [
  { key: "low",    label: "Low",    color: "#60a5fa" },
  { key: "medium", label: "Medium", color: "#d97706" },
  { key: "high",   label: "High",   color: "#dc2626" },
];

const TEAM = ["Kye", "Luka", "Aksel", "Kaylie"];

type Form = {
  title: string; description: string; status: string;
  priority: string; assigned_to: string; due_date: string;
};
const BLANK: Form = { title: "", description: "", status: "todo", priority: "medium", assigned_to: "", due_date: "" };

function priorityOf(key: string) { return PRIORITIES.find((p) => p.key === key) ?? PRIORITIES[1]; }

function isOverdue(due_date: string | null) {
  if (!due_date) return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}

function formatDate(due_date: string | null) {
  if (!due_date) return null;
  return new Date(due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default function ClientJobsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<number | "all">("all");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formClientId, setFormClientId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(BLANK);

  const dragId = useRef<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const load = useCallback(() => {
    return Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/client-jobs").then((r) => r.json()),
    ]).then(([c, j]) => {
      setClients(Array.isArray(c) ? c : []);
      setJobs(Array.isArray(j) ? j : []);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const clientName = (id: number) => clients.find((c) => c.id === id)?.business_name ?? `Client #${id}`;

  function openAdd(defaultStatus = "todo") {
    setEditId(null);
    setFormClientId(selected === "all" ? (clients[0]?.id ?? null) : selected);
    setForm({ ...BLANK, status: defaultStatus });
    setShowForm(true);
  }

  function openEdit(j: Job) {
    setEditId(j.id);
    setFormClientId(j.client_id);
    setForm({
      title: j.title, description: j.description ?? "",
      status: j.status, priority: j.priority,
      assigned_to: j.assigned_to ?? "",
      due_date: j.due_date ? j.due_date.slice(0, 10) : "",
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.title.trim() || !formClientId) return;
    const url = editId ? `/api/client-jobs/${editId}` : "/api/client-jobs";
    await fetch(url, {
      method: editId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, client_id: formClientId }),
    });
    setShowForm(false);
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this job?")) return;
    await fetch(`/api/client-jobs/${id}`, { method: "DELETE" });
    load();
  }

  async function moveStatus(j: Job, status: string) {
    setJobs((prev) => prev.map((x) => x.id === j.id ? { ...x, status } : x));
    await fetch(`/api/client-jobs/${j.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  function onDragStart(id: number) { dragId.current = id; }
  function onDragEnd() { dragId.current = null; setDragOverCol(null); }
  function onDragOver(e: React.DragEvent, col: string) { e.preventDefault(); setDragOverCol(col); }
  async function onDrop(e: React.DragEvent, col: string) {
    e.preventDefault(); setDragOverCol(null);
    if (dragId.current == null) return;
    const j = jobs.find((x) => x.id === dragId.current);
    if (!j || j.status === col) return;
    await moveStatus(j, col);
    dragId.current = null;
  }

  const filtered = selected === "all" ? jobs : jobs.filter((j) => j.client_id === selected);
  const totalDone = filtered.filter((j) => j.status === "done").length;
  const totalOverdue = filtered.filter((j) => isOverdue(j.due_date) && j.status !== "done").length;
  const countFor = (id: number) => jobs.filter((j) => j.client_id === id && j.status !== "done").length;

  return (
    <div style={{ padding: "2rem", maxWidth: "none" }}>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4f46e5", marginBottom: "0.35rem" }}>KW | Innovations</p>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>Client Jobs</h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginTop: "0.3rem" }}>
            {loading ? "Loading…" : `${filtered.length} jobs · ${totalDone} done${totalOverdue ? ` · ${totalOverdue} overdue` : ""}`}
          </p>
        </div>
        <div className="page-header-actions">
          <button onClick={() => openAdd()} className="btn-primary" disabled={clients.length === 0}>
            <Plus size={15} /> New Job
          </button>
        </div>
      </div>

      {/* ── Client selector ── */}
      {!loading && (
        <div className="stage-pills" style={{ marginBottom: "1.25rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)", alignSelf: "center", whiteSpace: "nowrap" }}>Client:</span>
          <button onClick={() => setSelected("all")} style={{ padding: "0.35rem 0.85rem", borderRadius: 99, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", background: selected === "all" ? "rgba(165,180,252,0.15)" : "var(--surface)", border: `1px solid ${selected === "all" ? "rgba(165,180,252,0.35)" : "var(--border)"}`, color: selected === "all" ? "#4f46e5" : "var(--text-2)", whiteSpace: "nowrap" }}>
            All clients ({jobs.length})
          </button>
          {clients.map((c) => {
            const active = selected === c.id;
            const open = countFor(c.id);
            return (
              <button key={c.id} onClick={() => setSelected(c.id)} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.35rem 0.85rem", borderRadius: 99, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", background: active ? "rgba(165,180,252,0.15)" : "var(--surface)", border: `1px solid ${active ? "rgba(165,180,252,0.35)" : "var(--border)"}`, color: active ? "#4f46e5" : "var(--text-2)", whiteSpace: "nowrap" }}>
                <Briefcase size={11} /> {c.business_name}
                {open > 0 && (
                  <span style={{ fontSize: "0.65rem", fontWeight: 700, background: active ? "rgba(79,70,229,0.15)" : "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 99, padding: "0 0.35rem" }}>{open}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Kanban Board ── */}
      {loading ? (
        <div style={{ textAlign: "center", color: "var(--text-3)", padding: "4rem" }}>Loading…</div>
      ) : clients.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-3)", padding: "4rem" }}>No clients yet — add clients first, then track their jobs here.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(240px, 1fr))", gap: "0.75rem", overflowX: "auto", paddingBottom: "1rem" }}>
          {COLUMNS.map((col) => {
            const cards = filtered.filter((j) => j.status === col.key);
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
                    <span>Add job</span>
                  </div>
                ) : (
                  cards.map((j) => {
                    const pri = priorityOf(j.priority);
                    const overdue = isOverdue(j.due_date) && j.status !== "done";
                    const done = j.status === "done";
                    return (
                      <div
                        key={j.id}
                        draggable
                        onDragStart={() => onDragStart(j.id)}
                        onDragEnd={onDragEnd}
                        style={{
                          background: "var(--surface)",
                          border: `1px solid ${overdue ? "rgba(248,113,113,0.3)" : "var(--border)"}`,
                          borderRadius: 12, overflow: "hidden",
                          cursor: "grab", userSelect: "none",
                          opacity: done ? 0.65 : 1,
                          transition: "box-shadow 0.15s, transform 0.15s",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(23,42,94,0.12)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                      >
                        {/* Priority stripe */}
                        <div style={{ height: 3, background: pri.color }} />

                        <div style={{ padding: "0.8rem" }}>
                          {/* Client chip (only in All view) */}
                          {selected === "all" && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.62rem", fontWeight: 700, color: "#4f46e5", background: "rgba(165,180,252,0.1)", border: "1px solid rgba(165,180,252,0.2)", padding: "0.1rem 0.45rem", borderRadius: 99, marginBottom: "0.4rem" }}>
                              <Briefcase size={8} /> {clientName(j.client_id)}
                            </span>
                          )}

                          {/* Title row */}
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.4rem", marginBottom: "0.4rem" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.4rem", flex: 1, minWidth: 0 }}>
                              {done && <CheckCircle2 size={13} style={{ color: "#059669", flexShrink: 0, marginTop: 2 }} />}
                              <span style={{ fontWeight: 700, fontSize: "0.85rem", lineHeight: 1.35, textDecoration: done ? "line-through" : "none", color: done ? "var(--text-3)" : "var(--text-1)" }}>
                                {j.title}
                              </span>
                            </div>
                            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: pri.color, background: `${pri.color}18`, border: `1px solid ${pri.color}30`, padding: "0.1rem 0.4rem", borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0 }}>
                              {pri.label}
                            </span>
                          </div>

                          {/* Description */}
                          {j.description && (
                            <p style={{ fontSize: "0.75rem", color: "var(--text-3)", lineHeight: 1.5, marginBottom: "0.5rem", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {j.description}
                            </p>
                          )}

                          {/* Meta */}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                            {j.assigned_to && (
                              <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.7rem", color: "#4f46e5" }}>
                                <UserCircle2 size={10} /> {j.assigned_to}
                              </span>
                            )}
                            {j.due_date && (
                              <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.7rem", color: overdue ? "#dc2626" : "var(--text-3)", fontWeight: overdue ? 700 : 400 }}>
                                <Calendar size={10} /> {formatDate(j.due_date)}{overdue ? " ⚠" : ""}
                              </span>
                            )}
                          </div>

                          {/* Actions */}
                          <div style={{ display: "flex", gap: "0.35rem", paddingTop: "0.6rem", marginTop: "0.6rem", borderTop: "1px solid var(--border)" }}>
                            {COLUMNS.filter((c) => c.key !== j.status).slice(0, 1).map((c) => (
                              <button key={c.key} onClick={() => moveStatus(j, c.key)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 6, padding: "0.3rem 0.4rem", cursor: "pointer", fontSize: "0.68rem", fontWeight: 700, color: c.color, whiteSpace: "nowrap" }}>
                                → {c.label}
                              </button>
                            ))}
                            <button onClick={() => openEdit(j)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--text-3)" }}>
                              <Pencil size={11} />
                            </button>
                            <button onClick={() => remove(j.id)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, background: "rgba(248,113,113,0.06)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 6, cursor: "pointer", color: "#dc2626" }}>
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
              <h2 style={{ fontWeight: 800, fontSize: "1.15rem", margin: 0 }}>{editId ? "Edit Job" : "New Job"}</h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost" style={{ padding: "0.4rem" }}><X size={16} /></button>
            </div>
            <div style={{ display: "grid", gap: "1rem" }}>
              {/* Client */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>
                  <Briefcase size={11} style={{ display: "inline", marginRight: 4 }} />Client <span style={{ color: "#4f46e5" }}>*</span>
                </label>
                <select className="field" value={formClientId ?? ""} onChange={(e) => setFormClientId(Number(e.target.value) || null)}>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
                </select>
              </div>

              {/* Title */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>
                  Title <span style={{ color: "#4f46e5" }}>*</span>
                </label>
                <input className="field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs doing for this client?" autoFocus />
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
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
              <button onClick={save} className="btn-primary" style={{ flex: 1, justifyContent: "center", background: "linear-gradient(135deg, #4f46e5, #4f46e5)" }}>
                {editId ? "Save Changes" : "Create Job"}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
