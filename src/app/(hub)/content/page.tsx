"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Megaphone, ChevronLeft, ChevronRight, Plus, X, Trash2, Send,
  ThumbsUp, Rocket, Link2, Settings2, Upload, MessageSquare, CheckCircle2,
  AlertTriangle, Clock, PencilLine, Cable,
} from "lucide-react";
import { PLATFORMS, platformInfo } from "@/lib/social/platforms";
import { PORTAL_MODULES } from "@/lib/modules";

interface Client { id: number; business_name: string; }
interface Channel { id?: number; platform: string; social_account_id: number | null; publish_status?: string; error?: string | null; }
interface Media { id: number; url: string; filename: string; content_type: string | null; }
interface Post {
  id: number; client_id: number; business_name?: string; title: string | null; caption: string | null;
  scheduled_at: string | null; status: string; approval_note: string | null;
  publish_error: string | null; published_at: string | null;
  channels: Channel[]; media: Media[]; comment_count: number;
}
interface Account {
  id: number; client_id: number; platform: string; account_name: string;
  status: string; has_token: boolean; token_expires_at: string | null;
}
interface Comment { id: number; author: string | null; author_role: string; body: string; created_at: string; }

const STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "#8b95c0" },
  pending_approval: { label: "Awaiting approval", color: "#d97706" },
  approved: { label: "Approved", color: "#059669" },
  changes_requested: { label: "Changes requested", color: "#dc2626" },
  published: { label: "Published", color: "#4f46e5" },
};

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthLabel(d: Date) {
  return d.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${ymd(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function niceTime(iso: string | null) {
  if (!iso) return "Unscheduled";
  return new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function StatusPill({ status }: { status: string }) {
  const st = STATUS[status] ?? STATUS.draft;
  return (
    <span style={{
      fontSize: "0.64rem", fontWeight: 700, color: st.color, background: `${st.color}14`,
      border: `1px solid ${st.color}30`, borderRadius: 99, padding: "0.12rem 0.5rem", whiteSpace: "nowrap",
    }}>{st.label}</span>
  );
}

function PlatformDots({ channels }: { channels: Channel[] }) {
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {channels.map((ch, i) => {
        const info = platformInfo(ch.platform);
        return <span key={i} title={info.label} style={{ width: 7, height: 7, borderRadius: "50%", background: info.color, display: "inline-block" }} />;
      })}
    </span>
  );
}

function ContentPlanner() {
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [oauth, setOauth] = useState<{ meta: boolean; linkedin: boolean }>({ meta: false, linkedin: false });
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  // OAuth callback lands back here with ?connected= / ?connect_error=
  const [panel, setPanel] = useState<"calendar" | "connections">(() =>
    searchParams.get("connected") || searchParams.get("connect_error") ? "connections" : "calendar");
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(() => {
    const ok = searchParams.get("connected");
    const err = searchParams.get("connect_error");
    return ok ? { ok: true, msg: ok } : err ? { ok: false, msg: err } : null;
  });

  // editor state
  const [editing, setEditing] = useState<Post | "new" | null>(null);
  const [form, setForm] = useState({ title: "", caption: "", scheduled_at: "", platforms: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [manualForm, setManualForm] = useState({ platform: "facebook", account_name: "" });

  useEffect(() => {
    fetch("/api/clients").then((r) => r.json()).then((data: Client[]) => {
      if (!Array.isArray(data)) return;
      setClients(data);
      const fromUrl = searchParams.get("client");
      const preset = fromUrl ? parseInt(fromUrl, 10) : NaN;
      setClientId(!Number.isNaN(preset) && data.some((c) => c.id === preset) ? preset : (data[0]?.id ?? null));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPosts = useCallback(() => {
    if (!clientId) return Promise.resolve();
    const from = new Date(month.getFullYear(), month.getMonth() - 1, 20).toISOString();
    const to = new Date(month.getFullYear(), month.getMonth() + 1, 10).toISOString();
    return fetch(`/api/posts?client_id=${clientId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((r) => r.json())
      .then((data: Post[]) => { if (Array.isArray(data)) setPosts(data); })
      .catch(() => {});
  }, [clientId, month]);

  const loadAccounts = useCallback(() => {
    if (!clientId) return Promise.resolve();
    return fetch(`/api/social-accounts?client_id=${clientId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.accounts)) setAccounts(data.accounts);
        if (data?.oauth) setOauth(data.oauth);
      })
      .catch(() => {});
  }, [clientId]);

  const loadModules = useCallback(() => {
    if (!clientId) return Promise.resolve();
    return fetch(`/api/portal/modules?client_id=${clientId}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data?.enabled)) setModules(data.enabled); })
      .catch(() => {});
  }, [clientId]);

  useEffect(() => {
    if (!clientId) return;
    Promise.all([loadPosts(), loadAccounts(), loadModules()]).finally(() => setLoading(false));
  }, [clientId, loadPosts, loadAccounts, loadModules]);

  // ── calendar grid ──
  const weeks = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7)); // back to Monday
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); cells.push(d); }
    const rows: Date[][] = [];
    for (let i = 0; i < 6; i++) rows.push(cells.slice(i * 7, i * 7 + 7));
    // drop trailing weeks entirely outside the month
    return rows.filter((row) => row.some((d) => d.getMonth() === month.getMonth()));
  }, [month]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of posts) {
      const key = p.scheduled_at ? ymd(new Date(p.scheduled_at)) : "unscheduled";
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return map;
  }, [posts]);
  const unscheduled = postsByDay.get("unscheduled") ?? [];
  const todayKey = ymd(new Date());

  // ── editor ──
  function openNew(day?: Date) {
    const when = day ? new Date(day) : null;
    if (when) when.setHours(9, 0, 0, 0);
    setForm({ title: "", caption: "", scheduled_at: when ? toLocalInput(when.toISOString()) : "", platforms: [] });
    setComments([]);
    setErr("");
    setEditing("new");
  }
  function openPost(p: Post) {
    setForm({
      title: p.title ?? "", caption: p.caption ?? "",
      scheduled_at: toLocalInput(p.scheduled_at),
      platforms: p.channels.map((c) => c.platform),
    });
    setErr("");
    setEditing(p);
    fetch(`/api/posts/${p.id}/comments`).then((r) => r.json())
      .then((data: Comment[]) => { if (Array.isArray(data)) setComments(data); });
  }

  function channelPayload(platforms: string[]) {
    return platforms.map((platform) => {
      const acct = accounts.find((a) => a.platform === platform && a.status === "connected")
        ?? accounts.find((a) => a.platform === platform);
      return { platform, social_account_id: acct?.id ?? null };
    });
  }

  async function savePost(status?: string): Promise<Post | null> {
    if (!clientId) return null;
    setSaving(true);
    setErr("");
    const payload = {
      client_id: clientId,
      title: form.title, caption: form.caption,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      channels: channelPayload(form.platforms),
      ...(status ? { status } : {}),
    };
    const isNew = editing === "new";
    const res = await fetch(isNew ? "/api/posts" : `/api/posts/${(editing as Post).id}`, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setErr(data.error ?? "Could not save"); return null; }
    await loadPosts();
    return data as Post;
  }

  async function saveAndClose(status?: string) {
    const saved = await savePost(status);
    if (saved) setEditing(null);
  }

  async function deletePost() {
    if (editing === "new" || !editing) return;
    if (!confirm("Delete this post?")) return;
    await fetch(`/api/posts/${editing.id}`, { method: "DELETE" });
    setEditing(null);
    loadPosts();
  }

  async function publishNow() {
    if (editing === "new" || !editing) return;
    const saved = await savePost();
    if (!saved) return;
    setSaving(true);
    const res = await fetch(`/api/posts/${editing.id}/publish`, { method: "POST" });
    const data = await res.json();
    setSaving(false);
    if (data.errors?.length) setFlash({ ok: data.failed === 0, msg: data.errors.join(" · ") });
    else setFlash({ ok: true, msg: "Published 🎉" });
    setEditing(null);
    loadPosts();
  }

  async function addComment() {
    if (editing === "new" || !editing || !commentDraft.trim()) return;
    const res = await fetch(`/api/posts/${editing.id}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentDraft }),
    });
    if (res.ok) {
      const c = await res.json();
      setComments((prev) => [...prev, c]);
      setCommentDraft("");
    }
  }

  async function uploadMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || editing === "new" || !editing) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/posts/${editing.id}/media`, { method: "POST", body: fd });
    setUploading(false);
    e.target.value = "";
    if (!res.ok) { const d = await res.json().catch(() => null); setErr(d?.error ?? "Upload failed"); return; }
    await loadPosts();
    const media = await res.json();
    setEditing((prev) => (prev && prev !== "new" ? { ...prev, media: [...prev.media, media] } : prev));
  }

  async function removeMedia(mediaId: number) {
    if (editing === "new" || !editing) return;
    await fetch(`/api/posts/${editing.id}/media`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_id: mediaId }),
    });
    setEditing((prev) => (prev && prev !== "new" ? { ...prev, media: prev.media.filter((m) => m.id !== mediaId) } : prev));
    loadPosts();
  }

  // ── connections / modules ──
  async function addManualAccount() {
    if (!clientId || !manualForm.account_name.trim()) return;
    const res = await fetch("/api/social-accounts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, ...manualForm }),
    });
    if (res.ok) { setManualForm({ platform: "facebook", account_name: "" }); loadAccounts(); }
  }
  async function removeAccount(id: number) {
    if (!confirm("Remove this account?")) return;
    await fetch("/api/social-accounts", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadAccounts();
  }
  async function toggleModule(key: string) {
    if (!clientId) return;
    const next = modules.includes(key) ? modules.filter((k) => k !== key) : [...modules, key];
    setModules(next);
    await fetch("/api/portal/modules", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, modules: next }),
    });
  }

  const currentClient = clients.find((c) => c.id === clientId);
  const pendingCount = posts.filter((p) => p.status === "pending_approval").length;
  const changesCount = posts.filter((p) => p.status === "changes_requested").length;

  const inputStyle: React.CSSProperties = { width: "100%" };

  return (
    <div className="page">
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <Megaphone size={20} color="var(--accent)" />
          <h1 style={{ fontSize: "1.35rem", fontWeight: 900, letterSpacing: "-0.02em" }}>Content Planner</h1>
        </div>
        <select
          className="field"
          value={clientId ?? ""}
          onChange={(e) => setClientId(parseInt(e.target.value, 10))}
          style={{ maxWidth: 260 }}
        >
          {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button className={panel === "calendar" ? "btn-primary" : "btn-ghost"} onClick={() => setPanel("calendar")} style={{ fontSize: "0.8rem" }}>
            <Clock size={13} /> Calendar
          </button>
          <button className={panel === "connections" ? "btn-primary" : "btn-ghost"} onClick={() => setPanel("connections")} style={{ fontSize: "0.8rem" }}>
            <Cable size={13} /> Channels &amp; Portal
          </button>
          <button className="btn-primary" onClick={() => openNew()} style={{ fontSize: "0.8rem" }}>
            <Plus size={14} /> New post
          </button>
        </div>
      </div>

      {flash && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem",
          padding: "0.6rem 0.9rem", borderRadius: 10, fontSize: "0.82rem", fontWeight: 600,
          background: flash.ok ? "rgba(16,185,129,0.08)" : "rgba(220,38,38,0.07)",
          border: `1px solid ${flash.ok ? "rgba(16,185,129,0.25)" : "rgba(220,38,38,0.2)"}`,
          color: flash.ok ? "#059669" : "#dc2626",
        }}>
          {flash.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          <span style={{ flex: 1 }}>{flash.msg}</span>
          <button onClick={() => setFlash(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit" }}><X size={14} /></button>
        </div>
      )}

      {(pendingCount > 0 || changesCount > 0) && panel === "calendar" && (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          {pendingCount > 0 && <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#d97706", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 99, padding: "0.3rem 0.75rem" }}>{pendingCount} awaiting client approval</span>}
          {changesCount > 0 && <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "#dc2626", background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 99, padding: "0.3rem 0.75rem" }}>{changesCount} with changes requested</span>}
        </div>
      )}

      {panel === "calendar" ? (
        <>
          {/* ── Month nav ── */}
          <div className="card" style={{ padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.9rem" }}>
            <button className="btn-ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={{ minHeight: 0, padding: "0.35rem 0.5rem" }}><ChevronLeft size={15} /></button>
            <span style={{ fontWeight: 800, fontSize: "0.95rem", minWidth: 150, textAlign: "center" }}>{monthLabel(month)}</span>
            <button className="btn-ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={{ minHeight: 0, padding: "0.35rem 0.5rem" }}><ChevronRight size={15} /></button>
            <button className="btn-ghost" onClick={() => { const d = new Date(); d.setDate(1); setMonth(d); }} style={{ minHeight: 0, padding: "0.35rem 0.7rem", fontSize: "0.75rem" }}>Today</button>
            <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "var(--text-3)" }}>
              {loading ? "Loading…" : `${posts.length} post${posts.length === 1 ? "" : "s"} · ${currentClient?.business_name ?? ""}`}
            </span>
          </div>

          {/* ── Grid ── */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 760 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--border)" }}>
                  {DOW.map((d) => (
                    <div key={d} style={{ padding: "0.5rem", fontSize: "0.66rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)", textAlign: "center" }}>{d}</div>
                  ))}
                </div>
                {weeks.map((row, wi) => (
                  <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: wi < weeks.length - 1 ? "1px solid var(--border)" : "none" }}>
                    {row.map((day) => {
                      const key = ymd(day);
                      const dayPosts = postsByDay.get(key) ?? [];
                      const inMonth = day.getMonth() === month.getMonth();
                      const isToday = key === todayKey;
                      return (
                        <div
                          key={key}
                          onClick={() => openNew(day)}
                          style={{
                            minHeight: 96, padding: "0.4rem", cursor: "pointer",
                            borderRight: "1px solid var(--border)",
                            background: inMonth ? "transparent" : "var(--surface-2)",
                            opacity: inMonth ? 1 : 0.55,
                          }}
                        >
                          <div style={{
                            width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.7rem", fontWeight: isToday ? 800 : 600, marginBottom: 4,
                            background: isToday ? "linear-gradient(135deg,#0891b2,#4f46e5)" : "transparent",
                            color: isToday ? "#fff" : "var(--text-2)",
                          }}>{day.getDate()}</div>
                          <div style={{ display: "grid", gap: 3 }}>
                            {dayPosts.map((p) => {
                              const st = STATUS[p.status] ?? STATUS.draft;
                              return (
                                <div
                                  key={p.id}
                                  onClick={(e) => { e.stopPropagation(); openPost(p); }}
                                  title={p.title ?? p.caption ?? ""}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 5,
                                    fontSize: "0.68rem", fontWeight: 600, padding: "0.25rem 0.4rem",
                                    borderRadius: 7, background: `${st.color}12`, border: `1px solid ${st.color}30`,
                                    color: "var(--text-1)", overflow: "hidden",
                                  }}
                                >
                                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.color, flexShrink: 0 }} />
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                                    {p.title || p.caption || "Untitled"}
                                  </span>
                                  <PlatformDots channels={p.channels} />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {unscheduled.length > 0 && (
            <div className="card" style={{ marginTop: "0.9rem", padding: "0.9rem 1.1rem" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 800, marginBottom: "0.55rem", color: "var(--text-2)" }}>Unscheduled drafts</div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {unscheduled.map((p) => (
                  <button key={p.id} onClick={() => openPost(p)} className="btn-ghost" style={{ minHeight: 0, padding: "0.4rem 0.7rem", fontSize: "0.76rem" }}>
                    {p.title || p.caption?.slice(0, 40) || "Untitled"} <StatusPill status={p.status} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── Channels & portal panel ── */
        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "start" }}>
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.9rem 1.1rem", borderBottom: "1px solid var(--border)" }}>
              <Link2 size={15} color="var(--accent)" />
              <span style={{ fontWeight: 800, fontSize: "0.9rem" }}>Connected channels — {currentClient?.business_name}</span>
            </div>
            <div style={{ padding: "1rem 1.1rem", display: "grid", gap: "0.9rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <a className="btn-primary" href={clientId ? `/api/social/oauth/meta?client_id=${clientId}` : "#"}
                   onClick={(e) => { if (!oauth.meta) { e.preventDefault(); setFlash({ ok: false, msg: "Meta OAuth isn't configured yet — set META_APP_ID / META_APP_SECRET in Vercel, or add the account manually below." }); } }}
                   style={{ fontSize: "0.78rem", background: "linear-gradient(135deg,#1877f2,#0e5fcb)" }}>
                  Connect Facebook &amp; Instagram
                </a>
                <a className="btn-primary" href={clientId ? `/api/social/oauth/linkedin?client_id=${clientId}` : "#"}
                   onClick={(e) => { if (!oauth.linkedin) { e.preventDefault(); setFlash({ ok: false, msg: "LinkedIn OAuth isn't configured yet — set LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET in Vercel, or add the account manually below." }); } }}
                   style={{ fontSize: "0.78rem", background: "linear-gradient(135deg,#0a66c2,#084e94)" }}>
                  Connect LinkedIn
                </a>
              </div>

              {accounts.length === 0 ? (
                <p style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>No channels yet — connect via OAuth above, or add one manually so it shows on the calendar (its posts get flagged for manual publishing).</p>
              ) : (
                <div style={{ display: "grid", gap: "0.45rem" }}>
                  {accounts.map((a) => {
                    const info = platformInfo(a.platform);
                    const auto = a.status === "connected" && a.has_token;
                    return (
                      <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.55rem 0.7rem", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: info.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.82rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.account_name}</div>
                          <div style={{ fontSize: "0.66rem", color: "var(--text-3)" }}>{info.label}</div>
                        </div>
                        <span style={{
                          fontSize: "0.64rem", fontWeight: 700, borderRadius: 99, padding: "0.12rem 0.5rem",
                          color: auto ? "#059669" : a.status === "expired" ? "#dc2626" : "#d97706",
                          background: auto ? "rgba(16,185,129,0.1)" : a.status === "expired" ? "rgba(220,38,38,0.08)" : "rgba(251,191,36,0.12)",
                          border: `1px solid ${auto ? "rgba(16,185,129,0.25)" : a.status === "expired" ? "rgba(220,38,38,0.2)" : "rgba(251,191,36,0.25)"}`,
                        }}>
                          {auto ? "Auto-publish" : a.status === "expired" ? "Expired — reconnect" : "Manual"}
                        </span>
                        <button onClick={() => removeAccount(a.id)} className="btn-ghost" style={{ minHeight: 0, padding: "0.3rem" }} title="Remove">
                          <Trash2 size={13} color="#dc2626" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.9rem" }}>
                <div style={{ fontSize: "0.74rem", fontWeight: 800, marginBottom: "0.5rem", color: "var(--text-2)" }}>Add a channel manually</div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <select className="field" value={manualForm.platform} onChange={(e) => setManualForm({ ...manualForm, platform: e.target.value })} style={{ maxWidth: 160 }}>
                    {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                  <input className="field" placeholder="Account name, e.g. @lvcivil" value={manualForm.account_name}
                         onChange={(e) => setManualForm({ ...manualForm, account_name: e.target.value })} style={{ flex: 1, minWidth: 160 }} />
                  <button className="btn-primary" onClick={addManualAccount} disabled={!manualForm.account_name.trim()} style={{ fontSize: "0.78rem" }}>Add</button>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.9rem 1.1rem", borderBottom: "1px solid var(--border)" }}>
              <Settings2 size={15} color="var(--accent)" />
              <span style={{ fontWeight: 800, fontSize: "0.9rem" }}>Portal services — what {currentClient?.business_name} sees</span>
            </div>
            <div style={{ padding: "0.6rem 0" }}>
              {PORTAL_MODULES.map((m) => {
                const on = modules.includes(m.key);
                return (
                  <div key={m.key} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.65rem 1.1rem", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.84rem", fontWeight: 700 }}>{m.label}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>{m.description}</div>
                    </div>
                    <button
                      onClick={() => !m.always && toggleModule(m.key)}
                      disabled={m.always}
                      title={m.always ? "Always on" : on ? "Turn off" : "Turn on"}
                      style={{
                        width: 40, height: 22, borderRadius: 99, border: "none", cursor: m.always ? "default" : "pointer",
                        background: on ? "linear-gradient(135deg,#0891b2,#4f46e5)" : "var(--surface-3)",
                        position: "relative", transition: "background 0.2s", opacity: m.always ? 0.6 : 1, flexShrink: 0,
                      }}
                    >
                      <span style={{
                        position: "absolute", top: 3, left: on ? 21 : 3, width: 16, height: 16, borderRadius: "50%",
                        background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                      }} />
                    </button>
                  </div>
                );
              })}
              <p style={{ fontSize: "0.7rem", color: "var(--text-3)", padding: "0.75rem 1.1rem 0.5rem" }}>
                Toggle services to match the client&apos;s subscription — their portal sidebar updates instantly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Composer / editor modal ── */}
      {editing !== null && (
        <div
          onClick={() => setEditing(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(10,14,30,0.55)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "3rem 1rem", overflowY: "auto" }}
        >
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 620, padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
              <Megaphone size={15} color="var(--accent)" />
              <span style={{ fontWeight: 800, fontSize: "0.92rem", flex: 1 }}>
                {editing === "new" ? "New post" : (editing.title || "Edit post")}
              </span>
              {editing !== "new" && <StatusPill status={editing.status} />}
              <button onClick={() => setEditing(null)} className="btn-ghost" style={{ minHeight: 0, padding: "0.3rem" }}><X size={15} /></button>
            </div>

            <div style={{ padding: "1.1rem 1.25rem", display: "grid", gap: "0.8rem" }}>
              {editing !== "new" && editing.status === "changes_requested" && editing.approval_note && (
                <div style={{ padding: "0.6rem 0.85rem", borderRadius: 10, fontSize: "0.8rem", background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)", color: "#dc2626" }}>
                  <strong>Client asked for changes:</strong> {editing.approval_note}
                </div>
              )}
              {editing !== "new" && editing.publish_error && (
                <div style={{ padding: "0.6rem 0.85rem", borderRadius: 10, fontSize: "0.8rem", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", color: "#d97706" }}>
                  {editing.publish_error}
                </div>
              )}

              <input className="field" placeholder="Internal title (e.g. Spring promo — week 1)" value={form.title}
                     onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
              <textarea className="field" placeholder="Caption — what gets posted" rows={5} value={form.caption}
                        onChange={(e) => setForm({ ...form, caption: e.target.value })}
                        style={{ ...inputStyle, resize: "vertical", minHeight: 110, fontFamily: "inherit", lineHeight: 1.5 }} />

              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-2)" }}>Schedule</label>
                <input type="datetime-local" className="field" value={form.scheduled_at}
                       onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} style={{ maxWidth: 230 }} />
              </div>

              <div>
                <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-2)", marginBottom: "0.4rem" }}>Channels</div>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {PLATFORMS.map((p) => {
                    const on = form.platforms.includes(p.key);
                    const hasAccount = accounts.some((a) => a.platform === p.key);
                    return (
                      <button key={p.key}
                        onClick={() => setForm({ ...form, platforms: on ? form.platforms.filter((k) => k !== p.key) : [...form.platforms, p.key] })}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
                          fontSize: "0.74rem", fontWeight: 700, padding: "0.35rem 0.7rem", borderRadius: 99,
                          border: `1px solid ${on ? p.color : "var(--border-2)"}`,
                          background: on ? `${p.color}14` : "transparent",
                          color: on ? p.color : "var(--text-3)",
                        }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, opacity: on ? 1 : 0.4 }} />
                        {p.label}{!hasAccount && on ? " (no account)" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* media (existing posts only — upload needs a post id) */}
              {editing !== "new" ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
                    <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "var(--text-2)" }}>Media</span>
                    <label className="btn-ghost" style={{ minHeight: 0, padding: "0.3rem 0.6rem", fontSize: "0.72rem", cursor: "pointer" }}>
                      <Upload size={12} /> {uploading ? "Uploading…" : "Add image / video"}
                      <input type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={uploadMedia} />
                    </label>
                  </div>
                  {editing.media.length > 0 && (
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {editing.media.map((m) => (
                        <div key={m.id} style={{ position: "relative" }}>
                          {m.content_type?.startsWith("image/") ? (
                            // eslint-disable-next-line @next/next/no-img-element -- blob-store media
                            <img src={m.url} alt={m.filename} style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border-2)" }} />
                          ) : (
                            <div style={{ width: 84, height: 84, borderRadius: 10, border: "1px solid var(--border-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", color: "var(--text-3)", padding: 4, textAlign: "center", overflow: "hidden" }}>{m.filename}</div>
                          )}
                          <button onClick={() => removeMedia(m.id)} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={11} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>Save the post first, then add images or video.</p>
              )}

              {err && <div style={{ padding: "0.55rem 0.8rem", borderRadius: 9, fontSize: "0.8rem", background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", color: "#dc2626" }}>{err}</div>}

              {/* actions */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", paddingTop: "0.25rem" }}>
                <button className="btn-ghost" onClick={() => saveAndClose()} disabled={saving} style={{ fontSize: "0.8rem" }}>
                  Save draft
                </button>
                <button className="btn-primary" onClick={() => saveAndClose("pending_approval")} disabled={saving}
                        style={{ fontSize: "0.8rem", background: "linear-gradient(135deg,#d97706,#f59e0b)" }}>
                  <Send size={13} /> Send for client approval
                </button>
                <button className="btn-primary" onClick={() => saveAndClose("approved")} disabled={saving}
                        style={{ fontSize: "0.8rem", background: "linear-gradient(135deg,#10b981,#059669)" }}>
                  <ThumbsUp size={13} /> Approve &amp; schedule
                </button>
                {editing !== "new" && (
                  <button className="btn-primary" onClick={publishNow} disabled={saving} style={{ fontSize: "0.8rem" }}>
                    <Rocket size={13} /> Publish now
                  </button>
                )}
                {editing !== "new" && (
                  <button className="btn-ghost" onClick={deletePost} disabled={saving} style={{ fontSize: "0.8rem", color: "#dc2626", marginLeft: "auto" }}>
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </div>

              {/* comments */}
              {editing !== "new" && (
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.8rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.74rem", fontWeight: 700, color: "var(--text-2)", marginBottom: "0.5rem" }}>
                    <MessageSquare size={13} /> Comments
                  </div>
                  <div style={{ display: "grid", gap: "0.45rem", maxHeight: 180, overflowY: "auto", marginBottom: "0.55rem" }}>
                    {comments.length === 0 && <p style={{ fontSize: "0.74rem", color: "var(--text-3)" }}>No comments yet.</p>}
                    {comments.map((c) => (
                      <div key={c.id} style={{ fontSize: "0.8rem", padding: "0.5rem 0.7rem", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                        <span style={{ fontWeight: 700, color: c.author_role === "client" ? "#d97706" : "var(--accent)" }}>
                          {c.author ?? (c.author_role === "client" ? "Client" : "KW team")}{c.author_role === "client" ? " (client)" : ""}:
                        </span>{" "}
                        {c.body}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input className="field" placeholder="Add an internal or reply comment…" value={commentDraft}
                           onChange={(e) => setCommentDraft(e.target.value)}
                           onKeyDown={(e) => e.key === "Enter" && addComment()} />
                    <button className="btn-primary" onClick={addComment} disabled={!commentDraft.trim()} style={{ flexShrink: 0 }}><Send size={13} /></button>
                  </div>
                </div>
              )}

              {editing !== "new" && (
                <div style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>
                  <PencilLine size={10} style={{ display: "inline", verticalAlign: "-1px" }} /> {niceTime(editing.scheduled_at)}
                  {editing.published_at ? ` · Published ${niceTime(editing.published_at)}` : ""}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContentPage() {
  return (
    <Suspense fallback={<div className="page" />}>
      <ContentPlanner />
    </Suspense>
  );
}
