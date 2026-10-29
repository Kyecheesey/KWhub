"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PORTAL_MODULES } from "@/lib/modules";
import {
  ArrowLeft, Send, KeyRound, UserPlus, Trash2,
  MessageSquare, Eye, Rocket, Plus, X, Wallet, CreditCard,
  ThumbsUp, FolderOpen, Upload, Receipt, ListChecks,
  Check, Image as ImageIcon, ChevronRight, Briefcase, Boxes, Compass, RotateCcw, LayoutGrid,
} from "lucide-react";

interface ClientInfo { id: number; business_name: string; contact_name: string | null; assigned_to: string | null; logo_url: string | null; }
interface PortalAccount { id: number; name: string; username: string; created_at: string; }
interface Message { id: number; author: string | null; author_role: string; body: string; created_at: string; }
interface Project { id: number; name: string; stage: number; notes: string | null; }
interface Approval { id: number; title: string; description: string | null; status: string; response_note: string | null; responded_at: string | null; created_at: string; }
interface PortalFile { id: number; filename: string; url: string; size_bytes: number | null; uploaded_by: string | null; created_at: string; }
interface Invoice { id: number; number: string; amount_cents: number; due_date: string | null; status: string; }
interface ChecklistItem { id: number; text: string; done: boolean; }
interface ClientJob { id: number; title: string; status: string; priority: string; assigned_to: string | null; due_date: string | null; visible_to_client?: boolean; }
interface ServiceMetric { id: number; service: string; label: string; value: string; trend: string | null; trend_note: string | null; source_key: string | null; }
interface ServiceUpdate { id: number; service: string; title: string; body: string | null; created_by: string | null; created_at: string; }
interface Orientation { completed_at: string | null; accepted_version: string | null; accepted_by: string | null; current_version: string; current: boolean; }
interface Plan { plan_name: string | null; plan_amount_cents: number | null; plan_interval: string | null; }
interface StripeLink {
  configured: boolean; webhook_configured: boolean; customer_id: string | null; subscription_id: string | null;
  subscription: { status: string; amount_cents: number | null; interval: string | null; next_invoice_at: string | null } | null;
}
interface ServiceConfig { website: string | null; gsc_site: string | null; vercel_project_id: string | null; }

const SERVICE_TABS = [
  { key: "websites", label: "Websites" },
  { key: "apps", label: "Apps" },
  { key: "seo", label: "SEO" },
  { key: "cybersecurity", label: "Cybersecurity" },
  { key: "ai", label: "AI" },
  { key: "systems", label: "Systems" },
];

const STAGES = ["Discovery", "Design", "Build", "Review", "Launch"];
const TABS: { key: string; label: string; icon: React.FC<{ size?: number }> }[] = [
  { key: "overview", label: "Overview", icon: MessageSquare },
  { key: "work", label: "Work", icon: Briefcase },
  { key: "billing", label: "Billing", icon: Receipt },
  { key: "files", label: "Files", icon: FolderOpen },
  { key: "access", label: "Access & setup", icon: KeyRound },
];
const JOB_COLUMNS = [
  { key: "todo", label: "To Do", color: "#60a5fa" },
  { key: "in_progress", label: "In Progress", color: "#d97706" },
  { key: "in_review", label: "In Review", color: "#4f46e5" },
  { key: "done", label: "Done", color: "#059669" },
];

function msgTime(iso: string) {
  return new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
function money(cents: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}

function Panel({ icon: Icon, title, hint, action, children }: {
  icon: React.FC<{ size?: number; color?: string }>; title: string; hint?: string;
  action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="card" style={{ overflow: "hidden" }}>
      <header style={{ display: "flex", alignItems: "center", gap: "0.7rem", padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(79,70,229,0.08)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={15} color="var(--accent)" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 750, fontSize: "0.92rem", letterSpacing: "-0.01em" }}>{title}</div>
          {hint && <div style={{ fontSize: "0.74rem", color: "var(--text-3)", marginTop: "0.05rem" }}>{hint}</div>}
        </div>
        {action}
      </header>
      {children}
    </section>
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
  const [clientJobs, setClientJobs] = useState<ClientJob[]>([]);
  const [orientation, setOrientation] = useState<Orientation | null>(null);
  const [planForm, setPlanForm] = useState({ plan_name: "", amount: "", interval: "month" });
  const [stripeLink, setStripeLink] = useState<StripeLink | null>(null);
  const [modules, setModules] = useState<string[]>([]);
  const [stripeCustomerInput, setStripeCustomerInput] = useState("");
  const [serviceMetrics, setServiceMetrics] = useState<ServiceMetric[]>([]);
  const [serviceUpdates, setServiceUpdates] = useState<ServiceUpdate[]>([]);
  const [svcTab, setSvcTab] = useState("seo");
  const [newMetric, setNewMetric] = useState({ label: "", value: "", trend: "", trend_note: "" });
  const [newUpdate, setNewUpdate] = useState({ title: "", body: "" });
  const [svcConfig, setSvcConfig] = useState({ gsc_site: "", vercel_project_id: "" });
  const [monitoredSite, setMonitoredSite] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
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
  const [tab, setTab] = useState("overview");
  const [adding, setAdding] = useState<string | null>(null);
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
    if (all || keys.includes("orientation")) jobs.push(j(`/api/portal/orientation${q}`, (d: Orientation) => setOrientation(d)));
    if (all || keys.includes("plan")) jobs.push(j(`/api/portal/plan${q}`, (d: Plan) => setPlanForm({
      plan_name: d.plan_name ?? "",
      amount: d.plan_amount_cents ? String(d.plan_amount_cents / 100) : "",
      interval: d.plan_interval ?? "month",
    })));
    if (all || keys.includes("modules")) jobs.push(j(`/api/portal/modules${q}`, (d: { enabled: string[] }) => setModules(Array.isArray(d?.enabled) ? d.enabled : [])));
    if (all || keys.includes("stripe")) jobs.push(j(`/api/stripe/client${q}`, (d: StripeLink) => setStripeLink(d)));
    if (all || keys.includes("clientJobs")) jobs.push(j(`/api/client-jobs${q}`, (d: ClientJob[]) => setClientJobs(Array.isArray(d) ? d : [])));
    if (all || keys.includes("services")) jobs.push(j(`/api/portal/services${q}`, (d: { metrics: ServiceMetric[]; updates: ServiceUpdate[]; config: ServiceConfig | null }) => {
      setServiceMetrics(Array.isArray(d?.metrics) ? d.metrics : []);
      setServiceUpdates(Array.isArray(d?.updates) ? d.updates : []);
      if (d?.config) {
        setSvcConfig({ gsc_site: d.config.gsc_site ?? "", vercel_project_id: d.config.vercel_project_id ?? "" });
        setMonitoredSite(d.config.website);
      }
    }));
    return Promise.all(jobs);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/clients").then((r) => r.json()).catch(() => null),
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

  // ?tab= keeps the open tab across reloads and makes it linkable
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && TABS.some((x) => x.key === t)) Promise.resolve().then(() => setTab(t));
  }, []);

  function switchTab(key: string) {
    setTab(key);
    setAdding(null);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url);
  }

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


  async function toggleModule(key: string) {
    const next = modules.includes(key) ? modules.filter((k) => k !== key) : [...modules, key];
    setModules(next);
    const data = await post("/api/portal/modules", { modules: next }, "PATCH");
    if (data?.enabled) setModules(data.enabled);
    else reload(["modules"]);
  }

  const pill = (text: string, color: string) => (
    <span style={{
      fontSize: "0.64rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
      color, background: `${color}14`, border: `1px solid ${color}30`, borderRadius: 99, padding: "0.15rem 0.5rem",
    }}>{text}</span>
  );

  // "+ Add" toggles keep each panel's add form tucked away until it's needed
  const addToggle = (key: string, label = "Add") => (
    <button onClick={() => setAdding(adding === key ? null : key)} className="btn-ghost" style={{ minHeight: 0, padding: "0.35rem 0.75rem", fontSize: "0.76rem" }}>
      {adding === key ? <><X size={13} /> Cancel</> : <><Plus size={13} /> {label}</>}
    </button>
  );
  const empty = (text: string) => (
    <p style={{ padding: "1.1rem 1.25rem", fontSize: "0.82rem", color: "var(--text-3)" }}>{text}</p>
  );

  const pendingApprovals = approvals.filter((a) => a.status === "pending").length;
  const unpaidInvoices = invoices.filter((i) => !["paid", "draft"].includes(i.status)).length;
  const openJobs = clientJobs.filter((jb) => jb.status !== "done").length;
  const tabCount: Record<string, number> = { overview: pendingApprovals, work: openJobs, billing: unpaidInvoices, files: files.length, access: accounts.length };

  const orientationStatus = orientation?.current
    ? { label: "Orientation complete", color: "#10b981" }
    : orientation?.completed_at ? { label: "Policies need re-accepting", color: "#d97706" }
    : { label: "Orientation not done", color: "#8b95c0" };
  const planStatus = planForm.plan_name && planForm.amount
    ? { label: `${planForm.plan_name} · ${money(Math.round(Number(planForm.amount) * 100))}/${planForm.interval}`, color: "#4f46e5" }
    : { label: "No plan set", color: "#8b95c0" };
  const stripeStatus = !stripeLink?.configured ? { label: "Stripe not connected", color: "#8b95c0" }
    : stripeLink.subscription ? { label: `Stripe subscription ${stripeLink.subscription.status}`, color: stripeLink.subscription.status === "active" ? "#10b981" : "#d97706" }
    : stripeLink.customer_id ? { label: "Stripe customer linked", color: "#4f46e5" }
    : { label: "Not in Stripe yet", color: "#8b95c0" };
  const loginStatus = { label: accounts.length ? `${accounts.length} portal login${accounts.length === 1 ? "" : "s"}` : "No portal login", color: accounts.length ? "#10b981" : "#dc2626" };

  return (
    <div className="page" style={{ maxWidth: 1120 }}>
      <Link href="/clients" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "var(--text-3)", textDecoration: "none", marginBottom: "1rem" }}>
        <ArrowLeft size={14} /> Clients
      </Link>

      {flash && (
        <div role="status" style={{
          position: "fixed", right: "1.25rem", bottom: "1.25rem", zIndex: 60, maxWidth: 380,
          display: "flex", alignItems: "flex-start", gap: "0.6rem",
          padding: "0.75rem 0.9rem", borderRadius: 12, fontSize: "0.83rem", fontWeight: 500,
          background: "var(--surface)", boxShadow: "var(--shadow-lg)",
          border: `1px solid ${flash.ok ? "rgba(16,185,129,0.35)" : "rgba(220,38,38,0.35)"}`,
          color: flash.ok ? "#059669" : "#dc2626",
        }}>
          {flash.ok ? <Check size={15} style={{ flexShrink: 0, marginTop: 1 }} /> : null}
          <span style={{ flex: 1 }}>{flash.text}</span>
          <button onClick={() => setFlash(null)} className="icon-btn" aria-label="Dismiss" style={{ padding: 0 }}><X size={14} /></button>
        </div>
      )}

      {loading && <div className="card" style={{ padding: "2rem", color: "var(--text-3)", fontSize: "0.85rem" }}>Loading…</div>}

      {!loading && !client && (
        <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--text-2)" }}>
          Client #{params.id} not found.
        </div>
      )}

      {client && (
        <>
          {/* ── Client header ── */}
          <div className="card" style={{ padding: "1.25rem 1.4rem", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              {client.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- external client logo, unknown host
                <img src={client.logo_url} alt="" style={{ width: 52, height: 52, borderRadius: 14, objectFit: "cover", border: "1px solid var(--border)", background: "#fff", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(79,70,229,0.08)", color: "var(--accent)", fontWeight: 800, fontSize: "1.05rem" }}>
                  {client.business_name.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w[0] ?? "")).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-3)", marginBottom: "0.2rem" }}>Client portal</div>
                <h1 style={{ fontSize: "1.45rem", fontWeight: 850, letterSpacing: "-0.025em", margin: 0, lineHeight: 1.15 }}>{client.business_name}</h1>
                <div style={{ fontSize: "0.82rem", color: "var(--text-3)", marginTop: "0.2rem" }}>
                  {[client.contact_name, client.assigned_to && `Looked after by ${client.assigned_to}`].filter(Boolean).join(" · ") || "No contact set"}
                </div>
              </div>
              <Link href={`/portal?client=${clientId}`} className="btn-primary">
                <Eye size={14} /> Preview portal
              </Link>
            </div>
            <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)" }}>
              {[
                { ...orientationStatus, tab: "access" },
                { ...loginStatus, tab: "access" },
                { ...planStatus, tab: "billing" },
                { ...stripeStatus, tab: "billing" },
              ].map((s) => (
                <button key={s.label} onClick={() => switchTab(s.tab)} style={{
                  display: "inline-flex", alignItems: "center", gap: "0.4rem", cursor: "pointer",
                  padding: "0.3rem 0.7rem", borderRadius: 99, border: "1px solid var(--border)", background: "var(--surface-2)",
                  fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)",
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Tabs ── */}
          <div role="tablist" style={{ display: "flex", gap: "0.2rem", borderBottom: "1px solid var(--border)", marginBottom: "1.25rem", overflowX: "auto" }}>
            {TABS.map((t) => {
              const on = tab === t.key;
              const Icon = t.icon;
              const count = tabCount[t.key] ?? 0;
              return (
                <button key={t.key} role="tab" aria-selected={on} onClick={() => switchTab(t.key)} style={{
                  display: "inline-flex", alignItems: "center", gap: "0.45rem", whiteSpace: "nowrap", cursor: "pointer",
                  padding: "0.7rem 0.95rem", marginBottom: -1, background: "none", border: "none",
                  borderBottom: `2px solid ${on ? "var(--accent)" : "transparent"}`,
                  color: on ? "var(--text-1)" : "var(--text-3)", fontWeight: on ? 700 : 600, fontSize: "0.86rem",
                }}>
                  <Icon size={14} />
                  {t.label}
                  {count > 0 && (
                    <span style={{ fontSize: "0.66rem", fontWeight: 700, padding: "0.05rem 0.45rem", borderRadius: 99, background: on ? "rgba(79,70,229,0.1)" : "var(--surface-3)", color: on ? "var(--accent)" : "var(--text-3)" }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ══ Overview ══ */}
          {tab === "overview" && (
            <div className="dashboard-grid">
              <Panel icon={MessageSquare} title="Updates & messages" hint="The client's thread in their portal" action={
                <Link href={`/portal?client=${clientId}`} style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.74rem", color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
                  Client view <ChevronRight size={12} />
                </Link>
              }>
            <div ref={threadRef} style={{ maxHeight: 300, overflowY: "auto", padding: "0.85rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
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
            <div style={{ display: "flex", gap: "0.5rem", padding: "0.75rem 1.25rem", borderTop: "1px solid var(--border)" }}>
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
              </Panel>
              <div style={{ display: "grid", gap: "1.25rem", alignContent: "start" }}>
                <Panel icon={Rocket} title="Projects" action={addToggle("project")}>
                  {adding === "project" && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newProject.trim()) return;
                    const data = await post("/api/portal/projects", { name: newProject });
                    if (data) { setNewProject(""); setAdding(null); reload(["projects"]); }
                  }}
                  style={{ display: "flex", gap: "0.5rem", padding: "0.85rem 1.25rem" }}
                >
                  <input className="field" placeholder="New project name…" value={newProject} onChange={(e) => setNewProject(e.target.value)} />
                  <button type="submit" className="btn-ghost" disabled={busy || !newProject.trim()}><Plus size={14} /> Add</button>
                </form>
                  )}
                  {projects.length === 0 && adding !== "project" && empty("No projects yet.")}
              {projects.map((p) => (
                <div key={p.id} style={{ padding: "0.85rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
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
                    className="icon-btn danger" aria-label="Delete"
                  ><Trash2 size={12} /></button>
                </div>
              ))}
                </Panel>
                <Panel icon={ThumbsUp} title="Approvals" hint={pendingApprovals ? `${pendingApprovals} waiting on the client` : undefined} action={addToggle("approval", "Request")}>
                  {adding === "approval" && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newApprovalTitle.trim()) return;
                    const data = await post("/api/portal/approvals", { title: newApprovalTitle, description: newApprovalDesc || null });
                    if (data) { setNewApprovalTitle(""); setNewApprovalDesc(""); setAdding(null); ok("Approval requested — the client was notified."); reload(["approvals"]); }
                  }}
                  style={{ display: "grid", gap: "0.5rem", padding: "0.85rem 1.25rem" }}
                >
                  <input className="field" placeholder="What needs approval? e.g. Homepage design v2" value={newApprovalTitle} onChange={(e) => setNewApprovalTitle(e.target.value)} />
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input className="field" placeholder="Optional details…" value={newApprovalDesc} onChange={(e) => setNewApprovalDesc(e.target.value)} />
                    <button type="submit" className="btn-ghost" disabled={busy || !newApprovalTitle.trim()}><Send size={13} /> Request</button>
                  </div>
                </form>
                  )}
                  {approvals.length === 0 && adding !== "approval" && empty("Nothing has been sent for approval.")}
              {approvals.map((a) => (
                <div key={a.id} style={{ padding: "0.85rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{a.title}</div>
                    {a.response_note && <div style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>&ldquo;{a.response_note}&rdquo;</div>}
                  </div>
                  {a.status === "pending" && pill("Pending", "#d97706")}
                  {a.status === "approved" && pill("Approved", "#10b981")}
                  {a.status === "changes_requested" && pill("Changes", "#dc2626")}
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete approval "${a.title}"?`)) return;
                      await post("/api/portal/approvals", { id: a.id }, "DELETE");
                      reload(["approvals"]);
                    }}
                    className="icon-btn danger" aria-label="Delete"
                  ><Trash2 size={12} /></button>
                </div>
              ))}
                </Panel>
              </div>
            </div>
          )}

          {/* ══ Work ══ */}
          {tab === "work" && (
            <div style={{ display: "grid", gap: "1.25rem" }}>
              <Panel icon={Briefcase} title="Jobs" hint="Work on the Client Jobs board for this client" action={
                <Link href="/client-jobs" className="btn-ghost" style={{ minHeight: 0, padding: "0.35rem 0.75rem", fontSize: "0.76rem" }}>Open board</Link>
              }>
            {clientJobs.length === 0 ? (
              <div style={{ padding: "1.5rem 1.25rem", color: "var(--text-3)", fontSize: "0.83rem" }}>
                No jobs for this client yet — add them on the Client Jobs board.
              </div>
            ) : (
              <div>
                {JOB_COLUMNS.filter((col) => clientJobs.some((jb) => jb.status === col.key)).map((col) => (
                  <div key={col.key}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", padding: "0.6rem 1.25rem 0.25rem", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-3)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} /> {col.label}
                    </div>
                    {clientJobs.filter((jb) => jb.status === col.key).map((jb) => (
                      <div key={jb.id} style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.55rem 1.25rem", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: "0.85rem", flex: 1, minWidth: 140, textDecoration: jb.status === "done" ? "line-through" : "none", color: jb.status === "done" ? "var(--text-3)" : "var(--text-1)" }}>{jb.title}</span>
                        {jb.assigned_to && <span style={{ fontSize: "0.72rem", color: "#4f46e5" }}>{jb.assigned_to}</span>}
                        {jb.due_date && <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>{new Date(jb.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>}
                        <select
                          className="field"
                          style={{ width: "auto", padding: "0.25rem 0.45rem", fontSize: "0.74rem" }}
                          value={jb.status}
                          disabled={busy}
                          onChange={async (e) => {
                            await post(`/api/client-jobs/${jb.id}`, { status: e.target.value }, "PATCH");
                            reload(["clientJobs"]);
                          }}
                        >
                          {JOB_COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
              </Panel>
              <Panel icon={Boxes} title="Service sections" hint="Metrics and updates the client sees on their service tabs">
            <div>
              {/* Live data sources */}
              <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1px solid var(--border)", display: "grid", gap: "0.5rem" }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-3)" }}>
                  Live data sources
                  <span style={{ fontWeight: 600, textTransform: "none", letterSpacing: 0, marginLeft: "0.5rem" }}>
                    {monitoredSite ? `Uptime monitors ${monitoredSite}` : "Set the client's website to enable uptime monitoring"}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.5rem" }}>
                  <input className="field" placeholder="Search Console property — e.g. sc-domain:client.com.au" value={svcConfig.gsc_site} onChange={(e) => setSvcConfig({ ...svcConfig, gsc_site: e.target.value })} />
                  <input className="field" placeholder="Vercel project ID — e.g. prj_abc123, or Site A: prj_abc, Site B: prj_def" value={svcConfig.vercel_project_id} onChange={(e) => setSvcConfig({ ...svcConfig, vercel_project_id: e.target.value })} />
                  <button
                    className="btn-ghost" disabled={busy}
                    onClick={async () => {
                      const data = await post("/api/portal/services", svcConfig, "PUT");
                      if (data) ok("Live sources saved.");
                    }}
                  ><Check size={13} /> Save</button>
                  <button
                    className="btn-ghost" disabled={syncing}
                    onClick={async () => {
                      setSyncing(true);
                      const data = await post("/api/portal/services/sync", {});
                      setSyncing(false);
                      if (data) {
                        ok(data.synced?.length ? `Synced: ${data.synced.join(", ")}.` : "Nothing to sync — configure a source first.");
                        reload(["services"]);
                      }
                    }}
                  >{syncing ? "Syncing…" : "Sync now"}</button>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.4rem", padding: "0.75rem 1.25rem 0.25rem", flexWrap: "wrap" }}>
                {SERVICE_TABS.map((t) => {
                  const on = svcTab === t.key;
                  const count = serviceMetrics.filter((m) => m.service === t.key).length + serviceUpdates.filter((u) => u.service === t.key).length;
                  return (
                    <button key={t.key} onClick={() => setSvcTab(t.key)} style={{
                      padding: "0.35rem 0.75rem", borderRadius: 99, cursor: "pointer", fontSize: "0.76rem", fontWeight: 700,
                      border: `1px solid ${on ? "rgba(79,70,229,0.35)" : "var(--border-2)"}`,
                      background: on ? "rgba(79,70,229,0.1)" : "transparent",
                      color: on ? "var(--accent)" : "var(--text-2)",
                    }}>
                      {t.label}{count > 0 && <span style={{ marginLeft: "0.3rem", color: "var(--text-4)", fontWeight: 600 }}>{count}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Headline metrics */}
              <div style={{ padding: "0.6rem 1.25rem 0.2rem", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-3)" }}>Headline metrics</div>
              {serviceMetrics.filter((m) => m.service === svcTab).map((m) => m.source_key ? (
                <div key={m.id} style={{ padding: "0.55rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.82rem", flex: 1, minWidth: 120 }}>{m.label}</span>
                  <span style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.82rem", fontWeight: 700 }}>{m.value}</span>
                  <span style={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#059669", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 99, padding: "0.1rem 0.45rem" }}>Live</span>
                </div>
              ) : (
                <div key={m.id} style={{ padding: "0.55rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.82rem", flex: 1, minWidth: 120 }}>{m.label}</span>
                  <input
                    className="field" defaultValue={m.value} key={`${m.id}-${m.value}`}
                    style={{ width: 110, minHeight: 0, padding: "0.3rem 0.55rem", fontSize: "0.8rem", fontWeight: 700 }}
                    onBlur={async (e) => {
                      const v = e.target.value.trim();
                      if (!v || v === m.value) return;
                      const data = await post("/api/portal/services", { kind: "metric", id: m.id, value: v }, "PATCH");
                      if (data) { ok(`${m.label} updated.`); reload(["services"]); }
                    }}
                  />
                  <select
                    className="field" value={m.trend ?? ""}
                    style={{ width: 105, minHeight: 0, padding: "0.3rem 0.4rem", fontSize: "0.76rem" }}
                    onChange={async (e) => {
                      const data = await post("/api/portal/services", { kind: "metric", id: m.id, trend: e.target.value || null }, "PATCH");
                      if (data) reload(["services"]);
                    }}
                  >
                    <option value="">No trend</option>
                    <option value="up">▲ Up</option>
                    <option value="down">▼ Down</option>
                    <option value="flat">— Steady</option>
                  </select>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete metric "${m.label}"?`)) return;
                      await post("/api/portal/services", { kind: "metric", id: m.id }, "DELETE");
                      reload(["services"]);
                    }}
                    className="icon-btn danger" aria-label="Delete"
                  ><Trash2 size={12} /></button>
                </div>
              ))}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newMetric.label.trim() || !newMetric.value.trim()) return;
                  const data = await post("/api/portal/services", { kind: "metric", service: svcTab, ...newMetric, trend: newMetric.trend || null });
                  if (data) { setNewMetric({ label: "", value: "", trend: "", trend_note: "" }); ok("Metric added."); reload(["services"]); }
                }}
                style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem", padding: "0.6rem 1.25rem 0.85rem" }}
              >
                <input className="field" placeholder="Label — e.g. Avg. Google position" value={newMetric.label} onChange={(e) => setNewMetric({ ...newMetric, label: e.target.value })} />
                <input className="field" placeholder="Value — e.g. 8.2" value={newMetric.value} onChange={(e) => setNewMetric({ ...newMetric, value: e.target.value })} />
                <select className="field" value={newMetric.trend} onChange={(e) => setNewMetric({ ...newMetric, trend: e.target.value })}>
                  <option value="">No trend</option>
                  <option value="up">▲ Up</option>
                  <option value="down">▼ Down</option>
                  <option value="flat">— Steady</option>
                </select>
                <input className="field" placeholder="Trend note — e.g. up 3 spots this month" value={newMetric.trend_note} onChange={(e) => setNewMetric({ ...newMetric, trend_note: e.target.value })} />
                <button type="submit" className="btn-ghost" disabled={busy || !newMetric.label.trim() || !newMetric.value.trim()}><Plus size={14} /> Add</button>
              </form>

              {/* Updates feed */}
              <div style={{ padding: "0.4rem 1.25rem 0.2rem", borderTop: "1px solid var(--border)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-3)" }}>Updates the client sees</div>
              {serviceUpdates.filter((u) => u.service === svcTab).map((u) => (
                <div key={u.id} style={{ padding: "0.6rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.83rem" }}>{u.title}</div>
                    {u.body && <div style={{ fontSize: "0.75rem", color: "var(--text-3)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{u.body}</div>}
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete update "${u.title}"?`)) return;
                      await post("/api/portal/services", { kind: "update", id: u.id }, "DELETE");
                      reload(["services"]);
                    }}
                    className="icon-btn danger" aria-label="Delete" style={{ flexShrink: 0 }}
                  ><Trash2 size={12} /></button>
                </div>
              ))}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newUpdate.title.trim()) return;
                  const data = await post("/api/portal/services", { kind: "update", service: svcTab, ...newUpdate });
                  if (data) { setNewUpdate({ title: "", body: "" }); ok("Update posted — the client was notified."); reload(["services"]); }
                }}
                style={{ display: "grid", gap: "0.5rem", padding: "0.6rem 1.25rem 0.85rem" }}
              >
                <input className="field" placeholder="Update headline — e.g. Blocked 42 intrusion attempts this week" value={newUpdate.title} onChange={(e) => setNewUpdate({ ...newUpdate, title: e.target.value })} />
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input className="field" placeholder="Optional detail…" value={newUpdate.body} onChange={(e) => setNewUpdate({ ...newUpdate, body: e.target.value })} />
                  <button type="submit" className="btn-ghost" disabled={busy || !newUpdate.title.trim()}><Send size={13} /> Post</button>
                </div>
              </form>
            </div>
              </Panel>
            </div>
          )}

          {/* ══ Billing ══ */}
          {tab === "billing" && (
            <div className="dashboard-grid">
              <Panel icon={Receipt} title="Invoices" hint={unpaidInvoices ? `${unpaidInvoices} unpaid` : "Stripe invoices appear here automatically"} action={addToggle("invoice", "Add manually")}>
                {adding === "invoice" && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const data = await post("/api/portal/invoices", newInvoice);
                    if (data) { setNewInvoice({ number: "", amount: "", due_date: "", pdf_url: "", pay_url: "" }); setAdding(null); ok("Invoice added — the client was notified."); reload(["invoices"]); }
                  }}
                  style={{ display: "grid", gap: "0.5rem", padding: "0.85rem 1.25rem" }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.5rem" }}>
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
                )}
                {invoices.length === 0 && adding !== "invoice" && empty("No invoices yet.")}
              {invoices.map((inv) => (
                <div key={inv.id} style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
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
                    className="icon-btn danger" aria-label="Delete"
                  ><Trash2 size={12} /></button>
                </div>
              ))}
              </Panel>
              <div style={{ display: "grid", gap: "1.25rem", alignContent: "start" }}>
                <Panel icon={Wallet} title="Plan" hint="Shown on the client's Billing tab">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const data = await post("/api/portal/plan", planForm, "PATCH");
                  if (data) { ok(data.plan_name ? "Plan saved." : "Plan cleared."); reload(["plan"]); }
                }}
                style={{ padding: "0.85rem 1.25rem", borderBottom: "1px solid var(--border)", display: "grid", gap: "0.5rem" }}
              >
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <input className="field" style={{ flex: 2, minWidth: 140 }} placeholder="e.g. Website + SEO" value={planForm.plan_name} onChange={(e) => setPlanForm({ ...planForm, plan_name: e.target.value })} />
                  <input className="field" style={{ flex: 1, minWidth: 90 }} type="number" min="0" step="0.01" placeholder="Amount ($)" value={planForm.amount} onChange={(e) => setPlanForm({ ...planForm, amount: e.target.value })} />
                  <select className="field" style={{ flex: 1, minWidth: 100 }} value={planForm.interval} onChange={(e) => setPlanForm({ ...planForm, interval: e.target.value })}>
                    <option value="month">per month</option>
                    <option value="quarter">per quarter</option>
                    <option value="year">per year</option>
                  </select>
                  <button type="submit" className="btn-ghost" disabled={busy}><Check size={14} /> Save</button>
                </div>
              </form>
                </Panel>
                <Panel icon={CreditCard} title="Stripe" action={stripeLink?.customer_id ? (
                  <a href={`https://dashboard.stripe.com/customers/${stripeLink.customer_id}`} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: "0.74rem", fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>Open in Stripe ↗</a>
                ) : undefined}>
              <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1px solid var(--border)", display: "grid", gap: "0.55rem", fontSize: "0.8rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  {!stripeLink?.configured ? pill("Not connected", "#8b95c0")
                    : stripeLink.subscription ? pill(`Subscription ${stripeLink.subscription.status}`, stripeLink.subscription.status === "active" ? "#10b981" : "#d97706")
                    : stripeLink.customer_id ? pill("Customer linked", "#4f46e5")
                    : pill("Not linked", "#8b95c0")}
                </div>
                {!stripeLink?.configured ? (
                  <span style={{ color: "var(--text-3)" }}>Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Vercel to bill clients through Stripe.</span>
                ) : (
                  <>
                    {!stripeLink.webhook_configured && (
                      <span style={{ color: "#d97706" }}>STRIPE_WEBHOOK_SECRET isn&apos;t set, so invoices only update when you press Sync.</span>
                    )}
                    {stripeLink.subscription && (
                      <span>
                        {stripeLink.subscription.amount_cents != null && `${money(stripeLink.subscription.amount_cents)} per ${stripeLink.subscription.interval ?? "period"}`}
                        {stripeLink.subscription.next_invoice_at && ` · next invoice ${new Date(stripeLink.subscription.next_invoice_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`}
                      </span>
                    )}
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {!stripeLink.subscription_id && (
                        <button
                          onClick={async () => {
                            if (!planForm.plan_name || !planForm.amount) { fail("Save a plan name and amount first."); return; }
                            if (!confirm(`Start a Stripe subscription for ${planForm.plan_name} at $${planForm.amount} per ${planForm.interval}? Stripe emails the first invoice straight away.`)) return;
                            const data = await post("/api/stripe/client", { action: "subscribe" });
                            if (data) { ok("Subscription started. The first invoice will appear once Stripe finalises it."); reload(["stripe", "invoices"]); }
                          }}
                          className="btn-primary" disabled={busy} style={{ minHeight: 0, padding: "0.35rem 0.75rem", fontSize: "0.74rem" }}
                        ><Plus size={12} /> Start subscription</button>
                      )}
                      {stripeLink.customer_id && (
                        <button
                          onClick={async () => {
                            const data = await post("/api/stripe/client", { action: "sync" });
                            if (data) { ok(`Synced ${data.synced} invoice${data.synced === 1 ? "" : "s"} from Stripe.`); reload(["invoices", "stripe"]); }
                          }}
                          className="btn-ghost" disabled={busy} style={{ minHeight: 0, padding: "0.35rem 0.7rem", fontSize: "0.74rem" }}
                        >Sync invoices</button>
                      )}
                      {stripeLink.customer_id && (
                        <button
                          onClick={async () => {
                            if (!confirm("Unlink this Stripe customer? Nothing is cancelled in Stripe.")) return;
                            const data = await post("/api/stripe/client", { action: "unlink" });
                            if (data) { ok("Stripe customer unlinked."); reload(["stripe"]); }
                          }}
                          className="btn-ghost" disabled={busy} style={{ minHeight: 0, padding: "0.35rem 0.7rem", fontSize: "0.74rem" }}
                        >Unlink</button>
                      )}
                    </div>
                    {!stripeLink.customer_id && (
                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const data = await post("/api/stripe/client", { action: "link", customer_id: stripeCustomerInput });
                          if (data) { setStripeCustomerInput(""); ok(`Linked. Pulled ${data.synced} invoice${data.synced === 1 ? "" : "s"} from Stripe.`); reload(["stripe", "invoices", "plan"]); }
                        }}
                        style={{ display: "flex", gap: "0.5rem" }}
                      >
                        <input className="field" placeholder="Already in Stripe? Paste the customer ID (cus_…)" value={stripeCustomerInput} onChange={(e) => setStripeCustomerInput(e.target.value)} />
                        <button type="submit" className="btn-ghost" disabled={busy || !stripeCustomerInput.trim()}>Link</button>
                      </form>
                    )}
                  </>
                )}
              </div>
                </Panel>
              </div>
            </div>
          )}

          {/* ══ Files ══ */}
          {tab === "files" && (
            <Panel icon={FolderOpen} title="Files" hint="Shared both ways: the client can upload too" action={
              <>
                <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={uploadFile} />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-ghost" style={{ minHeight: 0, padding: "0.3rem 0.65rem", fontSize: "0.72rem" }}>
                  <Upload size={11} /> {uploading ? "Uploading…" : "Upload"}
                </button>
              </>
            }>
              {files.length === 0 && empty("No files shared yet.")}
              {files.map((f) => (
                <div key={f.id} style={{ padding: "0.65rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
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
                    className="icon-btn danger" aria-label="Delete"
                  ><Trash2 size={12} /></button>
                </div>
              ))}
            </Panel>
          )}

          {/* ══ Access & setup ══ */}
          {tab === "access" && (
            <div className="dashboard-grid">
              <div style={{ display: "grid", gap: "1.25rem", alignContent: "start" }}>
                <Panel icon={KeyRound} title="Portal logins" hint="Each contact gets their own login" action={addToggle("login")}>
                  {adding === "login" && (
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
                      setNewUsername(""); setNewPassword(""); setNewDisplayName(""); setAdding(null);
                      reload(["accounts"]);
                    }
                  }}
                  style={{ display: "grid", gap: "0.5rem", padding: "0.85rem 1.25rem" }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.5rem" }}>
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
                  )}
                  {accounts.length === 0 && adding !== "login" && empty("No one can sign in yet. Add a login.")}
              {accounts.map((acct) => (
                <div key={acct.id} style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
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
                        await post("/api/portal/accounts", { username: acct.username }, "DELETE");
                        reload(["accounts"]);
                      }}
                      className="icon-btn danger" aria-label="Delete"
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
                </Panel>
                <Panel icon={ListChecks} title="Onboarding checklist" hint={checklist.length ? `${checklist.filter((i) => i.done).length} of ${checklist.length} done` : "Shown on the client's Overview"} action={addToggle("check")}>
                  {adding === "check" && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newCheckItem.trim()) return;
                    const data = await post("/api/portal/checklist", { text: newCheckItem });
                    if (data) { setNewCheckItem(""); reload(["checklist"]); }
                  }}
                  style={{ display: "flex", gap: "0.5rem", padding: "0.85rem 1.25rem" }}
                >
                  <input className="field" placeholder="e.g. Logo files received" value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)} />
                  <button type="submit" className="btn-ghost" disabled={busy || !newCheckItem.trim()}><Plus size={14} /> Add</button>
                </form>
                  )}
                  {checklist.length === 0 && adding !== "check" && empty("No checklist items.")}
              {checklist.map((item) => (
                <div key={item.id} style={{ padding: "0.6rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.6rem" }}>
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
                    className="icon-btn danger" aria-label="Delete"
                  ><Trash2 size={12} /></button>
                </div>
              ))}
                </Panel>
              </div>
              <div style={{ display: "grid", gap: "1.25rem", alignContent: "start" }}>
                <Panel icon={Compass} title="Orientation & policies" action={pill(orientationStatus.label.replace(/^Orientation /, ""), orientationStatus.color)}>
            <div style={{ padding: "0.85rem 1.25rem", display: "grid", gap: "0.5rem", fontSize: "0.82rem" }}>
              {orientation?.completed_at ? (
                <span>
                  Accepted policies {orientation.accepted_version} {orientation.accepted_by ? `(${orientation.accepted_by}) ` : ""}
                  on {new Date(orientation.completed_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}.
                  {!orientation.current && ` Current version is ${orientation.current_version}.`}
                </span>
              ) : (
                <span style={{ color: "var(--text-3)" }}>The client sees the orientation on their Overview until they finish it and accept the policies.</span>
              )}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <Link href="/policies" className="btn-ghost" style={{ minHeight: 0, padding: "0.3rem 0.6rem", fontSize: "0.72rem" }}>View policies</Link>
                {orientation?.completed_at && (
                  <button
                    onClick={async () => {
                      if (!confirm("Ask this client to go through orientation again?")) return;
                      const data = await post("/api/portal/orientation", {}, "DELETE");
                      if (data) { ok("Orientation reset."); reload(["orientation"]); }
                    }}
                    className="btn-ghost" style={{ minHeight: 0, padding: "0.3rem 0.6rem", fontSize: "0.72rem" }}
                  ><RotateCcw size={11} /> Reset</button>
                )}
              </div>
            </div>
                </Panel>
                <Panel icon={LayoutGrid} title="Portal sections" hint="Switch on the services this client pays for">
                  {PORTAL_MODULES.filter((m) => !m.always).map((m) => {
                    const on = modules.includes(m.key);
                    return (
                      <div key={m.key} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.65rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.84rem", fontWeight: 650 }}>{m.label}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>{m.description}</div>
                        </div>
                        <button role="switch" aria-checked={on} aria-label={`${m.label} section`} onClick={() => toggleModule(m.key)} style={{
                          width: 38, height: 22, borderRadius: 99, border: "none", cursor: "pointer", flexShrink: 0, position: "relative",
                          background: on ? "var(--accent)" : "var(--surface-4)", transition: "background 0.2s",
                        }}>
                          <span style={{ position: "absolute", top: 3, left: on ? 19 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                        </button>
                      </div>
                    );
                  })}
                </Panel>
                <Panel icon={ImageIcon} title="Portal branding" hint="Client logo shown in their portal">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const data = await post("/api/portal/me", { logo_url: logoUrl }, "PATCH");
                if (data) { setClient({ ...client, logo_url: logoUrl || null }); ok(logoUrl ? "Logo saved." : "Logo removed."); }
              }}
              style={{ display: "flex", gap: "0.5rem", padding: "0.85rem 1.25rem", alignItems: "center" }}
            >
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- external client logo, unknown host
                <img src={logoUrl} alt="logo" style={{ width: 34, height: 34, borderRadius: 9, objectFit: "cover", border: "1px solid var(--border-2)", background: "#fff", flexShrink: 0 }} />
              )}
              <input className="field" placeholder="Client logo URL (shows in their portal)" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
              <button type="submit" className="btn-ghost" disabled={busy}>Save</button>
            </form>
                </Panel>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
