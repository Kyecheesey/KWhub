"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { swrJson } from "@/lib/cache";
import {
  ScrollText, Plus, RefreshCw, ExternalLink, LayoutGrid, AlertCircle, Eye, Send,
  MessageCircleQuestion, CircleCheck, Trophy, FileX, Link2, Unlink, Search, Trash2,
} from "lucide-react";

/**
 * Proposals — mirrored from ProposalMe (the KWI proposal builder). Every
 * publish, open, answer and stage change arrives by webhook; proposals are
 * linked to the potential or client they're for, where they also show on the
 * record's timeline. Building and sending happens in ProposalMe.
 */

interface Proposal {
  id: number; external_id: string; kind: string; name: string | null; title: string; number: string | null;
  client_name: string | null; client_email: string | null; url: string | null; stage: string;
  views: number; answers: number; last_answer: string | null; package: string | null; last_note: string | null;
  potential_id: number | null; client_id: number | null;
  potential_name: string | null; potential_status: string | null; client_business: string | null;
  published_at: string | null; first_viewed_at: string | null; last_viewed_at: string | null; responded_at: string | null;
}
interface Named { id: number; business_name: string }

const ACCENT = "#4f46e5";
const card: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
};
const field: React.CSSProperties = {
  background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10,
  padding: "0.55rem 0.8rem", fontSize: "0.83rem", color: "var(--text-1)", width: "100%",
};
const btnPrimary: React.CSSProperties = {
  background: ACCENT, color: "#fff", border: "none", borderRadius: 10,
  padding: "0.6rem 1.05rem", fontSize: "0.83rem", fontWeight: 700, cursor: "pointer", textDecoration: "none",
  display: "inline-flex", alignItems: "center", gap: "0.4rem", justifyContent: "center",
};
const btnGhost: React.CSSProperties = {
  background: "none", border: "1px solid var(--border)", borderRadius: 9,
  padding: "0.4rem 0.8rem", fontSize: "0.75rem", fontWeight: 600, textDecoration: "none",
  color: "var(--text-2)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.35rem",
};

const STAGE: Record<string, { label: string; color: string; bg: string; icon: React.FC<{ size?: number }> }> = {
  sent:      { label: "Sent",      color: "#8892b0", bg: "rgba(136,146,176,0.12)", icon: Send },
  opened:    { label: "Opened",    color: "#2563eb", bg: "rgba(37,99,235,0.12)",   icon: Eye },
  questions: { label: "Questions", color: "#d97706", bg: "rgba(251,191,36,0.14)",  icon: MessageCircleQuestion },
  accepted:  { label: "Accepted",  color: "#059669", bg: "rgba(52,211,153,0.14)",  icon: CircleCheck },
  won:       { label: "Won",       color: "#0f766e", bg: "rgba(20,184,166,0.14)",  icon: Trophy },
  lost:      { label: "Lost",      color: "#dc2626", bg: "rgba(248,113,113,0.12)", icon: FileX },
};
const STAGE_ORDER = ["sent", "opened", "questions", "accepted", "won", "lost"];

function ago(iso: string | null) {
  if (!iso) return null;
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [potentials, setPotentials] = useState<Named[]>([]);
  const [clients, setClients] = useState<Named[]>([]);
  const [connected, setConnected] = useState(true);
  const [pmUrl, setPmUrl] = useState("https://kwi-proposals.vercel.app");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    return fetch("/api/proposals")
      .then((r) => r.json())
      .then((data: { proposals: Proposal[]; connected: boolean; proposalme_url: string }) => {
        if (Array.isArray(data.proposals)) setProposals(data.proposals);
        setConnected(!!data.connected);
        if (data.proposalme_url) setPmUrl(data.proposalme_url);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    swrJson<Named[]>("/api/potentials", (d) => setPotentials(Array.isArray(d) ? d : []));
    swrJson<Named[]>("/api/clients", (d) => setClients(Array.isArray(d) ? d : []));
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60_000);
    return () => clearInterval(t);
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function link(p: Proposal, value: string) {
    if (!value) return;
    const [type, id] = value.split(":");
    const body = type === "unlink" ? { unlink: true } : type === "potential" ? { potential_id: Number(id) } : { client_id: Number(id) };
    const res = await fetch(`/api/proposals/${p.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) load();
  }

  async function remove(p: Proposal) {
    if (!window.confirm(`Remove "${p.title}" from the hub? It stays in ProposalMe and reappears on its next open or answer.`)) return;
    await fetch(`/api/proposals/${p.id}`, { method: "DELETE" });
    load();
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: proposals.length };
    for (const s of STAGE_ORDER) c[s] = proposals.filter((p) => p.stage === s).length;
    return c;
  }, [proposals]);

  const shown = proposals.filter((p) =>
    (filter === "all" || p.stage === filter) &&
    (!query || `${p.name ?? ""} ${p.title} ${p.client_name ?? ""} ${p.package ?? ""} ${p.potential_name ?? ""} ${p.client_business ?? ""}`.toLowerCase().includes(query.toLowerCase())),
  );

  const opened = proposals.filter((p) => p.views > 0).length;
  const answered = proposals.filter((p) => p.answers > 0).length;
  const accepted = proposals.filter((p) => p.stage === "accepted" || p.stage === "won").length;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  const stats = [
    { label: "Proposals", value: String(proposals.length), sub: null },
    { label: "Opened", value: pct(opened, proposals.length), sub: `${opened} of ${proposals.length}` },
    { label: "Answered", value: pct(answered, opened), sub: `${answered} of ${opened} opened` },
    { label: "Accepted", value: String(accepted), sub: pct(accepted, proposals.length) + " of all" },
    { label: "Won", value: String(counts.won ?? 0), sub: null },
  ];

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
        <ScrollText size={22} style={{ color: ACCENT }} />
        <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-1)", margin: 0 }}>Proposals</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button onClick={refresh} style={btnGhost} disabled={refreshing}>
            <RefreshCw size={12} style={refreshing ? { animation: "spin 1s linear infinite" } : undefined} /> Refresh
          </button>
          <a href={`${pmUrl}/dashboard`} target="_blank" rel="noreferrer" style={btnGhost}>
            <LayoutGrid size={12} /> Tracking board <ExternalLink size={11} />
          </a>
          <a href={pmUrl} target="_blank" rel="noreferrer" style={btnPrimary}>
            <Plus size={14} /> New proposal
          </a>
        </div>
      </div>
      <p style={{ fontSize: "0.82rem", color: "var(--text-3)", margin: "0 0 1.25rem" }}>
        Built and sent in <strong>ProposalMe</strong>. Opens and answers land here in real time, on the
        matching potential or client&apos;s timeline, and as notifications.
      </p>

      {!connected && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.7rem 1rem", borderRadius: 11,
          marginBottom: "1rem", fontSize: "0.8rem", fontWeight: 600,
          background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", color: "#d97706",
        }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>
            ProposalMe isn&apos;t connected yet. Pick a long random secret and set it as <code>PROPOSALME_WEBHOOK_SECRET</code> in
            the hub&apos;s Vercel environment variables, and as <code>KWHUB_WEBHOOK_SECRET</code> (with <code>KWHUB_WEBHOOK_URL</code> set
            to this hub&apos;s <code>/api/proposalme/webhook</code>) in ProposalMe&apos;s.
          </span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.6rem", marginBottom: "1rem" }}>
        {stats.map((s) => (
          <div key={s.label} style={{ ...card, padding: "0.85rem 1rem" }}>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-1)", lineHeight: 1.2 }}>{s.value}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-3)", fontWeight: 600 }}>{s.label}</div>
            {s.sub && <div style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {["all", ...STAGE_ORDER].map((k) => {
            const active = filter === k;
            const st = STAGE[k];
            return (
              <button key={k} onClick={() => setFilter(k)} style={{
                ...btnGhost, borderRadius: 999,
                background: active ? (st?.color ?? ACCENT) : "none",
                color: active ? "#fff" : (st?.color ?? "var(--text-2)"),
                borderColor: active ? (st?.color ?? ACCENT) : "var(--border)",
              }}>
                {st ? st.label : "All"} <span style={{ opacity: 0.75 }}>{counts[k] ?? 0}</span>
              </button>
            );
          })}
        </div>
        <div style={{ position: "relative", marginLeft: "auto", minWidth: 200, flex: "0 1 260px" }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
          <input style={{ ...field, paddingLeft: "1.9rem" }} placeholder="Search proposals" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {loading && <div style={{ ...card, padding: "1.5rem", color: "var(--text-3)", fontSize: "0.85rem" }}>Loading proposals…</div>}

      {!loading && proposals.length === 0 && (
        <div style={{ ...card, padding: "3rem 1.5rem", textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 1rem",
            background: "rgba(79,70,229,0.10)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ScrollText size={24} style={{ color: ACCENT }} />
          </div>
          <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text-1)", marginBottom: "0.35rem" }}>No proposals yet</div>
          <p style={{ fontSize: "0.83rem", color: "var(--text-3)", maxWidth: 440, margin: "0 auto 1.1rem", lineHeight: 1.55 }}>
            Build one in ProposalMe and press Publish. It shows up here the moment it&apos;s sent, then
            again each time the client opens or answers it.
          </p>
          <a href={pmUrl} target="_blank" rel="noreferrer" style={btnPrimary}><Plus size={14} /> Open ProposalMe</a>
        </div>
      )}

      {!loading && proposals.length > 0 && shown.length === 0 && (
        <div style={{ ...card, padding: "1.25rem", color: "var(--text-3)", fontSize: "0.85rem" }}>No proposals match.</div>
      )}

      <div style={{ display: "grid", gap: "0.6rem" }}>
        {shown.map((p) => {
          const st = STAGE[p.stage] ?? STAGE.sent;
          const linkedName = p.potential_name ?? p.client_business;
          const linkedHref = p.potential_id ? `/potentials?q=${encodeURIComponent(p.potential_name ?? "")}` : p.client_id ? `/clients?q=${encodeURIComponent(p.client_business ?? "")}` : null;
          const meta = [
            p.client_name,
            p.kind === "page" ? "hand-built page" : p.published_at && `sent ${ago(p.published_at)}`,
            p.views ? `opened ${p.views}× · last ${ago(p.last_viewed_at)}` : "not opened yet",
          ].filter(Boolean).join(" · ");
          return (
            <div key={p.id} style={{ ...card, padding: "1rem 1.15rem", borderLeft: `3px solid ${st.color}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-1)", display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                    <span>{p.name || p.title}</span>
                    {p.kind === "unpublished" && (
                      <span style={{ fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--text-3)", border: "1px solid var(--border)", borderRadius: 5, padding: "0.05rem 0.35rem" }}>Unpublished</span>
                    )}
                  </div>
                  {p.name && p.name !== p.title && (
                    <div style={{ fontSize: "0.75rem", color: "var(--text-2)", marginTop: "0.1rem" }}>
                      {p.number ? `${p.number} · ` : ""}&ldquo;{p.title}&rdquo;
                    </div>
                  )}
                  <div style={{ fontSize: "0.73rem", color: "var(--text-3)", marginTop: "0.15rem" }}>{meta}</div>
                  {p.last_answer && (
                    <div style={{ fontSize: "0.78rem", color: "var(--text-2)", marginTop: "0.4rem" }}>
                      <strong>{p.last_answer}</strong>{p.package ? ` · ${p.package}` : ""}
                      <span style={{ color: "var(--text-3)" }}> · {ago(p.responded_at)}</span>
                    </div>
                  )}
                  {p.last_note && (
                    <div style={{
                      fontSize: "0.78rem", color: "var(--text-2)", marginTop: "0.35rem", padding: "0.45rem 0.65rem",
                      background: "var(--bg)", borderRadius: 8, whiteSpace: "pre-wrap",
                    }}>
                      &ldquo;{p.last_note}&rdquo;
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.55rem", fontSize: "0.74rem", color: "var(--text-3)", flexWrap: "wrap" }}>
                    <Link2 size={12} />
                    {linkedName && linkedHref ? (
                      <>
                        <span>{p.potential_id ? "Potential" : "Client"}:</span>
                        <Link href={linkedHref} style={{ color: ACCENT, fontWeight: 700, textDecoration: "none" }}>{linkedName}</Link>
                        <button onClick={() => link(p, "unlink:0")} title="Unlink" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 0, display: "inline-flex" }}>
                          <Unlink size={12} />
                        </button>
                      </>
                    ) : (
                      <select value="" onChange={(e) => link(p, e.target.value)}
                        style={{ ...field, width: "auto", padding: "0.3rem 0.5rem", fontSize: "0.72rem" }}>
                        <option value="">Link to a potential or client…</option>
                        <optgroup label="Potentials">
                          {potentials.map((x) => <option key={`p${x.id}`} value={`potential:${x.id}`}>{x.business_name}</option>)}
                        </optgroup>
                        <optgroup label="Clients">
                          {clients.map((x) => <option key={`c${x.id}`} value={`client:${x.id}`}>{x.business_name}</option>)}
                        </optgroup>
                      </select>
                    )}
                  </div>
                </div>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "0.3rem",
                  fontSize: "0.68rem", fontWeight: 800, padding: "0.28rem 0.65rem", borderRadius: 999,
                  background: st.bg, color: st.color, whiteSpace: "nowrap",
                }}>
                  <st.icon size={11} /> {st.label}
                </span>
                {p.url && p.kind !== "unpublished" && (
                  <a href={`${p.url}?preview`} target="_blank" rel="noreferrer"
                    style={{ ...btnGhost, color: ACCENT, borderColor: "rgba(79,70,229,0.4)" }}>
                    Open <ExternalLink size={11} />
                  </a>
                )}
                <button onClick={() => remove(p)} title="Remove from hub"
                  style={{ background: "none", border: "none", color: "var(--text-4, #b6bdd4)", cursor: "pointer", padding: "0.2rem" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: "1rem" }}>
        Stages move on their own as clients open and answer. Mark a proposal won or lost on the{" "}
        <a href={`${pmUrl}/dashboard`} target="_blank" rel="noreferrer" style={{ color: ACCENT }}>tracking board</a>; the linked potential follows.
      </p>
    </div>
  );
}
