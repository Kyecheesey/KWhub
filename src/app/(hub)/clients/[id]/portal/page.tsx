"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Send, KeyRound, UserPlus, Trash2,
  MessageSquare, Building2, Check, Eye,
} from "lucide-react";

interface ClientInfo {
  id: number;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  assigned_to: string | null;
}

interface PortalAccount {
  id: number;
  name: string;
  username: string;
  created_at: string;
}

interface Message {
  id: number;
  author: string | null;
  author_role: string;
  body: string;
  created_at: string;
}

function msgTime(iso: string) {
  return new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function ClientPortalAdminPage() {
  const params = useParams<{ id: string }>();
  const clientId = parseInt(params.id, 10);

  const [client, setClient] = useState<ClientInfo | null>(null);
  const [account, setAccount] = useState<PortalAccount | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetPw, setResetPw] = useState("");
  const [acctMsg, setAcctMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [acctBusy, setAcctBusy] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);

  const loadAccount = useCallback(() => {
    return fetch(`/api/portal/accounts?client_id=${clientId}`)
      .then((r) => r.json())
      .then((data) => setAccount(data && !data.error ? data : null));
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      fetch(`/api/portal/accounts?client_id=${clientId}`).then((r) => r.json()),
      fetch(`/api/portal/messages?client_id=${clientId}`).then((r) => r.json()),
    ]).then(([clients, acct, msgs]) => {
      if (cancelled) return;
      const c = Array.isArray(clients) ? clients.find((x: ClientInfo) => x.id === clientId) : null;
      setClient(c ?? null);
      setAccount(acct && !acct.error ? acct : null);
      setMessages(Array.isArray(msgs) ? msgs : []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [clientId]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const res = await fetch("/api/portal/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, client_id: clientId }),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      setDraft("");
    }
    setSending(false);
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setAcctMsg(null);
    setAcctBusy(true);
    const res = await fetch("/api/portal/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, username: newUsername, password: newPassword }),
    });
    const data = await res.json();
    setAcctBusy(false);
    if (!res.ok) { setAcctMsg({ text: data.error ?? "Something went wrong.", ok: false }); return; }
    setAcctMsg({ text: `Portal login created — username "${data.username}".`, ok: true });
    setNewUsername(""); setNewPassword("");
    loadAccount();
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    setAcctMsg(null);
    setAcctBusy(true);
    const res = await fetch("/api/portal/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: account.username, new_password: resetPw }),
    });
    const data = await res.json();
    setAcctBusy(false);
    if (!res.ok) { setAcctMsg({ text: data.error ?? "Something went wrong.", ok: false }); return; }
    setResetPw("");
    setAcctMsg({ text: "Password reset.", ok: true });
  }

  async function removeAccess() {
    if (!account) return;
    if (!confirm(`Remove portal access for ${account.username}?`)) return;
    setAcctBusy(true);
    await fetch("/api/portal/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: account.username }),
    });
    setAcctBusy(false);
    setAcctMsg({ text: "Portal access removed.", ok: true });
    setAccount(null);
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <Link href="/clients" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "var(--text-3)", textDecoration: "none", marginBottom: "1rem" }}>
        <ArrowLeft size={14} /> Back to Clients
      </Link>

      <div className="page-header">
        <div>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: "0.35rem" }}>Client Portal</p>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.02em", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Building2 size={22} style={{ color: "var(--accent)" }} />
            {loading ? "Loading…" : client?.business_name ?? "Unknown client"}
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginTop: "0.3rem" }}>
            Manage this client&apos;s portal access and post updates they&apos;ll see when they sign in.
          </p>
        </div>
        <div className="page-header-actions">
          <Link href={`/portal?client=${clientId}`} className="btn-primary">
            <Eye size={14} /> Preview Portal
          </Link>
        </div>
      </div>

      {!loading && !client && (
        <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--text-2)" }}>
          Client #{params.id} not found.
        </div>
      )}

      {client && (
        <div style={{ display: "grid", gap: "1.25rem" }}>
          {/* ── Portal account ── */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.9rem" }}>
              <KeyRound size={15} color="var(--accent)" />
              <span style={{ fontWeight: 800, fontSize: "0.92rem" }}>Portal Login</span>
            </div>

            {acctMsg && (
              <div style={{
                padding: "0.55rem 0.8rem", borderRadius: 9, fontSize: "0.8rem", fontWeight: 500, marginBottom: "0.85rem",
                background: acctMsg.ok ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)",
                border: `1px solid ${acctMsg.ok ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
                color: acctMsg.ok ? "#34d399" : "#f87171",
              }}>
                {acctMsg.text}
              </div>
            )}

            {account ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: "0.35rem",
                    fontSize: "0.75rem", fontWeight: 700, color: "var(--accent-3)",
                    background: "rgba(54,211,153,0.1)", border: "1px solid rgba(54,211,153,0.2)",
                    padding: "0.2rem 0.6rem", borderRadius: 99,
                  }}>
                    <Check size={11} /> Active
                  </span>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>
                    Username: <span style={{ fontWeight: 700, color: "var(--text-1)", fontFamily: "var(--font-geist-mono)" }}>{account.username}</span>
                  </span>
                </div>
                <form onSubmit={resetPassword} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <input
                    className="field"
                    type="text"
                    placeholder="New password (min 8 characters)"
                    value={resetPw}
                    onChange={(e) => setResetPw(e.target.value)}
                    autoComplete="off"
                    style={{ flex: 1, minWidth: 220 }}
                  />
                  <button type="submit" className="btn-ghost" disabled={acctBusy || resetPw.length < 8}>
                    <KeyRound size={13} /> Reset Password
                  </button>
                  <button type="button" onClick={removeAccess} disabled={acctBusy} className="btn-danger">
                    <Trash2 size={13} /> Remove Access
                  </button>
                </form>
              </>
            ) : (
              <>
                <p style={{ fontSize: "0.82rem", color: "var(--text-3)", marginBottom: "0.85rem" }}>
                  No portal login yet — create one and share the details with {client.contact_name ?? client.business_name}.
                </p>
                <form onSubmit={createAccount} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <input
                    className="field"
                    placeholder="Username (e.g. acmeplumbing)"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase().trim())}
                    autoComplete="off"
                    style={{ flex: 1, minWidth: 180 }}
                  />
                  <input
                    className="field"
                    type="text"
                    placeholder="Password (min 8 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="off"
                    style={{ flex: 1, minWidth: 180 }}
                  />
                  <button type="submit" className="btn-primary" disabled={acctBusy || !newUsername || newPassword.length < 8}>
                    <UserPlus size={14} /> Create Login
                  </button>
                </form>
              </>
            )}
          </div>

          {/* ── Messages ── */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
              <MessageSquare size={15} color="var(--accent)" />
              <span style={{ fontWeight: 800, fontSize: "0.92rem" }}>Updates & Messages</span>
              <span style={{ fontSize: "0.72rem", color: "var(--text-3)", marginLeft: "auto" }}>Visible to the client in their portal</span>
            </div>

            <div ref={threadRef} style={{ maxHeight: 380, overflowY: "auto", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {messages.length === 0 && (
                <p style={{ fontSize: "0.82rem", color: "var(--text-3)", textAlign: "center", padding: "1.5rem 0" }}>
                  No messages yet — post the first update.
                </p>
              )}
              {messages.map((m) => {
                const fromStaff = m.author_role !== "client";
                return (
                  <div key={m.id} style={{ display: "flex", justifyContent: fromStaff ? "flex-end" : "flex-start" }}>
                    <div style={{
                      maxWidth: "78%",
                      background: fromStaff ? "rgba(124,133,243,0.1)" : "var(--surface-2)",
                      border: `1px solid ${fromStaff ? "rgba(124,133,243,0.25)" : "var(--border)"}`,
                      borderRadius: 12, padding: "0.6rem 0.8rem",
                    }}>
                      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: fromStaff ? "#7c85f3" : "var(--accent)", marginBottom: "0.2rem" }}>
                        {fromStaff ? `${m.author ?? "KW team"}` : `${client.business_name} (client)`}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-1)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.body}</div>
                      <div style={{ fontSize: "0.64rem", color: "var(--text-3)", marginTop: "0.25rem" }}>{msgTime(m.created_at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: "0.5rem", padding: "0.85rem 1.25rem", borderTop: "1px solid var(--border)" }}>
              <input
                className="field"
                placeholder={`Post an update for ${client.business_name}…`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
              />
              <button onClick={send} disabled={sending || !draft.trim()} className="btn-primary" style={{ flexShrink: 0 }}>
                <Send size={14} /> Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
