"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Download, Globe, Search, Pencil, Trash2, X, RefreshCw,
  Phone, UserCircle2, PhoneCall, PhoneOff,
} from "lucide-react";
import RecordTimeline from "@/components/RecordTimeline";
import { findDuplicateGroups, matchReasons } from "@/lib/dupes";

interface Client {
  id: number;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  source: string;
  assigned_to: string | null;
  created_at: string;
}
interface TeamMember { id: number; name: string; role: string | null; }

type Form = {
  business_name: string; contact_name: string; phone: string;
  email: string; website: string; notes: string; assigned_to: string;
};
const BLANK: Form = { business_name: "", contact_name: "", phone: "", email: "", website: "", notes: "", assigned_to: "" };

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}
const COLORS = ["#22d3ee", "#818cf8", "#34d399", "#fb923c", "#f472b6", "#a78bfa"];
function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [callSet, setCallSet] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDupes, setShowDupes] = useState(false);

  const load = useCallback(() => {
    return Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/team").then((r) => r.json()),
      fetch("/api/call-list").then((r) => r.json()),
    ]).then(([cr, tr, clr]) => {
      setClients(cr);
      setTeam(tr);
      const onList = new Set<number>(
        (clr as { record_type: string; record_id: number }[])
          .filter((e) => e.record_type === "client")
          .map((e) => e.record_id)
      );
      setCallSet(onList);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Honor ?q= (from global search) and ?new=1 (from keyboard shortcut) on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const isNew = params.get("new") === "1";
    if (!q && !isNew) return;
    Promise.resolve().then(() => {
      if (q) setSearch(q);
      if (isNew) { setEditId(null); setForm(BLANK); setShowForm(true); }
    });
  }, []);

  // "n" keyboard shortcut fires this from LayoutShell
  useEffect(() => {
    const h = () => { setEditId(null); setForm(BLANK); setShowForm(true); };
    window.addEventListener("kw:new-record", h);
    return () => window.removeEventListener("kw:new-record", h);
  }, []);

  function openAdd() { setEditId(null); setForm(BLANK); setShowForm(true); }
  function openEdit(c: Client) {
    setEditId(c.id);
    setForm({
      business_name: c.business_name, contact_name: c.contact_name ?? "",
      phone: c.phone ?? "", email: c.email ?? "", website: c.website ?? "",
      notes: c.notes ?? "", assigned_to: c.assigned_to ?? "",
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.business_name.trim()) return;
    const url = editId ? `/api/clients/${editId}` : "/api/clients";
    await fetch(url, { method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setShowForm(false);
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this client?")) return;
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    load();
  }

  async function toggleCall(c: Client) {
    if (callSet.has(c.id)) {
      await fetch("/api/call-list", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ record_type: "client", record_id: c.id }) });
    } else {
      await fetch("/api/call-list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ record_type: "client", record_id: c.id }) });
    }
    load();
  }

  /* ── Bulk actions ── */
  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function bulkAssign(assignee: string | null) {
    setBulkBusy(true);
    await Promise.all(
      clients
        .filter((c) => selected.has(c.id))
        .map((c) => fetch(`/api/clients/${c.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...c, assigned_to: assignee }),
        }))
    );
    setSelected(new Set());
    setBulkBusy(false);
    load();
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selected.size} client${selected.size !== 1 ? "s" : ""}? This can't be undone.`)) return;
    setBulkBusy(true);
    await Promise.all(
      Array.from(selected).map((id) => fetch(`/api/clients/${id}`, { method: "DELETE" }))
    );
    setSelected(new Set());
    setBulkBusy(false);
    load();
  }

  async function scrape() {
    setScraping(true); setScrapeMsg(null);
    const res = await fetch("/api/clients/scrape", { method: "POST" });
    const data = await res.json();
    setScrapeMsg(
      data.error
        ? { text: data.error, ok: false }
        : data.imported > 0
        ? { text: `Imported ${data.imported} new client${data.imported !== 1 ? "s" : ""} from kwinnovations.com.au`, ok: true }
        : { text: data.message ?? "No new clients found — add manually.", ok: false }
    );
    setScraping(false);
    load();
  }

  const filtered = clients.filter(
    (c) =>
      c.business_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.assigned_to ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const dupeGroups = findDuplicateGroups(clients);

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: "0.35rem" }}>KW | Innovations</p>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>Current Clients</h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginTop: "0.3rem" }}>
            {loading ? "Loading…" : `${clients.length} client${clients.length !== 1 ? "s" : ""} · ${callSet.size} on call list`}
          </p>
        </div>
        <div className="page-header-actions">
          <button onClick={scrape} disabled={scraping} className="btn-ghost">
            <RefreshCw size={14} /> {scraping ? "Importing…" : "Import from Website"}
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page navigation */}
          <a href="/api/clients/export" className="btn-ghost"><Download size={14} /> Export CSV</a>
          <button onClick={openAdd} className="btn-primary"><Plus size={15} /> Add Client</button>
        </div>
      </div>

      {scrapeMsg && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0.75rem 1rem", borderRadius: 12, marginBottom: "1.25rem",
          background: scrapeMsg.ok ? "rgba(52,211,153,0.08)" : "rgba(251,146,60,0.08)",
          border: `1px solid ${scrapeMsg.ok ? "rgba(52,211,153,0.2)" : "rgba(251,146,60,0.2)"}`,
          color: scrapeMsg.ok ? "#34d399" : "#fb923c", fontSize: "0.85rem", fontWeight: 500,
        }}>
          {scrapeMsg.text}
          <button onClick={() => setScrapeMsg(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", opacity: 0.6 }}><X size={14} /></button>
        </div>
      )}

      {/* Search */}
      <div className="search-wrap">
        <Search size={15} />
        <input className="field" placeholder="Search by business, contact or assignee…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* ══ Duplicate detector ══ */}
      {!loading && dupeGroups.length > 0 && (
        <div style={{ marginBottom: "1.25rem", background: "var(--surface)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 14, overflow: "hidden" }}>
          <button
            onClick={() => setShowDupes(v => !v)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: "0.65rem",
              padding: "0.8rem 1rem", background: "rgba(251,191,36,0.06)",
              borderBottom: showDupes ? "1px solid rgba(251,191,36,0.2)" : "none",
              border: "none", cursor: "pointer", textAlign: "left",
            }}
          >
            <span style={{ fontSize: "1rem" }}>⚠️</span>
            <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#fbbf24", flex: 1 }}>
              {dupeGroups.length} possible duplicate{dupeGroups.length > 1 ? "s" : ""} detected
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-3)", fontWeight: 600 }}>
              {showDupes ? "Hide ▲" : "Review ▼"}
            </span>
          </button>

          {showDupes && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {dupeGroups.map((group, gi) => {
                const uniqueReasons = matchReasons(group);
                return (
                  <div key={gi} style={{ borderBottom: gi < dupeGroups.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ padding: "0.5rem 1rem 0.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-3)" }}>
                        Matched by:
                      </span>
                      {uniqueReasons.map(r => (
                        <span key={r} style={{ fontSize: "0.65rem", fontWeight: 700, background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 4, padding: "0.1rem 0.4rem", textTransform: "capitalize" }}>
                          {r}
                        </span>
                      ))}
                    </div>
                    {group.map((c, ci) => (
                      <div key={c.id} style={{
                        display: "flex", alignItems: "center", gap: "0.75rem",
                        padding: "0.65rem 1rem 0.65rem 1.5rem",
                        borderTop: ci > 0 ? "1px dashed var(--border)" : "none",
                        background: ci % 2 === 1 ? "rgba(255,255,255,0.015)" : "transparent",
                      }}>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 800, color: "var(--text-2)" }}>
                          {c.business_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.business_name}</div>
                          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.2rem" }}>
                            {c.email && <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>✉ {c.email}</span>}
                            {c.phone && <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>📞 {c.phone}</span>}
                            {c.assigned_to && <span style={{ fontSize: "0.7rem", color: "#818cf8" }}>👤 {c.assigned_to}</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                          <button onClick={() => openEdit(c)} style={{ padding: "0.3rem 0.6rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer", fontSize: "0.72rem", fontWeight: 600, color: "var(--text-2)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            <Pencil size={11} /> Edit
                          </button>
                          <button onClick={() => remove(c.id)} style={{ padding: "0.3rem 0.6rem", background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 7, cursor: "pointer", fontSize: "0.72rem", fontWeight: 600, color: "#f87171", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Desktop Table */}
      <div className="client-table-wrap">
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-3)" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "4rem", textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🏢</div>
            <p style={{ color: "var(--text-2)", fontWeight: 600, marginBottom: "0.35rem" }}>No clients yet</p>
            <p style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>Add one manually or import from kwinnovations.com.au</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((c) => selected.has(c.id))}
                    onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((c) => c.id)) : new Set())}
                    aria-label="Select all"
                    style={{ width: 15, height: 15, accentColor: "#2dd4e8", cursor: "pointer" }}
                  />
                </th>
                <th>Business</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Assigned To</th>
                <th>Notes</th>
                <th style={{ textAlign: "center" }}>Call List</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const color = colorFor(c.business_name);
                const onCall = callSet.has(c.id);
                return (
                  <tr key={c.id} style={selected.has(c.id) ? { background: "rgba(45,212,232,0.05)" } : onCall ? { background: "rgba(34,211,238,0.03)" } : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        aria-label={`Select ${c.business_name}`}
                        style={{ width: 15, height: 15, accentColor: "#2dd4e8", cursor: "pointer" }}
                      />
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div className="avatar" style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
                          {initials(c.business_name)}
                        </div>
                        <div>
                          {c.website ? (
                            <a href={c.website} target="_blank" rel="noopener" style={{ color: "var(--text-1)", fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                              {c.business_name} <Globe size={11} style={{ color: "var(--accent)", opacity: 0.7 }} />
                            </a>
                          ) : (
                            <span style={{ fontWeight: 700 }}>{c.business_name}</span>
                          )}
                          {c.source === "scraped" && <span style={{ fontSize: "0.65rem", color: "var(--text-3)" }}>Imported</span>}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: "var(--text-2)" }}>{c.contact_name ?? <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                    <td>
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--text-2)", textDecoration: "none", fontFamily: "var(--font-geist-mono)", fontSize: "0.82rem" }}>
                          <Phone size={11} style={{ color: "var(--accent)", opacity: 0.7 }} /> {c.phone}
                        </a>
                      ) : <span style={{ color: "var(--text-3)" }}>—</span>}
                    </td>
                    <td>
                      {c.assigned_to ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <UserCircle2 size={14} style={{ color: "#818cf8" }} />
                          <span style={{ fontSize: "0.82rem", color: "var(--text-2)" }}>{c.assigned_to}</span>
                        </div>
                      ) : <span style={{ color: "var(--text-3)", fontSize: "0.82rem" }}>Unassigned</span>}
                    </td>
                    <td style={{ color: "var(--text-3)", fontSize: "0.82rem", maxWidth: 160 }}>
                      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.notes ?? "—"}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        onClick={() => toggleCall(c)}
                        title={onCall ? "Remove from call list" : "Add to call list"}
                        style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 30, height: 30, borderRadius: 8, border: "none", cursor: "pointer",
                          background: onCall ? "rgba(34,211,238,0.12)" : "var(--surface-2)",
                          color: onCall ? "var(--accent)" : "var(--text-3)",
                          transition: "all 0.15s",
                        }}
                      >
                        {onCall ? <PhoneCall size={14} /> : <PhoneOff size={14} />}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                        <button onClick={() => openEdit(c)} className="btn-ghost" style={{ padding: "0.35rem 0.65rem", fontSize: "0.78rem" }}>
                          <Pencil size={12} /> Edit
                        </button>
                        <button onClick={() => remove(c.id)} className="btn-danger"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="client-cards">
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-3)" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🏢</div>
            <p style={{ color: "var(--text-2)", fontWeight: 600 }}>No clients yet</p>
          </div>
        ) : filtered.map((c) => {
          const color = colorFor(c.business_name);
          const onCall = callSet.has(c.id);
          return (
            <div key={c.id} style={{ background: "var(--surface)", border: `1px solid ${onCall ? "rgba(34,211,238,0.25)" : "var(--border)"}`, borderRadius: 14, padding: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div className="avatar" style={{ background: `${color}18`, color, border: `1px solid ${color}30`, width: 40, height: 40, fontSize: "0.85rem" }}>
                  {initials(c.business_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: "0.95rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.business_name}
                  </div>
                  {c.contact_name && <div style={{ fontSize: "0.8rem", color: "var(--text-2)" }}>{c.contact_name}</div>}
                </div>
                {c.assigned_to && (
                  <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "#818cf8", background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.2)", padding: "0.15rem 0.5rem", borderRadius: 99, whiteSpace: "nowrap" }}>
                    {c.assigned_to}
                  </span>
                )}
              </div>
              {c.phone && (
                <a href={`tel:${c.phone}`} style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--accent)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  <Phone size={14} /> {c.phone}
                </a>
              )}
              {c.notes && <p style={{ fontSize: "0.8rem", color: "var(--text-3)", marginBottom: "0.75rem", lineHeight: 1.5 }}>{c.notes}</p>}
              <div style={{ display: "flex", gap: "0.5rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
                <button onClick={() => openEdit(c)} className="btn-ghost" style={{ flex: 1, justifyContent: "center", fontSize: "0.82rem", padding: "0.5rem" }}>
                  <Pencil size={13} /> Edit
                </button>
                <button onClick={() => toggleCall(c)} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0.5rem 0.75rem", borderRadius: 8, border: "none", cursor: "pointer", background: onCall ? "rgba(34,211,238,0.12)" : "var(--surface-2)", color: onCall ? "var(--accent)" : "var(--text-3)" }}>
                  {onCall ? <PhoneCall size={15} /> : <PhoneOff size={15} />}
                </button>
                <button onClick={() => remove(c.id)} className="btn-danger" style={{ padding: "0.5rem 0.75rem" }}><Trash2 size={13} /></button>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "var(--text-3)" }}>
        {filtered.length} of {clients.length} client{clients.length !== 1 ? "s" : ""}
      </p>

      {/* ── Bulk action bar ── */}
      {selected.size > 0 && (
        <div style={{
          position: "fixed", bottom: "calc(var(--bottom-bar-h) + 12px)", left: "50%", transform: "translateX(-50%)",
          zIndex: 250, display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap",
          background: "var(--surface-2)", border: "1px solid var(--border-3)",
          borderRadius: 14, padding: "0.6rem 0.9rem", boxShadow: "var(--shadow-lg)",
          maxWidth: "calc(100vw - 24px)",
        }}>
          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-1)", whiteSpace: "nowrap" }}>
            {selected.size} selected
          </span>
          <select
            className="field"
            style={{ width: "auto", padding: "0.35rem 0.6rem", fontSize: "0.78rem" }}
            defaultValue=""
            disabled={bulkBusy}
            onChange={(e) => { if (e.target.value !== "") bulkAssign(e.target.value === "__none" ? null : e.target.value); }}
          >
            <option value="" disabled>Assign to…</option>
            {team.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
            <option value="__none">Unassigned</option>
          </select>
          <button onClick={bulkDelete} disabled={bulkBusy} className="btn-danger" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
            <Trash2 size={12} /> Delete
          </button>
          <button onClick={() => setSelected(new Set())} disabled={bulkBusy} className="btn-ghost" style={{ padding: "0.35rem 0.7rem", fontSize: "0.75rem", minHeight: 0 }}>
            Clear
          </button>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h2 style={{ fontWeight: 800, fontSize: "1.15rem", margin: 0 }}>{editId ? "Edit Client" : "Add Client"}</h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost" style={{ padding: "0.4rem" }}><X size={16} /></button>
            </div>
            <div style={{ display: "grid", gap: "1rem" }}>
              {([
                ["business_name", "Business Name", true],
                ["contact_name", "Contact Name", false],
                ["phone", "Phone", false],
                ["email", "Email", false],
                ["website", "Website", false],
              ] as const).map(([key, label, required]) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>
                    {label}{required && <span style={{ color: "var(--accent)", marginLeft: 2 }}>*</span>}
                  </label>
                  <input className="field" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={label} />
                </div>
              ))}

              {/* Assignment */}
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>
                  Assign To
                </label>
                {team.length > 0 ? (
                  <select className="field" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                    <option value="">— Unassigned —</option>
                    {team.map((m) => <option key={m.id} value={m.name}>{m.name}{m.role ? ` (${m.role})` : ""}</option>)}
                  </select>
                ) : (
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input className="field" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} placeholder="Enter name (add team members in Team Hub)" />
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>Notes</label>
                <textarea className="field" rows={3} style={{ resize: "vertical" }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any additional notes…" />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
              <button onClick={save} className="btn-primary" style={{ flex: 1, justifyContent: "center" }}>
                {editId ? "Save Changes" : "Add Client"}
              </button>
              <button onClick={() => setShowForm(false)} className="btn-ghost">Cancel</button>
            </div>
            {editId && (
              <RecordTimeline
                entityType="client"
                entityId={editId}
                entityName={form.business_name}
                phone={form.phone || null}
                email={form.email || null}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
