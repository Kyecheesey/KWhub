"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  LogOut, Send, Phone, Mail, Globe, UserCircle2,
  MessageSquare, Building2,
} from "lucide-react";

interface ClientInfo {
  id: number;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  assigned_to: string | null;
}

interface Message {
  id: number;
  author: string | null;
  author_role: string;
  body: string;
  created_at: string;
}

function msgTime(iso: string) {
  return new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function PortalPage() {
  const { data: session } = useSession();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/portal/me").then((r) => r.json()),
      fetch("/api/portal/messages").then((r) => r.json()),
    ]).then(([me, msgs]) => {
      if (cancelled) return;
      if (!me.error) setClient(me);
      setMessages(Array.isArray(msgs) ? msgs : []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const res = await fetch("/api/portal/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      setDraft("");
    }
    setSending(false);
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      {/* ── Header ── */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.85rem 1.25rem", borderBottom: "1px solid var(--border)",
        background: "var(--surface)", position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "linear-gradient(135deg,#2dd4e8,#818cf8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: "0.75rem", color: "#07090f",
          }}>KW</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--text-1)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>KW Innovations</div>
            <div style={{ fontSize: "0.6rem", color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>Client Portal</div>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="btn-ghost"
          style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem", minHeight: 0 }}
        >
          <LogOut size={13} /> Sign out
        </button>
      </header>

      {/* ── Body ── */}
      <main style={{ flex: 1, width: "100%", maxWidth: 860, margin: "0 auto", padding: "1.75rem 1.25rem 3rem" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.35rem" }}>
          {greeting}{client ? `, ${client.contact_name ?? client.business_name}` : ""}
        </h1>
        <p style={{ color: "var(--text-2)", fontSize: "0.9rem", marginBottom: "1.75rem" }}>
          Welcome to your KW Innovations portal — updates from the team and a direct line to us, all in one place.
        </p>

        {loading ? (
          <p style={{ color: "var(--text-3)" }}>Loading…</p>
        ) : (
          <div style={{ display: "grid", gap: "1.25rem" }}>
            {/* Your details */}
            {client && (
              <div className="card" style={{ padding: "1.25rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.9rem" }}>
                  <Building2 size={15} color="var(--accent)" />
                  <span style={{ fontWeight: 800, fontSize: "0.92rem" }}>{client.business_name}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.6rem" }}>
                  {client.contact_name && (
                    <span style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.82rem", color: "var(--text-2)" }}>
                      <UserCircle2 size={13} color="var(--text-3)" /> {client.contact_name}
                    </span>
                  )}
                  {client.phone && (
                    <span style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.82rem", color: "var(--text-2)" }}>
                      <Phone size={13} color="var(--text-3)" /> {client.phone}
                    </span>
                  )}
                  {client.email && (
                    <span style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.82rem", color: "var(--text-2)" }}>
                      <Mail size={13} color="var(--text-3)" /> {client.email}
                    </span>
                  )}
                  {client.website && (
                    <a href={client.website} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.82rem", color: "var(--accent)", textDecoration: "none" }}>
                      <Globe size={13} /> {client.website.replace(/^https?:\/\//, "")}
                    </a>
                  )}
                </div>
                {client.assigned_to && (
                  <p style={{ marginTop: "0.9rem", paddingTop: "0.9rem", borderTop: "1px solid var(--border)", fontSize: "0.8rem", color: "var(--text-3)" }}>
                    Your contact at KW Innovations: <span style={{ color: "var(--text-1)", fontWeight: 700 }}>{client.assigned_to}</span>
                  </p>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
                <MessageSquare size={15} color="var(--accent)" />
                <span style={{ fontWeight: 800, fontSize: "0.92rem" }}>Updates & Messages</span>
              </div>

              <div ref={threadRef} style={{ maxHeight: 420, overflowY: "auto", padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {messages.length === 0 && (
                  <p style={{ fontSize: "0.82rem", color: "var(--text-3)", textAlign: "center", padding: "1.5rem 0" }}>
                    No messages yet — say hello, or the team will post updates here.
                  </p>
                )}
                {messages.map((m) => {
                  const mine = m.author_role === "client";
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth: "78%",
                        background: mine ? "rgba(45,212,232,0.1)" : "var(--surface-2)",
                        border: `1px solid ${mine ? "rgba(45,212,232,0.22)" : "var(--border)"}`,
                        borderRadius: 12, padding: "0.6rem 0.8rem",
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

              {/* Composer */}
              <div style={{ display: "flex", gap: "0.5rem", padding: "0.85rem 1.25rem", borderTop: "1px solid var(--border)" }}>
                <input
                  className="field"
                  placeholder="Write a message to the team…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                />
                <button onClick={send} disabled={sending || !draft.trim()} className="btn-primary" style={{ flexShrink: 0 }}>
                  <Send size={14} /> Send
                </button>
              </div>
            </div>

            <p style={{ textAlign: "center", fontSize: "0.72rem", color: "var(--text-4)" }}>
              Signed in as {session?.user?.email ?? "client"} · KW Innovations Client Portal
            </p>
          </div>
        )}
      </main>
    </>
  );
}
