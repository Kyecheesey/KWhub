"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus, Download, Search, Pencil, Trash2, X,
  Phone, Mail, UserCircle2, PhoneCall, PhoneOff,
  Upload, LayoutGrid, List,
} from "lucide-react";

interface Potential {
  id: number;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}
interface TeamMember { id: number; name: string; role: string | null; }

const STAGES = [
  { key: "new",       label: "New",          color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.2)"  },
  { key: "contacted", label: "Contacted",     color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.2)"  },
  { key: "qualified", label: "Qualified",     color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.2)" },
  { key: "proposal",  label: "Proposal Sent", color: "#fb923c", bg: "rgba(251,146,60,0.1)",  border: "rgba(251,146,60,0.2)"  },
  { key: "won",       label: "Won",           color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.2)"  },
  { key: "lost",      label: "Lost",          color: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.2)" },
];

type Form = { business_name: string; contact_name: string; phone: string; email: string; notes: string; status: string; assigned_to: string };
const BLANK: Form = { business_name: "", contact_name: "", phone: "", email: "", notes: "", status: "new", assigned_to: "" };

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default function PotentialsPage() {
  const [potentials, setPotentials] = useState<Potential[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [callSet, setCallSet] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [filterAgent, setFilterAgent] = useState("all");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag state
  const dragId = useRef<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [pr, tr, clr] = await Promise.all([
      fetch("/api/potentials").then((r) => r.json()),
      fetch("/api/team").then((r) => r.json()),
      fetch("/api/call-list").then((r) => r.json()),
    ]);
    setPotentials(pr);
    setTeam(tr);
    const onList = new Set<number>(
      (clr as { record_type: string; record_id: number }[])
        .filter((e) => e.record_type === "potential")
        .map((e) => e.record_id)
    );
    setCallSet(onList);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd(defaultStatus = "new") {
    setEditId(null);
    setForm({ ...BLANK, status: defaultStatus });
    setShowForm(true);
  }
  function openEdit(p: Potential) {
    setEditId(p.id);
    setForm({ business_name: p.business_name, contact_name: p.contact_name ?? "", phone: p.phone ?? "", email: p.email ?? "", notes: p.notes ?? "", status: p.status, assigned_to: p.assigned_to ?? "" });
    setShowForm(true);
  }

  async function save() {
    if (!form.business_name.trim()) return;
    const url = editId ? `/api/potentials/${editId}` : "/api/potentials";
    await fetch(url, { method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowForm(false); load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this potential?")) return;
    await fetch(`/api/potentials/${id}`, { method: "DELETE" });
    load();
  }

  async function moveStage(p: Potential, status: string) {
    // Optimistic update
    setPotentials((prev) => prev.map((x) => x.id === p.id ? { ...x, status } : x));
    await fetch(`/api/potentials/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, status }),
    });
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/potentials/import", { method: "POST", body: fd });
    const data = await res.json();
    if (data.error) {
      setImportMsg({ text: data.error, ok: false });
    } else {
      setImportMsg({ text: `Imported ${data.imported} potential${data.imported !== 1 ? "s" : ""}${data.skipped ? ` · ${data.skipped} skipped` : ""}`, ok: true });
      load();
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function toggleCall(p: Potential) {
    if (callSet.has(p.id)) {
      await fetch("/api/call-list", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ record_type: "potential", record_id: p.id }) });
    } else {
      await fetch("/api/call-list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ record_type: "potential", record_id: p.id }) });
    }
    load();
  }

  // Drag handlers
  function onDragStart(id: number) { dragId.current = id; }
  function onDragEnd() { dragId.current = null; setDragOverCol(null); }
  function onDragOver(e: React.DragEvent, stageKey: string) {
    e.preventDefault();
    setDragOverCol(stageKey);
  }
  async function onDrop(e: React.DragEvent, stageKey: string) {
    e.preventDefault();
    setDragOverCol(null);
    if (dragId.current == null) return;
    const p = potentials.find((x) => x.id === dragId.current);
    if (!p || p.status === stageKey) return;
    await moveStage(p, stageKey);
    dragId.current = null;
  }

  const agents = Array.from(new Set(potentials.map((p) => p.assigned_to).filter(Boolean))) as string[];
  const unassignedCount = potentials.filter((p) => !p.assigned_to).length;

  const filtered = potentials.filter((p) => {
    const matchSearch = !search ||
      p.business_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.contact_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.assigned_to ?? "").toLowerCase().includes(search.toLowerCase());
    const matchAgent = filterAgent === "all" ? true
      : filterAgent === "unassigned" ? !p.assigned_to
      : p.assigned_to === filterAgent;
    return matchSearch && matchAgent;
  });

  const stageOf = (key: string) => STAGES.find((s) => s.key === key) ?? STAGES[0];

  return (
    <div style={{ padding: "2rem 2rem 2rem", maxWidth: view === "kanban" ? "none" : 1100, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#818cf8", marginBottom: "0.35rem" }}>KW | Innovations</p>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>Potentials</h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginTop: "0.3rem" }}>
            {loading ? "Loading…" : `${potentials.length} in pipeline · ${callSet.size} on call list`}
          </p>
        </div>
        <div className="page-header-actions">
          {/* View toggle */}
          <div style={{ display: "flex", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <button onClick={() => setView("kanban")} style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.5rem 0.85rem", border: "none", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, background: view === "kanban" ? "var(--surface-3)" : "transparent", color: view === "kanban" ? "var(--text-1)" : "var(--text-3)", transition: "all 0.15s" }}>
              <LayoutGrid size={14} /> Kanban
            </button>
            <button onClick={() => setView("list")} style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.5rem 0.85rem", border: "none", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, background: view === "list" ? "var(--surface-3)" : "transparent", color: view === "list" ? "var(--text-1)" : "var(--text-3)", transition: "all 0.15s" }}>
              <List size={14} /> List
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleImport} />
          <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="btn-ghost">
            <Upload size={14} /> {importing ? "Importing…" : "Import"}
          </button>
          <a href="/api/potentials/export" className="btn-ghost"><Download size={14} /> Export</a>
          <button onClick={() => openAdd()} className="btn-primary"><Plus size={15} /> Add Potential</button>
        </div>
      </div>

      {importMsg && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderRadius: 12, marginBottom: "1.25rem", background: importMsg.ok ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)", border: `1px solid ${importMsg.ok ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`, color: importMsg.ok ? "#34d399" : "#f87171", fontSize: "0.85rem", fontWeight: 500 }}>
          {importMsg.text}
          <button onClick={() => setImportMsg(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", opacity: 0.6 }}><X size={14} /></button>
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1.25rem" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: "0.8rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }} />
          <input className="field" style={{ paddingLeft: "2.2rem" }} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {/* Agent filter */}
        {agents.length > 0 && (
          <div className="stage-pills" style={{ marginBottom: 0 }}>
            <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)", alignSelf: "center", whiteSpace: "nowrap" }}>Agent:</span>
            <button onClick={() => setFilterAgent("all")} style={{ padding: "0.3rem 0.75rem", borderRadius: 99, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", background: filterAgent === "all" ? "var(--surface-3)" : "var(--surface)", border: `1px solid ${filterAgent === "all" ? "var(--border-2)" : "var(--border)"}`, color: filterAgent === "all" ? "var(--text-1)" : "var(--text-2)", whiteSpace: "nowrap" }}>All</button>
            {agents.map((agent) => (
              <button key={agent} onClick={() => setFilterAgent(filterAgent === agent ? "all" : agent)} style={{ padding: "0.3rem 0.75rem", borderRadius: 99, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", background: filterAgent === agent ? "rgba(129,140,248,0.15)" : "var(--surface)", border: `1px solid ${filterAgent === agent ? "rgba(129,140,248,0.35)" : "var(--border)"}`, color: filterAgent === agent ? "#818cf8" : "var(--text-2)", whiteSpace: "nowrap" }}>
                {agent}
              </button>
            ))}
            {unassignedCount > 0 && (
              <button onClick={() => setFilterAgent(filterAgent === "unassigned" ? "all" : "unassigned")} style={{ padding: "0.3rem 0.75rem", borderRadius: 99, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", background: filterAgent === "unassigned" ? "rgba(74,82,114,0.3)" : "var(--surface)", border: `1px solid ${filterAgent === "unassigned" ? "var(--border-2)" : "var(--border)"}`, color: filterAgent === "unassigned" ? "var(--text-1)" : "var(--text-3)", whiteSpace: "nowrap" }}>
                Unassigned
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "var(--text-3)", padding: "4rem" }}>Loading…</div>
      ) : view === "kanban" ? (

        /* ══════════════════════════════════════════
           KANBAN VIEW
        ══════════════════════════════════════════ */
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(220px, 1fr))",
          gap: "0.75rem",
          overflowX: "auto",
          paddingBottom: "1rem",
        }}>
          {STAGES.map((stage) => {
            const cards = filtered.filter((p) => p.status === stage.key);
            const isDragTarget = dragOverCol === stage.key;
            return (
              <div
                key={stage.key}
                onDragOver={(e) => onDragOver(e, stage.key)}
                onDrop={(e) => onDrop(e, stage.key)}
                onDragLeave={() => setDragOverCol(null)}
                style={{
                  display: "flex", flexDirection: "column", gap: "0.5rem",
                  background: isDragTarget ? `${stage.color}08` : "transparent",
                  border: `2px dashed ${isDragTarget ? stage.color : "transparent"}`,
                  borderRadius: 14,
                  padding: "0.5rem",
                  transition: "all 0.15s",
                  minHeight: 200,
                }}
              >
                {/* Column header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.25rem 0.25rem 0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: stage.color, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--text-1)" }}>{stage.label}</span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: stage.color, background: `${stage.color}18`, border: `1px solid ${stage.color}30`, padding: "0.1rem 0.45rem", borderRadius: 99 }}>{cards.length}</span>
                  </div>
                  <button onClick={() => openAdd(stage.key)} title={`Add to ${stage.label}`} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex", padding: "0.2rem", borderRadius: 6, lineHeight: 1 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = stage.color)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Cards */}
                {cards.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: "0.75rem", padding: "1.5rem 0", opacity: 0.5 }}>
                    Drop here
                  </div>
                ) : (
                  cards.map((p) => {
                    const onCall = callSet.has(p.id);
                    return (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={() => onDragStart(p.id)}
                        onDragEnd={onDragEnd}
                        style={{
                          background: "var(--surface)",
                          border: `1px solid ${onCall ? "rgba(34,211,238,0.25)" : "var(--border)"}`,
                          borderRadius: 12,
                          overflow: "hidden",
                          cursor: "grab",
                          userSelect: "none",
                          transition: "box-shadow 0.15s, transform 0.15s",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                      >
                        {/* Stage stripe */}
                        <div style={{ height: 3, background: stage.color }} />
                        <div style={{ padding: "0.75rem" }}>
                          {/* Business + avatar */}
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: stage.bg, color: stage.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 800, flexShrink: 0 }}>
                              {initials(p.business_name)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 800, fontSize: "0.82rem", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.business_name}</div>
                              {p.contact_name && <div style={{ fontSize: "0.72rem", color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.contact_name}</div>}
                            </div>
                          </div>

                          {/* Contact */}
                          {p.phone && (
                            <a href={`tel:${p.phone}`} onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.72rem", color: "var(--accent)", textDecoration: "none", marginBottom: "0.25rem" }}>
                              <Phone size={10} /> {p.phone}
                            </a>
                          )}
                          {p.assigned_to && (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.72rem", color: "#818cf8", marginBottom: "0.25rem" }}>
                              <UserCircle2 size={10} /> {p.assigned_to}
                            </div>
                          )}
                          {p.notes && (
                            <p style={{ fontSize: "0.7rem", color: "var(--text-3)", lineHeight: 1.4, margin: "0.4rem 0 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                              {p.notes}
                            </p>
                          )}

                          {/* Date stamp */}
                          <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.66rem", color: "var(--text-3)", marginTop: "0.45rem", opacity: 0.7 }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            {new Date(p.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                          </div>

                          {/* Actions */}
                          <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.65rem", paddingTop: "0.6rem", borderTop: "1px solid var(--border)" }}>
                            <button onClick={() => openEdit(p)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "0.3rem 0.5rem", cursor: "pointer", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-2)" }}>
                              <Pencil size={10} /> Edit
                            </button>
                            <button onClick={() => toggleCall(p)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, borderRadius: 6, border: "none", cursor: "pointer", background: onCall ? "rgba(34,211,238,0.12)" : "var(--surface-2)", color: onCall ? "var(--accent)" : "var(--text-3)" }}>
                              {onCall ? <PhoneCall size={11} /> : <PhoneOff size={11} />}
                            </button>
                            <button onClick={() => remove(p.id)} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, borderRadius: 6, border: "1px solid rgba(248,113,113,0.2)", cursor: "pointer", background: "rgba(248,113,113,0.06)", color: "#f87171" }}>
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

        /* ══════════════════════════════════════════
           LIST VIEW
        ══════════════════════════════════════════ */
        filtered.length === 0 ? (
          <div style={{ padding: "4rem", textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎯</div>
            <p style={{ color: "var(--text-2)", fontWeight: 600 }}>No potentials found</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {STAGES.map((stage) => {
              const cards = filtered.filter((p) => p.status === stage.key);
              if (cards.length === 0) return null;
              return (
                <div key={stage.key}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 0 0.4rem" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: stage.color }} />
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: stage.color }}>{stage.label}</span>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>{cards.length}</span>
                  </div>
                  {cards.map((p) => {
                    const onCall = callSet.has(p.id);
                    return (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "var(--surface)", border: `1px solid ${onCall ? "rgba(34,211,238,0.2)" : "var(--border)"}`, borderRadius: 12, padding: "0.8rem 1rem", marginBottom: "0.4rem" }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: stage.bg, color: stage.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 800, flexShrink: 0 }}>
                          {initials(p.business_name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: "0.88rem" }}>{p.business_name}</div>
                          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.2rem" }}>
                            {p.contact_name && <span style={{ fontSize: "0.75rem", color: "var(--text-2)" }}>{p.contact_name}</span>}
                            {p.phone && <a href={`tel:${p.phone}`} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--accent)", textDecoration: "none" }}><Phone size={10} />{p.phone}</a>}
                            {p.email && <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--text-3)" }}><Mail size={10} />{p.email}</span>}
                            {p.assigned_to && <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "#818cf8" }}><UserCircle2 size={10} />{p.assigned_to}</span>}
                            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.72rem", color: "var(--text-3)", opacity: 0.7 }}>
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                              {new Date(p.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                          {STAGES.filter((s) => s.key !== p.status).slice(0, 2).map((s) => (
                            <button key={s.key} onClick={() => moveStage(p, s.key)} style={{ fontSize: "0.68rem", fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 6, padding: "0.2rem 0.5rem", cursor: "pointer", whiteSpace: "nowrap" }}>→ {s.label}</button>
                          ))}
                          <button onClick={() => openEdit(p)} className="btn-ghost" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}><Pencil size={11} /></button>
                          <button onClick={() => toggleCall(p)} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0.3rem 0.5rem", borderRadius: 8, border: "none", cursor: "pointer", background: onCall ? "rgba(34,211,238,0.12)" : "var(--surface-2)", color: onCall ? "var(--accent)" : "var(--text-3)" }}>
                            {onCall ? <PhoneCall size={13} /> : <PhoneOff size={13} />}
                          </button>
                          <button onClick={() => remove(p.id)} className="btn-danger" style={{ padding: "0.3rem 0.5rem" }}><Trash2 size={11} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )
      )}

      <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--text-3)" }}>{filtered.length} of {potentials.length} potential{potentials.length !== 1 ? "s" : ""}</p>

      {/* ── Modal ── */}
      {showForm && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.15rem", margin: 0 }}>{editId ? "Edit Potential" : "Add Potential"}</h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost" style={{ padding: "0.4rem" }}><X size={16} /></button>
            </div>
            <div style={{ display: "grid", gap: "1rem" }}>
              {([["business_name", "Business Name", true], ["contact_name", "Contact Name", false], ["phone", "Phone", false], ["email", "Email", false]] as const).map(([key, label, required]) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>
                    {label}{required && <span style={{ color: "#818cf8", marginLeft: 2 }}>*</span>}
                  </label>
                  <input className="field" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={label} />
                </div>
              ))}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>Stage</label>
                <select className="field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STAGES.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>Assign To</label>
                {team.length > 0 ? (
                  <select className="field" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                    <option value="">— Unassigned —</option>
                    {team.map((m) => <option key={m.id} value={m.name}>{m.name}{m.role ? ` (${m.role})` : ""}</option>)}
                  </select>
                ) : (
                  <input className="field" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} placeholder="Enter name" />
                )}
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>Notes</label>
                <textarea className="field" rows={3} style={{ resize: "vertical" }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Conversation notes, next steps…" />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
              <button onClick={save} className="btn-primary" style={{ flex: 1, justifyContent: "center", background: "linear-gradient(135deg, #818cf8, #6366f1)" }}>
                {editId ? "Save Changes" : "Add Potential"}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
