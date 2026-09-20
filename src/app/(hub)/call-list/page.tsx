"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Phone, CheckCircle2, UserCircle2, Trash2, PhoneCall, RefreshCw,
  Mail, ThumbsUp, ThumbsDown, ChevronDown, StickyNote, Save,
} from "lucide-react";
import { swrJson } from "@/lib/cache";

/**
 * Cold Call Tracker — work down the list, log what each call turned up
 * (who answered, emails, numbers, interested or not, notes) and Save & sync
 * writes it back onto the business's record and moves its pipeline stage.
 */

interface CallEntry {
  id: number;
  record_type: "client" | "potential";
  record_id: number;
  list_note: string | null;
  receptionist_name: string | null;
  emails: string | null;
  phones: string | null;
  interested: "yes" | "no" | null;
  call_notes: string | null;
  called: number;
  called_at: string | null;
  called_by: string | null;
  created_at: string;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  assigned_to: string | null;
  potential_status: string | null;
}

type LogForm = { receptionist_name: string; emails: string; phones: string; interested: "yes" | "no" | ""; call_notes: string };

const STAGE_COLOR: Record<string, string> = {
  new: "#60a5fa", contacted: "#d97706", qualified: "#4f46e5",
  proposal: "#ea580c", won: "#059669", lost: "#dc2626",
};

const FILTERS = [
  ["tocall", "To call"], ["interested", "Interested"], ["notinterested", "Not interested"], ["called", "Called"], ["all", "All"],
] as const;

export default function ColdCallTrackerPage() {
  const [entries, setEntries] = useState<CallEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("tocall");
  const [openId, setOpenId] = useState<number | null>(null);
  const [form, setForm] = useState<LogForm>({ receptionist_name: "", emails: "", phones: "", interested: "", call_notes: "" });
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");

  const load = useCallback(() => {
    return swrJson<CallEntry[]>("/api/call-list", (data) => { setEntries(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  function openLog(entry: CallEntry) {
    if (openId === entry.id) { setOpenId(null); return; }
    setOpenId(entry.id);
    setForm({
      receptionist_name: entry.receptionist_name ?? "",
      emails: entry.emails ?? "",
      phones: entry.phones ?? "",
      interested: entry.interested ?? "",
      call_notes: entry.call_notes ?? "",
    });
  }

  async function saveLog(entry: CallEntry) {
    setSaving(true);
    try {
      const res = await fetch(`/api/call-list/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          called: true,
          receptionist_name: form.receptionist_name,
          emails: form.emails,
          phones: form.phones,
          interested: form.interested || null,
          call_notes: form.call_notes,
          sync: true,
        }),
      });
      if (res.ok) {
        setFlash(`${entry.business_name} logged and synced${form.interested === "yes" ? " — moved to Qualified 🎉" : form.interested === "no" ? " — marked lost" : ""}`);
        setTimeout(() => setFlash(""), 4000);
        setOpenId(null);
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function undoCalled(entry: CallEntry) {
    await fetch(`/api/call-list/${entry.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ called: false }),
    });
    load();
  }

  async function remove(entry: CallEntry) {
    if (!window.confirm(`Remove ${entry.business_name} from the tracker?`)) return;
    await fetch("/api/call-list", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_type: entry.record_type, record_id: entry.record_id }),
    });
    load();
  }

  const toCall = entries.filter((e) => !e.called);
  const called = entries.filter((e) => e.called);
  const interested = entries.filter((e) => e.interested === "yes");
  const notInterested = entries.filter((e) => e.interested === "no");
  const displayed =
    filter === "all" ? entries
    : filter === "tocall" ? toCall
    : filter === "called" ? called
    : filter === "interested" ? interested
    : notInterested;
  const filterCount = (k: (typeof FILTERS)[number][0]) =>
    k === "all" ? entries.length : k === "tocall" ? toCall.length : k === "called" ? called.length
    : k === "interested" ? interested.length : notInterested.length;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#059669", marginBottom: "0.35rem" }}>KW | Innovations</p>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>
            Cold Call Tracker
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginTop: "0.3rem" }}>
            {loading ? "Loading…" : `${toCall.length} to call · ${called.length} called · ${interested.length} interested`}
          </p>
        </div>
        <button onClick={load} className="btn-ghost"><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Stats */}
      {entries.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
          {[
            { label: "To call", value: toCall.length, color: "#0891b2" },
            { label: "Called", value: called.length, color: "#059669" },
            { label: "Interested", value: interested.length, color: "#4f46e5" },
            { label: "Not interested", value: notInterested.length, color: "#dc2626" },
          ].map((s) => (
            <div key={s.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "0.8rem 1rem" }}>
              <div style={{ fontSize: "1.35rem", fontWeight: 900, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Progress */}
      {entries.length > 0 && (
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(called.length / entries.length) * 100}%`, background: "linear-gradient(90deg, #059669, #0891b2)", borderRadius: 99, transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {flash && (
        <div style={{ marginBottom: "1rem", padding: "0.65rem 0.95rem", borderRadius: 10, fontSize: "0.83rem", fontWeight: 600, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.35)", color: "#059669" }}>
          <CheckCircle2 size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />{flash}
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: "0.4rem 1rem", borderRadius: 99, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
              background: filter === key ? "var(--surface-3)" : "var(--surface)",
              border: `1px solid ${filter === key ? "var(--border-2)" : "var(--border)"}`,
              color: filter === key ? "var(--text-1)" : "var(--text-2)",
            }}
          >
            {label} ({filterCount(key)})
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: "center", color: "var(--text-3)", padding: "3rem" }}>Loading…</div>
      ) : displayed.length === 0 ? (
        <div style={{ padding: "4rem", textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
          <PhoneCall size={36} style={{ color: "var(--text-3)", margin: "0 auto 1rem" }} />
          <p style={{ color: "var(--text-2)", fontWeight: 600, marginBottom: "0.35rem" }}>
            {filter === "tocall" ? "Nothing left to call 🎉" : "Nothing here yet"}
          </p>
          <p style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>
            Flag clients or potentials for calling using the <PhoneCall size={12} style={{ display: "inline", verticalAlign: "middle" }} /> button on their record.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {displayed.map((entry) => {
            const isCalled = Boolean(entry.called);
            const isOpen = openId === entry.id;
            const outcomeColor = entry.interested === "yes" ? "#4f46e5" : entry.interested === "no" ? "#dc2626" : isCalled ? "#059669" : "var(--border-2)";
            return (
              <div
                key={entry.id}
                style={{
                  background: "var(--surface)",
                  border: `1px solid ${isOpen ? "var(--border-2)" : "var(--border)"}`,
                  borderLeft: `3px solid ${outcomeColor}`,
                  borderRadius: 14,
                  opacity: isCalled && !isOpen && filter === "all" ? 0.75 : 1,
                }}
              >
                <div style={{ padding: "0.9rem 1.15rem", display: "flex", alignItems: "center", gap: "0.85rem", flexWrap: "wrap" }}>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.2rem" }}>
                      <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)" }}>
                        {entry.business_name}
                      </span>
                      {entry.interested === "yes" && (
                        <span style={{ fontSize: "0.64rem", fontWeight: 800, padding: "0.12rem 0.5rem", borderRadius: 999, background: "rgba(129,140,248,0.14)", color: "#4f46e5" }}>
                          <ThumbsUp size={9} style={{ verticalAlign: "-1px" }} /> INTERESTED
                        </span>
                      )}
                      {entry.interested === "no" && (
                        <span style={{ fontSize: "0.64rem", fontWeight: 800, padding: "0.12rem 0.5rem", borderRadius: 999, background: "rgba(248,113,113,0.14)", color: "#dc2626" }}>
                          <ThumbsDown size={9} style={{ verticalAlign: "-1px" }} /> NOT INTERESTED
                        </span>
                      )}
                      {entry.potential_status && (
                        <span style={{
                          fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                          padding: "0.1rem 0.45rem", borderRadius: 4,
                          color: STAGE_COLOR[entry.potential_status] ?? "var(--text-3)",
                          background: `${STAGE_COLOR[entry.potential_status] ?? "#888"}18`,
                        }}>
                          {entry.potential_status}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", fontSize: "0.78rem", color: "var(--text-3)" }}>
                      {(entry.receptionist_name || entry.contact_name) && (
                        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <UserCircle2 size={12} /> {entry.receptionist_name || entry.contact_name}
                        </span>
                      )}
                      {entry.phone && (
                        <a href={`tel:${entry.phone}`} style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "#0891b2", textDecoration: "none", fontWeight: 600 }}>
                          <Phone size={12} /> {entry.phone}
                        </a>
                      )}
                      {(entry.emails || entry.email) && (
                        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                          <Mail size={12} /> {entry.emails || entry.email}
                        </span>
                      )}
                      {isCalled && entry.called_at && (
                        <span style={{ color: "#059669" }}>
                          ✓ {entry.called_by ? `${entry.called_by} · ` : ""}{new Date(entry.called_at + "Z").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                    {entry.call_notes && !isOpen && (
                      <div style={{ marginTop: "0.3rem", fontSize: "0.75rem", color: "var(--text-2)", display: "flex", gap: "0.3rem", alignItems: "flex-start" }}>
                        <StickyNote size={11} style={{ marginTop: 2, flexShrink: 0, color: "var(--text-3)" }} /> {entry.call_notes}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "0.45rem", flexShrink: 0, alignItems: "center" }}>
                    <button onClick={() => openLog(entry)} className={isCalled ? "btn-ghost" : "btn-primary"}
                      style={{ padding: "0.45rem 0.85rem", fontSize: "0.78rem", minHeight: 0 }}>
                      <PhoneCall size={13} /> {isCalled ? "Edit log" : "Log call"}
                      <ChevronDown size={12} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                    </button>
                    {isCalled && (
                      <button onClick={() => undoCalled(entry)} className="btn-ghost" title="Mark as not called"
                        style={{ padding: "0.45rem 0.6rem", fontSize: "0.72rem", minHeight: 0 }}>
                        Undo
                      </button>
                    )}
                    <button onClick={() => remove(entry)} className="btn-danger" title="Remove from tracker" style={{ minHeight: 0, padding: "0.45rem 0.6rem" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Log panel */}
                {isOpen && (
                  <div style={{ borderTop: "1px solid var(--border)", padding: "1rem 1.15rem", display: "grid", gap: "0.6rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.6rem" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
                          Receptionist / who answered
                        </label>
                        <input className="field" placeholder="e.g. Sarah" value={form.receptionist_name}
                          onChange={(e) => setForm((f) => ({ ...f, receptionist_name: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
                          Emails picked up
                        </label>
                        <input className="field" placeholder="e.g. owner@business.com.au" value={form.emails}
                          onChange={(e) => setForm((f) => ({ ...f, emails: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
                          Phone numbers
                        </label>
                        <input className="field" placeholder="e.g. 0412 345 678 (owner's mobile)" value={form.phones}
                          onChange={(e) => setForm((f) => ({ ...f, phones: e.target.value }))} />
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Interested?</span>
                      {([["yes", "Yes", "#4f46e5", ThumbsUp], ["no", "No", "#dc2626", ThumbsDown]] as const).map(([val, label, color, Icon]) => {
                        const active = form.interested === val;
                        return (
                          <button key={val} type="button"
                            onClick={() => setForm((f) => ({ ...f, interested: f.interested === val ? "" : val }))}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: "0.35rem",
                              padding: "0.4rem 0.95rem", borderRadius: 999, fontSize: "0.8rem", fontWeight: 700, cursor: "pointer",
                              border: `1.5px solid ${active ? color : "var(--border)"}`,
                              background: active ? `${color}1a` : "var(--surface)",
                              color: active ? color : "var(--text-2)",
                            }}>
                            <Icon size={13} /> {label}
                          </button>
                        );
                      })}
                      <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>
                        {form.interested === "yes" ? "→ pipeline moves to Qualified" : form.interested === "no" ? "→ marked Lost" : "leave blank if unsure — stays Contacted"}
                      </span>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.68rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
                        More info on the call
                      </label>
                      <textarea className="field" style={{ minHeight: 70, resize: "vertical", fontFamily: "inherit" }}
                        placeholder="Best time to call back, who the decision maker is, what they said…"
                        value={form.call_notes} onChange={(e) => setForm((f) => ({ ...f, call_notes: e.target.value }))} />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button onClick={() => saveLog(entry)} className="btn-primary" disabled={saving} style={{ fontSize: "0.82rem" }}>
                        <Save size={14} /> {saving ? "Saving…" : "Save & sync to business"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
