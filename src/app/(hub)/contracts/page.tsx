"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { swrJson } from "@/lib/cache";
import {
  FileSignature, Plus, RefreshCw, ExternalLink, Trash2, CheckCircle2,
  AlertCircle, X, Paperclip, Sparkles, Clock, Ban, PenLine,
} from "lucide-react";

/**
 * Contracts — tracked in the hub, signed through Sign IT Digital (KW's own
 * e-signature product). Upload a PDF here and a draft envelope is created in
 * Sign IT; fields get placed and sent from its editor, and statuses sync back.
 */

interface Contract {
  id: number; client_id: number | null; business_name: string | null;
  counterparty_name: string | null; counterparty_email: string | null;
  title: string; status: string; signit_envelope_id: string | null;
  notes: string | null; created_by: string | null;
  sent_at: string | null; completed_at: string | null; created_at: string;
}
interface Client { id: number; business_name: string }

const ACCENT = "#4f46e5";
const card: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
};
const field: React.CSSProperties = {
  background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10,
  padding: "0.6rem 0.8rem", fontSize: "0.85rem", color: "var(--text-1)", width: "100%",
};
const btnPrimary: React.CSSProperties = {
  background: ACCENT, color: "#fff", border: "none", borderRadius: 10,
  padding: "0.6rem 1.05rem", fontSize: "0.83rem", fontWeight: 700, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: "0.4rem", justifyContent: "center",
};
const btnGhost: React.CSSProperties = {
  background: "none", border: "1px solid var(--border)", borderRadius: 9,
  padding: "0.4rem 0.8rem", fontSize: "0.75rem", fontWeight: 600,
  color: "var(--text-2)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.35rem",
};

const STATUS: Record<string, { label: string; color: string; bg: string; icon: React.FC<{ size?: number }> }> = {
  draft:     { label: "Draft",     color: "#8892b0", bg: "rgba(136,146,176,0.12)", icon: PenLine },
  sent:      { label: "Awaiting signature", color: "#d97706", bg: "rgba(251,191,36,0.14)", icon: Clock },
  completed: { label: "Signed",    color: "#059669", bg: "rgba(52,211,153,0.14)", icon: CheckCircle2 },
  declined:  { label: "Declined",  color: "#dc2626", bg: "rgba(248,113,113,0.14)", icon: Ban },
  voided:    { label: "Voided",    color: "#8892b0", bg: "rgba(136,146,176,0.12)", icon: Ban },
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [connected, setConnected] = useState(true);
  const [signitUrl, setSignitUrl] = useState("https://signitdigital.com");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", client_id: "", counterparty_name: "", counterparty_email: "", notes: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback((sync = false) => {
    return fetch(`/api/contracts${sync ? "?sync=1" : ""}`)
      .then((r) => r.json())
      .then((data: { contracts: Contract[]; signit_connected: boolean; signit_url: string }) => {
        if (Array.isArray(data.contracts)) setContracts(data.contracts);
        setConnected(!!data.signit_connected);
        if (data.signit_url) setSignitUrl(data.signit_url);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  useEffect(() => {
    swrJson<Client[]>("/api/clients", (d) => setClients(Array.isArray(d) ? d : []));
    load(true);
  }, [load]);

  function flash(ok: boolean, text: string) {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 6000);
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function addContract(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const file = fileRef.current?.files?.[0];
      const pdf_base64 = file ? await fileToBase64(file) : undefined;
      const res = await fetch("/api/contracts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title, client_id: form.client_id ? parseInt(form.client_id, 10) : null,
          counterparty_name: form.counterparty_name, counterparty_email: form.counterparty_email,
          notes: form.notes, pdf_base64,
        }),
      });
      const data = await res.json();
      if (!res.ok) { flash(false, data.error ?? "Something went wrong"); return; }
      if (data.signit_error) {
        flash(false, data.signit_error);
      } else if (data.signit_editor_url) {
        flash(true, "Contract created in Sign IT — opening the editor to place fields and send");
        window.open(data.signit_editor_url, "_blank", "noopener");
      } else {
        flash(true, "Contract added");
      }
      setForm({ title: "", client_id: "", counterparty_name: "", counterparty_email: "", notes: "" });
      if (fileRef.current) fileRef.current.value = "";
      setShowAdd(false);
      load();
    } finally {
      setCreating(false);
    }
  }

  async function syncAll() {
    setSyncing(true);
    await load(true);
    setSyncing(false);
    flash(true, "Statuses refreshed from Sign IT");
  }
  async function syncOne(c: Contract) {
    const res = await fetch(`/api/contracts/${c.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sync: true }),
    });
    const data = await res.json();
    if (!res.ok) { flash(false, data.error ?? "Sync failed"); return; }
    flash(true, `"${c.title}" is ${STATUS[data.status as string]?.label.toLowerCase() ?? data.status}`);
    load();
  }
  async function setStatus(c: Contract, status: string) {
    const res = await fetch(`/api/contracts/${c.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) load();
  }
  async function remove(c: Contract) {
    if (!window.confirm(`Delete "${c.title}"? This only removes the hub record, not the Sign IT envelope.`)) return;
    await fetch(`/api/contracts/${c.id}`, { method: "DELETE" });
    flash(true, "Contract removed");
    load();
  }

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
        <FileSignature size={22} style={{ color: ACCENT }} />
        <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-1)", margin: 0 }}>Contracts</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
          <button onClick={syncAll} style={btnGhost} disabled={syncing}>
            <RefreshCw size={12} style={syncing ? { animation: "spin 1s linear infinite" } : undefined} /> {syncing ? "Syncing…" : "Sync statuses"}
          </button>
          <a href={signitUrl} target="_blank" rel="noreferrer" style={{ ...btnGhost, textDecoration: "none" }}>
            Open Sign IT <ExternalLink size={11} />
          </a>
          <button onClick={() => setShowAdd((v) => !v)} style={btnPrimary}>
            <Plus size={14} /> New contract
          </button>
        </div>
      </div>
      <p style={{ fontSize: "0.82rem", color: "var(--text-3)", margin: "0 0 1.25rem" }}>
        Signed through <strong>Sign IT Digital</strong> — upload a PDF here, place the fields in
        Sign IT&apos;s editor, and the signed status syncs back automatically.
      </p>

      {!connected && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.7rem 1rem", borderRadius: 11,
          marginBottom: "1rem", fontSize: "0.8rem", fontWeight: 600,
          background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", color: "#d97706",
        }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>
            Sign IT isn&apos;t connected yet — contracts work as a manual tracker. To connect: Sign IT →
            Settings → API keys → create a key, then add it as <code>SIGNIT_API_KEY</code> in the hub&apos;s
            Vercel environment variables.
          </span>
        </div>
      )}

      {msg && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.65rem 0.95rem", borderRadius: 11,
          marginBottom: "1rem", fontSize: "0.83rem", fontWeight: 600,
          background: msg.ok ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
          border: `1px solid ${msg.ok ? "rgba(52,211,153,0.35)" : "rgba(248,113,113,0.35)"}`,
          color: msg.ok ? "#059669" : "#dc2626",
        }}>
          {msg.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {msg.text}
        </div>
      )}

      {showAdd && (
        <form onSubmit={addContract} style={{ ...card, padding: "1.25rem", display: "grid", gap: "0.65rem", marginBottom: "1rem", borderColor: "rgba(79,70,229,0.35)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)", display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <Sparkles size={15} style={{ color: ACCENT }} /> New contract
            </div>
            <button type="button" onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}>
              <X size={16} />
            </button>
          </div>
          <input style={field} placeholder="Contract title (e.g. SEO retainer — Acme Pty Ltd)" value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
            <select style={field} value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}>
              <option value="">Link to a client (optional)</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
            <input style={field} placeholder="Signer name" value={form.counterparty_name}
              onChange={(e) => setForm((f) => ({ ...f, counterparty_name: e.target.value }))} />
          </div>
          <input style={field} type="email" placeholder="Signer email (who receives the signing link)" value={form.counterparty_email}
            onChange={(e) => setForm((f) => ({ ...f, counterparty_email: e.target.value }))} />
          <textarea style={{ ...field, minHeight: 60, resize: "vertical", fontFamily: "inherit" }} placeholder="Message to the signer / internal notes"
            value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem", color: "var(--text-2)", fontWeight: 600, cursor: "pointer" }}>
            <Paperclip size={13} style={{ color: ACCENT }} />
            Contract PDF {connected ? "(creates the envelope in Sign IT)" : "(optional — Sign IT not connected)"}
            <input ref={fileRef} type="file" accept="application/pdf" style={{ fontSize: "0.75rem" }} />
          </label>
          <button type="submit" style={{ ...btnPrimary, justifySelf: "start" }} disabled={!form.title.trim() || creating}>
            {creating ? "Creating…" : "Create contract"}
          </button>
        </form>
      )}

      {loading && <div style={{ ...card, padding: "1.5rem", color: "var(--text-3)", fontSize: "0.85rem" }}>Loading contracts…</div>}

      {!loading && contracts.length === 0 && !showAdd && (
        <div style={{ ...card, padding: "3rem 1.5rem", textAlign: "center" }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: "0 auto 1rem",
            background: "rgba(79,70,229,0.10)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <FileSignature size={24} style={{ color: ACCENT }} />
          </div>
          <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text-1)", marginBottom: "0.35rem" }}>No contracts yet</div>
          <p style={{ fontSize: "0.83rem", color: "var(--text-3)", maxWidth: 420, margin: "0 auto 1.1rem", lineHeight: 1.55 }}>
            Upload a contract PDF, it becomes a Sign IT envelope, the client signs from one
            private link, and the sealed PDF with its audit trail lands back in Sign IT.
          </p>
          <button onClick={() => setShowAdd(true)} style={btnPrimary}>
            <Plus size={14} /> Create your first contract
          </button>
        </div>
      )}

      <div style={{ display: "grid", gap: "0.6rem" }}>
        {contracts.map((c) => {
          const st = STATUS[c.status] ?? STATUS.draft;
          return (
            <div key={c.id} style={{ ...card, padding: "1rem 1.15rem", borderLeft: `3px solid ${st.color}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-1)" }}>{c.title}</div>
                  <div style={{ fontSize: "0.73rem", color: "var(--text-3)", marginTop: "0.15rem" }}>
                    {[c.business_name, c.counterparty_name || c.counterparty_email,
                      c.completed_at ? `signed ${new Date(c.completed_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`
                        : c.sent_at ? `sent ${new Date(c.sent_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`
                        : `created ${new Date(c.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`,
                      c.created_by && `by ${c.created_by}`,
                    ].filter(Boolean).join(" · ")}
                  </div>
                  {c.notes && <div style={{ fontSize: "0.75rem", color: "var(--text-2)", marginTop: "0.25rem" }}>{c.notes}</div>}
                </div>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "0.3rem",
                  fontSize: "0.68rem", fontWeight: 800, padding: "0.28rem 0.65rem", borderRadius: 999,
                  background: st.bg, color: st.color, whiteSpace: "nowrap",
                }}>
                  <st.icon size={11} /> {st.label}
                </span>
                {c.signit_envelope_id ? (
                  <>
                    <a href={`${signitUrl}/documents/${c.signit_envelope_id}`} target="_blank" rel="noreferrer"
                      style={{ ...btnGhost, textDecoration: "none", color: ACCENT, borderColor: "rgba(79,70,229,0.4)" }}>
                      Open in Sign IT <ExternalLink size={11} />
                    </a>
                    <button onClick={() => syncOne(c)} style={btnGhost} title="Refresh status from Sign IT">
                      <RefreshCw size={11} />
                    </button>
                  </>
                ) : (
                  <select value={c.status} onChange={(e) => setStatus(c, e.target.value)}
                    style={{ ...field, width: "auto", padding: "0.35rem 0.5rem", fontSize: "0.72rem" }}>
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                )}
                <button onClick={() => remove(c)} title="Delete"
                  style={{ background: "none", border: "none", color: "var(--text-4, #b6bdd4)", cursor: "pointer", padding: "0.2rem" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
