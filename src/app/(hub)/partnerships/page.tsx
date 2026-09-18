"use client";

import { useCallback, useEffect, useState } from "react";
import { swrJson } from "@/lib/cache";
import { Handshake, Plus, KeyRound, UserPlus, Users, Megaphone, CheckCircle2, AlertCircle, Lock } from "lucide-react";

/**
 * Partnerships — Kye-only directory of partner organisations (e.g. GC Media
 * Group). Each partner runs its own isolated workspace at /partner with its
 * own clients and content; nothing here mixes with KWI's client lists.
 */

interface PartnerUser { id: number; name: string; username: string; locked: boolean }
interface Partner {
  id: number; name: string; slug: string; contact_name: string | null;
  email: string | null; phone: string | null; notes: string | null;
  client_count: number; post_count: number; users: PartnerUser[];
}

const field: React.CSSProperties = {
  background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
  padding: "0.5rem 0.7rem", fontSize: "0.82rem", color: "var(--text-1)", width: "100%",
};
const card: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
};

export default function PartnershipsPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [newPartner, setNewPartner] = useState({ name: "", contact_name: "", email: "", phone: "" });
  const [login, setLogin] = useState<{ partnerId: number | null; name: string; username: string; password: string }>({ partnerId: null, name: "", username: "", password: "" });
  const [reset, setReset] = useState<{ username: string | null; password: string }>({ username: null, password: "" });

  const load = useCallback(() => {
    return swrJson<Partner[]>("/api/partnerships", (data) => {
      setPartners(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  function flash(ok: boolean, text: string) {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 4000);
  }

  async function post(body: Record<string, unknown>, okText: string) {
    const res = await fetch("/api/partnerships", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { flash(false, data.error ?? "Something went wrong"); return false; }
    flash(true, okText);
    await load();
    return true;
  }

  async function addPartner(e: React.FormEvent) {
    e.preventDefault();
    if (await post({ action: "create_partner", ...newPartner }, `${newPartner.name} added as a partner`)) {
      setNewPartner({ name: "", contact_name: "", email: "", phone: "" });
    }
  }

  async function addLogin(e: React.FormEvent) {
    e.preventDefault();
    if (await post(
      { action: "create_user", partner_id: login.partnerId, name: login.name, username: login.username, password: login.password },
      `Login created for ${login.name}`
    )) setLogin({ partnerId: null, name: "", username: "", password: "" });
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (await post({ action: "reset_password", username: reset.username, new_password: reset.password }, `Password updated for ${reset.username}`)) {
      setReset({ username: null, password: "" });
    }
  }

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem" }}>
        <Handshake size={22} style={{ color: "var(--accent, #4f46e5)" }} />
        <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-1)", margin: 0 }}>Partnerships</h1>
      </div>
      <p style={{ fontSize: "0.82rem", color: "var(--text-3)", margin: "0 0 1.25rem" }}>
        Partner agencies run their own workspace at <code>/partner</code> with their own clients and content —
        fully separated from KW Innovations&apos; data.
      </p>

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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
        {loading && <div style={{ ...card, padding: "1.25rem", color: "var(--text-3)", fontSize: "0.85rem" }}>Loading partners…</div>}
        {!loading && partners.length === 0 && (
          <div style={{ ...card, padding: "1.25rem", color: "var(--text-3)", fontSize: "0.85rem" }}>No partners yet — add the first one below.</div>
        )}
        {partners.map((p) => (
          <div key={p.id} style={{ ...card, padding: "1.1rem 1.15rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginBottom: "0.75rem" }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "0.85rem",
              }}>
                {p.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)" }}>{p.name}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
                  {p.contact_name ? `Contact: ${p.contact_name}` : "No contact set"}{p.email ? ` · ${p.email}` : ""}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginBottom: "0.85rem", fontSize: "0.78rem", color: "var(--text-2)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}><Users size={13} /> {p.client_count} clients</span>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}><Megaphone size={13} /> {p.post_count} posts</span>
            </div>

            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
              Workspace logins
            </div>
            {p.users.length === 0 && <div style={{ fontSize: "0.78rem", color: "var(--text-3)", marginBottom: "0.5rem" }}>No logins yet.</div>}
            {p.users.map((u) => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0", fontSize: "0.82rem", color: "var(--text-1)" }}>
                <span style={{ fontWeight: 600 }}>{u.name}</span>
                <span style={{ color: "var(--text-3)" }}>({u.username})</span>
                {u.locked && (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.2rem", fontSize: "0.7rem", color: "#d97706", fontWeight: 700 }}>
                    <Lock size={11} /> no password set
                  </span>
                )}
                <button
                  onClick={() => setReset({ username: u.username, password: "" })}
                  style={{ marginLeft: "auto", background: "none", border: "1px solid var(--border)", borderRadius: 7, padding: "0.2rem 0.55rem", fontSize: "0.7rem", color: "var(--text-2)", cursor: "pointer" }}
                >
                  {u.locked ? "Set password" : "Reset password"}
                </button>
              </div>
            ))}
            {reset.username && p.users.some((u) => u.username === reset.username) && (
              <form onSubmit={resetPassword} style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <input
                  style={field} type="text" autoComplete="off" placeholder={`New password for ${reset.username} (min 8)`}
                  value={reset.password} onChange={(e) => setReset((r) => ({ ...r, password: e.target.value }))}
                />
                <button className="btn-primary" type="submit" disabled={reset.password.length < 8}
                  style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "0.5rem 0.8rem", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  <KeyRound size={13} style={{ verticalAlign: "-2px" }} /> Save
                </button>
              </form>
            )}

            <button
              onClick={() => setLogin({ partnerId: p.id, name: "", username: "", password: "" })}
              style={{ marginTop: "0.7rem", background: "none", border: "1px dashed var(--border)", borderRadius: 8, padding: "0.4rem 0.7rem", fontSize: "0.75rem", color: "var(--text-2)", cursor: "pointer", width: "100%" }}
            >
              <UserPlus size={13} style={{ verticalAlign: "-2px" }} /> Add workspace login
            </button>
            {login.partnerId === p.id && (
              <form onSubmit={addLogin} style={{ display: "grid", gap: "0.5rem", marginTop: "0.6rem" }}>
                <input style={field} placeholder="Display name (e.g. Jed)" value={login.name} onChange={(e) => setLogin((l) => ({ ...l, name: e.target.value }))} />
                <input style={field} placeholder="Username" autoComplete="off" value={login.username} onChange={(e) => setLogin((l) => ({ ...l, username: e.target.value }))} />
                <input style={field} type="text" placeholder="Password (min 8 characters)" autoComplete="off" value={login.password} onChange={(e) => setLogin((l) => ({ ...l, password: e.target.value }))} />
                <button type="submit" disabled={!login.name || !login.username || login.password.length < 8}
                  style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "0.55rem", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}>
                  Create login
                </button>
              </form>
            )}
          </div>
        ))}
      </div>

      {/* Add partner */}
      <div style={{ ...card, padding: "1.1rem 1.15rem", maxWidth: 520 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 800, fontSize: "0.95rem", color: "var(--text-1)", marginBottom: "0.75rem" }}>
          <Plus size={15} /> Add a partner
        </div>
        <form onSubmit={addPartner} style={{ display: "grid", gap: "0.6rem" }}>
          <input style={field} placeholder="Partner / agency name" value={newPartner.name} onChange={(e) => setNewPartner((p) => ({ ...p, name: e.target.value }))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
            <input style={field} placeholder="Contact name" value={newPartner.contact_name} onChange={(e) => setNewPartner((p) => ({ ...p, contact_name: e.target.value }))} />
            <input style={field} placeholder="Phone" value={newPartner.phone} onChange={(e) => setNewPartner((p) => ({ ...p, phone: e.target.value }))} />
          </div>
          <input style={field} type="email" placeholder="Email" value={newPartner.email} onChange={(e) => setNewPartner((p) => ({ ...p, email: e.target.value }))} />
          <button type="submit" disabled={!newPartner.name.trim()}
            style={{ background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "0.6rem", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
            Add partner
          </button>
        </form>
      </div>
    </div>
  );
}
