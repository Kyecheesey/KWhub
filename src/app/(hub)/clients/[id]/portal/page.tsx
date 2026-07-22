"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Send, KeyRound, UserPlus, Trash2,
  MessageSquare, Building2, Eye, Rocket, Plus,
  ThumbsUp, FolderOpen, Upload, Receipt, ListChecks,
  Check, Image as ImageIcon, ChevronRight,
} from "lucide-react";

interface ClientInfo { id: number; business_name: string; contact_name: string | null; assigned_to: string | null; logo_url: string | null; }
interface PortalAccount { id: number; name: string; username: string; created_at: string; }
interface Message { id: number; author: string | null; author_role: string; body: string; created_at: string; }
interface Project { id: number; name: string; stage: number; notes: string | null; }
interface Approval { id: number; title: string; description: string | null; status: string; response_note: string | null; responded_at: string | null; created_at: string; }
interface PortalFile { id: number; filename: string; url: string; size_bytes: number | null; uploaded_by: string | null; created_at: string; }
interface Invoice { id: number; number: string; amount_cents: number; due_date: string | null; status: string; }
interface ChecklistItem { id: number; text: string; done: boolean; }

const STAGES = ["Discovery", "Design", "Build", "Review", "Launch"];

function msgTime(iso: string) {
  return new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
function money(cents: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}

function Section({ icon: Icon, title, children, extra }: {
  icon: React.FC<{ size?: number; color?: string }>; title: string;
  children: React.ReactNode; extra?: React.ReactNode;
}) {
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.9rem 1.15rem", borderBottom: "1px solid var(--border)" }}>
        <Icon size={15} color="var(--accent)" />
        <span style={{ fontWeight: 800, fontSize: "0.9rem" }}>{title}</span>
        {extra && <span style={{ marginLeft: "auto" }}>{extra}</span>}
      </div>
      {children}
    </div>
  );
}

export default function ClientPortalAdminPage() {
  const params = useParams<{ id: string }>();
  const clientId = parseInt(params.id, 10);

  const [client, setClient] = useState<ClientInfo | null>(null);
  const [accounts, setAccounts] = useState<PortalAccount[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [files, setFiles] = useState<PortalFile[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [newProject, setNewProject] = useState("");
  const [newApprovalTitle, setNewApprovalTitle] = useState("");
  const [newApprovalDesc, setNewApprovalDesc] = useState("");
  const [newInvoice, setNewInvoice] = useState({ number: "", amount: "", due_date: "", pdf_url: "", pay_url: "" });
  const [newCheckItem, setNewCheckItem] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const q = `?client_id=${clientId}`;
  const withClient = useCallback((body: Record<string, unknown>) => JSON.stringify({ ...body, client_id: clientId }), [clientId]);

  const reload = useCallback((keys?: string[]) => {
    const all = !keys;
    const jobs: Promise<void>[] = [];
    const j = <T,>(url: string, set: (v: T) => void) =>
      fetch(url).then((r) => r.json()).then((d) => { if (Array.isArray(d) || !d?.error) set(d); }).catch(() => {});
    if (all || keys.includes("accounts")) jobs.push(j(`/api/portal/accounts${q}`, (d: PortalAccount[]) => setAccounts(Array.isArray(d) ? d : [])));
    if (all || keys.includes("messages")) jobs.push(j(`/api/portal/messages${q}`, (d: Message[]) => setMessages(Array.isArray(d) ? d : [])));
    if (all || keys.includes("projects")) jobs.push(j(`/api/portal/projects${q}`, (d: Project[]) => setProjects(Array.isArray(d) ? d : [])));
    if (all || keys.includes("approvals")) jobs.push(j(`/api/portal/approvals${q}`, (d: Approval[]) => setApprovals(Array.isArray(d) ? d : [])));
    if (all || keys.includes("files")) jobs.push(j(`/api/portal/files${q}`, (d: PortalFile[]) => setFiles(Array.isArray(d) ? d : [])));
    if (all || keys.includes("invoices")) jobs.push(j(`/api/portal/invoices${q}`, (d: Invoice[]) => setInvoices(Array.isArray(d) ? d : [])));
    if (all || keys.includes("checklist")) jobs.push(j(`/api/portal/checklist${q}`, (d: ChecklistItem[]) => setChecklist(Array.isArray(d) ? d : [])));
    return Promise.all(jobs);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/clients").then((r) => r.json()),
      reload(),
    ]).then(([clients]) => {
      if (cancelled) return;
      const c = Array.isArray(clients) ? clients.find((x: ClientInfo) => x.id === clientId) : null;
      setClient(c ?? null);
      setLogoUrl(c?.logo_url ?? "");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [clientId, reload]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages]);

  function ok(text: string) { setFlash({ text, ok: true }); setTimeout(() => setFlash(null), 4000); }
  function fail(text: string) { setFlash({ text, ok: false }); }

  async function post(url: string, body: Record<string, unknown>, method = "POST") {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: withClient(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { fail(data.error ?? "Something went wrong."); return null; }
    return data;
  }

  async function sendMessage() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const data = await post("/api/portal/messages", { body });
    if (data) { setMessages((prev) => [...prev, data]); setDraft(""); }
    setSending(false);
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("client_id", String(clientId));
    const res = await fetch("/api/portal/files", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) fail(data.error ?? "Upload failed.");
    else { ok(`Uploaded ${file.name} — the client was notified.`); reload(["files"]); }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const pill = (text: string, color: string) => (
    <span style={{
      fontSize: "0.64rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
      color, background: `${color}14`, border: `1px solid ${color}30`, borderRadius: 99, padding: "0.15rem 0.5rem",
    }}>{text}</span>
  );

  return (
    <div className="page" style={{ maxWidth: 1000 }}>
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
            Everything the client sees in their portal, managed from here.
          </p>
        </div>
        <div className="page-header-actions">
          <Link href={`/portal?client=${clientId}`} className="btn-primary">
            <Eye size={14} /> Preview Portal
          </Link>
        </div>
      </div>

      {flash && (
        <div style={{
          padding: "0.65rem 0.9rem", borderRadius: 10, fontSize: "0.83rem", fontWeight: 500, marginBottom: "1rem",
          background: flash.ok ? "rgba(52,211,153,0.08)" : "rgba(225,29,72,0.07)",
          border: `1px solid ${flash.ok ? "rgba(52,211,153,0.2)" : "rgba(225,29,72,0.2)"}`,
          color: flash.ok ? "#059669" : "#e11d48",
        }}>
          {flash.text}
        </div>
      )}

      {!loading && !client && (
        <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--text-2)" }}>
          Client #{params.id} not found.
        </div>
      )}

      {client && (
        <div className="dashboard-grid">
          {/* ══ LEFT COLUMN ══ */}
          <div style={{ display: "grid", gap: "1.25rem", alignContent: "start" }}>

            {/* Projects */}
            <Section icon={Rocket} title="Projects">
              <div>
                {projects.map((p) => (
                  <div key={p.id} style={{ padding: "0.85rem 1.15rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.87rem", flex: 1, minWidth: 120 }}>{p.name}</span>
                    <select
                      className="field"
                      style={{ width: "auto", padding: "0.3rem 0.5rem", fontSize: "0.78rem" }}
                      value={p.stage}
                      disabled={busy}
                      onChange={async (e) => {
                        const data = await post("/api/portal/projects", { id: p.id, stage: parseInt(e.target.value, 10) }, "PATCH");
                        if (data) { ok(`${p.name} moved to ${STAGES[data.stage]}.`); reload(["projects"]); }
                      }}
                    >
                      {STAGES.map((s, i) => <option key={s} value={i}>{s}</option>)}
                    </select>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete project "${p.name}"?`)) return;
                        await post("/api/portal/projects", { id: p.id }, "DELETE");
                        reload(["projects"]);
                      }}
                      className="btn-danger" style={{ minHeight: 0, padding: "0.3rem 0.5rem" }}
                    ><Trash2 size={12} /></button>
                  </div>
                ))}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newProject.trim()) return;
                    const data = await post("/api/portal/projects", { name: newProject });
                    if (data) { setNewProject(""); reload(["projects"]); }
                  }}
                  style={{ display: "flex", gap: "0.5rem", padding: "0.85rem 1.15rem" }}
                >
                  <input className="field" placeholder="New project name…" value={newProject} onChange={(e) => setNewProject(e.target.value)} />
                  <button type="submit" className="btn-ghost" disabled={busy || !newProject.trim()}><Plus size={14} /> Add</button>
                </form>
              </div>
            </Section>

            {/* Approvals */}
            <Section icon={ThumbsUp} title="Approvals">
              <div>
                {approvals.map((a) => (
                  <div key={a.id} style={{ padding: "0.85rem 1.15rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{a.title}</div>
                      {a.response_note && <div style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>&ldquo;{a.response_note}&rdquo;</div>}
                    </div>
                    {a.status === "pending" && pill("Pending", "#d97706")}
                    {a.status === "approved" && pill("Approved", "#10b981")}
                    {a.status === "changes_requested" && pill("Changes", "#e11d48")}
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete approval "${a.title}"?`)) return;
                        await post("/api/portal/approvals", { id: a.id }, "DELETE");
                        reload(["approvals"]);
                      }}
                      className="btn-danger" style={{ minHeight: 0, padding: "0.3rem 0.5rem" }}
                    ><Trash2 size={12} /></button>
                  </div>
                ))}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newApprovalTitle.trim()) return;
                    const data = await post("/api/portal/approvals", { title: newApprovalTitle, description: newApprovalDesc || null });
                    if (data) { setNewApprovalTitle(""); setNewApprovalDesc(""); ok("Approval requested — the client was notified."); reload(["approvals"]); }
                  }}
                  style={{ display: "grid", gap: "0.5rem", padding: "0.85rem 1.15rem" }}
                >
                  <input className="field" placeholder="What needs approval? e.g. Homepage design v2" value={newApprovalTitle} onChange={(e) => setNewApprovalTitle(e.target.value)} />
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input className="field" placeholder="Optional details…" value={newApprovalDesc} onChange={(e) => setNewApprovalDesc(e.target.value)} />
                    <button type="submit" className="btn-ghost" disabled={busy || !newApprovalTitle.trim()}><Send size={13} /> Request</button>
                  </div>
                </form>
              </div>
            </Section>

            {/* Invoices */}
            <Section icon={Receipt} title="Invoices">
              <div>
                {invoices.map((inv) => (
                  <div key={inv.id} style={{ padding: "0.75rem 1.15rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.85rem", flex: 1, minWidth: 90 }}>{inv.number}</span>
                    <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.85rem", fontWeight: 700 }}>{money(inv.amount_cents)}</span>
                    {inv.status === "paid" ? pill("Paid", "#10b981") : (
                      <button
                        onClick={async () => {
                          const data = await post("/api/portal/invoices", { id: inv.id, status: "paid" }, "PATCH");
                          if (data) { ok(`${inv.number} marked paid.`); reload(["invoices"]); }
                        }}
                        className="btn-ghost" style={{ minHeight: 0, padding: "0.25rem 0.6rem", fontSize: "0.72rem" }}
                      ><Check size={12} /> Mark paid</button>
                    )}
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete invoice ${inv.number}?`)) return;
                        await post("/api/portal/invoices", { id: inv.id }, "DELETE");
                        reload(["invoices"]);
                      }}
                      className="btn-danger" style={{ minHeight: 0, padding: "0.3rem 0.5rem" }}
                    ><Trash2 size={12} /></button>
                  </div>
                ))}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const data = await post("/api/portal/invoices", newInvoice);
                    if (data) { setNewInvoice({ number: "", amount: "", due_date: "", pdf_url: "", pay_url: "" }); ok("Invoice added — the client was notified."); reload(["invoices"]); }
                  }}
                  style={{ display: "grid", gap: "0.5rem", padding: "0.85rem 1.15rem" }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                    <input className="field" placeholder="INV-001" value={newInvoice.number} onChange={(e) => setNewInvoice({ ...newInvoice, number: e.target.value })} />
                    <input className="field" type="number" min="0" step="0.01" placeholder="Amount ($)" value={newInvoice.amount} onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })} />
                    <input className="field" type="date" value={newInvoice.due_date} onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })} />
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input className="field" placeholder="PDF link (optional)" value={newInvoice.pdf_url} onChange={(e) => setNewInvoice({ ...newInvoice, pdf_url: e.target.value })} />
                    <input className="field" placeholder="Payment link (optional)" value={newInvoice.pay_url} onChange={(e) => setNewInvoice({ ...newInvoice, pay_url: e.target.value })} />
                    <button type="submit" className="btn-ghost" disabled={busy || !newInvoice.number.trim() || !newInvoice.amount}><Plus size={14} /> Add</button>
                  </div>
                </form>
              </div>
            </Section>

            {/* Onboarding checklist */}
            <Section icon={ListChecks} title="Onboarding Checklist" extra={
              <span style={{ fontSize: "0.72rem", color: "var(--text-3)", fontWeight: 600 }}>
                {checklist.filter((i) => i.done).length}/{checklist.length} done
              </span>
            }>
              <div>
                {checklist.map((item) => (
                  <div key={item.id} style={{ padding: "0.6rem 1.15rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <button
                      onClick={async () => {
                        await post("/api/portal/checklist", { id: item.id, done: !item.done }, "PATCH");
                        reload(["checklist"]);
                      }}
                      style={{
                        width: 19, height: 19, borderRadius: 6, flexShrink: 0, cursor: "pointer",
                        border: `2px solid ${item.done ? "#10b981" : "var(--border-3)"}`,
                        background: item.done ? "#10b981" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {item.done && <Check size={11} color="#ffffff" strokeWidth={3} />}
                    </button>
                    <span style={{ flex: 1, fontSize: "0.85rem", textDecoration: item.done ? "line-through" : "none", opacity: item.done ? 0.6 : 1 }}>{item.text}</span>
                    <button
                      onClick={async () => { await post("/api/portal/checklist", { id: item.id }, "DELETE"); reload(["checklist"]); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", display: "flex", padding: "0.2rem" }}
                    ><Trash2 size={12} /></button>
                  </div>
                ))}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newCheckItem.trim()) return;
                    const data = await post("/api/portal/checklist", { text: newCheckItem });
                    if (data) { setNewCheckItem(""); reload(["checklist"]); }
                  }}
                  style={{ display: "flex", gap: "0.5rem", padding: "0.85rem 1.15rem" }}
                >
                  <input className="field" placeholder="e.g. Logo files received" value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)} />
                  <button type="submit" className="btn-ghost" disabled={busy || !newCheckItem.trim()}><Plus size={14} /> Add</button>
                </form>
              </div>
            </Section>
          </div>

          {/* ══ RIGHT COLUMN ══ */}
          <div style={{ display: "grid", gap: "1.25rem", alignContent: "start" }}>

            {/* Portal logins */}
            <Section icon={KeyRound} title="Portal Logins" extra={
              <span style={{ fontSize: "0.72rem", color: "var(--text-3)", fontWeight: 600 }}>{accounts.length} contact{accounts.length !== 1 ? "s" : ""}</span>
            }>
              <div>
                {accounts.map((acct) => (
                  <div key={acct.id} style={{ padding: "0.75rem 1.15rem", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{acct.name}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-3)", fontFamily: "var(--font-geist-mono)" }}>{acct.username}</div>
                      </div>
                      <button onClick={() => { setResetTarget(resetTarget === acct.username ? null : acct.username); setResetPw(""); }} className="btn-ghost" style={{ minHeight: 0, padding: "0.3rem 0.6rem", fontSize: "0.72rem" }}>
                        <KeyRound size={11} /> Reset
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Remove portal access for ${acct.username}?`)) return;
                          await fetch("/api/portal/accounts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: acct.username }) });
                          reload(["accounts"]);
                        }}
                        className="btn-danger" style={{ minHeight: 0, padding: "0.3rem 0.5rem" }}
                      ><Trash2 size={12} /></button>
                    </div>
                    {resetTarget === acct.username && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const res = await fetch("/api/portal/accounts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: acct.username, new_password: resetPw }) });
                          const data = await res.json();
                          if (!res.ok) fail(data.error ?? "Reset failed.");
                          else { ok(`Password reset for ${acct.username}.`); setResetTarget(null); }
                        }}
                        style={{ display: "flex", gap: "0.5rem", marginTop: "0.55rem" }}
                      >
                        <input className="field" type="text" placeholder="New password (8+ chars)" value={resetPw} onChange={(e) => setResetPw(e.target.value)} autoComplete="off" />
                        <button type="submit" className="btn-ghost" disabled={resetPw.length < 8}>Save</button>
                      </form>
                    )}
                  </div>
                ))}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await fetch("/api/portal/accounts", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ client_id: clientId, username: newUsername, password: newPassword, display_name: newDisplayName }),
                    });
                    const data = await res.json();
                    if (!res.ok) fail(data.error ?? "Couldn't create login.");
                    else {
                      ok(`Login created — username "${data.username}".`);
                      setNewUsername(""); setNewPassword(""); setNewDisplayName("");
                      reload(["accounts"]);
                    }
                  }}
                  style={{ display: "grid", gap: "0.5rem", padding: "0.85rem 1.15rem" }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <input className="field" placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value.toLowerCase().trim())} autoComplete="off" />
                    <input className="field" placeholder="Contact name (optional)" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} autoComplete="off" />
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input className="field" type="text" placeholder="Password (8+ chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="off" />
                    <button type="submit" className="btn-ghost" disabled={busy || !newUsername || newPassword.length < 8}>
                      <UserPlus size={13} /> Add
                    </button>
                  </div>
                </form>
              </div>
            </Section>

            {/* Branding */}
            <Section icon={ImageIcon} title="Portal Branding">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const data = await post("/api/portal/me", { logo_url: logoUrl }, "PATCH");
                  if (data) ok(logoUrl ? "Logo saved." : "Logo removed.");
                }}
                style={{ display: "flex", gap: "0.5rem", padding: "0.85rem 1.15rem", alignItems: "center" }}
              >
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- external client logo, unknown host
                  <img src={logoUrl} alt="logo" style={{ width: 34, height: 34, borderRadius: 9, objectFit: "cover", border: "1px solid var(--border-2)", background: "#fff", flexShrink: 0 }} />
                )}
                <input className="field" placeholder="Client logo URL (shows in their portal)" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
                <button type="submit" className="btn-ghost" disabled={busy}>Save</button>
              </form>
            </Section>

            {/* Files */}
            <Section icon={FolderOpen} title="Files" extra={
              <>
                <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={uploadFile} />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-ghost" style={{ minHeight: 0, padding: "0.3rem 0.65rem", fontSize: "0.72rem" }}>
                  <Upload size={11} /> {uploading ? "Uploading…" : "Upload"}
                </button>
              </>
            }>
              <div>
                {files.length === 0 && <p style={{ padding: "1rem 1.15rem", fontSize: "0.8rem", color: "var(--text-3)" }}>No files shared yet.</p>}
                {files.map((f) => (
                  <div key={f.id} style={{ padding: "0.65rem 1.15rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 0, fontSize: "0.83rem", fontWeight: 600, color: "var(--text-1)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.filename}
                    </a>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-3)", flexShrink: 0 }}>{f.uploaded_by ?? ""}</span>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete ${f.filename}?`)) return;
                        await post("/api/portal/files", { id: f.id }, "DELETE");
                        reload(["files"]);
                      }}
                      className="btn-danger" style={{ minHeight: 0, padding: "0.3rem 0.5rem" }}
                    ><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </Section>

            {/* Messages */}
            <Section icon={MessageSquare} title="Updates & Messages" extra={
              <Link href={`/portal?client=${clientId}`} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.72rem", color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                Client view <ChevronRight size={12} />
              </Link>
            }>
              <div ref={threadRef} style={{ maxHeight: 300, overflowY: "auto", padding: "0.85rem 1.15rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {messages.length === 0 && <p style={{ fontSize: "0.8rem", color: "var(--text-3)", textAlign: "center", padding: "1rem 0" }}>No messages yet — post the first update.</p>}
                {messages.map((m) => {
                  const fromStaff = m.author_role !== "client";
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: fromStaff ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth: "82%",
                        background: fromStaff ? "rgba(124,133,243,0.1)" : "var(--surface-2)",
                        border: `1px solid ${fromStaff ? "rgba(124,133,243,0.25)" : "var(--border)"}`,
                        borderRadius: 11, padding: "0.5rem 0.7rem",
                      }}>
                        <div style={{ fontSize: "0.64rem", fontWeight: 700, color: fromStaff ? "#7c85f3" : "var(--accent)", marginBottom: "0.15rem" }}>
                          {fromStaff ? m.author ?? "KW team" : `${client.business_name} (client)`}
                        </div>
                        <div style={{ fontSize: "0.82rem", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{m.body}</div>
                        <div style={{ fontSize: "0.6rem", color: "var(--text-3)", marginTop: "0.2rem" }}>{msgTime(m.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", padding: "0.75rem 1.15rem", borderTop: "1px solid var(--border)" }}>
                <input
                  className="field"
                  placeholder={`Post an update for ${client.business_name}…`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button onClick={sendMessage} disabled={sending || !draft.trim()} className="btn-primary" style={{ flexShrink: 0 }}>
                  <Send size={14} />
                </button>
              </div>
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}
