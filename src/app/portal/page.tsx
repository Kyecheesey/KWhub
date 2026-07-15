"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  LogOut, Send, Phone, Mail, Globe, UserCircle2,
  MessageSquare, Sparkles, Eye, ArrowLeft, CalendarPlus,
  Rocket, ThumbsUp, PencilLine, FolderOpen, Download,
  Upload, Receipt, ListChecks, Check, ExternalLink,
} from "lucide-react";

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

const STAGES = ["Discovery", "Design", "Build", "Review", "Launch"];
const POLL_MS = 20_000;

function msgTime(iso: string) {
  return new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
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
  const opts = ["#2dd4e8,#0ea5e9", "#818cf8,#6366f1", "#34d399,#059669", "#fb923c,#ea580c"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return `linear-gradient(135deg, ${opts[Math.abs(h) % opts.length]})`;
}
function invoiceState(inv: Invoice): { label: string; color: string } {
  if (inv.status === "paid") return { label: "Paid", color: "#36d399" };
  if (inv.status === "draft") return { label: "Draft", color: "#8b95c0" };
  if (inv.due_date && new Date(inv.due_date) < new Date()) return { label: "Overdue", color: "#f87171" };
  return { label: "Due", color: "#fbbf24" };
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [files, setFiles] = useState<PortalFile[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [respondingTo, setRespondingTo] = useState<number | null>(null);
  const [changeNote, setChangeNote] = useState("");
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
    ]).then(([me, msgs, projs, apprs, fls, invs, chk]) => {
      if (cancelled) return;
      if (!me.error) setClient(me);
      if (Array.isArray(msgs)) setMessages(msgs);
      if (Array.isArray(projs)) setProjects(projs);
      if (Array.isArray(apprs)) setApprovals(apprs);
      if (Array.isArray(fls)) setFiles(fls);
      if (Array.isArray(invs)) setInvoices(invs);
      if (Array.isArray(chk)) setChecklist(chk);
      setLoading(false);
    });
    const interval = setInterval(() => { loadMessages(); loadApprovals(); }, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [previewId, qs, loadMessages, loadApprovals]);

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
  const doneCount = checklist.filter((i) => i.done).length;

  return (
    <>
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
            background: "linear-gradient(135deg,#2dd4e8,#818cf8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: "0.75rem", color: "#07090f",
            boxShadow: "0 2px 12px rgba(45,212,232,0.35)",
          }}>KW</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--text-1)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>KW Innovations</div>
            <div style={{ fontSize: "0.6rem", color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>Client Portal</div>
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
          color: "#fbbf24", position: "sticky", top: 57, zIndex: 49,
        }}>
          <Eye size={13} />
          Preview mode — you&apos;re seeing this portal exactly as {client ? client.business_name : "the client"} sees it
        </div>
      )}

      {/* ── Body ── */}
      <main style={{ flex: 1, width: "100%", maxWidth: 860, margin: "0 auto", padding: "2rem 1.25rem 3rem", position: "relative" }}>
        {/* Hero */}
        <div className="fade-up" style={{ marginBottom: "1.75rem" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
            color: "var(--accent)", background: "rgba(45,212,232,0.1)",
            border: "1px solid rgba(45,212,232,0.2)", padding: "0.22rem 0.7rem", borderRadius: 99,
            marginBottom: "0.85rem",
          }}>
            <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
            {today}
          </span>
          <h1 style={{ fontSize: "clamp(1.7rem, 4vw, 2.3rem)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.12, marginBottom: "0.4rem" }}>
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

        {loading ? (
          <div style={{ display: "grid", gap: "1.25rem" }}>
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
            <div className="card" style={{ padding: "1.25rem", display: "grid", gap: "0.85rem" }}>
              <Skeleton height={14} width="35%" />
              <Skeleton height={52} width="70%" style={{ borderRadius: 12 }} />
              <Skeleton height={52} width="60%" style={{ borderRadius: 12, justifySelf: "end" }} />
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1.25rem" }}>

            {/* ── Pending approvals — front and centre ── */}
            {pendingApprovals.length > 0 && (
              <div className="card fade-up" style={{ overflow: "hidden", border: "1px solid rgba(251,191,36,0.35)" }}>
                <CardHeader icon={ThumbsUp} title="Waiting on your approval" extra={
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#fbbf24", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 99, padding: "0.15rem 0.55rem" }}>
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
                          <button onClick={() => respond(a, "changes_requested", changeNote)} className="btn-primary" style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b)" }}>
                            Send
                          </button>
                          <button onClick={() => { setRespondingTo(null); setChangeNote(""); }} className="btn-ghost">Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                          <button onClick={() => respond(a, "approved")} className="btn-primary" style={{ background: "linear-gradient(135deg,#36d399,#059669)" }}>
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
            )}

            {/* ── Your details ── */}
            {client && (
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
                        fontWeight: 900, fontSize: "0.95rem", color: "#07090f",
                        boxShadow: "0 4px 18px rgba(45,212,232,0.2)",
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
                        fontSize: "0.68rem", fontWeight: 800, color: "#07090f",
                      }}>
                        {client.assigned_to.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-1)" }}>{client.assigned_to}</div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>Your contact at KW Innovations</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Project tracker ── */}
            {projects.length > 0 && (
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
                          <div style={{ position: "absolute", top: 5, left: 0, width: `${pct}%`, height: 3, background: "linear-gradient(90deg,#2dd4e8,#818cf8)", borderRadius: 99, transition: "width 0.6s cubic-bezier(0.16,1,0.3,1)" }} />
                          <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
                            {STAGES.map((s, i) => {
                              const done = i < p.stage;
                              const current = i === p.stage;
                              return (
                                <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 0 }}>
                                  <div style={{
                                    width: current ? 13 : 11, height: current ? 13 : 11, borderRadius: "50%",
                                    background: done || current ? "linear-gradient(135deg,#2dd4e8,#818cf8)" : "var(--surface-3)",
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
            )}

            {/* ── Onboarding checklist ── */}
            {checklist.length > 0 && (
              <div className="card fade-up" style={{ overflow: "hidden", animationDelay: "0.14s" }}>
                <CardHeader icon={ListChecks} title="Onboarding" extra={
                  <span style={{ fontSize: "0.72rem", color: "var(--text-3)", fontWeight: 600 }}>{doneCount}/{checklist.length} complete</span>
                } />
                <div style={{ padding: "1rem 1.25rem" }}>
                  <div style={{ height: 6, background: "var(--surface-3)", borderRadius: 99, overflow: "hidden", marginBottom: "0.9rem" }}>
                    <div style={{ width: `${checklist.length ? (doneCount / checklist.length) * 100 : 0}%`, height: "100%", background: "linear-gradient(90deg,#36d399,#059669)", borderRadius: 99, transition: "width 0.5s ease" }} />
                  </div>
                  <div style={{ display: "grid", gap: "0.45rem" }}>
                    {checklist.map((item) => (
                      <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.55rem", opacity: item.done ? 0.65 : 1 }}>
                        <div style={{
                          width: 18, height: 18, borderRadius: 6, flexShrink: 0,
                          border: `2px solid ${item.done ? "#36d399" : "var(--border-3)"}`,
                          background: item.done ? "#36d399" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {item.done && <Check size={11} color="#07090f" strokeWidth={3} />}
                        </div>
                        <span style={{ fontSize: "0.84rem", color: "var(--text-1)", textDecoration: item.done ? "line-through" : "none" }}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Messages ── */}
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
                      background: "rgba(45,212,232,0.08)", border: "1px solid rgba(45,212,232,0.18)",
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
                        border: `1px solid ${mine ? "rgba(45,212,232,0.25)" : "var(--border)"}`,
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

            {/* ── Files ── */}
            <div className="card fade-up" style={{ overflow: "hidden", animationDelay: "0.22s" }}>
              <CardHeader icon={FolderOpen} title="Files & Deliverables" extra={
                <>
                  <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={uploadFile} />
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-ghost" style={{ minHeight: 0, padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>
                    <Upload size={12} /> {uploading ? "Uploading…" : "Upload"}
                  </button>
                </>
              } />
              {uploadErr && (
                <div style={{ margin: "0.75rem 1.25rem 0", padding: "0.55rem 0.8rem", borderRadius: 9, fontSize: "0.8rem", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
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

            {/* ── Invoices ── */}
            {invoices.length > 0 && (
              <div className="card fade-up" style={{ overflow: "hidden", animationDelay: "0.26s" }}>
                <CardHeader icon={Receipt} title="Invoices" />
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
              </div>
            )}

            <p className="fade-up" style={{ animationDelay: "0.3s", textAlign: "center", fontSize: "0.72rem", color: "var(--text-4)" }}>
              {isPreview
                ? `Previewing as ${client?.business_name ?? "client"} · signed in as ${session?.user?.name ?? "staff"}`
                : `Signed in as ${session?.user?.email ?? "client"} · KW Innovations Client Portal`}
            </p>
          </div>
        )}
      </main>
    </>
  );
}
