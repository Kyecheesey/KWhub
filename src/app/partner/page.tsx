"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { swrJson } from "@/lib/cache";
import {
  Users, Megaphone, Plus, UserPlus, KeyRound, Trash2, ExternalLink,
  CheckCircle2, AlertCircle, Clock, Send, LogOut, CalendarDays,
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

const field: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
  padding: "0.55rem 0.7rem", fontSize: "0.84rem", color: "var(--text-1)", width: "100%",
};
const card: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
};
const btnPrimary: React.CSSProperties = {
  background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8,
  padding: "0.55rem 0.9rem", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer",
};

const POST_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:             { label: "Draft",             color: "#8892b0", bg: "rgba(136,146,176,0.12)" },
  pending_approval:  { label: "Awaiting approval", color: "#d97706", bg: "rgba(251,191,36,0.12)" },
  approved:          { label: "Approved",          color: "#059669", bg: "rgba(52,211,153,0.12)" },
  changes_requested: { label: "Changes requested", color: "#dc2626", bg: "rgba(248,113,113,0.12)" },
  published:         { label: "Published",         color: "#4f46e5", bg: "rgba(129,140,248,0.12)" },
};

export default function PartnerWorkspace() {
  const [me, setMe] = useState<Me | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<"clients" | "content">("clients");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Clients tab state
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({ business_name: "", contact_name: "", phone: "", email: "", website: "" });
  const [openClient, setOpenClient] = useState<number | null>(null);
  const [logins, setLogins] = useState<Record<number, PortalLogin[]>>({});
  const [newLogin, setNewLogin] = useState({ username: "", password: "", display_name: "" });

  // Content tab state
  const [contentClient, setContentClient] = useState<number | "all">("all");
  const [showAddPost, setShowAddPost] = useState(false);
  const [newPost, setNewPost] = useState({ client_id: "", title: "", caption: "", scheduled_at: "", submit: false });

  const load = useCallback(() => {
    return Promise.all([
      swrJson<Me>("/api/partner/me", (data) => { if (data && "partner" in data) setMe(data); }),
      swrJson<Client[]>("/api/partner/clients", (data) => setClients(Array.isArray(data) ? data : [])),
    ]);
  }, []);
  const loadPosts = useCallback(() => {
    const q = contentClient === "all" ? "" : `?client_id=${contentClient}`;
    return swrJson<Post[]>(`/api/partner/posts${q}`, (data) => setPosts(Array.isArray(data) ? data : []));
  }, [contentClient]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "content") loadPosts(); }, [tab, loadPosts]);

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

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.25rem 1rem 3rem", width: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <div style={{
          width: 42, height: 42, borderRadius: 11, background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800,
        }}>
          {orgName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 800, fontSize: "1.15rem", color: "var(--text-1)" }}>{orgName}</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
            Partner workspace{me?.user.name ? ` · Signed in as ${me.user.name}` : ""} · Powered by KW Innovations
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/login" })}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "0.45rem 0.8rem", fontSize: "0.78rem", color: "var(--text-2)", cursor: "pointer" }}>
          <LogOut size={13} style={{ verticalAlign: "-2px" }} /> Sign out
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem", marginBottom: "1.25rem" }}>
        {[
          { label: "Clients", value: me?.counts.clients ?? "—", icon: Users, color: "#7c3aed" },
          { label: "Scheduled posts", value: me?.counts.scheduled_posts ?? "—", icon: CalendarDays, color: "#4f46e5" },
          { label: "Awaiting approval", value: me?.counts.pending_approval ?? "—", icon: Clock, color: "#d97706" },
        ].map((s) => (
          <div key={s.label} style={{ ...card, padding: "0.9rem 1rem", display: "flex", alignItems: "center", gap: "0.7rem" }}>
            <s.icon size={18} style={{ color: s.color }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.15rem", color: "var(--text-1)" }}>{s.value}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {msg && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 0.9rem", borderRadius: 10,
          marginBottom: "1rem", fontSize: "0.82rem", fontWeight: 600,
          background: msg.ok ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
          color: msg.ok ? "#059669" : "#dc2626",
        }}>
          {msg.ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem" }}>
        {([["clients", "Clients", Users], ["content", "Content planner", Megaphone]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem 1rem", borderRadius: 9,
              fontSize: "0.83rem", fontWeight: 700, cursor: "pointer",
              background: tab === key ? "#7c3aed" : "var(--surface)",
              color: tab === key ? "#fff" : "var(--text-2)",
              border: tab === key ? "1px solid #7c3aed" : "1px solid var(--border)",
            }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Clients tab ── */}
      {tab === "clients" && (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <button onClick={() => setShowAddClient((v) => !v)}
            style={{ ...card, padding: "0.7rem", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-2)", cursor: "pointer", border: "1px dashed var(--border)", background: "none" }}>
            <Plus size={14} style={{ verticalAlign: "-2px" }} /> Add a client
          </button>
          {showAddClient && (
            <form onSubmit={addClient} style={{ ...card, padding: "1rem", display: "grid", gap: "0.6rem" }}>
              <input style={field} placeholder="Business name" value={newClient.business_name} onChange={(e) => setNewClient((c) => ({ ...c, business_name: e.target.value }))} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                <input style={field} placeholder="Contact name" value={newClient.contact_name} onChange={(e) => setNewClient((c) => ({ ...c, contact_name: e.target.value }))} />
                <input style={field} placeholder="Phone" value={newClient.phone} onChange={(e) => setNewClient((c) => ({ ...c, phone: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                <input style={field} type="email" placeholder="Email" value={newClient.email} onChange={(e) => setNewClient((c) => ({ ...c, email: e.target.value }))} />
                <input style={field} placeholder="Website" value={newClient.website} onChange={(e) => setNewClient((c) => ({ ...c, website: e.target.value }))} />
              </div>
              <button type="submit" style={btnPrimary} disabled={!newClient.business_name.trim()}>Add client</button>
            </form>
          )}

          {clients.length === 0 && (
            <div style={{ ...card, padding: "1.5rem", textAlign: "center", color: "var(--text-3)", fontSize: "0.85rem" }}>
              No clients yet — add your first client to give them portal access and start planning content.
            </div>
          )}
          {clients.map((c) => (
            <div key={c.id} style={{ ...card, padding: "1rem 1.1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)" }}>{c.business_name}</div>
                  <div style={{ fontSize: "0.73rem", color: "var(--text-3)" }}>
                    {[c.contact_name, c.email, c.phone].filter(Boolean).join(" · ") || "No contact details"}
                  </div>
                </div>
                <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>{c.post_count} posts</span>
                <span style={{ fontSize: "0.72rem", color: c.portal_logins > 0 ? "#059669" : "var(--text-3)", fontWeight: 600 }}>
                  {c.portal_logins > 0 ? `${c.portal_logins} portal login${c.portal_logins > 1 ? "s" : ""}` : "No portal access yet"}
                </span>
                <a href={`/portal?client=${c.id}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: "0.72rem", color: "#7c3aed", fontWeight: 700, textDecoration: "none" }}>
                  Preview portal <ExternalLink size={11} style={{ verticalAlign: "-1px" }} />
                </a>
                <button onClick={() => toggleClient(c.id)}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 7, padding: "0.3rem 0.65rem", fontSize: "0.72rem", color: "var(--text-2)", cursor: "pointer" }}>
                  {openClient === c.id ? "Close" : "Manage access"}
                </button>
                <button onClick={() => removeClient(c)} title="Remove client"
                  style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: "0.2rem" }}>
                  <Trash2 size={14} />
                </button>
              </div>

              {openClient === c.id && (
                <div style={{ marginTop: "0.8rem", borderTop: "1px solid var(--border)", paddingTop: "0.8rem" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
                    Portal logins
                  </div>
                  {(logins[c.id] ?? []).length === 0 && (
                    <div style={{ fontSize: "0.78rem", color: "var(--text-3)", marginBottom: "0.5rem" }}>None yet — create one below.</div>
                  )}
                  {(logins[c.id] ?? []).map((l) => (
                    <div key={l.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0", fontSize: "0.82rem", color: "var(--text-1)" }}>
                      <span style={{ fontWeight: 600 }}>{l.name}</span>
                      <span style={{ color: "var(--text-3)" }}>({l.username})</span>
                      <button onClick={() => resetLogin(l.username)} title="Reset password"
                        style={{ marginLeft: "auto", background: "none", border: "1px solid var(--border)", borderRadius: 7, padding: "0.2rem 0.55rem", fontSize: "0.7rem", color: "var(--text-2)", cursor: "pointer" }}>
                        <KeyRound size={11} style={{ verticalAlign: "-1px" }} /> Reset
                      </button>
                      <button onClick={() => removeLogin(c.id, l.username)} title="Remove login"
                        style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: "0.2rem" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <form onSubmit={(e) => addLogin(e, c.id)} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "0.5rem", marginTop: "0.6rem" }}>
                    <input style={field} placeholder="Display name" value={newLogin.display_name} onChange={(e) => setNewLogin((l) => ({ ...l, display_name: e.target.value }))} />
                    <input style={field} placeholder="Username" autoComplete="off" value={newLogin.username} onChange={(e) => setNewLogin((l) => ({ ...l, username: e.target.value }))} />
                    <input style={field} type="text" placeholder="Password (min 8)" autoComplete="off" value={newLogin.password} onChange={(e) => setNewLogin((l) => ({ ...l, password: e.target.value }))} />
                    <button type="submit" style={btnPrimary} disabled={!newLogin.username || newLogin.password.length < 8}>
                      <UserPlus size={13} style={{ verticalAlign: "-2px" }} />
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Content tab ── */}
      {tab === "content" && (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
            <select style={{ ...field, width: "auto", minWidth: 200 }} value={String(contentClient)}
              onChange={(e) => setContentClient(e.target.value === "all" ? "all" : parseInt(e.target.value, 10))}>
              <option value="all">All clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
            <button onClick={() => setShowAddPost((v) => !v)} style={btnPrimary}>
              <Plus size={14} style={{ verticalAlign: "-2px" }} /> New post
            </button>
          </div>

          {showAddPost && (
            <form onSubmit={addPost} style={{ ...card, padding: "1rem", display: "grid", gap: "0.6rem" }}>
              <select style={field} value={newPost.client_id} onChange={(e) => setNewPost((p) => ({ ...p, client_id: e.target.value }))}>
                <option value="">Choose a client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
              </select>
              <input style={field} placeholder="Title (optional)" value={newPost.title} onChange={(e) => setNewPost((p) => ({ ...p, title: e.target.value }))} />
              <textarea style={{ ...field, minHeight: 90, resize: "vertical", fontFamily: "inherit" }} placeholder="Caption / copy"
                value={newPost.caption} onChange={(e) => setNewPost((p) => ({ ...p, caption: e.target.value }))} />
              <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
                <input style={{ ...field, width: "auto" }} type="datetime-local" value={newPost.scheduled_at}
                  onChange={(e) => setNewPost((p) => ({ ...p, scheduled_at: e.target.value }))} />
                <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.78rem", color: "var(--text-2)" }}>
                  <input type="checkbox" checked={newPost.submit} onChange={(e) => setNewPost((p) => ({ ...p, submit: e.target.checked }))} />
                  Send straight to the client for approval
                </label>
                <button type="submit" style={{ ...btnPrimary, marginLeft: "auto" }}
                  disabled={!newPost.client_id || (!newPost.title.trim() && !newPost.caption.trim())}>
                  {newPost.submit ? "Create & send" : "Save draft"}
                </button>
              </div>
            </form>
          )}

          {posts.length === 0 && (
            <div style={{ ...card, padding: "1.5rem", textAlign: "center", color: "var(--text-3)", fontSize: "0.85rem" }}>
              No posts yet. Create a draft and send it to your client for approval — they&apos;ll see it in their portal&apos;s Marketing tab.
            </div>
          )}
          {posts.map((p) => {
            const st = POST_STATUS[p.status] ?? POST_STATUS.draft;
            return (
              <div key={p.id} style={{ ...card, padding: "0.9rem 1.1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-1)" }}>
                      {p.title || p.caption?.slice(0, 60) || "Untitled post"}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
                      {p.business_name}
                      {p.scheduled_at ? ` · scheduled ${new Date(p.scheduled_at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}` : " · not scheduled"}
                      {p.comment_count > 0 ? ` · ${p.comment_count} comment${p.comment_count > 1 ? "s" : ""}` : ""}
                    </div>
                    {p.status === "changes_requested" && p.approval_note && (
                      <div style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "0.25rem" }}>Client note: {p.approval_note}</div>
                    )}
                  </div>
                  <span style={{ fontSize: "0.7rem", fontWeight: 700, padding: "0.25rem 0.6rem", borderRadius: 999, background: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                  {(p.status === "draft" || p.status === "changes_requested") && (
                    <button onClick={() => setPostStatus(p, "pending_approval", "Sent to the client for approval")}
                      style={{ background: "none", border: "1px solid var(--border)", borderRadius: 7, padding: "0.3rem 0.65rem", fontSize: "0.72rem", color: "var(--text-2)", cursor: "pointer" }}>
                      <Send size={11} style={{ verticalAlign: "-1px" }} /> Send for approval
                    </button>
                  )}
                  {p.status === "approved" && (
                    <button onClick={() => setPostStatus(p, "published", "Marked as published")}
                      style={{ background: "none", border: "1px solid var(--border)", borderRadius: 7, padding: "0.3rem 0.65rem", fontSize: "0.72rem", color: "#059669", cursor: "pointer" }}>
                      Mark published
                    </button>
                  )}
                  <button onClick={() => removePost(p)} title="Delete post"
                    style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: "0.2rem" }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
