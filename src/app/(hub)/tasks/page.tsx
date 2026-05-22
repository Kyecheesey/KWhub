"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus, X, Pencil, Trash2, Flag, Calendar,
  UserCircle2, CheckCircle2, Circle, Clock,
  LayoutGrid, List, ChevronDown,
} from "lucide-react";
import { useSession } from "next-auth/react";

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string;
  assigned_by: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

const TEAM = ["Kye", "Luka", "Aksel"];

const PRIORITIES = [
  { key: "low",    label: "Low",    color: "#60a5fa", bg: "rgba(96,165,250,0.1)"  },
  { key: "medium", label: "Medium", color: "#fbbf24", bg: "rgba(251,191,36,0.1)"  },
  { key: "high",   label: "High",   color: "#f87171", bg: "rgba(248,113,113,0.1)" },
];

const STATUSES = [
  { key: "pending",     label: "Pending",     color: "#8892b0" },
  { key: "in_progress", label: "In Progress", color: "#fbbf24" },
  { key: "done",        label: "Done",        color: "#34d399" },
];

// Avatar colours per person
const AVATAR_COLORS: Record<string, { bg: string; color: string }> = {
  Kye:   { bg: "rgba(34,211,238,0.15)",  color: "#22d3ee"  },
  Luka:  { bg: "rgba(129,140,248,0.15)", color: "#818cf8"  },
  Aksel: { bg: "rgba(52,211,153,0.15)",  color: "#34d399"  },
};
function avatarStyle(name: string) {
  return AVATAR_COLORS[name] ?? { bg: "rgba(251,146,60,0.15)", color: "#fb923c" };
}

type Form = {
  title: string; description: string; status: string;
  priority: string; assigned_to: string; assigned_by: string; due_date: string;
};
const BLANK: Form = { title: "", description: "", status: "pending", priority: "medium", assigned_to: "", assigned_by: "", due_date: "" };

function isOverdue(due_date: string | null, status: string) {
  if (!due_date || status === "done") return false;
  return new Date(due_date) < new Date(new Date().toDateString());
}
function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
function daysUntil(d: string | null) {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return `Due in ${diff}d`;
}

function priorityOf(key: string) { return PRIORITIES.find((p) => p.key === key) ?? PRIORITIES[1]; }
function statusOf(key: string)   { return STATUSES.find((s) => s.key === key) ?? STATUSES[0]; }

export default function TasksPage() {
  const { data: session } = useSession();
  const currentUser = session?.user?.name ?? "";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [view, setView] = useState<"board" | "list">("board");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Drag-and-drop
  const dragId = useRef<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await fetch("/api/tasks").then((r) => r.json());
    setTasks(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd(defaultAssignee = "") {
    setEditId(null);
    setForm({ ...BLANK, assigned_to: defaultAssignee, assigned_by: currentUser });
    setShowForm(true);
  }

  function openEdit(t: Task) {
    setEditId(t.id);
    setForm({
      title: t.title, description: t.description ?? "",
      status: t.status, priority: t.priority,
      assigned_to: t.assigned_to, assigned_by: t.assigned_by ?? currentUser,
      due_date: t.due_date ? t.due_date.slice(0, 10) : "",
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.title.trim() || !form.assigned_to) return;
    const url = editId ? `/api/tasks/${editId}` : "/api/tasks";
    await fetch(url, {
      method: editId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, assigned_by: form.assigned_by || currentUser }),
    });
    setShowForm(false);
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    load();
  }

  async function toggleDone(t: Task) {
    const newStatus = t.status === "done" ? "pending" : "done";
    setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, status: newStatus } : x));
    await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  async function moveStatus(t: Task, status: string) {
    setTasks((prev) => prev.map((x) => x.id === t.id ? { ...x, status } : x));
    await fetch(`/api/tasks/${t.id}`, {
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
    const t = tasks.find((x) => x.id === dragId.current);
    if (!t || t.status === col) return;
    await moveStatus(t, col);
    dragId.current = null;
  }

  const filtered = tasks.filter((t) => {
    const matchAssignee = filterAssignee === "all" || t.assigned_to === filterAssignee;
    const matchPriority = filterPriority === "all" || t.priority === filterPriority;
    const matchStatus   = filterStatus === "all" || t.status === filterStatus;
    return matchAssignee && matchPriority && matchStatus;
  });

  const totalPending = tasks.filter((t) => t.status !== "done").length;
  const totalDone = tasks.filter((t) => t.status === "done").length;
  const totalOverdue = tasks.filter((t) => isOverdue(t.due_date, t.status)).length;

  return (
    <div style={{ padding: "2rem", maxWidth: "none" }}>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#22d3ee", marginBottom: "0.35rem" }}>KW | Innovations</p>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>Tasks</h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginTop: "0.3rem" }}>
            {loading ? "Loading…" : `${totalPending} open · ${totalDone} completed${totalOverdue ? ` · ${totalOverdue} overdue` : ""}`}
          </p>
        </div>
        <div className="page-header-actions">
          {/* View toggle */}
          <div style={{ display: "flex", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <button onClick={() => setView("board")} style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.5rem 0.85rem", border: "none", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, background: view === "board" ? "var(--surface-3)" : "transparent", color: view === "board" ? "var(--text-1)" : "var(--text-3)", transition: "all 0.15s" }}>
              <LayoutGrid size={14} /> Board
            </button>
            <button onClick={() => setView("list")} style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.5rem 0.85rem", border: "none", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, background: view === "list" ? "var(--surface-3)" : "transparent", color: view === "list" ? "var(--text-1)" : "var(--text-3)", transition: "all 0.15s" }}>
              <List size={14} /> List
            </button>
          </div>
          <button onClick={() => openAdd()} className="btn-primary">
            <Plus size={15} /> Assign Task
          </button>
        </div>
      </div>

      {/* ── Team Overview cards ── */}
      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {TEAM.map((member) => {
            const memberTasks = tasks.filter((t) => t.assigned_to === member);
            const done = memberTasks.filter((t) => t.status === "done").length;
            const open = memberTasks.filter((t) => t.status !== "done").length;
            const overdue = memberTasks.filter((t) => isOverdue(t.due_date, t.status)).length;
            const av = avatarStyle(member);
            return (
              <button
                key={member}
                onClick={() => setFilterAssignee(filterAssignee === member ? "all" : member)}
                style={{ background: filterAssignee === member ? av.bg : "var(--surface)", border: `1px solid ${filterAssignee === member ? av.color + "40" : "var(--border)"}`, borderRadius: 14, padding: "1rem", textAlign: "left", cursor: "pointer", transition: "all 0.15s" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: av.bg, color: av.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.82rem", fontWeight: 800, flexShrink: 0, border: `1px solid ${av.color}30` }}>
                    {member.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-1)" }}>{member}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>{memberTasks.length} task{memberTasks.length !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.68rem", fontWeight: 700, background: "rgba(96,165,250,0.1)", color: "#60a5fa", padding: "0.15rem 0.5rem", borderRadius: 99, border: "1px solid rgba(96,165,250,0.2)" }}>{open} open</span>
                  <span style={{ fontSize: "0.68rem", fontWeight: 700, background: "rgba(52,211,153,0.1)", color: "#34d399", padding: "0.15rem 0.5rem", borderRadius: 99, border: "1px solid rgba(52,211,153,0.2)" }}>{done} done</span>
                  {overdue > 0 && <span style={{ fontSize: "0.68rem", fontWeight: 700, background: "rgba(248,113,113,0.1)", color: "#f87171", padding: "0.15rem 0.5rem", borderRadius: 99, border: "1px solid rgba(248,113,113,0.2)" }}>⚠ {overdue}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem", alignItems: "center" }}>
        <div className="stage-pills" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)", alignSelf: "center", whiteSpace: "nowrap" }}>Status:</span>
          {[{ key: "all", label: "All" }, ...STATUSES].map((s) => (
            <button key={s.key} onClick={() => setFilterStatus(s.key)} style={{ padding: "0.3rem 0.75rem", borderRadius: 99, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", background: filterStatus === s.key ? "var(--surface-3)" : "var(--surface)", border: `1px solid ${filterStatus === s.key ? "var(--border-2)" : "var(--border)"}`, color: filterStatus === s.key ? "var(--text-1)" : "var(--text-2)", whiteSpace: "nowrap" }}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="stage-pills" style={{ marginBottom: 0 }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)", alignSelf: "center", whiteSpace: "nowrap" }}>Priority:</span>
          {[{ key: "all", label: "All", color: "var(--text-2)" }, ...PRIORITIES].map((p) => (
            <button key={p.key} onClick={() => setFilterPriority(p.key)} style={{ padding: "0.3rem 0.75rem", borderRadius: 99, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", background: filterPriority === p.key ? `${p.color}20` : "var(--surface)", border: `1px solid ${filterPriority === p.key ? `${p.color}40` : "var(--border)"}`, color: filterPriority === p.key ? p.color : "var(--text-2)", whiteSpace: "nowrap" }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "var(--text-3)", padding: "4rem" }}>Loading…</div>
      ) : view === "board" ? (

        /* ══════════════════════════════════════
           BOARD VIEW — columns by status
        ══════════════════════════════════════ */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(280px, 1fr))", gap: "0.75rem", overflowX: "auto", paddingBottom: "1rem" }}>
          {STATUSES.map((col) => {
            const cards = filtered.filter((t) => t.status === col.key);
            const isDragTarget = dragOverCol === col.key;
            return (
              <div
                key={col.key}
                onDragOver={(e) => onDragOver(e, col.key)}
                onDrop={(e) => onDrop(e, col.key)}
                onDragLeave={() => setDragOverCol(null)}
                style={{ display: "flex", flexDirection: "column", gap: "0.5rem", background: isDragTarget ? `${col.color}08` : "transparent", border: `2px dashed ${isDragTarget ? col.color : "transparent"}`, borderRadius: 14, padding: "0.5rem", transition: "all 0.15s", minHeight: 200 }}
              >
                {/* Column header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.25rem 0.25rem 0.6rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color }} />
                    <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text-1)" }}>{col.label}</span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: col.color, background: `${col.color}18`, border: `1px solid ${col.color}30`, padding: "0.1rem 0.45rem", borderRadius: 99 }}>{cards.length}</span>
                  </div>
                  <button onClick={() => openAdd()} title="Assign task" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex", padding: "0.2rem", borderRadius: 6 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = col.color)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {cards.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: "0.75rem", opacity: 0.4, padding: "1.5rem 0" }}>
                    Drop tasks here
                  </div>
                ) : (
                  cards.map((t) => {
                    const pri = priorityOf(t.priority);
                    const av = avatarStyle(t.assigned_to);
                    const overdue = isOverdue(t.due_date, t.status);
                    const done = t.status === "done";
                    const dueLabel = daysUntil(t.due_date);
                    return (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={() => onDragStart(t.id)}
                        onDragEnd={onDragEnd}
                        style={{ background: "var(--surface)", border: `1px solid ${overdue ? "rgba(248,113,113,0.3)" : "var(--border)"}`, borderRadius: 12, overflow: "hidden", cursor: "grab", userSelect: "none", opacity: done ? 0.6 : 1, transition: "box-shadow 0.15s, transform 0.15s" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                      >
                        {/* Priority stripe */}
                        <div style={{ height: 3, background: pri.color }} />
                        <div style={{ padding: "0.8rem" }}>
                          {/* Title */}
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            <button onClick={() => toggleDone(t)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, marginTop: 1, color: done ? "#34d399" : "var(--text-3)", display: "flex" }}>
                              {done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                            </button>
                            <span style={{ fontWeight: 700, fontSize: "0.85rem", lineHeight: 1.35, textDecoration: done ? "line-through" : "none", color: done ? "var(--text-3)" : "var(--text-1)" }}>
                              {t.title}
                            </span>
                          </div>

                          {t.description && (
                            <p style={{ fontSize: "0.75rem", color: "var(--text-3)", lineHeight: 1.5, marginBottom: "0.5rem", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {t.description}
                            </p>
                          )}

                          {/* Assignee row */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                              <div style={{ width: 22, height: 22, borderRadius: "50%", background: av.bg, color: av.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 800 }}>
                                {t.assigned_to.slice(0, 2).toUpperCase()}
                              </div>
                              <span style={{ fontSize: "0.72rem", fontWeight: 600, color: av.color }}>{t.assigned_to}</span>
                              {t.assigned_by && <span style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>← {t.assigned_by}</span>}
                            </div>
                            <span style={{ fontSize: "0.68rem", fontWeight: 700, color: pri.color, background: pri.bg, padding: "0.1rem 0.4rem", borderRadius: 99 }}>{pri.label}</span>
                          </div>

                          {/* Due date */}
                          {t.due_date && (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", color: overdue ? "#f87171" : "var(--text-3)", fontWeight: overdue ? 700 : 400, marginTop: "0.4rem" }}>
                              <Clock size={10} /> {dueLabel}
                            </div>
                          )}

                          {/* Actions */}
                          <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.65rem", paddingTop: "0.6rem", borderTop: "1px solid var(--border)" }}>
                            <button onClick={() => openEdit(t)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "0.3rem 0.5rem", cursor: "pointer", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-2)" }}>
                              <Pencil size={10} /> Edit
                            </button>
                            <button onClick={() => remove(t.id)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6, cursor: "pointer", color: "#f87171" }}>
                              <Trash2 size={10} />
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

      ) : (

        /* ══════════════════════════════════════
           LIST VIEW — grouped by assignee
        ══════════════════════════════════════ */
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {(filterAssignee === "all" ? TEAM : [filterAssignee]).map((member) => {
            const memberTasks = filtered.filter((t) => t.assigned_to === member);
            if (memberTasks.length === 0) return null;
            const av = avatarStyle(member);
            return (
              <div key={member}>
                {/* Member header */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem", paddingBottom: "0.6rem", borderBottom: `2px solid ${av.color}30` }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: av.bg, color: av.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 800, border: `1px solid ${av.color}30` }}>
                    {member.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text-1)" }}>{member}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-3)", marginLeft: "0.5rem" }}>{memberTasks.length} task{memberTasks.length !== 1 ? "s" : ""}</span>
                  </div>
                  <button onClick={() => openAdd(member)} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.3rem", background: av.bg, border: `1px solid ${av.color}30`, color: av.color, borderRadius: 8, padding: "0.35rem 0.75rem", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700 }}>
                    <Plus size={13} /> Assign Task
                  </button>
                </div>

                {/* Task rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {memberTasks.map((t) => {
                    const pri = priorityOf(t.priority);
                    const st = statusOf(t.status);
                    const overdue = isOverdue(t.due_date, t.status);
                    const done = t.status === "done";
                    return (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "var(--surface)", border: `1px solid ${overdue ? "rgba(248,113,113,0.25)" : done ? "var(--border)" : "var(--border-2)"}`, borderRadius: 12, padding: "0.75rem 1rem", opacity: done ? 0.65 : 1, transition: "background 0.15s" }}
                        onMouseEnter={(e) => { if (!done) (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface)"; }}
                      >
                        {/* Checkbox */}
                        <button onClick={() => toggleDone(t)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0, color: done ? "#34d399" : "var(--text-3)", display: "flex" }}>
                          {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                        </button>

                        {/* Priority dot */}
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: pri.color, flexShrink: 0 }} />

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.88rem", textDecoration: done ? "line-through" : "none", color: done ? "var(--text-3)" : "var(--text-1)", marginBottom: t.description ? "0.15rem" : 0 }}>
                            {t.title}
                          </div>
                          {t.description && (
                            <div style={{ fontSize: "0.75rem", color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>
                          )}
                        </div>

                        {/* Meta chips */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {t.assigned_by && (
                            <span style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>by {t.assigned_by}</span>
                          )}
                          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: pri.color, background: pri.bg, padding: "0.15rem 0.5rem", borderRadius: 99 }}>{pri.label}</span>
                          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: st.color, background: `${st.color}18`, padding: "0.15rem 0.5rem", borderRadius: 99 }}>{st.label}</span>
                          {t.due_date && (
                            <span style={{ fontSize: "0.68rem", fontWeight: overdue ? 700 : 400, color: overdue ? "#f87171" : "var(--text-3)", display: "flex", alignItems: "center", gap: "0.2rem" }}>
                              <Calendar size={9} /> {formatDate(t.due_date)}{overdue ? " ⚠" : ""}
                            </span>
                          )}
                          <button onClick={() => openEdit(t)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", color: "var(--text-3)" }}>
                            <Pencil size={11} />
                          </button>
                          <button onClick={() => remove(t.id)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6, cursor: "pointer", color: "#f87171" }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div style={{ padding: "4rem", textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
              <CheckCircle2 size={36} style={{ color: "var(--text-3)", margin: "0 auto 1rem" }} />
              <p style={{ color: "var(--text-2)", fontWeight: 600, marginBottom: "0.35rem" }}>No tasks found</p>
              <p style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>Assign a task to get started</p>
            </div>
          )}
        </div>
      )}

      {/* ── Modal ── */}
      {showForm && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.15rem", margin: 0 }}>{editId ? "Edit Task" : "Assign Task"}</h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost" style={{ padding: "0.4rem" }}><X size={16} /></button>
            </div>
            <div style={{ display: "grid", gap: "1rem" }}>

              {/* Title */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>Task <span style={{ color: "var(--accent)" }}>*</span></label>
                <input className="field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs to be done?" autoFocus />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>Details</label>
                <textarea className="field" rows={3} style={{ resize: "vertical" }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Steps, context, links…" />
              </div>

              {/* Assign to + Assign by */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>
                    <UserCircle2 size={11} style={{ display: "inline", marginRight: 4 }} />Assign To <span style={{ color: "var(--accent)" }}>*</span>
                  </label>
                  <select className="field" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                    <option value="">— Choose —</option>
                    {TEAM.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>Assigned By</label>
                  <select className="field" value={form.assigned_by} onChange={(e) => setForm({ ...form, assigned_by: e.target.value })}>
                    <option value="">— Choose —</option>
                    {TEAM.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>
              </div>

              {/* Priority + Status */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>
                    <Flag size={11} style={{ display: "inline", marginRight: 4 }} />Priority
                  </label>
                  <select className="field" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    {PRIORITIES.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>Status</label>
                  <select className="field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {STATUSES.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </div>
              </div>

              {/* Due date */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>
                  <Calendar size={11} style={{ display: "inline", marginRight: 4 }} />Due Date
                </label>
                <input type="date" className="field" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
              <button onClick={save} disabled={!form.title.trim() || !form.assigned_to} className="btn-primary" style={{ flex: 1, justifyContent: "center" }}>
                {editId ? "Save Changes" : "Assign Task"}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
