"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { swrJson } from "@/lib/cache";
import {
  Users, Megaphone, Plus, UserPlus, KeyRound, Trash2, ExternalLink,
  CheckCircle2, AlertCircle, Clock, Send, LogOut, CalendarDays,
  Globe, Mail, Phone, Sparkles, ShieldCheck, ArrowRight, X,
  Briefcase, ListTodo, MessageSquare, Paperclip, ImageIcon, Palette,
  ChevronLeft, ChevronRight, List, LayoutGrid,
} from "lucide-react";

/**
 * Partner workspace — the standalone platform partner agencies (e.g. Jed at
 * GC Media Group) use to run marketing for their own clients. Their clients
 * sign in to the normal client portal (white-labelled with the partner's
 * branding); everything here is scoped server-side to the partner's own org,
 * completely separate from KW Innovations' data.
 */

interface Me {
  partner: { id: number; name: string; slug: string; contact_name: string | null; logo_url: string | null; accent_color: string | null };
  user: { name: string | null };
  counts: { clients: number; scheduled_posts: number; pending_approval: number };
}
interface Client {
  id: number; business_name: string; contact_name: string | null; phone: string | null;
  email: string | null; website: string | null; portal_logins: number; post_count: number;
}
interface PortalLogin { id: number; name: string; username: string }
interface Media { id: number; url: string; filename: string; content_type: string | null }
interface Post {
  id: number; client_id: number; title: string | null; caption: string | null;
  scheduled_at: string | null; status: string; business_name: string; comment_count: number;
  approval_note: string | null; media: Media[];
}
interface Comment { id: number; author: string | null; author_role: string; body: string; created_at: string }
interface Job {
  id: number; client_id: number; title: string; description: string | null; status: string;
  priority: string; due_date: string | null; kind: string; business_name: string;
  visible_to_client: boolean; created_at: string;
}
interface Todo { id: number; text: string; done: boolean; created_at: string }

const DEFAULT_ACCENT = "#7c3aed";

// Content planner rollout switch: false shows a polished "not ready yet"
// panel on the Content tab (everything else stays live). Flip to true and
// redeploy when it's ready for partners to use.
const CONTENT_READY = false;

const card: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
};

const POST_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:             { label: "Draft",             color: "#8892b0", bg: "rgba(136,146,176,0.12)" },
  pending_approval:  { label: "Awaiting approval", color: "#d97706", bg: "rgba(251,191,36,0.14)"  },
  approved:          { label: "Approved",          color: "#059669", bg: "rgba(52,211,153,0.14)"  },
  changes_requested: { label: "Changes requested", color: "#dc2626", bg: "rgba(248,113,113,0.14)" },
  published:         { label: "Published",         color: "#4f46e5", bg: "rgba(129,140,248,0.14)" },
};
const FILTERS = [
  ["all", "All"], ["draft", "Drafts"], ["pending_approval", "Awaiting approval"],
  ["changes_requested", "Changes requested"], ["approved", "Approved"], ["published", "Published"],
] as const;

const JOB_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  todo:        { label: "To do",       color: "#8892b0", bg: "rgba(136,146,176,0.12)" },
  in_progress: { label: "In progress", color: "#d97706", bg: "rgba(251,191,36,0.14)"  },
  done:        { label: "Done",        color: "#059669", bg: "rgba(52,211,153,0.14)"  },
};

const CLIENT_GRADS = [
  "linear-gradient(135deg,#7c3aed,#4f46e5)",
  "linear-gradient(135deg,#0ea5e9,#4f46e5)",
  "linear-gradient(135deg,#059669,#0ea5e9)",
  "linear-gradient(135deg,#db2777,#7c3aed)",
  "linear-gradient(135deg,#d97706,#db2777)",
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}
function greet(h: number) {
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PartnerWorkspace() {
  const [me, setMe] = useState<Me | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tab, setTab] = useState<"clients" | "content" | "jobs" | "mylist">("clients");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pageLoadedAt] = useState(() => new Date()); // stable "now" for greeting + stats

  // Clients tab state
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({ business_name: "", contact_name: "", phone: "", email: "", website: "" });
  const [openClient, setOpenClient] = useState<number | null>(null);
  const [logins, setLogins] = useState<Record<number, PortalLogin[]>>({});
  const [newLogin, setNewLogin] = useState({ username: "", password: "", display_name: "", send_welcome: true, email_password: true });

  // Content tab state
  const [contentClient, setContentClient] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [contentView, setContentView] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showAddPost, setShowAddPost] = useState(false);
  const [newPost, setNewPost] = useState({ client_id: "", title: "", caption: "", scheduled_at: "", submit: false });
  const newPostFile = useRef<HTMLInputElement>(null);
  const [openComments, setOpenComments] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [newComment, setNewComment] = useState("");
  const [uploadingPost, setUploadingPost] = useState<number | null>(null);

  // Jobs tab state
  const [jobClient, setJobClient] = useState<number | "all">("all");
  const [showAddJob, setShowAddJob] = useState(false);
  const [newJob, setNewJob] = useState({ client_id: "", title: "", description: "", priority: "medium", due_date: "", visible_to_client: false });

  // My list state
  const [newTodo, setNewTodo] = useState("");

  // Branding state
  const [showBranding, setShowBranding] = useState(false);
  const [branding, setBranding] = useState({ accent_color: DEFAULT_ACCENT, logo_url: "" });

  const accent = me?.partner.accent_color || DEFAULT_ACCENT;
  const accentGrad = `linear-gradient(135deg, ${accent} 0%, #4f46e5 55%, #0ea5e9 130%)`;
  const btnPrimary: React.CSSProperties = {
    background: accentGrad, color: "#fff", border: "none", borderRadius: 10,
    padding: "0.6rem 1.05rem", fontSize: "0.83rem", fontWeight: 700, cursor: "pointer",
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

  const load = useCallback(() => {
    return Promise.all([
      swrJson<Me>("/api/partner/me", (data) => {
        if (data && "partner" in data) {
          setMe(data);
          setBranding({ accent_color: data.partner.accent_color || DEFAULT_ACCENT, logo_url: data.partner.logo_url || "" });
        }
      }),
      swrJson<Client[]>("/api/partner/clients", (data) => setClients(Array.isArray(data) ? data : [])),
    ]);
  }, []);
  const loadPosts = useCallback(() => {
    return swrJson<Post[]>("/api/partner/posts", (data) => setPosts(Array.isArray(data) ? data : []));
  }, []);
  const loadJobs = useCallback(() => {
    return swrJson<Job[]>("/api/partner/jobs", (data) => setJobs(Array.isArray(data) ? data : []));
  }, []);
  const loadTodos = useCallback(() => {
    return swrJson<Todo[]>("/api/partner/todos", (data) => setTodos(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    load(); loadJobs(); loadTodos();
    if (CONTENT_READY) loadPosts(); // skip a request while the planner is gated
  }, [load, loadPosts, loadJobs, loadTodos]);

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

  // ── Clients ──
  async function addClient(e: React.FormEvent) {
    e.preventDefault();
    if (await api("/api/partner/clients", "POST", newClient)) {
      flash(true, `${newClient.business_name} added`);
      setNewClient({ business_name: "", contact_name: "", phone: "", email: "", website: "" });
      setShowAddClient(false);
      load();
    }
  }
  async function removeClient(c: Client) {
    if (!window.confirm(`Remove ${c.business_name} and their portal access?`)) return;
    if (await api(`/api/partner/clients/${c.id}`, "DELETE")) { flash(true, `${c.business_name} removed`); load(); }
  }
  async function toggleClient(id: number) {
    const next = openClient === id ? null : id;
    setOpenClient(next);
    setNewLogin({ username: "", password: "", display_name: "", send_welcome: true, email_password: true });
    if (next !== null && !logins[next]) {
      const rows = await api(`/api/partner/accounts?client_id=${next}`, "GET");
      if (rows) setLogins((l) => ({ ...l, [next]: rows as PortalLogin[] }));
    }
  }
  async function addLogin(e: React.FormEvent, clientId: number) {
    e.preventDefault();
    const created = await api("/api/partner/accounts", "POST", { client_id: clientId, ...newLogin }) as
      | ({ welcome: { ok: boolean; error?: string } | null }) | null;
    if (created) {
      if (newLogin.send_welcome) {
        flash(created.welcome?.ok ?? false,
          created.welcome?.ok
            ? "Portal login created — welcome email sent to the client"
            : `Login created, but the welcome email didn't send${created.welcome?.error ? ` (${created.welcome.error})` : ""}`);
      } else {
        flash(true, "Portal login created");
      }
      setNewLogin({ username: "", password: "", display_name: "", send_welcome: true, email_password: true });
      const rows = await api(`/api/partner/accounts?client_id=${clientId}`, "GET");
      if (rows) setLogins((l) => ({ ...l, [clientId]: rows as PortalLogin[] }));
      load();
    }
  }
  async function removeLogin(clientId: number, username: string) {
    if (!window.confirm(`Remove portal login ${username}?`)) return;
    if (await api("/api/partner/accounts", "DELETE", { username })) {
      flash(true, "Portal login removed");
      const rows = await api(`/api/partner/accounts?client_id=${clientId}`, "GET");
      if (rows) setLogins((l) => ({ ...l, [clientId]: rows as PortalLogin[] }));
      load();
    }
  }
  async function resetLogin(username: string) {
    const pw = window.prompt(`New password for ${username} (min 8 characters):`);
    if (!pw) return;
    if (await api("/api/partner/accounts", "PATCH", { username, new_password: pw })) {
      flash(true, `Password updated for ${username}`);
    }
  }

  // ── Posts ──
  async function addPost(e: React.FormEvent) {
    e.preventDefault();
    const created = await api("/api/partner/posts", "POST", {
      client_id: newPost.client_id, title: newPost.title, caption: newPost.caption,
      scheduled_at: newPost.scheduled_at || null,
      status: newPost.submit ? "pending_approval" : "draft",
    }) as { id: number } | null;
    if (created) {
      const file = newPostFile.current?.files?.[0];
      if (file) {
        const ok = await uploadMedia(created.id, file);
        flash(ok, ok
          ? (newPost.submit ? "Post + media sent to the client for approval" : "Draft saved with media")
          : "Post saved, but the file upload failed — try attaching it again");
      } else {
        flash(true, newPost.submit ? "Post sent to the client for approval" : "Draft saved");
      }
      setNewPost({ client_id: "", title: "", caption: "", scheduled_at: "", submit: false });
      if (newPostFile.current) newPostFile.current.value = "";
      setShowAddPost(false);
      loadPosts();
    }
  }
  async function uploadMedia(postId: number, file: File): Promise<boolean> {
    setUploadingPost(postId);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/partner/posts/${postId}/media`, { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        flash(false, (data as { error?: string }).error ?? "Upload failed");
        return false;
      }
      return true;
    } finally {
      setUploadingPost(null);
    }
  }
  async function attachMedia(postId: number, file: File) {
    if (await uploadMedia(postId, file)) { flash(true, "Media attached"); loadPosts(); }
  }
  async function removeMedia(postId: number, mediaId: number) {
    if (await api(`/api/partner/posts/${postId}/media`, "DELETE", { media_id: mediaId })) {
      flash(true, "Media removed");
      loadPosts();
    }
  }
  async function setPostStatus(p: Post, status: string, okText: string) {
    if (await api(`/api/partner/posts/${p.id}`, "PATCH", { status })) { flash(true, okText); loadPosts(); }
  }
  async function removePost(p: Post) {
    if (!window.confirm("Delete this post?")) return;
    if (await api(`/api/partner/posts/${p.id}`, "DELETE")) { flash(true, "Post deleted"); loadPosts(); }
  }
  async function toggleComments(postId: number) {
    const next = openComments === postId ? null : postId;
    setOpenComments(next);
    setNewComment("");
    if (next !== null) {
      const rows = await api(`/api/partner/posts/${next}/comments`, "GET");
      if (rows) setComments((c) => ({ ...c, [next]: rows as Comment[] }));
    }
  }
  async function addComment(e: React.FormEvent, postId: number) {
    e.preventDefault();
    if (!newComment.trim()) return;
    if (await api(`/api/partner/posts/${postId}/comments`, "POST", { body: newComment })) {
      setNewComment("");
      const rows = await api(`/api/partner/posts/${postId}/comments`, "GET");
      if (rows) setComments((c) => ({ ...c, [postId]: rows as Comment[] }));
      loadPosts();
    }
  }

  // ── Jobs ──
  async function addJob(e: React.FormEvent) {
    e.preventDefault();
    if (await api("/api/partner/jobs", "POST", newJob)) {
      flash(true, "Job added");
      setNewJob({ client_id: "", title: "", description: "", priority: "medium", due_date: "", visible_to_client: false });
      setShowAddJob(false);
      loadJobs();
    }
  }
  async function setJobStatus(j: Job, status: string) {
    if (await api(`/api/partner/jobs/${j.id}`, "PATCH", { status })) loadJobs();
  }
  async function removeJob(j: Job) {
    if (!window.confirm(`Delete "${j.title}"?`)) return;
    if (await api(`/api/partner/jobs/${j.id}`, "DELETE")) { flash(true, "Job deleted"); loadJobs(); }
  }

  // ── My list ──
  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!newTodo.trim()) return;
    if (await api("/api/partner/todos", "POST", { text: newTodo })) { setNewTodo(""); loadTodos(); }
  }
  async function toggleTodo(t: Todo) {
    if (await api("/api/partner/todos", "PATCH", { id: t.id, done: !t.done })) loadTodos();
  }
  async function removeTodo(t: Todo) {
    if (await api("/api/partner/todos", "DELETE", { id: t.id })) loadTodos();
  }

  // ── Branding ──
  async function saveBranding(e: React.FormEvent) {
    e.preventDefault();
    if (await api("/api/partner/me", "PATCH", { accent_color: branding.accent_color, logo_url: branding.logo_url })) {
      flash(true, "Branding updated — it flows through to your clients' portals too");
      setShowBranding(false);
      load();
    }
  }

  const orgName = me?.partner.name ?? "Partner workspace";
  const firstName = (me?.user.name ?? "").split(" ")[0];
  const today = pageLoadedAt.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });

  const stats = useMemo(() => {
    const now = pageLoadedAt.getTime();
    const byStatus = (s: string) => posts.filter((p) => p.status === s).length;
    const weekAhead = posts.filter((p) => {
      if (!p.scheduled_at) return false;
      const t = new Date(p.scheduled_at).getTime();
      return t >= now - 86400000 && t < now + 7 * 86400000;
    }).length;
    return {
      clients: clients.length,
      needsAction: byStatus("changes_requested"),
      awaiting: byStatus("pending_approval"),
      approved: byStatus("approved"),
      weekAhead,
      openJobs: jobs.filter((j) => j.status !== "done").length,
      openTodos: todos.filter((t) => !t.done).length,
    };
  }, [clients, posts, jobs, todos, pageLoadedAt]);

  const visiblePosts = useMemo(() => {
    return posts
      .filter((p) => contentClient === "all" || p.client_id === contentClient)
      .filter((p) => statusFilter === "all" || p.status === statusFilter)
      .filter((p) => !selectedDay || contentView !== "calendar" || (p.scheduled_at && dayKey(new Date(p.scheduled_at)) === selectedDay));
  }, [posts, contentClient, statusFilter, selectedDay, contentView]);

  const filterCounts = useMemo(() => {
    const base = posts.filter((p) => contentClient === "all" || p.client_id === contentClient);
    const out: Record<string, number> = { all: base.length };
    for (const [key] of FILTERS) if (key !== "all") out[key] = base.filter((p) => p.status === key).length;
    return out;
  }, [posts, contentClient]);

  // Calendar grid for the selected month
  const calendar = useMemo(() => {
    const first = calMonth;
    const startOffset = (first.getDay() + 6) % 7; // Monday-first
    const gridStart = new Date(first);
    gridStart.setDate(1 - startOffset);
    const byDay: Record<string, Post[]> = {};
    for (const p of posts) {
      if (!p.scheduled_at) continue;
      if (contentClient !== "all" && p.client_id !== contentClient) continue;
      const k = dayKey(new Date(p.scheduled_at));
      (byDay[k] ??= []).push(p);
    }
    const weeks: { date: Date; key: string; inMonth: boolean; posts: Post[] }[][] = [];
    const cursor = new Date(gridStart);
    for (let w = 0; w < 6; w++) {
      const row: { date: Date; key: string; inMonth: boolean; posts: Post[] }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(cursor);
        const key = dayKey(date);
        row.push({ date, key, inMonth: date.getMonth() === first.getMonth(), posts: byDay[key] ?? [] });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(row);
    }
    return weeks;
  }, [calMonth, posts, contentClient]);

  const visibleJobs = useMemo(
    () => jobs.filter((j) => jobClient === "all" || j.client_id === jobClient),
    [jobs, jobClient]
  );

  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "1.5rem 1rem 4rem", width: "100%" }}>

      {/* ── Hero header ── */}
      <div style={{
        position: "relative", overflow: "hidden", borderRadius: 20, marginBottom: "1.25rem",
        background: accentGrad, padding: "1.75rem 1.75rem 1.6rem",
        boxShadow: `0 20px 50px ${accent}4d`,
      }}>
        <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", top: -160, right: -80, background: "rgba(255,255,255,0.12)" }} />
        <div style={{ position: "absolute", width: 220, height: 220, borderRadius: "50%", bottom: -140, left: "35%", background: "rgba(255,255,255,0.07)" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          {me?.partner.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.partner.logo_url} alt={orgName}
              style={{ width: 54, height: 54, borderRadius: 15, objectFit: "cover", border: "1px solid rgba(255,255,255,0.4)", flexShrink: 0, background: "#fff" }} />
          ) : (
            <div style={{
              width: 54, height: 54, borderRadius: 15, flexShrink: 0,
              background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 900, fontSize: "1.05rem", letterSpacing: "0.02em",
              backdropFilter: "blur(6px)",
            }}>
              {initials(orgName)}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)", marginBottom: "0.2rem" }}>
              {today}
            </div>
            <div style={{ fontWeight: 900, fontSize: "1.45rem", color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              {firstName ? `${greet(pageLoadedAt.getHours())}, ${firstName} 👋` : orgName}
            </div>
            <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.82)", marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700 }}>{orgName}</span>
              <span style={{ opacity: 0.6 }}>·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                <ShieldCheck size={13} /> Private partner workspace
              </span>
              <span style={{ opacity: 0.6 }}>·</span>
              <span>Powered by KW Innovations</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={() => setShowBranding((v) => !v)} title="Branding"
              style={{
                background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.35)",
                borderRadius: 10, padding: "0.5rem 0.8rem", fontSize: "0.78rem", fontWeight: 700,
                color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.4rem",
                backdropFilter: "blur(6px)",
              }}>
              <Palette size={13} /> Branding
            </button>
            <button onClick={() => signOut({ callbackUrl: "/login" })}
              style={{
                background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.35)",
                borderRadius: 10, padding: "0.5rem 0.95rem", fontSize: "0.78rem", fontWeight: 700,
                color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.4rem",
                backdropFilter: "blur(6px)",
              }}>
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Branding panel */}
      {showBranding && (
        <form onSubmit={saveBranding} style={{ ...card, padding: "1.15rem 1.25rem", marginBottom: "1.25rem", display: "grid", gap: "0.7rem", borderColor: `${accent}59` }}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)", display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <Palette size={15} style={{ color: accent }} /> Your branding
            <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text-3)" }}>— shown here and in your clients&apos; portals</span>
          </div>
          <div style={{ display: "flex", gap: "0.7rem", alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--text-2)", fontWeight: 600 }}>
              Accent colour
              <input type="color" value={branding.accent_color}
                onChange={(e) => setBranding((b) => ({ ...b, accent_color: e.target.value }))}
                style={{ width: 44, height: 32, border: "1px solid var(--border)", borderRadius: 8, padding: 2, background: "var(--bg)", cursor: "pointer" }} />
            </label>
            <input style={{ ...field, flex: 1, minWidth: 240 }} placeholder="Logo URL (https://… square image works best)"
              value={branding.logo_url} onChange={(e) => setBranding((b) => ({ ...b, logo_url: e.target.value }))} />
            <button type="submit" style={btnPrimary}>Save branding</button>
          </div>
        </form>
      )}

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
        {(CONTENT_READY ? [
          { label: "Clients", value: stats.clients, icon: Users, color: accent, bg: `${accent}1a` },
          { label: "Scheduled this week", value: stats.weekAhead, icon: CalendarDays, color: "#0ea5e9", bg: "rgba(14,165,233,0.10)" },
          { label: "Awaiting approval", value: stats.awaiting, icon: Clock, color: "#d97706", bg: "rgba(217,119,6,0.10)" },
          { label: "Approved & ready", value: stats.approved, icon: CheckCircle2, color: "#059669", bg: "rgba(5,150,105,0.10)" },
          { label: "Open jobs", value: stats.openJobs, icon: Briefcase, color: "#4f46e5", bg: "rgba(79,70,229,0.10)" },
        ] : [
          { label: "Clients", value: stats.clients, icon: Users, color: accent, bg: `${accent}1a` },
          { label: "Open jobs", value: stats.openJobs, icon: Briefcase, color: "#4f46e5", bg: "rgba(79,70,229,0.10)" },
          { label: "On my list", value: stats.openTodos, icon: ListTodo, color: "#0ea5e9", bg: "rgba(14,165,233,0.10)" },
        ]).map((s) => (
          <div key={s.label} style={{ ...card, padding: "1rem 1.05rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <s.icon size={17} style={{ color: s.color }} />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: "1.3rem", color: "var(--text-1)", lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-3)", fontWeight: 600 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Needs-attention nudge */}
      {stats.needsAction > 0 && (
        <button onClick={() => { setTab("content"); setContentView("list"); setStatusFilter("changes_requested"); }}
          style={{
            width: "100%", textAlign: "left", cursor: "pointer", marginBottom: "1.25rem",
            display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.75rem 1rem",
            borderRadius: 12, border: "1px solid rgba(248,113,113,0.35)", background: "rgba(248,113,113,0.08)",
            color: "#dc2626", fontSize: "0.83rem", fontWeight: 700,
          }}>
          <AlertCircle size={16} />
          {stats.needsAction} post{stats.needsAction > 1 ? "s" : ""} came back with change requests — review now
          <ArrowRight size={14} style={{ marginLeft: "auto" }} />
        </button>
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

      {/* ── Tabs ── */}
      <div style={{
        display: "inline-flex", background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 12, padding: 4, marginBottom: "1.1rem", gap: 2, flexWrap: "wrap",
      }}>
        {([
          ["clients", "Clients", Users],
          ["content", "Content", Megaphone],
          ["jobs", "Jobs", Briefcase],
          ["mylist", `My list${stats.openTodos > 0 ? ` (${stats.openTodos})` : ""}`, ListTodo],
        ] as const).map(([key, label, Icon]) => {
          const active = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)}
              style={{
                display: "flex", alignItems: "center", gap: "0.45rem", padding: "0.55rem 1.05rem", borderRadius: 9,
                fontSize: "0.84rem", fontWeight: 700, cursor: "pointer", border: "none",
                background: active ? accentGrad : "transparent",
                color: active ? "#fff" : "var(--text-3)",
                boxShadow: active ? `0 4px 14px ${accent}4d` : "none",
                transition: "background 0.15s, color 0.15s",
              }}>
              <Icon size={14} /> {label}
              {key === "content" && !CONTENT_READY && (
                <span style={{
                  fontSize: "0.58rem", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase",
                  padding: "0.12rem 0.4rem", borderRadius: 999,
                  background: active ? "rgba(255,255,255,0.25)" : `${accent}1a`,
                  color: active ? "#fff" : accent,
                }}>Soon</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Clients tab ── */}
      {tab === "clients" && (
        <div style={{ display: "grid", gap: "0.85rem" }}>
          {!showAddClient && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setShowAddClient(true)} style={btnPrimary}>
                <Plus size={14} /> Add a client
              </button>
            </div>
          )}
          {showAddClient && (
            <form onSubmit={addClient} style={{ ...card, padding: "1.25rem", display: "grid", gap: "0.65rem", borderColor: `${accent}59` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)", display: "flex", alignItems: "center", gap: "0.45rem" }}>
                  <Sparkles size={15} style={{ color: accent }} /> New client
                </div>
                <button type="button" onClick={() => setShowAddClient(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}>
                  <X size={16} />
                </button>
              </div>
              <input style={field} placeholder="Business name" value={newClient.business_name} onChange={(e) => setNewClient((c) => ({ ...c, business_name: e.target.value }))} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                <input style={field} placeholder="Contact name" value={newClient.contact_name} onChange={(e) => setNewClient((c) => ({ ...c, contact_name: e.target.value }))} />
                <input style={field} placeholder="Phone" value={newClient.phone} onChange={(e) => setNewClient((c) => ({ ...c, phone: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                <input style={field} type="email" placeholder="Email" value={newClient.email} onChange={(e) => setNewClient((c) => ({ ...c, email: e.target.value }))} />
                <input style={field} placeholder="Website" value={newClient.website} onChange={(e) => setNewClient((c) => ({ ...c, website: e.target.value }))} />
              </div>
              <button type="submit" style={{ ...btnPrimary, justifySelf: "start" }} disabled={!newClient.business_name.trim()}>
                <Plus size={14} /> Add client
              </button>
            </form>
          )}

          {clients.length === 0 && !showAddClient && (
            <div style={{ ...card, padding: "3rem 1.5rem", textAlign: "center" }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: "0 auto 1rem",
                background: `${accent}1a`, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Users size={24} style={{ color: accent }} />
              </div>
              <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text-1)", marginBottom: "0.35rem" }}>Bring your first client on board</div>
              <p style={{ fontSize: "0.83rem", color: "var(--text-3)", maxWidth: 380, margin: "0 auto 1.1rem", lineHeight: 1.55 }}>
                Add a client to give them their own branded portal login and start planning
                content they can approve with one click.
              </p>
              <button onClick={() => setShowAddClient(true)} style={btnPrimary}>
                <Plus size={14} /> Add your first client
              </button>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: "0.85rem" }}>
            {clients.map((c, i) => (
              <div key={c.id} style={{ ...card, padding: "1.15rem 1.2rem", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: CLIENT_GRADS[i % CLIENT_GRADS.length],
                    display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "0.85rem",
                  }}>
                    {initials(c.business_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.business_name}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>{c.contact_name || "No contact set"}</div>
                  </div>
                  <button onClick={() => removeClient(c)} title="Remove client"
                    style={{ background: "none", border: "none", color: "var(--text-4, #b6bdd4)", cursor: "pointer", padding: "0.2rem" }}>
                    <Trash2 size={14} />
                  </button>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  {c.email && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", color: "var(--text-2)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 999, padding: "0.22rem 0.6rem" }}>
                      <Mail size={11} /> {c.email}
                    </span>
                  )}
                  {c.phone && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", color: "var(--text-2)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 999, padding: "0.22rem 0.6rem" }}>
                      <Phone size={11} /> {c.phone}
                    </span>
                  )}
                  {c.website && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", color: "var(--text-2)", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 999, padding: "0.22rem 0.6rem" }}>
                      <Globe size={11} /> {c.website.replace(/^https?:\/\//, "")}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.9rem", fontSize: "0.74rem", color: "var(--text-3)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                    <Megaphone size={12} /> {c.post_count} posts
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", color: c.portal_logins > 0 ? "#059669" : "var(--text-3)", fontWeight: c.portal_logins > 0 ? 700 : 400 }}>
                    <ShieldCheck size={12} /> {c.portal_logins > 0 ? `${c.portal_logins} portal login${c.portal_logins > 1 ? "s" : ""}` : "No portal access yet"}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "0.45rem", marginTop: "auto" }}>
                  <button onClick={() => toggleClient(c.id)} style={{ ...btnGhost, flex: 1, justifyContent: "center" }}>
                    <KeyRound size={12} /> {openClient === c.id ? "Close access" : "Manage access"}
                  </button>
                  <a href={`/portal?client=${c.id}`} target="_blank" rel="noreferrer"
                    style={{ ...btnGhost, flex: 1, justifyContent: "center", textDecoration: "none", color: accent, borderColor: `${accent}66` }}>
                    Preview portal <ExternalLink size={11} />
                  </a>
                </div>

                {openClient === c.id && (
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.8rem" }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.45rem" }}>
                      Portal logins
                    </div>
                    {(logins[c.id] ?? []).length === 0 && (
                      <div style={{ fontSize: "0.78rem", color: "var(--text-3)", marginBottom: "0.5rem" }}>None yet — create one below.</div>
                    )}
                    {(logins[c.id] ?? []).map((l) => (
                      <div key={l.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.32rem 0", fontSize: "0.82rem", color: "var(--text-1)" }}>
                        <span style={{ fontWeight: 600 }}>{l.name}</span>
                        <span style={{ color: "var(--text-3)" }}>({l.username})</span>
                        <button onClick={() => resetLogin(l.username)} title="Reset password" style={{ ...btnGhost, marginLeft: "auto", padding: "0.2rem 0.55rem", fontSize: "0.68rem" }}>
                          <KeyRound size={10} /> Reset
                        </button>
                        <button onClick={() => removeLogin(c.id, l.username)} title="Remove login"
                          style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: "0.2rem" }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    <form onSubmit={(e) => addLogin(e, c.id)} style={{ display: "grid", gap: "0.45rem", marginTop: "0.55rem" }}>
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
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Content tab: coming-soon gate ── */}
      {tab === "content" && !CONTENT_READY && (
        <div style={{ ...card, padding: "3.5rem 1.5rem", textAlign: "center" }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, margin: "0 auto 1.1rem",
            background: accentGrad, display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 12px 30px ${accent}40`,
          }}>
            <Megaphone size={28} style={{ color: "#fff" }} />
          </div>
          <div style={{ fontWeight: 900, fontSize: "1.15rem", color: "var(--text-1)", marginBottom: "0.4rem" }}>
            Content planner — coming soon
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-3)", maxWidth: 440, margin: "0 auto", lineHeight: 1.6 }}>
            Plan posts with the creative attached, send them to your clients for one-click
            approval in their portal, and track everything on a calendar. It&apos;s getting its
            final polish — your clients and jobs are ready to use right now.
          </p>
        </div>
      )}

      {/* ── Content tab ── */}
      {tab === "content" && CONTENT_READY && (
        <div style={{ display: "grid", gap: "0.85rem" }}>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
            <select style={{ ...field, width: "auto", minWidth: 190 }} value={String(contentClient)}
              onChange={(e) => { setContentClient(e.target.value === "all" ? "all" : parseInt(e.target.value, 10)); setSelectedDay(null); }}>
              <option value="all">All clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
            <div style={{ display: "inline-flex", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 3, gap: 2 }}>
              {([["list", "List", List], ["calendar", "Calendar", LayoutGrid]] as const).map(([key, label, Icon]) => {
                const active = contentView === key;
                return (
                  <button key={key} onClick={() => { setContentView(key); setSelectedDay(null); }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.4rem 0.8rem",
                      borderRadius: 8, fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", border: "none",
                      background: active ? `${accent}1a` : "transparent", color: active ? accent : "var(--text-3)",
                    }}>
                    <Icon size={13} /> {label}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setShowAddPost((v) => !v)} style={{ ...btnPrimary, marginLeft: "auto" }}>
              <Plus size={14} /> New post
            </button>
          </div>

          {contentView === "list" && (
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {FILTERS.map(([key, label]) => {
                const active = statusFilter === key;
                const count = filterCounts[key] ?? 0;
                return (
                  <button key={key} onClick={() => setStatusFilter(key)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "0.35rem",
                      padding: "0.35rem 0.75rem", borderRadius: 999, fontSize: "0.74rem", fontWeight: 700, cursor: "pointer",
                      border: active ? `1px solid ${accent}` : "1px solid var(--border)",
                      background: active ? `${accent}1a` : "var(--surface)",
                      color: active ? accent : "var(--text-3)",
                    }}>
                    {label}
                    <span style={{
                      fontSize: "0.66rem", fontWeight: 800, borderRadius: 999, padding: "0.05rem 0.4rem",
                      background: active ? accent : "var(--bg)", color: active ? "#fff" : "var(--text-3)",
                    }}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {showAddPost && (
            <form onSubmit={addPost} style={{ ...card, padding: "1.25rem", display: "grid", gap: "0.65rem", borderColor: `${accent}59` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)", display: "flex", alignItems: "center", gap: "0.45rem" }}>
                  <Sparkles size={15} style={{ color: accent }} /> New post
                </div>
                <button type="button" onClick={() => setShowAddPost(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}>
                  <X size={16} />
                </button>
              </div>
              <select style={field} value={newPost.client_id} onChange={(e) => setNewPost((p) => ({ ...p, client_id: e.target.value }))}>
                <option value="">Choose a client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
              </select>
              <input style={field} placeholder="Title (optional)" value={newPost.title} onChange={(e) => setNewPost((p) => ({ ...p, title: e.target.value }))} />
              <textarea style={{ ...field, minHeight: 100, resize: "vertical", fontFamily: "inherit" }} placeholder="Caption / copy"
                value={newPost.caption} onChange={(e) => setNewPost((p) => ({ ...p, caption: e.target.value }))} />
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.78rem", color: "var(--text-2)", fontWeight: 600, cursor: "pointer" }}>
                <Paperclip size={13} style={{ color: accent }} />
                Attach image or video
                <input ref={newPostFile} type="file" accept="image/*,video/*" style={{ fontSize: "0.75rem" }} />
              </label>
              <div style={{ display: "flex", gap: "0.65rem", alignItems: "center", flexWrap: "wrap" }}>
                <input style={{ ...field, width: "auto" }} type="datetime-local" value={newPost.scheduled_at}
                  onChange={(e) => setNewPost((p) => ({ ...p, scheduled_at: e.target.value }))} />
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "var(--text-2)", fontWeight: 600 }}>
                  <input type="checkbox" checked={newPost.submit} onChange={(e) => setNewPost((p) => ({ ...p, submit: e.target.checked }))} />
                  Send straight to the client for approval
                </label>
                <button type="submit" style={{ ...btnPrimary, marginLeft: "auto" }}
                  disabled={!newPost.client_id || (!newPost.title.trim() && !newPost.caption.trim())}>
                  {newPost.submit ? <>Create &amp; send <Send size={13} /></> : "Save draft"}
                </button>
              </div>
            </form>
          )}

          {/* Calendar view */}
          {contentView === "calendar" && (
            <div style={{ ...card, padding: "1.1rem 1.15rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.8rem" }}>
                <button onClick={() => { setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)); setSelectedDay(null); }} style={btnGhost}>
                  <ChevronLeft size={14} />
                </button>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)" }}>
                  {MONTHS[calMonth.getMonth()]} {calMonth.getFullYear()}
                </div>
                <button onClick={() => { setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)); setSelectedDay(null); }} style={btnGhost}>
                  <ChevronRight size={14} />
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
                {DOW.map((d) => (
                  <div key={d} style={{ textAlign: "center", fontSize: "0.64rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0.2rem 0" }}>{d}</div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                {calendar.flat().map((cell) => {
                  const isToday = cell.key === dayKey(pageLoadedAt);
                  const selected = selectedDay === cell.key;
                  return (
                    <button key={cell.key}
                      onClick={() => setSelectedDay(selected ? null : cell.posts.length > 0 ? cell.key : null)}
                      style={{
                        minHeight: 66, borderRadius: 9, padding: "0.3rem 0.35rem", textAlign: "left",
                        cursor: cell.posts.length > 0 ? "pointer" : "default",
                        border: selected ? `1.5px solid ${accent}` : isToday ? `1px solid ${accent}80` : "1px solid var(--border)",
                        background: selected ? `${accent}14` : cell.inMonth ? "var(--bg)" : "transparent",
                        opacity: cell.inMonth ? 1 : 0.45,
                      }}>
                      <div style={{ fontSize: "0.66rem", fontWeight: isToday ? 800 : 600, color: isToday ? accent : "var(--text-3)", marginBottom: 2 }}>
                        {cell.date.getDate()}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {cell.posts.slice(0, 2).map((p) => {
                          const st = POST_STATUS[p.status] ?? POST_STATUS.draft;
                          return (
                            <div key={p.id} style={{
                              display: "flex", alignItems: "center", gap: 3, fontSize: "0.6rem", fontWeight: 600,
                              color: "var(--text-2)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.color, flexShrink: 0 }} />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{p.title || p.caption?.slice(0, 20) || p.business_name}</span>
                            </div>
                          );
                        })}
                        {cell.posts.length > 2 && (
                          <div style={{ fontSize: "0.58rem", color: "var(--text-3)", fontWeight: 700 }}>+{cell.posts.length - 2} more</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: "0.7rem", marginTop: "0.7rem", flexWrap: "wrap" }}>
                {Object.entries(POST_STATUS).map(([k, v]) => (
                  <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.64rem", color: "var(--text-3)", fontWeight: 600 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: v.color }} /> {v.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {selectedDay && contentView === "calendar" && (
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-2)" }}>
              Posts on {new Date(selectedDay).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}:
            </div>
          )}

          {(contentView === "list" || selectedDay) && visiblePosts.length === 0 && !showAddPost && (
            <div style={{ ...card, padding: "3rem 1.5rem", textAlign: "center" }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: "0 auto 1rem",
                background: `${accent}1a`, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Megaphone size={24} style={{ color: accent }} />
              </div>
              <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text-1)", marginBottom: "0.35rem" }}>
                {statusFilter === "all" ? "Plan your first post" : `Nothing ${POST_STATUS[statusFilter]?.label.toLowerCase() ?? "here"} right now`}
              </div>
              <p style={{ fontSize: "0.83rem", color: "var(--text-3)", maxWidth: 400, margin: "0 auto 1.1rem", lineHeight: 1.55 }}>
                Draft content with the actual creative attached, send it to your client for
                one-click approval in their portal, and track everything from idea to published.
              </p>
              {statusFilter === "all" && (
                <button onClick={() => setShowAddPost(true)} style={btnPrimary}>
                  <Plus size={14} /> Create a post
                </button>
              )}
            </div>
          )}

          {(contentView === "list" || selectedDay) && visiblePosts.map((p) => {
            const st = POST_STATUS[p.status] ?? POST_STATUS.draft;
            return (
              <div key={p.id} style={{ ...card, padding: "1rem 1.15rem", borderLeft: `3px solid ${st.color}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-1)" }}>
                      {p.title || p.caption?.slice(0, 70) || "Untitled post"}
                    </div>
                    <div style={{ fontSize: "0.73rem", color: "var(--text-3)", marginTop: "0.15rem", display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, color: "var(--text-2)" }}>{p.business_name}</span>
                      <span style={{ opacity: 0.5 }}>·</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        <CalendarDays size={11} />
                        {p.scheduled_at
                          ? new Date(p.scheduled_at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })
                          : "Not scheduled"}
                      </span>
                    </div>
                    {p.status === "changes_requested" && p.approval_note && (
                      <div style={{
                        fontSize: "0.76rem", color: "#dc2626", marginTop: "0.4rem",
                        background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
                        borderRadius: 8, padding: "0.4rem 0.6rem",
                      }}>
                        Client note: {p.approval_note}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: "0.68rem", fontWeight: 800, padding: "0.28rem 0.65rem", borderRadius: 999, background: st.bg, color: st.color, whiteSpace: "nowrap" }}>
                    {st.label}
                  </span>
                  <button onClick={() => toggleComments(p.id)} style={{ ...btnGhost, color: p.comment_count > 0 ? accent : undefined }}>
                    <MessageSquare size={11} /> {p.comment_count > 0 ? p.comment_count : ""}
                  </button>
                  {(p.status === "draft" || p.status === "changes_requested") && (
                    <button onClick={() => setPostStatus(p, "pending_approval", "Sent to the client for approval")} style={btnGhost}>
                      <Send size={11} /> Send for approval
                    </button>
                  )}
                  {p.status === "approved" && (
                    <button onClick={() => setPostStatus(p, "published", "Marked as published")} style={{ ...btnGhost, color: "#059669", borderColor: "rgba(5,150,105,0.4)" }}>
                      <CheckCircle2 size={11} /> Mark published
                    </button>
                  )}
                  <button onClick={() => removePost(p)} title="Delete post"
                    style={{ background: "none", border: "none", color: "var(--text-4, #b6bdd4)", cursor: "pointer", padding: "0.2rem" }}>
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Media strip */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: p.media.length > 0 ? "0.7rem" : "0.5rem", flexWrap: "wrap" }}>
                  {p.media.map((m) => (
                    <div key={m.id} style={{ position: "relative" }}>
                      {m.content_type?.startsWith("video") ? (
                        <video src={m.url} style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" }} muted />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.url} alt={m.filename} style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)" }} />
                      )}
                      <button onClick={() => removeMedia(p.id, m.id)} title="Remove media"
                        style={{
                          position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%",
                          background: "#dc2626", color: "#fff", border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                  <label style={{
                    width: p.media.length > 0 ? 84 : undefined, height: p.media.length > 0 ? 84 : undefined,
                    padding: p.media.length > 0 ? 0 : "0.35rem 0.7rem",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.35rem",
                    borderRadius: 10, border: "1px dashed var(--border)", cursor: "pointer",
                    fontSize: "0.72rem", fontWeight: 600, color: "var(--text-3)",
                  }}>
                    <ImageIcon size={14} />
                    {uploadingPost === p.id ? "Uploading…" : p.media.length > 0 ? "" : "Attach media"}
                    <input type="file" accept="image/*,video/*" style={{ display: "none" }}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) attachMedia(p.id, f); e.target.value = ""; }} />
                  </label>
                </div>

                {/* Comments thread */}
                {openComments === p.id && (
                  <div style={{ borderTop: "1px solid var(--border)", marginTop: "0.8rem", paddingTop: "0.8rem" }}>
                    {(comments[p.id] ?? []).length === 0 && (
                      <div style={{ fontSize: "0.78rem", color: "var(--text-3)", marginBottom: "0.5rem" }}>No comments yet.</div>
                    )}
                    {(comments[p.id] ?? []).map((cm) => {
                      const isClient = cm.author_role === "client";
                      return (
                        <div key={cm.id} style={{ display: "flex", justifyContent: isClient ? "flex-start" : "flex-end", marginBottom: "0.45rem" }}>
                          <div style={{
                            maxWidth: "80%", padding: "0.5rem 0.7rem", borderRadius: isClient ? "11px 11px 11px 3px" : "11px 11px 3px 11px",
                            background: isClient ? "var(--bg)" : `${accent}14`,
                            border: `1px solid ${isClient ? "var(--border)" : `${accent}40`}`,
                          }}>
                            <div style={{ fontSize: "0.64rem", fontWeight: 700, color: isClient ? "var(--text-3)" : accent, marginBottom: 2 }}>
                              {cm.author ?? (isClient ? p.business_name : orgName)}{isClient ? ` · ${p.business_name}` : ""}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-1)", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{cm.body}</div>
                          </div>
                        </div>
                      );
                    })}
                    <form onSubmit={(e) => addComment(e, p.id)} style={{ display: "flex", gap: "0.45rem", marginTop: "0.55rem" }}>
                      <input style={field} placeholder="Reply to your client…" value={newComment} onChange={(e) => setNewComment(e.target.value)} />
                      <button type="submit" style={{ ...btnPrimary, padding: "0.55rem 0.9rem" }} disabled={!newComment.trim()}>
                        <Send size={13} />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Jobs tab ── */}
      {tab === "jobs" && (
        <div style={{ display: "grid", gap: "0.85rem" }}>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
            <select style={{ ...field, width: "auto", minWidth: 190 }} value={String(jobClient)}
              onChange={(e) => setJobClient(e.target.value === "all" ? "all" : parseInt(e.target.value, 10))}>
              <option value="all">All clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
            <button onClick={() => setShowAddJob((v) => !v)} style={{ ...btnPrimary, marginLeft: "auto" }}>
              <Plus size={14} /> New job
            </button>
          </div>

          {showAddJob && (
            <form onSubmit={addJob} style={{ ...card, padding: "1.25rem", display: "grid", gap: "0.65rem", borderColor: `${accent}59` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)", display: "flex", alignItems: "center", gap: "0.45rem" }}>
                  <Briefcase size={15} style={{ color: accent }} /> New job
                </div>
                <button type="button" onClick={() => setShowAddJob(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)" }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                <select style={field} value={newJob.client_id} onChange={(e) => setNewJob((j) => ({ ...j, client_id: e.target.value }))}>
                  <option value="">Choose a client…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
                </select>
                <select style={field} value={newJob.priority} onChange={(e) => setNewJob((j) => ({ ...j, priority: e.target.value }))}>
                  <option value="low">Low priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="high">High priority</option>
                </select>
              </div>
              <input style={field} placeholder="What needs doing?" value={newJob.title} onChange={(e) => setNewJob((j) => ({ ...j, title: e.target.value }))} />
              <textarea style={{ ...field, minHeight: 70, resize: "vertical", fontFamily: "inherit" }} placeholder="Details (optional)"
                value={newJob.description} onChange={(e) => setNewJob((j) => ({ ...j, description: e.target.value }))} />
              <div style={{ display: "flex", gap: "0.65rem", alignItems: "center", flexWrap: "wrap" }}>
                <input style={{ ...field, width: "auto" }} type="date" value={newJob.due_date} onChange={(e) => setNewJob((j) => ({ ...j, due_date: e.target.value }))} />
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "var(--text-2)", fontWeight: 600 }}>
                  <input type="checkbox" checked={newJob.visible_to_client} onChange={(e) => setNewJob((j) => ({ ...j, visible_to_client: e.target.checked }))} />
                  Visible to the client in their portal
                </label>
                <button type="submit" style={{ ...btnPrimary, marginLeft: "auto" }} disabled={!newJob.client_id || !newJob.title.trim()}>
                  <Plus size={14} /> Add job
                </button>
              </div>
            </form>
          )}

          {visibleJobs.length === 0 && !showAddJob && (
            <div style={{ ...card, padding: "3rem 1.5rem", textAlign: "center" }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: "0 auto 1rem",
                background: `${accent}1a`, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Briefcase size={24} style={{ color: accent }} />
              </div>
              <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text-1)", marginBottom: "0.35rem" }}>No jobs yet</div>
              <p style={{ fontSize: "0.83rem", color: "var(--text-3)", maxWidth: 400, margin: "0 auto 1.1rem", lineHeight: 1.55 }}>
                Track the work you&apos;re doing for each client. Support requests your clients raise
                in their portal land here automatically.
              </p>
              <button onClick={() => setShowAddJob(true)} style={btnPrimary}>
                <Plus size={14} /> Add a job
              </button>
            </div>
          )}

          {(["todo", "in_progress", "done"] as const).map((col) => {
            const colJobs = visibleJobs.filter((j) => j.status === col);
            if (colJobs.length === 0) return null;
            const meta = JOB_STATUS[col];
            return (
              <div key={col}>
                <div style={{ fontSize: "0.72rem", fontWeight: 800, color: meta.color, textTransform: "uppercase", letterSpacing: "0.07em", margin: "0.35rem 0 0.5rem" }}>
                  {meta.label} · {colJobs.length}
                </div>
                <div style={{ display: "grid", gap: "0.55rem" }}>
                  {colJobs.map((j) => (
                    <div key={j.id} style={{ ...card, padding: "0.85rem 1.05rem", display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", borderLeft: `3px solid ${meta.color}` }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-1)", textDecoration: col === "done" ? "line-through" : "none", opacity: col === "done" ? 0.6 : 1 }}>
                          {j.title}
                          {j.kind === "support" && (
                            <span style={{ marginLeft: "0.45rem", fontSize: "0.62rem", fontWeight: 800, color: "#d97706", background: "rgba(251,191,36,0.14)", borderRadius: 999, padding: "0.12rem 0.5rem", verticalAlign: "1px" }}>
                              SUPPORT
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-3)", marginTop: "0.1rem" }}>
                          {j.business_name}
                          {j.priority === "high" && <span style={{ color: "#dc2626", fontWeight: 700 }}> · High priority</span>}
                          {j.due_date && ` · due ${new Date(j.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`}
                          {j.visible_to_client && " · visible to client"}
                        </div>
                        {j.description && <div style={{ fontSize: "0.76rem", color: "var(--text-2)", marginTop: "0.25rem" }}>{j.description}</div>}
                      </div>
                      {col !== "todo" && (
                        <button onClick={() => setJobStatus(j, col === "done" ? "in_progress" : "todo")} style={btnGhost}>
                          ← {col === "done" ? "Reopen" : "To do"}
                        </button>
                      )}
                      {col !== "done" && (
                        <button onClick={() => setJobStatus(j, col === "todo" ? "in_progress" : "done")}
                          style={{ ...btnGhost, color: col === "in_progress" ? "#059669" : undefined }}>
                          {col === "todo" ? "Start →" : "Done ✓"}
                        </button>
                      )}
                      <button onClick={() => removeJob(j)} title="Delete job"
                        style={{ background: "none", border: "none", color: "var(--text-4, #b6bdd4)", cursor: "pointer", padding: "0.2rem" }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── My list tab ── */}
      {tab === "mylist" && (
        <div style={{ maxWidth: 620 }}>
          <form onSubmit={addTodo} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.85rem" }}>
            <input style={field} placeholder="Add something to your list…" value={newTodo} onChange={(e) => setNewTodo(e.target.value)} />
            <button type="submit" style={btnPrimary} disabled={!newTodo.trim()}>
              <Plus size={14} />
            </button>
          </form>
          {todos.length === 0 && (
            <div style={{ ...card, padding: "2.25rem 1.5rem", textAlign: "center", color: "var(--text-3)", fontSize: "0.85rem" }}>
              Your personal list — only you can see it. Jot down anything you need to get to.
            </div>
          )}
          <div style={{ display: "grid", gap: "0.4rem" }}>
            {todos.map((t) => (
              <div key={t.id} style={{ ...card, padding: "0.7rem 0.95rem", display: "flex", alignItems: "center", gap: "0.65rem" }}>
                <input type="checkbox" checked={t.done} onChange={() => toggleTodo(t)} style={{ width: 16, height: 16, accentColor: accent, cursor: "pointer" }} />
                <span style={{ flex: 1, fontSize: "0.87rem", color: t.done ? "var(--text-3)" : "var(--text-1)", textDecoration: t.done ? "line-through" : "none" }}>
                  {t.text}
                </span>
                <button onClick={() => removeTodo(t)} title="Remove"
                  style={{ background: "none", border: "none", color: "var(--text-4, #b6bdd4)", cursor: "pointer", padding: "0.15rem" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={{ textAlign: "center", marginTop: "2.5rem", fontSize: "0.72rem", color: "var(--text-3)" }}>
        {orgName} partner workspace · Powered by KW Innovations
      </p>
    </div>
  );
}
