"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Phone, CheckCircle2, Circle, UserCircle2,
  Trash2, ExternalLink, PhoneCall, RefreshCw,
} from "lucide-react";

interface CallEntry {
  id: number;
  record_type: "client" | "potential";
  record_id: number;
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

const STAGE_COLOR: Record<string, string> = {
  new: "#60a5fa", contacted: "#fbbf24", qualified: "#a78bfa",
  proposal: "#fb923c", won: "#34d399", lost: "#f87171",
};

export default function CallListPage() {
  const [entries, setEntries] = useState<CallEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("pending");

  const load = useCallback(async () => {
    const res = await fetch("/api/call-list");
    setEntries(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markCalled(entry: CallEntry, called: boolean) {
    await fetch(`/api/call-list/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ called, called_by: null }),
    });
    load();
  }

  async function remove(entry: CallEntry) {
    await fetch("/api/call-list", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_type: entry.record_type, record_id: entry.record_id }),
    });
    load();
  }

  const pending = entries.filter((e) => !e.called);
  const done = entries.filter((e) => e.called);
  const displayed = filter === "all" ? entries : filter === "pending" ? pending : done;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#34d399", marginBottom: "0.35rem" }}>KW | Innovations</p>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>
            Call List
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginTop: "0.3rem" }}>
            {loading ? "Loading…" : `${pending.length} pending · ${done.length} called`}
          </p>
        </div>
        <button onClick={load} className="btn-ghost"><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Progress bar */}
      {entries.length > 0 && (
        <div style={{ marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-2)", fontWeight: 600 }}>Progress</span>
            <span style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>{done.length} / {entries.length} called</span>
          </div>
          <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(done.length / entries.length) * 100}%`, background: "linear-gradient(90deg, #34d399, #22d3ee)", borderRadius: 99, transition: "width 0.3s" }} />
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.5rem" }}>
        {(["pending", "all", "done"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "0.4rem 1rem", borderRadius: 99, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
              background: filter === f ? "var(--surface-3)" : "var(--surface)",
              border: `1px solid ${filter === f ? "var(--border-2)" : "var(--border)"}`,
              color: filter === f ? "var(--text-1)" : "var(--text-2)",
            }}
          >
            {f === "pending" ? `Pending (${pending.length})` : f === "done" ? `Called (${done.length})` : `All (${entries.length})`}
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
            {filter === "pending" ? "No pending calls" : filter === "done" ? "No completed calls yet" : "Call list is empty"}
          </p>
          <p style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>
            Flag clients or potentials for calling using the <PhoneCall size={12} style={{ display: "inline", verticalAlign: "middle" }} /> button on their record.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {displayed.map((entry) => {
            const isCalled = Boolean(entry.called);
            return (
              <div
                key={entry.id}
                style={{
                  background: "var(--surface)",
                  border: `1px solid ${isCalled ? "var(--border)" : "var(--border-2)"}`,
                  borderRadius: 14,
                  padding: "1rem 1.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  opacity: isCalled ? 0.6 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {/* Mark called button */}
                <button
                  onClick={() => markCalled(entry, !isCalled)}
                  title={isCalled ? "Mark as not called" : "Mark as called"}
                  style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: isCalled ? "#34d399" : "var(--text-3)", padding: 0, display: "flex" }}
                >
                  {isCalled ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                </button>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.2rem" }}>
                    <span style={{ fontWeight: 800, fontSize: "0.95rem", color: isCalled ? "var(--text-2)" : "var(--text-1)", textDecoration: isCalled ? "line-through" : "none" }}>
                      {entry.business_name}
                    </span>
                    {/* Type badge */}
                    <span style={{
                      fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                      padding: "0.1rem 0.45rem", borderRadius: 4,
                      background: entry.record_type === "client" ? "rgba(34,211,238,0.1)" : "rgba(129,140,248,0.1)",
                      color: entry.record_type === "client" ? "#22d3ee" : "#818cf8",
                      border: `1px solid ${entry.record_type === "client" ? "rgba(34,211,238,0.2)" : "rgba(129,140,248,0.2)"}`,
                    }}>
                      {entry.record_type}
                    </span>
                    {/* Potential stage */}
                    {entry.potential_status && (
                      <span style={{
                        fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                        padding: "0.1rem 0.45rem", borderRadius: 4,
                        color: STAGE_COLOR[entry.potential_status] ?? "var(--text-3)",
                        background: `${STAGE_COLOR[entry.potential_status] ?? "#fff"}18`,
                        border: `1px solid ${STAGE_COLOR[entry.potential_status] ?? "#fff"}30`,
                      }}>
                        {entry.potential_status}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", fontSize: "0.8rem", color: "var(--text-3)" }}>
                    {entry.contact_name && (
                      <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                        <UserCircle2 size={12} /> {entry.contact_name}
                      </span>
                    )}
                    {entry.phone && (
                      <a href={`tel:${entry.phone}`} style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "#22d3ee", textDecoration: "none", fontWeight: 600 }}>
                        <Phone size={12} /> {entry.phone}
                      </a>
                    )}
                    {entry.assigned_to && (
                      <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "#818cf8" }}>
                        <UserCircle2 size={12} /> {entry.assigned_to}
                      </span>
                    )}
                    {isCalled && entry.called_at && (
                      <span style={{ color: "#34d399" }}>
                        ✓ Called {new Date(entry.called_at + "Z").toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                  <a
                    href={`/${entry.record_type === "client" ? "clients" : "potentials"}`}
                    className="btn-ghost"
                    style={{ padding: "0.4rem 0.65rem", fontSize: "0.78rem" }}
                    title="Open record"
                  >
                    <ExternalLink size={13} />
                  </a>
                  <button onClick={() => remove(entry)} className="btn-danger" title="Remove from call list">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Call all hint */}
      {pending.length > 0 && (
        <div style={{ marginTop: "1.5rem", padding: "1rem 1.25rem", background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.12)", borderRadius: 12, display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Phone size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <p style={{ fontSize: "0.83rem", color: "var(--text-2)", margin: 0 }}>
            Click the circle on each entry to mark it as called, or click a phone number to dial directly.
          </p>
        </div>
      )}
    </div>
  );
}
