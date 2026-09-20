"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { swrJson } from "@/lib/cache";
import {
  ArrowLeft, Users, Mail, Phone, Globe, ExternalLink, KeyRound, UserPlus,
  Trash2, Send, MessageSquare, Briefcase, Plus, CheckCircle2, AlertCircle,
  ShieldCheck,
} from "lucide-react";

/**
 * Partner client detail — one page per client: message thread, jobs and
 * portal access together, so a partner isn't hopping between tabs.
 */

interface Me { partner: { name: string; accent_color: string | null } }
interface Client {
  id: number; business_name: string; contact_name: string | null; phone: string | null;
  email: string | null; website: string | null; portal_logins: number; post_count: number; open_jobs: number;
}
interface PortalLogin { id: number; name: string; username: string }
interface Message { id: number; author: string | null; author_role: string; body: string; created_at: string }
interface Job {
  id: number; title: string; description: string | null; status: string; priority: string;
  due_date: string | null; kind: string; visible_to_client: boolean;
}
interface PortalModule { key: string; label: string; description: string; always?: boolean }
interface Modules { enabled: string[]; all: PortalModule[] }

const DEFAULT_ACCENT = "#7c3aed";
const card: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
};
const JOB_STATUS: Record<string, { label: string; color: string }> = {
  todo:        { label: "To do",       color: "#8892b0" },
  in_progress: { label: "In progress", color: "#d97706" },
  done:        { label: "Done",        color: "#059669" },
};

export default function PartnerClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const clientId = parseInt(id, 10);

  const [me, setMe] = useState<Me | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logins, setLogins] = useState<PortalLogin[]>([]);
  const [modules, setModules] = useState<Modules | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [newMessage, setNewMessage] = useState("");
  const [showAddJob, setShowAddJob] = useState(false);
  const [newJob, setNewJob] = useState({ title: "", description: "", priority: "medium", due_date: "", visible_to_client: false });
  const [newLogin, setNewLogin] = useState({ username: "", password: "", display_name: "", send_welcome: true, email_password: true });

  const accent = me?.partner.accent_color || DEFAULT_ACCENT;
  const accentGrad = `linear-gradient(135deg, ${accent} 0%, #4f46e5 55%, #0ea5e9 130%)`;
  const btnPrimary: React.CSSProperties = {
    background: accentGrad, color: "#fff", border: "none", borderRadius: 10,
    padding: "0.55rem 1rem", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
    boxShadow: `0 6px 18px ${accent}48`,
    display: "inline-flex", alignItems: "center", gap: "0.4rem", justifyContent: "center",
  };
  const btnGhost: React.CSSProperties = {
    background: "none", border: "1px solid var(--border)", borderRadius: 9,
    padding: "0.4rem 0.8rem", fontSize: "0.75rem", fontWeight: 600,
    color: "var(--text-2)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.35rem",
  };
  const field: React.CSSProperties = {
    background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10,
    padding: "0.6rem 0.8rem", fontSize: "0.85rem", color: "var(--text-1)", width: "100%",
  };

  function flash(ok: boolean, text: string) {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 4500);
  }
  async function api(url: string, method: string, body?: unknown) {
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { flash(false, (data as { error?: string }).error ?? "Something went wrong"); return null; }
    return data;
  }

  const load = useCallback(() => {
    return Promise.all([
      swrJson<Me>("/api/partner/me", (d) => { if (d && "partner" in d) setMe(d); }),
      fetch(`/api/partner/clients/${clientId}`).then(async (res) => {
        if (res.ok) setClient(await res.json());
        else setNotFound(true);
      }),
      swrJson<Message[]>(`/api/partner/messages?client_id=${clientId}`, (d) => setMessages(Array.isArray(d) ? d : [])),
      swrJson<Job[]>(`/api/partner/jobs?client_id=${clientId}`, (d) => setJobs(Array.isArray(d) ? d : [])),
      swrJson<PortalLogin[]>(`/api/partner/accounts?client_id=${clientId}`, (d) => setLogins(Array.isArray(d) ? d : [])),
      swrJson<Modules>(`/api/portal/modules?client_id=${clientId}`, (d) => { if (d && "enabled" in d) setModules(d); }),
    ]);
  }, [clientId]);
  useEffect(() => { load(); }, [load]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (await api("/api/partner/messages", "POST", { client_id: clientId, body: newMessage })) {
      setNewMessage("");
      const rows = await api(`/api/partner/messages?client_id=${clientId}`, "GET");
      if (rows) setMessages(rows as Message[]);
    }
  }
  async function addJob(e: React.FormEvent) {
    e.preventDefault();
    if (await api("/api/partner/jobs", "POST", { client_id: clientId, ...newJob })) {
      flash(true, "Job added");
      setNewJob({ title: "", description: "", priority: "medium", due_date: "", visible_to_client: false });
      setShowAddJob(false);
      const rows = await api(`/api/partner/jobs?client_id=${clientId}`, "GET");
      if (rows) setJobs(rows as Job[]);
    }
  }
  async function setJobStatus(j: Job, status: string) {
    if (await api(`/api/partner/jobs/${j.id}`, "PATCH", { status })) {
      const rows = await api(`/api/partner/jobs?client_id=${clientId}`, "GET");
      if (rows) setJobs(rows as Job[]);
    }
  }
  async function removeJob(j: Job) {
    if (!window.confirm(`Delete "${j.title}"?`)) return;
    if (await api(`/api/partner/jobs/${j.id}`, "DELETE")) {
      const rows = await api(`/api/partner/jobs?client_id=${clientId}`, "GET");
      if (rows) setJobs(rows as Job[]);
    }
  }
  async function addLogin(e: React.FormEvent) {
    e.preventDefault();
    const created = await api("/api/partner/accounts", "POST", { client_id: clientId, ...newLogin }) as
      | ({ welcome: { ok: boolean; error?: string } | null }) | null;
    if (created) {
      flash(created.welcome ? (created.welcome.ok ?? false) : true,
        created.welcome
          ? (created.welcome.ok ? "Portal login created — welcome email sent" : `Login created, but the email didn't send${created.welcome.error ? ` (${created.welcome.error})` : ""}`)
          : "Portal login created");
      setNewLogin({ username: "", password: "", display_name: "", send_welcome: true, email_password: true });
      const rows = await api(`/api/partner/accounts?client_id=${clientId}`, "GET");
      if (rows) setLogins(rows as PortalLogin[]);
    }
  }
  async function removeLogin(username: string) {
    if (!window.confirm(`Remove portal login ${username}?`)) return;
    if (await api("/api/partner/accounts", "DELETE", { username })) {
      const rows = await api(`/api/partner/accounts?client_id=${clientId}`, "GET");
      if (rows) setLogins(rows as PortalLogin[]);
    }
  }
  async function resetLogin(username: string) {
    const pw = window.prompt(`New password for ${username} (min 8 characters):`);
    if (!pw) return;
    if (await api("/api/partner/accounts", "PATCH", { username, new_password: pw })) {
      flash(true, `Password updated for ${username}`);
    }
  }
  async function toggleModule(key: string) {
    if (!modules) return;
    const enabled = modules.enabled.includes(key)
      ? modules.enabled.filter((k) => k !== key)
      : [...modules.enabled, key];
    setModules({ ...modules, enabled }); // optimistic — their portal updates instantly
    const res = await api("/api/portal/modules", "PATCH", { client_id: clientId, modules: enabled });
    if (res && "enabled" in (res as Modules)) setModules((m) => (m ? { ...m, enabled: (res as Modules).enabled } : m));
  }

  if (notFound) {
    return (
      <div style={{ maxWidth: 640, margin: "4rem auto", textAlign: "center", padding: "0 1rem" }}>
        <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--text-1)", marginBottom: "0.5rem" }}>Client not found</div>
        <p style={{ color: "var(--text-3)", fontSize: "0.85rem", marginBottom: "1rem" }}>This client doesn&apos;t exist or isn&apos;t part of your workspace.</p>
        <Link href="/partner" style={{ color: DEFAULT_ACCENT, fontWeight: 700, fontSize: "0.85rem" }}>← Back to your workspace</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "1.25rem 1rem 4rem", width: "100%" }}>
      <Link href="/partner" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-3)", textDecoration: "none", marginBottom: "0.9rem" }}>
        <ArrowLeft size={14} /> Back to workspace
      </Link>

      {/* Header */}
      <div style={{ ...card, padding: "1.25rem 1.35rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.9rem", flexWrap: "wrap" }}>
        <div style={{
          width: 50, height: 50, borderRadius: 14, flexShrink: 0, background: accentGrad,
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "1rem",
        }}>
          {(client?.business_name ?? "…").split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 900, fontSize: "1.2rem", color: "var(--text-1)", letterSpacing: "-0.02em" }}>
            {client?.business_name ?? "Loading…"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.4rem" }}>
            {client?.contact_name && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.72rem", color: "var(--text-2)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 999, padding: "0.22rem 0.6rem" }}>
                <Users size={11} /> {client.contact_name}
              </span>
            )}
            {client?.email && (
              <a href={`mailto:${client.email}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.72rem", color: "var(--text-2)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 999, padding: "0.22rem 0.6rem", textDecoration: "none" }}>
                <Mail size={11} /> {client.email}
              </a>
            )}
            {client?.phone && (
              <a href={`tel:${client.phone}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.72rem", color: "var(--text-2)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 999, padding: "0.22rem 0.6rem", textDecoration: "none" }}>
                <Phone size={11} /> {client.phone}
              </a>
            )}
            {client?.website && (
              <a href={client.website} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.72rem", color: accent, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 999, padding: "0.22rem 0.6rem", textDecoration: "none" }}>
                <Globe size={11} /> {client.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </div>
        <a href={`/portal?client=${clientId}`} target="_blank" rel="noreferrer" style={{ ...btnGhost, textDecoration: "none", color: accent, borderColor: `${accent}66` }}>
          Preview their portal <ExternalLink size={11} />
        </a>
      </div>

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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1rem", alignItems: "start" }}>

        {/* ── Messages ── */}
        <div style={{ ...card, padding: "1.1rem 1.2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)", marginBottom: "0.8rem" }}>
            <MessageSquare size={15} style={{ color: accent }} /> Messages
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.45rem", marginBottom: "0.7rem" }}>
            {messages.length === 0 && (
              <div style={{ fontSize: "0.8rem", color: "var(--text-3)", padding: "1rem 0", textAlign: "center" }}>
                No messages yet — say hello. They&apos;ll see it in their portal and get an email.
              </div>
            )}
            {messages.map((m) => {
              const isClient = m.author_role === "client";
              return (
                <div key={m.id} style={{ display: "flex", justifyContent: isClient ? "flex-start" : "flex-end" }}>
                  <div style={{
                    maxWidth: "82%", padding: "0.5rem 0.75rem",
                    borderRadius: isClient ? "12px 12px 12px 3px" : "12px 12px 3px 12px",
                    background: isClient ? "var(--bg)" : `${accent}14`,
                    border: `1px solid ${isClient ? "var(--border)" : `${accent}40`}`,
                  }}>
                    <div style={{ fontSize: "0.64rem", fontWeight: 700, color: isClient ? "var(--text-3)" : accent, marginBottom: 2 }}>
                      {m.author ?? (isClient ? client?.business_name : me?.partner.name)}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-1)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.body}</div>
                    <div style={{ fontSize: "0.62rem", color: "var(--text-3)", marginTop: 3 }}>
                      {new Date(m.created_at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <form onSubmit={sendMessage} style={{ display: "flex", gap: "0.45rem" }}>
            <input style={field} placeholder={`Message ${client?.business_name ?? "your client"}…`}
              value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
            <button type="submit" style={{ ...btnPrimary, padding: "0.55rem 0.9rem" }} disabled={!newMessage.trim()}>
              <Send size={13} />
            </button>
          </form>
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
          {/* ── Jobs ── */}
          <div style={{ ...card, padding: "1.1rem 1.2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)", marginBottom: "0.8rem" }}>
              <Briefcase size={15} style={{ color: accent }} /> Jobs
              <button onClick={() => setShowAddJob((v) => !v)} style={{ ...btnGhost, marginLeft: "auto", padding: "0.3rem 0.65rem", fontSize: "0.7rem" }}>
                <Plus size={11} /> Add
              </button>
            </div>
            {showAddJob && (
              <form onSubmit={addJob} style={{ display: "grid", gap: "0.5rem", marginBottom: "0.8rem", paddingBottom: "0.8rem", borderBottom: "1px solid var(--border)" }}>
                <input style={field} placeholder="What needs doing?" value={newJob.title} onChange={(e) => setNewJob((j) => ({ ...j, title: e.target.value }))} />
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <select style={{ ...field, width: "auto" }} value={newJob.priority} onChange={(e) => setNewJob((j) => ({ ...j, priority: e.target.value }))}>
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                  </select>
                  <input style={{ ...field, width: "auto" }} type="date" value={newJob.due_date} onChange={(e) => setNewJob((j) => ({ ...j, due_date: e.target.value }))} />
                  <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.72rem", color: "var(--text-2)" }}>
                    <input type="checkbox" checked={newJob.visible_to_client} onChange={(e) => setNewJob((j) => ({ ...j, visible_to_client: e.target.checked }))} />
                    Visible to client
                  </label>
                  <button type="submit" style={{ ...btnPrimary, marginLeft: "auto", padding: "0.5rem 0.85rem" }} disabled={!newJob.title.trim()}>
                    <Plus size={12} />
                  </button>
                </div>
              </form>
            )}
            {jobs.length === 0 && !showAddJob && (
              <div style={{ fontSize: "0.8rem", color: "var(--text-3)", padding: "0.5rem 0" }}>No jobs for this client yet.</div>
            )}
            <div style={{ display: "grid", gap: "0.45rem" }}>
              {jobs.map((j) => {
                const st = JOB_STATUS[j.status] ?? JOB_STATUS.todo;
                return (
                  <div key={j.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.55rem 0.7rem", borderRadius: 10, background: "var(--bg)", border: "1px solid var(--border)", borderLeft: `3px solid ${st.color}`, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--text-1)", textDecoration: j.status === "done" ? "line-through" : "none", opacity: j.status === "done" ? 0.6 : 1 }}>
                        {j.title}
                        {j.kind === "support" && (
                          <span style={{ marginLeft: "0.4rem", fontSize: "0.58rem", fontWeight: 800, color: "#d97706", background: "rgba(251,191,36,0.14)", borderRadius: 999, padding: "0.1rem 0.45rem", verticalAlign: "1px" }}>SUPPORT</span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>
                        {st.label}
                        {j.priority === "high" && <span style={{ color: "#dc2626", fontWeight: 700 }}> · High</span>}
                        {j.due_date && ` · due ${new Date(j.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`}
                      </div>
                    </div>
                    {j.status !== "done" && (
                      <button onClick={() => setJobStatus(j, j.status === "todo" ? "in_progress" : "done")} style={{ ...btnGhost, padding: "0.25rem 0.55rem", fontSize: "0.66rem" }}>
                        {j.status === "todo" ? "Start" : "Done ✓"}
                      </button>
                    )}
                    {j.status === "done" && (
                      <button onClick={() => setJobStatus(j, "in_progress")} style={{ ...btnGhost, padding: "0.25rem 0.55rem", fontSize: "0.66rem" }}>Reopen</button>
                    )}
                    <button onClick={() => removeJob(j)} style={{ background: "none", border: "none", color: "var(--text-4, #b6bdd4)", cursor: "pointer", padding: "0.1rem" }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Portal access ── */}
          <div style={{ ...card, padding: "1.1rem 1.2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)", marginBottom: "0.8rem" }}>
              <ShieldCheck size={15} style={{ color: accent }} /> Portal access
            </div>
            {logins.length === 0 && (
              <div style={{ fontSize: "0.8rem", color: "var(--text-3)", marginBottom: "0.6rem" }}>No portal logins yet — create one below and they&apos;ll get an email with their sign-in details.</div>
            )}
            {logins.map((l) => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0", fontSize: "0.82rem", color: "var(--text-1)" }}>
                <span style={{ fontWeight: 600 }}>{l.name}</span>
                <span style={{ color: "var(--text-3)" }}>({l.username})</span>
                <button onClick={() => resetLogin(l.username)} style={{ ...btnGhost, marginLeft: "auto", padding: "0.2rem 0.55rem", fontSize: "0.68rem" }}>
                  <KeyRound size={10} /> Reset
                </button>
                <button onClick={() => removeLogin(l.username)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: "0.15rem" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <form onSubmit={addLogin} style={{ display: "grid", gap: "0.45rem", marginTop: "0.6rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.45rem" }}>
                <input style={field} placeholder="Display name" value={newLogin.display_name} onChange={(e) => setNewLogin((l) => ({ ...l, display_name: e.target.value }))} />
                <input style={field} placeholder="Username (their email works best)" autoComplete="off" value={newLogin.username} onChange={(e) => setNewLogin((l) => ({ ...l, username: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: "0.45rem" }}>
                <input style={field} type="text" placeholder="Password (min 8)" autoComplete="off" value={newLogin.password} onChange={(e) => setNewLogin((l) => ({ ...l, password: e.target.value }))} />
                <button type="submit" style={{ ...btnPrimary, padding: "0.55rem 0.9rem" }} disabled={!newLogin.username || newLogin.password.length < 8}>
                  <UserPlus size={13} />
                </button>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.74rem", color: "var(--text-2)" }}>
                <input type="checkbox" checked={newLogin.send_welcome} onChange={(e) => setNewLogin((l) => ({ ...l, send_welcome: e.target.checked }))} />
                Email the client their sign-in details
              </label>
              {newLogin.send_welcome && (
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.74rem", color: "var(--text-3)", marginLeft: "1.3rem" }}>
                  <input type="checkbox" checked={newLogin.email_password} onChange={(e) => setNewLogin((l) => ({ ...l, email_password: e.target.checked }))} />
                  Include the temporary password in the email
                </label>
              )}
            </form>
          </div>

          {/* ── Portal services ── */}
          <div style={{ ...card, padding: "1.1rem 1.2rem" }}>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)", marginBottom: "0.2rem" }}>
              Portal services
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginBottom: "0.8rem" }}>
              What {client?.business_name ?? "this client"} sees — their portal sidebar updates instantly.
            </div>
            {!modules && <div style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>Loading…</div>}
            {modules?.all.map((m) => {
              const on = modules.enabled.includes(m.key);
              return (
                <div key={m.key} style={{ display: "flex", alignItems: "center", gap: "0.7rem", padding: "0.5rem 0", borderTop: "1px solid var(--border)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.84rem", fontWeight: 700, color: "var(--text-1)" }}>{m.label}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>{m.description}</div>
                  </div>
                  <button
                    onClick={() => !m.always && toggleModule(m.key)}
                    disabled={m.always}
                    aria-label={`${m.label} ${on ? "on" : "off"}`}
                    style={{
                      width: 40, height: 22, borderRadius: 999, border: "none", flexShrink: 0,
                      cursor: m.always ? "default" : "pointer", position: "relative",
                      background: on ? accent : "var(--border)",
                      opacity: m.always ? 0.55 : 1, transition: "background 0.15s",
                    }}>
                    <span style={{
                      position: "absolute", top: 3, left: on ? 21 : 3, width: 16, height: 16,
                      borderRadius: "50%", background: "#fff", transition: "left 0.15s",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                    }} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p style={{ textAlign: "center", marginTop: "2.5rem", fontSize: "0.72rem", color: "var(--text-3)" }}>
        {me?.partner.name ?? "Partner"} workspace · Powered by KW Innovations
      </p>
    </div>
  );
}
