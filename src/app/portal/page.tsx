"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  LogOut, Send, Phone, Mail, Globe, UserCircle2,
  MessageSquare, Sparkles, Eye, ArrowLeft, CalendarPlus,
  Rocket, ThumbsUp, PencilLine, FolderOpen, Download,
  Upload, Receipt, ListChecks, Check, ExternalLink,
  LayoutDashboard, Megaphone, LifeBuoy, CalendarClock, Plus, X, Lock,
  Smartphone, Search, ShieldCheck, Cpu, Boxes,
} from "lucide-react";
import { platformInfo } from "@/lib/social/platforms";

interface ClientInfo {
  id: number;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  assigned_to: string | null;
  logo_url: string | null;
  booking_url: string | null;
}
interface Message { id: number; author: string | null; author_role: string; body: string; created_at: string; }
interface Project { id: number; name: string; stage: number; notes: string | null; updated_at: string; }
interface Approval { id: number; title: string; description: string | null; status: string; response_note: string | null; created_by: string | null; created_at: string; }
interface PortalFile { id: number; filename: string; url: string; size_bytes: number | null; uploaded_by: string | null; created_at: string; }
interface Invoice { id: number; number: string; amount_cents: number; due_date: string | null; status: string; pdf_url: string | null; pay_url: string | null; }
interface ChecklistItem { id: number; text: string; done: boolean; }
interface VisibleJob { id: number; title: string; description: string | null; status: string; due_date: string | null; updated_at: string; kind?: string; }
interface PostChannel { platform: string; publish_status: string; }
interface PostMedia { url: string; content_type: string | null; filename: string; }
interface Post {
  id: number; title: string | null; caption: string | null; scheduled_at: string | null;
  status: string; approval_note: string | null; published_at: string | null;
  channels: PostChannel[]; media: PostMedia[]; comment_count: number;
}
interface PostComment { id: number; author: string | null; author_role: string; body: string; created_at: string; }
interface SupportTicket { id: number; title: string; description: string | null; status: string; priority: string; created_at: string; updated_at: string; }
interface ServiceMetric { id: number; service: string; label: string; value: string; trend: string | null; trend_note: string | null; source_key: string | null; updated_at: string; }
interface ServiceUpdate { id: number; service: string; title: string; body: string | null; created_by: string | null; created_at: string; }

const JOB_STATUS: Record<string, { label: string; color: string }> = {
  todo: { label: "Queued", color: "#60a5fa" },
  in_progress: { label: "In progress", color: "#d97706" },
  in_review: { label: "In review", color: "#4f46e5" },
  done: { label: "Done", color: "#059669" },
};

const STAGES = ["Discovery", "Design", "Build", "Review", "Launch"];
const POLL_MS = 20_000;

const SECTIONS: { key: string; label: string; icon: React.FC<{ size?: number; color?: string }> }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "websites", label: "Websites", icon: Globe },
  { key: "apps", label: "Apps", icon: Smartphone },
  { key: "seo", label: "SEO", icon: Search },
  { key: "cybersecurity", label: "Cybersecurity", icon: ShieldCheck },
  { key: "ai", label: "AI", icon: Cpu },
  { key: "marketing", label: "Marketing", icon: Megaphone },
  { key: "systems", label: "Systems", icon: Boxes },
  { key: "support", label: "IT Support", icon: LifeBuoy },
  { key: "files", label: "Files", icon: FolderOpen },
  { key: "invoices", label: "Invoices", icon: Receipt },
];

/** Blurb shown on service sections that don't have bespoke portal content yet. */
const SERVICE_BLURB: Record<string, string> = {
  seo: "Search visibility and optimisation work — rankings, on-page fixes and reporting.",
  cybersecurity: "Security monitoring and protection for your website, email and systems.",
  ai: "AI and automation solutions built around how your business runs.",
  systems: "Your business systems and operations tooling — your ops, one login.",
};

const METRIC_TREND: Record<string, { glyph: string; color: string }> = {
  up: { glyph: "▲", color: "#059669" },
  down: { glyph: "▼", color: "#dc2626" },
  flat: { glyph: "—", color: "var(--text-3)" },
};

function MetricTiles({ metrics }: { metrics: ServiceMetric[] }) {
  if (metrics.length === 0) return null;
  return (
    <div className="fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
      {metrics.map((m) => {
        const t = m.trend ? METRIC_TREND[m.trend] : null;
        return (
          <div key={m.id} className="card" style={{ padding: "0.9rem 1rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.4rem", marginBottom: "0.3rem" }}>
              <span style={{ fontSize: "0.64rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-3)" }}>{m.label}</span>
              {m.source_key && (
                <span title={`Live data · updated ${msgTime(m.updated_at)}`} style={{ fontSize: "0.58rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "#059669", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 99, padding: "0.08rem 0.4rem", flexShrink: 0 }}>Live</span>
              )}
            </div>
            <div style={{ fontSize: "1.35rem", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1 }}>{m.value}</div>
            {(t || m.trend_note) && (
              <div style={{ marginTop: "0.35rem", fontSize: "0.7rem", fontWeight: 700, color: t?.color ?? "var(--text-3)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                {t && <span aria-hidden="true">{t.glyph}</span>}
                <span style={{ color: "var(--text-3)", fontWeight: 600 }}>{m.trend_note ?? (m.trend === "up" ? "Trending up" : m.trend === "down" ? "Trending down" : "Steady")}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UpdatesLog({ updates, label }: { updates: ServiceUpdate[]; label: string }) {
  return (
    <div className="card fade-up" style={{ animationDelay: "0.06s" }}>
      <div style={{ padding: "1rem 1.15rem 0.6rem", fontWeight: 800, fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <CalendarClock size={15} color="var(--accent)" /> Latest from the team
      </div>
      {updates.length === 0 ? (
        <p style={{ padding: "0 1.15rem 1.15rem", fontSize: "0.8rem", color: "var(--text-3)" }}>
          No updates yet — the team&apos;s first {label} update will appear here.
        </p>
      ) : updates.map((u) => (
        <div key={u.id} style={{ padding: "0.85rem 1.15rem", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: "0.86rem", flex: 1, minWidth: 160 }}>{u.title}</span>
            <span style={{ fontSize: "0.68rem", color: "var(--text-4)" }}>{msgTime(u.created_at)}</span>
          </div>
          {u.body && <p style={{ fontSize: "0.8rem", color: "var(--text-2)", lineHeight: 1.55, marginTop: "0.3rem", whiteSpace: "pre-wrap" }}>{u.body}</p>}
          {u.created_by && <p style={{ fontSize: "0.66rem", color: "var(--text-4)", marginTop: "0.3rem" }}>— {u.created_by}, KW Innovations</p>}
        </div>
      ))}
    </div>
  );
}

function msgTime(iso: string) {
  return new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
function postTime(iso: string | null) {
  if (!iso) return "Not scheduled yet";
  return new Date(iso).toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
function fileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function money(cents: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(cents / 100);
}
function avatarGradient(name: string) {
  const opts = ["#0891b2,#0ea5e9", "#4f46e5,#6366f1", "#059669,#059669", "#ea580c,#ea580c"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return `linear-gradient(135deg, ${opts[Math.abs(h) % opts.length]})`;
}
function invoiceState(inv: Invoice): { label: string; color: string } {
  if (inv.status === "paid") return { label: "Paid", color: "#10b981" };
  if (inv.status === "draft") return { label: "Draft", color: "#8b95c0" };
  if (inv.due_date && new Date(inv.due_date) < new Date()) return { label: "Overdue", color: "#dc2626" };
  return { label: "Due", color: "#d97706" };
}

function Skeleton({ height, width, style }: { height: number; width?: number | string; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ height, width: width ?? "100%", ...style }} />;
}

function CardHeader({ icon: Icon, title, extra }: { icon: React.FC<{ size?: number; color?: string }>; title: string; extra?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
      <Icon size={15} color="var(--accent)" />
      <span style={{ fontWeight: 800, fontSize: "0.92rem" }}>{title}</span>
      {extra && <span style={{ marginLeft: "auto" }}>{extra}</span>}
    </div>
  );
}

export default function PortalPage() {
  const { data: session } = useSession();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [modules, setModules] = useState<string[]>(["overview"]);
  const [serviceMetrics, setServiceMetrics] = useState<ServiceMetric[]>([]);
  const [serviceUpdates, setServiceUpdates] = useState<ServiceUpdate[]>([]);
  // Deep links: /portal?section=support (via /it-support) opens that tab directly
  const [section, setSection] = useState(() =>
    typeof window === "undefined"
      ? "overview"
      : new URLSearchParams(window.location.search).get("section") ?? "overview"
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [files, setFiles] = useState<PortalFile[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [visibleJobs, setVisibleJobs] = useState<VisibleJob[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [respondingTo, setRespondingTo] = useState<number | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const [postRespondingTo, setPostRespondingTo] = useState<number | null>(null);
  const [postChangeNote, setPostChangeNote] = useState("");
  const [openComments, setOpenComments] = useState<number | null>(null);
  const [postComments, setPostComments] = useState<PostComment[]>([]);
  const [postCommentDraft, setPostCommentDraft] = useState("");
  const [supportForm, setSupportForm] = useState({ title: "", description: "", priority: "medium" });
  const [supportSending, setSupportSending] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  // Staff preview: /portal?client=<id> renders that client's portal
  const [previewId, setPreviewId] = useState<number | null | "pending">("pending");
  const threadRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPreview = typeof previewId === "number";
  const qs = isPreview ? `?client_id=${previewId}` : "";

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("client");
    Promise.resolve().then(() => setPreviewId(param ? parseInt(param, 10) : null));
  }, []);

  const loadMessages = useCallback(() => {
    return fetch(`/api/portal/messages${qs}`)
      .then((r) => r.json())
      .then((msgs: Message[]) => { if (Array.isArray(msgs)) setMessages(msgs); })
      .catch(() => {});
  }, [qs]);

  const loadApprovals = useCallback(() => {
    return fetch(`/api/portal/approvals${qs}`)
      .then((r) => r.json())
      .then((data: Approval[]) => { if (Array.isArray(data)) setApprovals(data); })
      .catch(() => {});
  }, [qs]);

  const loadFiles = useCallback(() => {
    return fetch(`/api/portal/files${qs}`)
      .then((r) => r.json())
      .then((data: PortalFile[]) => { if (Array.isArray(data)) setFiles(data); })
      .catch(() => {});
  }, [qs]);

  const loadPosts = useCallback(() => {
    return fetch(`/api/portal/posts${qs}`)
      .then((r) => r.json())
      .then((data: Post[]) => { if (Array.isArray(data)) setPosts(data); })
      .catch(() => {});
  }, [qs]);

  const loadTickets = useCallback(() => {
    return fetch(`/api/portal/support${qs}`)
      .then((r) => r.json())
      .then((data: SupportTicket[]) => { if (Array.isArray(data)) setTickets(data); })
      .catch(() => {});
  }, [qs]);

  useEffect(() => {
    if (previewId === "pending") return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/portal/me${qs}`).then((r) => r.json()),
      fetch(`/api/portal/messages${qs}`).then((r) => r.json()),
      fetch(`/api/portal/projects${qs}`).then((r) => r.json()),
      fetch(`/api/portal/approvals${qs}`).then((r) => r.json()),
      fetch(`/api/portal/files${qs}`).then((r) => r.json()),
      fetch(`/api/portal/invoices${qs}`).then((r) => r.json()),
      fetch(`/api/portal/checklist${qs}`).then((r) => r.json()),
      fetch(`/api/portal/jobs${qs}`).then((r) => r.json()),
      fetch(`/api/portal/modules${qs}`).then((r) => r.json()),
      fetch(`/api/portal/posts${qs}`).then((r) => r.json()),
      fetch(`/api/portal/support${qs}`).then((r) => r.json()),
      fetch(`/api/portal/services${qs}`).then((r) => r.json()),
    ]).then(([me, msgs, projs, apprs, fls, invs, chk, jbs, mods, psts, tkts, svcs]) => {
      if (cancelled) return;
      if (!me.error) setClient(me);
      if (Array.isArray(msgs)) setMessages(msgs);
      if (Array.isArray(projs)) setProjects(projs);
      if (Array.isArray(apprs)) setApprovals(apprs);
      if (Array.isArray(fls)) setFiles(fls);
      if (Array.isArray(invs)) setInvoices(invs);
      if (Array.isArray(chk)) setChecklist(chk);
      if (Array.isArray(jbs)) setVisibleJobs(jbs);
      if (Array.isArray(mods?.enabled)) setModules(mods.enabled);
      if (Array.isArray(psts)) setPosts(psts);
      if (Array.isArray(tkts)) setTickets(tkts);
      if (Array.isArray(svcs?.metrics)) setServiceMetrics(svcs.metrics);
      if (Array.isArray(svcs?.updates)) setServiceUpdates(svcs.updates);
      setLoading(false);
    });
    const interval = setInterval(() => { loadMessages(); loadApprovals(); loadPosts(); }, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [previewId, qs, loadMessages, loadApprovals, loadPosts]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const res = await fetch("/api/portal/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isPreview ? { body, client_id: previewId } : { body }),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      setDraft("");
    }
    setSending(false);
  }

  async function respond(approval: Approval, status: "approved" | "changes_requested", note?: string) {
    await fetch("/api/portal/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: approval.id, status, response_note: note || null,
        ...(isPreview ? { client_id: previewId } : {}),
      }),
    });
    setRespondingTo(null);
    setChangeNote("");
    loadApprovals();
    loadMessages();
  }

  async function respondToPost(post: Post, status: "approved" | "changes_requested", note?: string) {
    await fetch("/api/portal/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: post.id, status, note: note || null,
        ...(isPreview ? { client_id: previewId } : {}),
      }),
    });
    setPostRespondingTo(null);
    setPostChangeNote("");
    loadPosts();
    loadMessages();
  }

  async function toggleComments(post: Post) {
    if (openComments === post.id) { setOpenComments(null); return; }
    setOpenComments(post.id);
    setPostComments([]);
    const sep = qs ? "&" : "?";
    const res = await fetch(`/api/portal/posts/comments${qs}${sep}post_id=${post.id}`);
    const data = await res.json().catch(() => []);
    if (Array.isArray(data)) setPostComments(data);
  }

  async function sendPostComment(post: Post) {
    const body = postCommentDraft.trim();
    if (!body) return;
    const res = await fetch("/api/portal/posts/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id: post.id, body, ...(isPreview ? { client_id: previewId } : {}) }),
    });
    if (res.ok) {
      const c = await res.json();
      setPostComments((prev) => [...prev, c]);
      setPostCommentDraft("");
    }
  }

  async function submitSupport(e: React.FormEvent) {
    e.preventDefault();
    if (!supportForm.title.trim() || supportSending) return;
    setSupportSending(true);
    const res = await fetch("/api/portal/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...supportForm, ...(isPreview ? { client_id: previewId } : {}) }),
    });
    if (res.ok) {
      setSupportForm({ title: "", description: "", priority: "medium" });
      setSupportOpen(false);
      loadTickets();
    }
    setSupportSending(false);
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadErr("");
    const fd = new FormData();
    fd.append("file", file);
    if (isPreview) fd.append("client_id", String(previewId));
    const res = await fetch("/api/portal/files", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) setUploadErr(data.error ?? "Upload failed.");
    else loadFiles();
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
  const pendingApprovals = approvals.filter((a) => a.status === "pending");
  const pendingPosts = posts.filter((p) => p.status === "pending_approval");
  const doneCount = checklist.filter((i) => i.done).length;
  const projectJobs = visibleJobs.filter((jb) => jb.kind !== "support");
  const enabledSections = SECTIONS.filter((s) => modules.includes(s.key));
  // Locked sections stay visible but greyed out until staff unlock them
  const isLocked = (key: string) => !modules.includes(key);
  const active = enabledSections.some((s) => s.key === section) ? section : "overview";
  const attention = (key: string) =>
    key === "marketing" ? pendingPosts.length : key === "overview" ? pendingApprovals.length : 0;

  // ── section blocks (rendered per active tab) ──

  const approvalsCard = pendingApprovals.length > 0 && (
    <div className="card fade-up" style={{ overflow: "hidden", border: "1px solid rgba(251,191,36,0.35)" }}>
      <CardHeader icon={ThumbsUp} title="Waiting on your approval" extra={
        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#d97706", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 99, padding: "0.15rem 0.55rem" }}>
          {pendingApprovals.length}
        </span>
      } />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {pendingApprovals.map((a) => (
          <div key={a.id} style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 800, fontSize: "0.92rem", marginBottom: "0.2rem" }}>{a.title}</div>
            {a.description && <p style={{ fontSize: "0.82rem", color: "var(--text-2)", lineHeight: 1.55, margin: "0 0 0.35rem" }}>{a.description}</p>}
            <div style={{ fontSize: "0.7rem", color: "var(--text-3)", marginBottom: "0.75rem" }}>
              Requested by {a.created_by ?? "KW team"} · {shortDate(a.created_at)}
            </div>
            {respondingTo === a.id ? (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <input
                  className="field"
                  placeholder="What would you like changed?"
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  autoFocus
                  style={{ flex: 1, minWidth: 200 }}
                />
                <button onClick={() => respond(a, "changes_requested", changeNote)} className="btn-primary" style={{ background: "linear-gradient(135deg,#d97706,#f59e0b)" }}>
                  Send
                </button>
                <button onClick={() => { setRespondingTo(null); setChangeNote(""); }} className="btn-ghost">Cancel</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button onClick={() => respond(a, "approved")} className="btn-primary" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                  <ThumbsUp size={14} /> Approve
                </button>
                <button onClick={() => setRespondingTo(a.id)} className="btn-ghost">
                  <PencilLine size={14} /> Request changes
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const detailsCard = client && (
    <div className="card fade-up" style={{ padding: "1.4rem", animationDelay: "0.06s", position: "relative", overflow: "hidden" }}>
      <div className="hero-glow" />
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "1rem" }}>
          {client.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- external client logo, unknown host
            <img src={client.logo_url} alt={client.business_name} style={{ width: 46, height: 46, borderRadius: 13, objectFit: "cover", flexShrink: 0, border: "1px solid var(--border-2)", background: "#fff" }} />
          ) : (
            <div style={{
              width: 46, height: 46, borderRadius: 13, flexShrink: 0,
              background: avatarGradient(client.business_name),
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 900, fontSize: "0.95rem", color: "#ffffff",
              boxShadow: "0 4px 18px rgba(79,70,229,0.2)",
            }}>
              {client.business_name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-0.01em" }}>{client.business_name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.72rem", color: "var(--accent-3)", fontWeight: 700 }}>
              <Sparkles size={11} /> Active client
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {client.contact_name && <span className="btn-ghost" style={{ minHeight: 0, padding: "0.4rem 0.75rem", fontSize: "0.78rem", cursor: "default" }}><UserCircle2 size={12} /> {client.contact_name}</span>}
          {client.phone && <a href={`tel:${client.phone}`} className="btn-ghost" style={{ minHeight: 0, padding: "0.4rem 0.75rem", fontSize: "0.78rem" }}><Phone size={12} /> {client.phone}</a>}
          {client.email && <a href={`mailto:${client.email}`} className="btn-ghost" style={{ minHeight: 0, padding: "0.4rem 0.75rem", fontSize: "0.78rem" }}><Mail size={12} /> {client.email}</a>}
          {client.website && <a href={client.website} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ minHeight: 0, padding: "0.4rem 0.75rem", fontSize: "0.78rem", color: "var(--accent)" }}><Globe size={12} /> {client.website.replace(/^https?:\/\//, "")}</a>}
        </div>

        {client.assigned_to && (
          <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
              background: avatarGradient(client.assigned_to),
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.68rem", fontWeight: 800, color: "#ffffff",
            }}>
              {client.assigned_to.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-1)" }}>{client.assigned_to}</div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>Your contact at KW Innovations</div>
            </div>
            <a href="mailto:director@kwinnovations.com.au" className="btn-ghost" style={{ marginLeft: "auto", minHeight: 0, padding: "0.4rem 0.75rem", fontSize: "0.78rem" }}>
              <Mail size={12} /> director@kwinnovations.com.au
            </a>
          </div>
        )}
      </div>
    </div>
  );

  const checklistCard = checklist.length > 0 && (
    <div className="card fade-up" style={{ overflow: "hidden", animationDelay: "0.14s" }}>
      <CardHeader icon={ListChecks} title="Onboarding" extra={
        <span style={{ fontSize: "0.72rem", color: "var(--text-3)", fontWeight: 600 }}>{doneCount}/{checklist.length} complete</span>
      } />
      <div style={{ padding: "1rem 1.25rem" }}>
        <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 99, overflow: "hidden", marginBottom: "0.9rem" }}>
          <div style={{ width: `${checklist.length ? (doneCount / checklist.length) * 100 : 0}%`, height: "100%", background: "linear-gradient(90deg,#10b981,#059669)", borderRadius: 99, transition: "width 0.5s ease" }} />
        </div>
        <div style={{ display: "grid", gap: "0.45rem" }}>
          {checklist.map((item) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.55rem", opacity: item.done ? 0.65 : 1 }}>
              <div style={{
                width: 18, height: 18, borderRadius: 6, flexShrink: 0,
                border: `2px solid ${item.done ? "#10b981" : "var(--border-3)"}`,
                background: item.done ? "#10b981" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {item.done && <Check size={11} color="#ffffff" strokeWidth={3} />}
              </div>
              <span style={{ fontSize: "0.84rem", color: "var(--text-1)", textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const messagesCard = (
    <div className="card fade-up" style={{ overflow: "hidden", animationDelay: "0.18s" }}>
      <CardHeader icon={MessageSquare} title="Updates & Messages" extra={
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.68rem", color: "var(--text-3)", fontWeight: 600 }}>
          <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-3)", display: "inline-block" }} />
          Live
        </span>
      } />
      <div ref={threadRef} style={{ maxHeight: 420, overflowY: "auto", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%", margin: "0 auto 0.7rem",
              background: "rgba(79,70,229,0.07)", border: "1px solid rgba(45,212,232,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <MessageSquare size={18} color="var(--accent)" />
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-2)", fontWeight: 600, marginBottom: "0.2rem" }}>No messages yet</p>
            <p style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>Say hello — the team will post project updates here.</p>
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.author_role === "client";
          return (
            <div key={m.id} className="msg-in" style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", animationDelay: `${Math.min(i * 0.04, 0.4)}s` }}>
              <div style={{
                maxWidth: "78%",
                background: mine ? "linear-gradient(135deg, rgba(45,212,232,0.14), rgba(14,165,233,0.1))" : "var(--surface-2)",
                border: `1px solid ${mine ? "rgba(79,70,229,0.25)" : "var(--border)"}`,
                borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                padding: "0.65rem 0.85rem",
              }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: mine ? "var(--accent)" : "#7c85f3", marginBottom: "0.2rem" }}>
                  {mine ? "You" : `${m.author ?? "KW Innovations"} · KW team`}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-1)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.body}</div>
                <div style={{ fontSize: "0.64rem", color: "var(--text-3)", marginTop: "0.25rem" }}>{msgTime(m.created_at)}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: "0.5rem", padding: "0.85rem 1.25rem", borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
        <input
          className="field"
          placeholder={isPreview ? "Reply as the KW team…" : "Write a message to the team…"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button onClick={send} disabled={sending || !draft.trim()} className="btn-primary" style={{ flexShrink: 0 }}>
          <Send size={14} /> {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );

  const jobsCard = projectJobs.length > 0 && (
    <div className="card fade-up" style={{ overflow: "hidden", animationDelay: "0.05s" }}>
      <CardHeader icon={Rocket} title="What we're working on" />
      <div>
        {projectJobs.map((jb, ji) => {
          const st = JOB_STATUS[jb.status] ?? JOB_STATUS.todo;
          return (
            <div key={jb.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.9rem 1.25rem", borderBottom: ji < projectJobs.length - 1 ? "1px solid var(--border)" : "none" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: st.color, flexShrink: 0, marginTop: 6 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.88rem", textDecoration: jb.status === "done" ? "line-through" : "none", color: jb.status === "done" ? "var(--text-3)" : "var(--text-1)" }}>{jb.title}</div>
                {jb.description && <div style={{ fontSize: "0.76rem", color: "var(--text-3)", lineHeight: 1.5, marginTop: 2 }}>{jb.description}</div>}
              </div>
              <span style={{ fontSize: "0.66rem", fontWeight: 700, color: st.color, background: `${st.color}14`, border: `1px solid ${st.color}30`, padding: "0.15rem 0.55rem", borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0 }}>
                {st.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const projectsCard = projects.length > 0 && (
    <div className="card fade-up" style={{ overflow: "hidden", animationDelay: "0.1s" }}>
      <CardHeader icon={Rocket} title="Your Projects" />
      <div>
        {projects.map((p, pi) => {
          const pct = (p.stage / (STAGES.length - 1)) * 100;
          return (
            <div key={p.id} style={{ padding: "1.1rem 1.25rem", borderBottom: pi < projects.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.85rem", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>{p.name}</span>
                <span style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>Updated {shortDate(p.updated_at)}</span>
              </div>
              {/* Progress line */}
              <div style={{ position: "relative", margin: "0 10px 0.5rem" }}>
                <div style={{ position: "absolute", top: 5, left: 0, right: 0, height: 3, background: "var(--surface-3)", borderRadius: 99 }} />
                <div style={{ position: "absolute", top: 5, left: 0, width: `${pct}%`, height: 3, background: "linear-gradient(90deg,#0891b2,#4f46e5)", borderRadius: 99, transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
                  {STAGES.map((s, i) => {
                    const done = i < p.stage;
                    const current = i === p.stage;
                    return (
                      <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 0 }}>
                        <div style={{
                          width: current ? 13 : 11, height: current ? 13 : 11, borderRadius: "50%",
                          background: done || current ? "linear-gradient(135deg,#0891b2,#4f46e5)" : "var(--surface-3)",
                          boxShadow: current ? "0 0 0 4px rgba(45,212,232,0.18), 0 0 14px rgba(45,212,232,0.5)" : "none",
                          transition: "all 0.3s",
                        }} />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                {STAGES.map((s, i) => (
                  <span key={s} style={{
                    fontSize: "0.62rem", fontWeight: i === p.stage ? 800 : 600,
                    color: i === p.stage ? "var(--accent)" : i < p.stage ? "var(--text-2)" : "var(--text-4)",
                    textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>{s}</span>
                ))}
              </div>
              {p.notes && <p style={{ fontSize: "0.78rem", color: "var(--text-3)", margin: "0.65rem 0 0", lineHeight: 1.5 }}>{p.notes}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );

  const filesCard = (
    <div className="card fade-up" style={{ overflow: "hidden", animationDelay: "0.1s" }}>
      <CardHeader icon={FolderOpen} title="Files & Deliverables" extra={
        <>
          <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={uploadFile} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-ghost" style={{ minHeight: 0, padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
            <Upload size={12} /> {uploading ? "Uploading…" : "Upload"}
          </button>
        </>
      } />
      {uploadErr && (
        <div style={{ margin: "0.75rem 1.25rem 0", padding: "0.55rem 0.8rem", borderRadius: 9, fontSize: "0.8rem", background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", color: "#dc2626" }}>
          {uploadErr}
        </div>
      )}
      {files.length === 0 ? (
        <p style={{ padding: "1.25rem", fontSize: "0.8rem", color: "var(--text-3)", textAlign: "center" }}>
          No files yet — mockups, documents and deliverables will appear here.
        </p>
      ) : (
        <div>
          {files.map((f, fi) => (
            <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" style={{
              display: "flex", alignItems: "center", gap: "0.7rem",
              padding: "0.7rem 1.25rem", textDecoration: "none",
              borderBottom: fi < files.length - 1 ? "1px solid var(--border)" : "none",
            }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: "rgba(124,133,243,0.1)", border: "1px solid rgba(124,133,243,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Download size={14} color="#7c85f3" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.filename}</div>
                <div style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>
                  {[fileSize(f.size_bytes), f.uploaded_by, shortDate(f.created_at)].filter(Boolean).join(" · ")}
                </div>
              </div>
              <ExternalLink size={13} color="var(--text-3)" />
            </a>
          ))}
        </div>
      )}
    </div>
  );

  const invoicesCard = (
    <div className="card fade-up" style={{ overflow: "hidden", animationDelay: "0.1s" }}>
      <CardHeader icon={Receipt} title="Invoices" />
      {invoices.filter((inv) => inv.status !== "draft").length === 0 ? (
        <p style={{ padding: "1.25rem", fontSize: "0.8rem", color: "var(--text-3)", textAlign: "center" }}>No invoices yet.</p>
      ) : (
        <div>
          {invoices.filter((inv) => inv.status !== "draft").map((inv, ii, arr) => {
            const st = invoiceState(inv);
            return (
              <div key={inv.id} style={{
                display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap",
                padding: "0.8rem 1.25rem",
                borderBottom: ii < arr.length - 1 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>{inv.number}</div>
                  {inv.due_date && <div style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>Due {shortDate(inv.due_date)}</div>}
                </div>
                <span style={{ fontSize: "0.95rem", fontWeight: 800, fontFamily: "var(--font-geist-mono)" }}>{money(inv.amount_cents)}</span>
                <span style={{
                  fontSize: "0.66rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                  color: st.color, background: `${st.color}14`, border: `1px solid ${st.color}30`,
                  borderRadius: 99, padding: "0.18rem 0.6rem",
                }}>{st.label}</span>
                {inv.pdf_url && <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ minHeight: 0, padding: "0.3rem 0.6rem", fontSize: "0.72rem" }}>View</a>}
                {inv.pay_url && inv.status !== "paid" && <a href={inv.pay_url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ minHeight: 0, padding: "0.3rem 0.7rem", fontSize: "0.72rem" }}>Pay now</a>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  function postCard(p: Post) {
    const pending = p.status === "pending_approval";
    const statusMeta: Record<string, { label: string; color: string }> = {
      pending_approval: { label: "Waiting on you", color: "#d97706" },
      approved: { label: "Approved — scheduled", color: "#059669" },
      changes_requested: { label: "Changes requested", color: "#dc2626" },
      published: { label: "Published", color: "#4f46e5" },
    };
    const st = statusMeta[p.status] ?? { label: p.status, color: "#8b95c0" };
    return (
      <div key={p.id} style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.45rem" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.72rem", fontWeight: 700, color: "var(--text-2)" }}>
            <CalendarClock size={12} /> {postTime(p.scheduled_at)}
          </span>
          <span style={{ display: "inline-flex", gap: 4 }}>
            {p.channels.map((ch, i) => {
              const info = platformInfo(ch.platform);
              return (
                <span key={i} style={{ fontSize: "0.64rem", fontWeight: 700, color: info.color, background: `${info.color}12`, border: `1px solid ${info.color}30`, borderRadius: 99, padding: "0.1rem 0.5rem" }}>
                  {info.label}
                </span>
              );
            })}
          </span>
          <span style={{ marginLeft: "auto", fontSize: "0.66rem", fontWeight: 700, color: st.color, background: `${st.color}14`, border: `1px solid ${st.color}30`, borderRadius: 99, padding: "0.15rem 0.55rem" }}>
            {st.label}
          </span>
        </div>
        {p.title && <div style={{ fontWeight: 800, fontSize: "0.9rem", marginBottom: "0.25rem" }}>{p.title}</div>}
        {p.caption && <p style={{ fontSize: "0.85rem", color: "var(--text-1)", lineHeight: 1.55, whiteSpace: "pre-wrap", margin: "0 0 0.6rem" }}>{p.caption}</p>}
        {p.media.length > 0 && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
            {p.media.map((m, i) => m.content_type?.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element -- blob-store media
              <img key={i} src={m.url} alt={m.filename} style={{ width: 110, height: 110, objectFit: "cover", borderRadius: 12, border: "1px solid var(--border-2)" }} />
            ) : (
              <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ minHeight: 0, padding: "0.35rem 0.7rem", fontSize: "0.74rem" }}>
                <Download size={12} /> {m.filename}
              </a>
            ))}
          </div>
        )}
        {p.status === "changes_requested" && p.approval_note && (
          <div style={{ fontSize: "0.76rem", color: "#dc2626", marginBottom: "0.5rem" }}>Your note: {p.approval_note}</div>
        )}
        {pending && (
          postRespondingTo === p.id ? (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
              <input
                className="field"
                placeholder="What would you like changed?"
                value={postChangeNote}
                onChange={(e) => setPostChangeNote(e.target.value)}
                autoFocus
                style={{ flex: 1, minWidth: 200 }}
              />
              <button onClick={() => respondToPost(p, "changes_requested", postChangeNote)} className="btn-primary" style={{ background: "linear-gradient(135deg,#d97706,#f59e0b)" }}>Send</button>
              <button onClick={() => { setPostRespondingTo(null); setPostChangeNote(""); }} className="btn-ghost">Cancel</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.4rem" }}>
              <button onClick={() => respondToPost(p, "approved")} className="btn-primary" style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                <ThumbsUp size={14} /> Approve
              </button>
              <button onClick={() => setPostRespondingTo(p.id)} className="btn-ghost">
                <PencilLine size={14} /> Request changes
              </button>
            </div>
          )
        )}
        <button onClick={() => toggleComments(p)} className="btn-ghost" style={{ minHeight: 0, padding: "0.3rem 0.6rem", fontSize: "0.72rem" }}>
          <MessageSquare size={12} /> {openComments === p.id ? "Hide comments" : `Comments${p.comment_count ? ` (${p.comment_count})` : ""}`}
        </button>
        {openComments === p.id && (
          <div style={{ marginTop: "0.6rem", display: "grid", gap: "0.45rem" }}>
            {postComments.map((c) => (
              <div key={c.id} style={{ fontSize: "0.8rem", padding: "0.5rem 0.7rem", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <span style={{ fontWeight: 700, color: c.author_role === "client" ? "var(--accent)" : "#7c85f3" }}>
                  {c.author_role === "client" ? "You" : `${c.author ?? "KW"} · KW team`}:
                </span>{" "}
                {c.body}
              </div>
            ))}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input className="field" placeholder="Add a comment…" value={postCommentDraft}
                     onChange={(e) => setPostCommentDraft(e.target.value)}
                     onKeyDown={(e) => e.key === "Enter" && sendPostComment(p)} />
              <button onClick={() => sendPostComment(p)} disabled={!postCommentDraft.trim()} className="btn-primary" style={{ flexShrink: 0 }}><Send size={13} /></button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const marketingSection = (
    <>
      <div className="card fade-up" style={{ overflow: "hidden", border: pendingPosts.length > 0 ? "1px solid rgba(251,191,36,0.35)" : undefined }}>
        <CardHeader icon={Megaphone} title="Content awaiting your approval" extra={
          pendingPosts.length > 0 ? (
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#d97706", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 99, padding: "0.15rem 0.55rem" }}>
              {pendingPosts.length}
            </span>
          ) : undefined
        } />
        {pendingPosts.length === 0 ? (
          <p style={{ padding: "1.25rem", fontSize: "0.8rem", color: "var(--text-3)", textAlign: "center" }}>
            Nothing waiting on you — new posts will appear here for sign-off before they go live.
          </p>
        ) : (
          <div>{pendingPosts.map((p) => postCard(p))}</div>
        )}
      </div>
      {posts.filter((p) => p.status !== "pending_approval").length > 0 && (
        <div className="card fade-up" style={{ overflow: "hidden", animationDelay: "0.08s" }}>
          <CardHeader icon={CalendarClock} title="Upcoming & published" />
          <div>{posts.filter((p) => p.status !== "pending_approval").map((p) => postCard(p))}</div>
        </div>
      )}
    </>
  );

  const supportSection = (
    <div className="card fade-up" style={{ overflow: "hidden" }}>
      <CardHeader icon={LifeBuoy} title="IT Support" extra={
        <button onClick={() => setSupportOpen((v) => !v)} className="btn-primary" style={{ minHeight: 0, padding: "0.35rem 0.8rem", fontSize: "0.75rem" }}>
          {supportOpen ? <><X size={12} /> Cancel</> : <><Plus size={12} /> New request</>}
        </button>
      } />
      {supportOpen && (
        <form onSubmit={submitSupport} style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)", display: "grid", gap: "0.6rem", background: "var(--surface-2)" }}>
          <input className="field" placeholder="What's the issue? e.g. Website contact form not sending" value={supportForm.title}
                 onChange={(e) => setSupportForm({ ...supportForm, title: e.target.value })} autoFocus />
          <textarea className="field" placeholder="Any extra detail — what you saw, when it started…" rows={3} value={supportForm.description}
                    onChange={(e) => setSupportForm({ ...supportForm, description: e.target.value })}
                    style={{ resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <select className="field" value={supportForm.priority} onChange={(e) => setSupportForm({ ...supportForm, priority: e.target.value })} style={{ maxWidth: 170 }}>
              <option value="low">Low — when you can</option>
              <option value="medium">Normal</option>
              <option value="high">Urgent</option>
            </select>
            <button type="submit" className="btn-primary" disabled={supportSending || !supportForm.title.trim()}>
              <Send size={13} /> {supportSending ? "Sending…" : "Send request"}
            </button>
          </div>
        </form>
      )}
      {tickets.length === 0 ? (
        <p style={{ padding: "1.25rem", fontSize: "0.8rem", color: "var(--text-3)", textAlign: "center" }}>
          No support requests yet — anything you raise here goes straight to the KW team.
        </p>
      ) : (
        <div>
          {tickets.map((t, ti) => {
            const st = JOB_STATUS[t.status] ?? JOB_STATUS.todo;
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.9rem 1.25rem", borderBottom: ti < tickets.length - 1 ? "1px solid var(--border)" : "none" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: st.color, flexShrink: 0, marginTop: 6 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.88rem", color: t.status === "done" ? "var(--text-3)" : "var(--text-1)" }}>{t.title}</div>
                  {t.description && <div style={{ fontSize: "0.76rem", color: "var(--text-3)", lineHeight: 1.5, marginTop: 2 }}>{t.description}</div>}
                  <div style={{ fontSize: "0.66rem", color: "var(--text-3)", marginTop: 3 }}>Raised {shortDate(t.created_at)}{t.priority === "high" ? " · Urgent" : ""}</div>
                </div>
                <span style={{ fontSize: "0.66rem", fontWeight: 700, color: st.color, background: `${st.color}14`, border: `1px solid ${st.color}30`, padding: "0.15rem 0.55rem", borderRadius: 99, whiteSpace: "nowrap", flexShrink: 0 }}>
                  {t.status === "done" ? "Resolved" : st.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        .portal-layout { display: flex; gap: 1.5rem; align-items: flex-start; }
        .portal-side { position: sticky; top: ${isPreview ? "108px" : "78px"}; width: 200px; flex-shrink: 0; display: flex; flex-direction: column; gap: 0.25rem; }
        .portal-tabs { display: none; }
        @media (max-width: 760px) {
          .portal-side { display: none; }
          .portal-layout { display: block; }
          .portal-tabs { display: flex; gap: 0.4rem; overflow-x: auto; padding-bottom: 0.35rem; margin-bottom: 1rem; -webkit-overflow-scrolling: touch; }
        }
      `}</style>

      {/* Ambient background */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div className="login-blob" style={{ width: 420, height: 420, top: -140, right: -120, background: "rgba(45,212,232,0.09)" }} />
        <div className="login-blob" style={{ width: 360, height: 360, bottom: -140, left: -100, background: "rgba(124,133,243,0.08)", animationDelay: "-7s" }} />
      </div>

      {/* ── Header ── */}
      <header className="glass" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.85rem 1.25rem", borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "linear-gradient(135deg,#0891b2,#4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: "0.75rem", color: "#ffffff",
            boxShadow: "0 2px 12px rgba(45,212,232,0.35)",
          }}>KW</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--text-1)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>KW Innovations</div>
            <div style={{ fontSize: "0.6rem", color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>Client Dashboard</div>
          </div>
        </div>
        {isPreview ? (
          <Link href={`/clients/${previewId}/portal`} className="btn-ghost" style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem", minHeight: 0 }}>
            <ArrowLeft size={13} /> Exit Preview
          </Link>
        ) : (
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="btn-ghost" style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem", minHeight: 0 }}>
            <LogOut size={13} /> Sign out
          </button>
        )}
      </header>

      {/* ── Preview banner ── */}
      {isPreview && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
          padding: "0.5rem 1rem", fontSize: "0.78rem", fontWeight: 700,
          background: "rgba(251,191,36,0.1)", borderBottom: "1px solid rgba(251,191,36,0.25)",
          color: "#d97706", position: "sticky", top: 57, zIndex: 49,
        }}>
          <Eye size={13} />
          Preview mode — you&apos;re seeing this dashboard exactly as {client ? client.business_name : "the client"} sees it
        </div>
      )}

      {/* ── Body ── */}
      <main style={{ flex: 1, width: "100%", maxWidth: 1080, margin: "0 auto", padding: "2rem 1.25rem 3rem", position: "relative" }}>
        {loading ? (
          <div style={{ display: "grid", gap: "1.25rem", maxWidth: 860 }}>
            <div className="card" style={{ padding: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                <Skeleton height={44} width={44} style={{ borderRadius: 12, flexShrink: 0 }} />
                <div style={{ flex: 1, display: "grid", gap: "0.5rem" }}>
                  <Skeleton height={14} width="45%" />
                  <Skeleton height={10} width="28%" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                <Skeleton height={12} /><Skeleton height={12} />
              </div>
            </div>
            <div className="card" style={{ padding: "1.25rem", display: "grid", gap: "0.85rem" }}>
              <Skeleton height={14} width="35%" />
              <Skeleton height={40} style={{ borderRadius: 10 }} />
            </div>
          </div>
        ) : (
          <div className="portal-layout">
            {/* ── Sidebar (desktop) ── */}
            <nav className="portal-side">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const locked = isLocked(s.key);
                const on = !locked && active === s.key;
                const dot = locked ? 0 : attention(s.key);
                return (
                  <button key={s.key} onClick={() => !locked && setSection(s.key)} disabled={locked}
                    title={locked ? `${s.label} is locked — it unlocks when this service is added to your plan` : undefined}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.6rem", width: "100%",
                      padding: "0.6rem 0.85rem", borderRadius: 11, cursor: locked ? "not-allowed" : "pointer", textAlign: "left",
                      border: `1px solid ${on ? "rgba(79,70,229,0.3)" : "transparent"}`,
                      background: on ? "linear-gradient(135deg, rgba(45,212,232,0.1), rgba(124,133,243,0.08))" : "transparent",
                      color: on ? "var(--text-1)" : locked ? "var(--text-4)" : "var(--text-2)",
                      fontWeight: on ? 800 : 600, fontSize: "0.84rem",
                      opacity: locked ? 0.55 : 1,
                    }}>
                    <Icon size={15} color={on ? "var(--accent)" : locked ? "var(--text-4)" : "var(--text-3)"} />
                    <span style={{ flex: 1 }}>{s.label}</span>
                    {locked && <Lock size={12} color="var(--text-4)" />}
                    {dot > 0 && (
                      <span style={{ fontSize: "0.62rem", fontWeight: 800, color: "#fff", background: "#d97706", borderRadius: 99, padding: "0.05rem 0.4rem", minWidth: 17, textAlign: "center" }}>{dot}</span>
                    )}
                  </button>
                );
              })}
              <div style={{ marginTop: "0.75rem", padding: "0.75rem 0.85rem", borderRadius: 11, border: "1px dashed var(--border-2)", fontSize: "0.66rem", color: "var(--text-4)", lineHeight: 1.5 }}>
                Locked sections unlock as services are added to your plan — message the KW team to get one switched on.
              </div>
            </nav>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* ── Tabs (mobile) ── */}
              <div className="portal-tabs">
                {SECTIONS.map((s) => {
                  const Icon = s.icon;
                  const locked = isLocked(s.key);
                  const on = !locked && active === s.key;
                  const dot = locked ? 0 : attention(s.key);
                  return (
                    <button key={s.key} onClick={() => !locked && setSection(s.key)} disabled={locked} style={{
                      display: "inline-flex", alignItems: "center", gap: "0.4rem", whiteSpace: "nowrap",
                      padding: "0.45rem 0.8rem", borderRadius: 99, cursor: locked ? "not-allowed" : "pointer", flexShrink: 0,
                      border: `1px solid ${on ? "rgba(79,70,229,0.3)" : "var(--border)"}`,
                      background: on ? "linear-gradient(135deg, rgba(45,212,232,0.12), rgba(124,133,243,0.1))" : "var(--surface)",
                      color: on ? "var(--text-1)" : locked ? "var(--text-4)" : "var(--text-2)", fontWeight: 700, fontSize: "0.76rem",
                      opacity: locked ? 0.55 : 1,
                    }}>
                      <Icon size={13} color={on ? "var(--accent)" : locked ? "var(--text-4)" : "var(--text-3)"} /> {s.label}
                      {locked && <Lock size={11} color="var(--text-4)" />}
                      {dot > 0 && <span style={{ fontSize: "0.6rem", fontWeight: 800, color: "#fff", background: "#d97706", borderRadius: 99, padding: "0 0.35rem" }}>{dot}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Hero (overview only) */}
              {active === "overview" && (
                <div className="fade-up" style={{ marginBottom: "1.5rem" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: "0.4rem",
                    fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                    color: "var(--accent)", background: "rgba(45,212,232,0.1)",
                    border: "1px solid rgba(79,70,229,0.2)", padding: "0.22rem 0.7rem", borderRadius: 99,
                    marginBottom: "0.85rem",
                  }}>
                    <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
                    {today}
                  </span>
                  <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.1rem)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.12, marginBottom: "0.4rem" }}>
                    {greeting}{client ? "," : ""} {client && <span className="grad-text">{client.contact_name ?? client.business_name}</span>}
                  </h1>
                  <p style={{ color: "var(--text-2)", fontSize: "0.92rem", maxWidth: 520, lineHeight: 1.6, marginBottom: client?.booking_url ? "1rem" : 0 }}>
                    Your window into everything we&apos;re working on together — updates from the team and a direct line to us.
                  </p>
                  {client?.booking_url && (
                    <a href={client.booking_url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ fontSize: "0.82rem" }}>
                      <CalendarPlus size={14} /> Book a call with us
                    </a>
                  )}
                </div>
              )}

              <div style={{ display: "grid", gap: "1.25rem" }}>
                {active === "overview" && (
                  <>
                    {/* ── At-a-glance tiles ── */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.6rem" }}>
                      {([
                        {
                          label: "Awaiting your approval",
                          value: pendingApprovals.length + (modules.includes("marketing") ? pendingPosts.length : 0),
                          color: "#d97706", icon: ThumbsUp,
                          target: pendingPosts.length > 0 && modules.includes("marketing") ? "marketing" : "overview",
                        },
                        modules.includes("marketing") ? {
                          label: "Next post scheduled",
                          value: (() => {
                            const next = posts.filter((p) => ["approved", "pending_approval"].includes(p.status) && p.scheduled_at && new Date(p.scheduled_at) > new Date())
                              .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())[0];
                            return next?.scheduled_at ? new Date(next.scheduled_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "—";
                          })(),
                          color: "#4f46e5", icon: CalendarClock, target: "marketing",
                        } : null,
                        modules.includes("support") ? {
                          label: "Open requests",
                          value: tickets.filter((t) => t.status !== "done").length,
                          color: "#0284c7", icon: LifeBuoy, target: "support",
                        } : null,
                        modules.includes("invoices") ? {
                          label: "Invoices due",
                          value: invoices.filter((i) => !["paid", "draft"].includes(i.status)).length,
                          color: "#dc2626", icon: Receipt, target: "invoices",
                        } : null,
                      ].filter(Boolean) as { label: string; value: number | string; color: string; icon: React.FC<{ size?: number; color?: string }>; target: string }[]).map((tile) => {
                        const Icon = tile.icon;
                        return (
                          <button key={tile.label} onClick={() => setSection(tile.target)} className="card fade-up" style={{ padding: "0.8rem 0.9rem", textAlign: "left", cursor: "pointer" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.45rem" }}>
                              <span style={{ width: 24, height: 24, borderRadius: 7, background: `${tile.color}14`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                                <Icon size={12} color={tile.color} />
                              </span>
                              <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", lineHeight: 1.2 }}>{tile.label}</span>
                            </div>
                            <div style={{ fontSize: "1.35rem", fontWeight: 900, color: "var(--text-1)", lineHeight: 1 }}>{tile.value}</div>
                          </button>
                        );
                      })}
                    </div>

                    {pendingPosts.length > 0 && modules.includes("marketing") && (
                      <button onClick={() => setSection("marketing")} className="card fade-up" style={{
                        display: "flex", alignItems: "center", gap: "0.7rem", padding: "0.85rem 1.1rem",
                        border: "1px solid rgba(251,191,36,0.35)", cursor: "pointer", textAlign: "left", width: "100%",
                      }}>
                        <Megaphone size={16} color="#d97706" />
                        <span style={{ fontSize: "0.85rem", fontWeight: 700, flex: 1 }}>
                          {pendingPosts.length} post{pendingPosts.length === 1 ? "" : "s"} waiting for your approval in Marketing
                        </span>
                        <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--accent)" }}>Review →</span>
                      </button>
                    )}
                    {approvalsCard}
                    {detailsCard}
                    {checklistCard}
                    {messagesCard}
                  </>
                )}
                {active === "marketing" && marketingSection}
                {(active === "websites" || active === "apps") && (
                  <>
                    <MetricTiles metrics={serviceMetrics.filter((m) => m.service === active)} />
                    {jobsCard}
                    {projectsCard}
                    {serviceUpdates.some((u) => u.service === active) && (
                      <UpdatesLog updates={serviceUpdates.filter((u) => u.service === active)} label={active === "apps" ? "Apps" : "Websites"} />
                    )}
                    {!jobsCard && !projectsCard && (
                      <div className="card fade-up" style={{ padding: "1.5rem", textAlign: "center", fontSize: "0.82rem", color: "var(--text-3)" }}>
                        Nothing in flight right now — active {active === "apps" ? "app" : "website"} projects and work will show up here.
                      </div>
                    )}
                  </>
                )}
                {SERVICE_BLURB[active] && (() => {
                  const s = SECTIONS.find((x) => x.key === active)!;
                  const Icon = s.icon;
                  const metrics = serviceMetrics.filter((m) => m.service === active);
                  const updates = serviceUpdates.filter((u) => u.service === active);
                  if (metrics.length === 0 && updates.length === 0) {
                    return (
                      <div className="card fade-up" style={{ padding: "2rem 1.5rem", textAlign: "center" }}>
                        <div style={{ width: 48, height: 48, borderRadius: 14, margin: "0 auto 0.85rem", background: "rgba(79,70,229,0.08)", border: "1px solid rgba(79,70,229,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={22} color="var(--accent)" />
                        </div>
                        <h2 style={{ fontSize: "1.1rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.35rem" }}>{s.label}</h2>
                        <p style={{ fontSize: "0.85rem", color: "var(--text-2)", lineHeight: 1.6, maxWidth: 420, margin: "0 auto 0.85rem" }}>
                          {SERVICE_BLURB[active]}
                        </p>
                        <p style={{ fontSize: "0.76rem", color: "var(--text-3)" }}>
                          This service is active on your plan — the team&apos;s first update will appear here shortly.
                        </p>
                      </div>
                    );
                  }
                  return (
                    <>
                      {/* Section header */}
                      <div className="fade-up" style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(79,70,229,0.08)", border: "1px solid rgba(79,70,229,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={19} color="var(--accent)" />
                        </div>
                        <div>
                          <h2 style={{ fontSize: "1.1rem", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.2 }}>{s.label}</h2>
                          <p style={{ fontSize: "0.76rem", color: "var(--text-3)" }}>{SERVICE_BLURB[active]}</p>
                        </div>
                      </div>

                      <MetricTiles metrics={metrics} />
                      <UpdatesLog updates={updates} label={s.label} />
                    </>
                  );
                })()}
                {active === "support" && supportSection}
                {active === "files" && filesCard}
                {active === "invoices" && invoicesCard}

                <p className="fade-up" style={{ animationDelay: "0.3s", textAlign: "center", fontSize: "0.72rem", color: "var(--text-4)" }}>
                  {isPreview
                    ? `Previewing as ${client?.business_name ?? "client"} · signed in as ${session?.user?.name ?? "staff"}`
                    : `Signed in as ${session?.user?.email ?? "client"} · KW Innovations Client Dashboard`}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
