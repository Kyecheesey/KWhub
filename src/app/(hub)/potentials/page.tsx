"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Download, Search, Pencil, Trash2, X,
  Phone, Mail, ChevronRight, UserCircle2, PhoneCall, PhoneOff,
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
  const [filterStatus, setFilterStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [loading, setLoading] = useState(true);

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

  function openAdd() { setEditId(null); setForm(BLANK); setShowForm(true); }
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
    await fetch(`/api/potentials/${p.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...p, status }) });
    load();
  }

  async function toggleCall(p: Potential) {
    if (callSet.has(p.id)) {
      await fetch("/api/call-list", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ record_type: "potential", record_id: p.id }) });
    } else {
      await fetch("/api/call-list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ record_type: "potential", record_id: p.id }) });
    }
    load();
  }

  const filtered = potentials.filter((p) => {
    const matchSearch = p.business_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.contact_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.assigned_to ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const stageOf = (key: string) => STAGES.find((s) => s.key === key) ?? STAGES[0];
  const countOf = (key: string) => potentials.filter((p) => p.status === key).length;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#818cf8", marginBottom: "0.35rem" }}>KW | Innovations</p>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>Potentials</h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginTop: "0.3rem" }}>
            {loading ? "Loading…" : `${potentials.length} in pipeline · ${callSet.size} on call list`}
          </p>
        </div>
        <div className="page-header-actions">
          <a href="/api/potentials/export" className="btn-ghost"><Download size={14} /> Export CSV</a>
          <button onClick={openAdd} className="btn-primary"><Plus size={15} /> Add Potential</button>
        </div>
      </div>

      {/* Stage pills */}
      <div className="stage-pills">
        <button onClick={() => setFilterStatus("all")} style={{ padding: "0.4rem 1rem", borderRadius: 99, fontSize: "0.8rem", fontWeight: 600, background: filterStatus === "all" ? "var(--surface-3)" : "var(--surface)", border: `1px solid ${filterStatus === "all" ? "var(--border-2)" : "var(--border)"}`, color: filterStatus === "all" ? "var(--text-1)" : "var(--text-2)", cursor: "pointer" }}>
          All <span style={{ opacity: 0.5 }}>({potentials.length})</span>
        </button>
        {STAGES.map(({ key, label, color, bg, border }) => (
          <button key={key} onClick={() => setFilterStatus(filterStatus === key ? "all" : key)} style={{ padding: "0.4rem 1rem", borderRadius: 99, fontSize: "0.8rem", fontWeight: 600, background: filterStatus === key ? bg : "var(--surface)", border: `1px solid ${filterStatus === key ? border : "var(--border)"}`, color: filterStatus === key ? color : "var(--text-2)", cursor: "pointer", transition: "all 0.15s" }}>
            {label} <span style={{ opacity: 0.6 }}>({countOf(key)})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="search-wrap">
        <Search size={15} />
        <input className="field" placeholder="Search by business, contact or assignee…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Cards */}
      {loading ? (
        <div style={{ textAlign: "center", color: "var(--text-3)", padding: "3rem" }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "4rem", textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎯</div>
          <p style={{ color: "var(--text-2)", fontWeight: 600, marginBottom: "0.35rem" }}>No potentials yet</p>
          <p style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>Start tracking your pipeline</p>
        </div>
      ) : (
        <div className="card-grid">
          {filtered.map((p) => {
            const stage = stageOf(p.status);
            const onCall = callSet.has(p.id);
            return (
              <div key={p.id} style={{ background: "var(--surface)", border: `1px solid ${onCall ? "rgba(34,211,238,0.2)" : "var(--border)"}`, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column", transition: "border-color 0.15s, transform 0.15s" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
              >
                {/* Stage bar */}
                <div style={{ height: 3, background: stage.color, opacity: 0.8 }} />

                <div style={{ padding: "1.1rem 1.1rem 0.75rem", flex: 1 }}>
                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.6rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                      <div className="avatar" style={{ background: stage.bg, color: stage.color, fontSize: "0.7rem", width: "2rem", height: "2rem" }}>
                        {initials(p.business_name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "0.9rem" }}>{p.business_name}</div>
                        {p.contact_name && <div style={{ fontSize: "0.75rem", color: "var(--text-2)" }}>{p.contact_name}</div>}
                      </div>
                    </div>
                    <span className="badge" style={{ background: stage.bg, borderColor: stage.border, color: stage.color }}>{stage.label}</span>
                  </div>

                  {/* Contact info */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "0.6rem" }}>
                    {p.phone && (
                      <a href={`tel:${p.phone}`} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "var(--text-3)", textDecoration: "none" }}>
                        <Phone size={11} /> {p.phone}
                      </a>
                    )}
                    {p.email && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "var(--text-3)" }}>
                        <Mail size={11} /> {p.email}
                      </div>
                    )}
                    {p.assigned_to && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "#818cf8" }}>
                        <UserCircle2 size={11} /> {p.assigned_to}
                      </div>
                    )}
                  </div>

                  {p.notes && (
                    <p style={{ fontSize: "0.78rem", color: "var(--text-3)", lineHeight: 1.5, borderTop: "1px solid var(--border)", paddingTop: "0.65rem", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {p.notes}
                    </p>
                  )}
                </div>

                {/* Move stage */}
                <div style={{ borderTop: "1px solid var(--border)", padding: "0.6rem 0.75rem" }}>
                  <p style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)", marginBottom: "0.4rem" }}>Move to</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                    {STAGES.filter((s) => s.key !== p.status).slice(0, 4).map(({ key, label, color }) => (
                      <button key={key} onClick={() => moveStage(p, key)} style={{ fontSize: "0.7rem", fontWeight: 600, color, background: "transparent", border: `1px solid ${color}30`, borderRadius: 6, padding: "0.2rem 0.5rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.2rem", transition: "background 0.12s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = `${color}12`)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {label} <ChevronRight size={9} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ borderTop: "1px solid var(--border)", padding: "0.6rem 0.75rem", display: "flex", gap: "0.5rem" }}>
                  <button onClick={() => openEdit(p)} className="btn-ghost" style={{ flex: 1, justifyContent: "center", padding: "0.4rem", fontSize: "0.8rem" }}>
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    onClick={() => toggleCall(p)}
                    title={onCall ? "Remove from call list" : "Add to call list"}
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0.4rem 0.6rem", borderRadius: 8, border: "none", cursor: "pointer", background: onCall ? "rgba(34,211,238,0.12)" : "var(--surface-2)", color: onCall ? "var(--accent)" : "var(--text-3)", transition: "all 0.15s" }}
                  >
                    {onCall ? <PhoneCall size={14} /> : <PhoneOff size={14} />}
                  </button>
                  <button onClick={() => remove(p.id)} className="btn-danger" style={{ padding: "0.4rem 0.65rem" }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--text-3)" }}>{filtered.length} of {potentials.length} potential{potentials.length !== 1 ? "s" : ""}</p>

      {/* Modal */}
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
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>Status</label>
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
                  <input className="field" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} placeholder="Enter name (add team in Team Hub)" />
                )}
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>Notes</label>
                <textarea className="field" rows={4} style={{ resize: "vertical" }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Conversation notes, next steps, context…" />
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
