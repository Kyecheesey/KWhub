"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import { swrJson } from "@/lib/cache";
import {
  Users, Megaphone, Plus, UserPlus, KeyRound, Trash2, ExternalLink,
  CheckCircle2, AlertCircle, Clock, Send, LogOut, CalendarDays,
  Globe, Mail, Phone, Sparkles, ShieldCheck, ArrowRight, X,
} from "lucide-react";

/**
 * Partner workspace — the standalone platform partner agencies (e.g. Jed at
 * GC Media Group) use to run marketing for their own clients. Their clients
 * sign in to the normal client portal; everything here is scoped server-side
 * to the partner's own org, completely separate from KW Innovations' data.
 */

interface Me {
  partner: { id: number; name: string; slug: string; contact_name: string | null };
  user: { name: string | null };
  counts: { clients: number; scheduled_posts: number; pending_approval: number };
}
interface Client {
  id: number; business_name: string; contact_name: string | null; phone: string | null;
  email: string | null; website: string | null; portal_logins: number; post_count: number;
}
interface PortalLogin { id: number; name: string; username: string }
interface Post {
  id: number; client_id: number; title: string | null; caption: string | null;
  scheduled_at: string | null; status: string; business_name: string; comment_count: number;
  approval_note: string | null;
}

const ACCENT = "#7c3aed";
const ACCENT_GRAD = "linear-gradient(135deg, #7c3aed 0%, #4f46e5 55%, #0ea5e9 130%)";

const field: React.CSSProperties = {
  background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10,
  padding: "0.6rem 0.8rem", fontSize: "0.85rem", color: "var(--text-1)", width: "100%",
};
const card: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
};
const btnPrimary: React.CSSProperties = {
  background: ACCENT_GRAD, color: "#fff", border: "none", borderRadius: 10,
  padding: "0.6rem 1.05rem", fontSize: "0.83rem", fontWeight: 700, cursor: "pointer",
  boxShadow: "0 6px 18px rgba(124,58,237,0.28)",
  display: "inline-flex", alignItems: "center", gap: "0.4rem", justifyContent: "center",
};
const btnGhost: React.CSSProperties = {
  background: "none", border: "1px solid var(--border)", borderRadius: 9,
  padding: "0.4rem 0.8rem", fontSize: "0.75rem", fontWeight: 600,
  color: "var(--text-2)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.35rem",
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

const CLIENT_GRADS = [
  "linear-gradient(135deg,#7c3aed,#4f46e5)",
  "linear-gradient(135deg,#0ea5e9,#4f46e5)",
  "linear-gradient(135deg,#059669,#0ea5e9)",
  "linear-gradient(135deg,#db2777,#7c3aed)",
  "linear-gradient(135deg,#d97706,#db2777)",
];

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}
function greet() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function PartnerWorkspace() {
  const [me, setMe] = useState<Me | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<"clients" | "content">("clients");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [now] = useState(() => Date.now()); // page-load timestamp for "this week" stats

  // Clients tab state
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({ business_name: "", contact_name: "", phone: "", email: "", website: "" });
  const [openClient, setOpenClient] = useState<number | null>(null);
  const [logins, setLogins] = useState<Record<number, PortalLogin[]>>({});
  const [newLogin, setNewLogin] = useState({ username: "", password: "", display_name: "" });

  // Content tab state
  const [contentClient, setContentClient] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAddPost, setShowAddPost] = useState(false);
  const [newPost, setNewPost] = useState({ client_id: "", title: "", caption: "", scheduled_at: "", submit: false });

  const load = useCallback(() => {
    return Promise.all([
      swrJson<Me>("/api/partner/me", (data) => { if (data && "partner" in data) setMe(data); }),
      swrJson<Client[]>("/api/partner/clients", (data) => setClients(Array.isArray(data) ? data : [])),
    ]);
  }, []);
  const loadPosts = useCallback(() => {
    return swrJson<Post[]>("/api/partner/posts", (data) => setPosts(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => { load(); loadPosts(); }, [load, loadPosts]);

  function flash(ok: boolean, text: string) {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 4000);
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
    setNewLogin({ username: "", password: "", display_name: "" });
    if (next !== null && !logins[next]) {
      const rows = await api(`/api/partner/accounts?client_id=${next}`, "GET");
      if (rows) setLogins((l) => ({ ...l, [next]: rows as PortalLogin[] }));
    }
  }
  async function addLogin(e: React.FormEvent, clientId: number) {
    e.preventDefault();
    if (await api("/api/partner/accounts", "POST", { client_id: clientId, ...newLogin })) {
      flash(true, "Portal login created");
      setNewLogin({ username: "", password: "", display_name: "" });
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

  async function addPost(e: React.FormEvent) {
    e.preventDefault();
    const created = await api("/api/partner/posts", "POST", {
      client_id: newPost.client_id, title: newPost.title, caption: newPost.caption,
      scheduled_at: newPost.scheduled_at || null,
      status: newPost.submit ? "pending_approval" : "draft",
    });
    if (created) {
      flash(true, newPost.submit ? "Post sent to the client for approval" : "Draft saved");
      setNewPost({ client_id: "", title: "", caption: "", scheduled_at: "", submit: false });
      setShowAddPost(false);
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

  const orgName = me?.partner.name ?? "Partner workspace";
  const firstName = (me?.user.name ?? "").split(" ")[0];
  const today = new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });

  const stats = useMemo(() => {
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
    };
  }, [clients, posts, now]);

  const visiblePosts = useMemo(() => {
    return posts
      .filter((p) => contentClient === "all" || p.client_id === contentClient)
      .filter((p) => statusFilter === "all" || p.status === statusFilter);
  }, [posts, contentClient, statusFilter]);

  const filterCounts = useMemo(() => {
    const base = posts.filter((p) => contentClient === "all" || p.client_id === contentClient);
    const out: Record<string, number> = { all: base.length };
    for (const [key] of FILTERS) if (key !== "all") out[key] = base.filter((p) => p.status === key).length;
    return out;
  }, [posts, contentClient]);

  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "1.5rem 1rem 4rem", width: "100%" }}>

      {/* ── Hero header ── */}
      <div style={{
        position: "relative", overflow: "hidden", borderRadius: 20, marginBottom: "1.25rem",
        background: ACCENT_GRAD, padding: "1.75rem 1.75rem 1.6rem",
        boxShadow: "0 20px 50px rgba(124,58,237,0.30)",
      }}>
        <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", top: -160, right: -80, background: "rgba(255,255,255,0.12)" }} />
        <div style={{ position: "absolute", width: 220, height: 220, borderRadius: "50%", bottom: -140, left: "35%", background: "rgba(255,255,255,0.07)" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{
            width: 54, height: 54, borderRadius: 15, flexShrink: 0,
            background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 900, fontSize: "1.05rem", letterSpacing: "0.02em",
            backdropFilter: "blur(6px)",
          }}>
            {initials(orgName)}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.75)", marginBottom: "0.2rem" }}>
              {today}
            </div>
            <div style={{ fontWeight: 900, fontSize: "1.45rem", color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              {firstName ? `${greet()}, ${firstName} 👋` : orgName}
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

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
        {[
          { label: "Clients", value: stats.clients, icon: Users, color: "#7c3aed", bg: "rgba(124,58,237,0.10)" },
          { label: "Scheduled this week", value: stats.weekAhead, icon: CalendarDays, color: "#0ea5e9", bg: "rgba(14,165,233,0.10)" },
          { label: "Awaiting approval", value: stats.awaiting, icon: Clock, color: "#d97706", bg: "rgba(217,119,6,0.10)" },
          { label: "Approved & ready", value: stats.approved, icon: CheckCircle2, color: "#059669", bg: "rgba(5,150,105,0.10)" },
        ].map((s) => (
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
        <button onClick={() => { setTab("content"); setStatusFilter("changes_requested"); }}
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
        borderRadius: 12, padding: 4, marginBottom: "1.1rem", gap: 2,
      }}>
        {([["clients", "Clients", Users], ["content", "Content planner", Megaphone]] as const).map(([key, label, Icon]) => {
          const active = tab === key;
          return (
            <button key={key} onClick={() => setTab(key)}
              style={{
                display: "flex", alignItems: "center", gap: "0.45rem", padding: "0.55rem 1.15rem", borderRadius: 9,
                fontSize: "0.84rem", fontWeight: 700, cursor: "pointer", border: "none",
                background: active ? ACCENT_GRAD : "transparent",
                color: active ? "#fff" : "var(--text-3)",
                boxShadow: active ? "0 4px 14px rgba(124,58,237,0.30)" : "none",
                transition: "background 0.15s, color 0.15s",
              }}>
              <Icon size={14} /> {label}
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
            <form onSubmit={addClient} style={{ ...card, padding: "1.25rem", display: "grid", gap: "0.65rem", borderColor: "rgba(124,58,237,0.35)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)", display: "flex", alignItems: "center", gap: "0.45rem" }}>
                  <Sparkles size={15} style={{ color: ACCENT }} /> New client
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
                background: "rgba(124,58,237,0.10)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Users size={24} style={{ color: ACCENT }} />
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
                    style={{ ...btnGhost, flex: 1, justifyContent: "center", textDecoration: "none", color: ACCENT, borderColor: "rgba(124,58,237,0.4)" }}>
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
                        <input style={field} placeholder="Username" autoComplete="off" value={newLogin.username} onChange={(e) => setNewLogin((l) => ({ ...l, username: e.target.value }))} />
                      </div>
                      <div style={{ display: "flex", gap: "0.45rem" }}>
                        <input style={field} type="text" placeholder="Password (min 8)" autoComplete="off" value={newLogin.password} onChange={(e) => setNewLogin((l) => ({ ...l, password: e.target.value }))} />
                        <button type="submit" style={{ ...btnPrimary, padding: "0.55rem 0.9rem" }} disabled={!newLogin.username || newLogin.password.length < 8}>
                          <UserPlus size={13} />
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Content tab ── */}
      {tab === "content" && (
        <div style={{ display: "grid", gap: "0.85rem" }}>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
            <select style={{ ...field, width: "auto", minWidth: 190 }} value={String(contentClient)}
              onChange={(e) => setContentClient(e.target.value === "all" ? "all" : parseInt(e.target.value, 10))}>
              <option value="all">All clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
            <button onClick={() => setShowAddPost((v) => !v)} style={{ ...btnPrimary, marginLeft: "auto" }}>
              <Plus size={14} /> New post
            </button>
          </div>

          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {FILTERS.map(([key, label]) => {
              const active = statusFilter === key;
              const count = filterCounts[key] ?? 0;
              return (
                <button key={key} onClick={() => setStatusFilter(key)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "0.35rem",
                    padding: "0.35rem 0.75rem", borderRadius: 999, fontSize: "0.74rem", fontWeight: 700, cursor: "pointer",
                    border: active ? `1px solid ${ACCENT}` : "1px solid var(--border)",
                    background: active ? "rgba(124,58,237,0.10)" : "var(--surface)",
                    color: active ? ACCENT : "var(--text-3)",
                  }}>
                  {label}
                  <span style={{
                    fontSize: "0.66rem", fontWeight: 800, borderRadius: 999, padding: "0.05rem 0.4rem",
                    background: active ? ACCENT : "var(--bg)", color: active ? "#fff" : "var(--text-3)",
                  }}>{count}</span>
                </button>
              );
            })}
          </div>

          {showAddPost && (
            <form onSubmit={addPost} style={{ ...card, padding: "1.25rem", display: "grid", gap: "0.65rem", borderColor: "rgba(124,58,237,0.35)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)", display: "flex", alignItems: "center", gap: "0.45rem" }}>
                  <Sparkles size={15} style={{ color: ACCENT }} /> New post
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

          {visiblePosts.length === 0 && !showAddPost && (
            <div style={{ ...card, padding: "3rem 1.5rem", textAlign: "center" }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: "0 auto 1rem",
                background: "rgba(124,58,237,0.10)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Megaphone size={24} style={{ color: ACCENT }} />
              </div>
              <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text-1)", marginBottom: "0.35rem" }}>
                {statusFilter === "all" ? "Plan your first post" : `Nothing ${POST_STATUS[statusFilter]?.label.toLowerCase() ?? "here"} right now`}
              </div>
              <p style={{ fontSize: "0.83rem", color: "var(--text-3)", maxWidth: 400, margin: "0 auto 1.1rem", lineHeight: 1.55 }}>
                Draft content, send it to your client for one-click approval in their portal,
                and track everything from idea to published.
              </p>
              {statusFilter === "all" && (
                <button onClick={() => setShowAddPost(true)} style={btnPrimary}>
                  <Plus size={14} /> Create a post
                </button>
              )}
            </div>
          )}

          {visiblePosts.map((p) => {
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
                      {p.comment_count > 0 && (
                        <>
                          <span style={{ opacity: 0.5 }}>·</span>
                          <span>{p.comment_count} comment{p.comment_count > 1 ? "s" : ""}</span>
                        </>
                      )}
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
              </div>
            );
          })}
        </div>
      )}

      <p style={{ textAlign: "center", marginTop: "2.5rem", fontSize: "0.72rem", color: "var(--text-3)" }}>
        {orgName} partner workspace · Powered by KW Innovations
      </p>
    </div>
  );
}
