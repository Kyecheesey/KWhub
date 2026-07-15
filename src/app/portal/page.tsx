"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  LogOut, Send, Phone, Mail, Globe, UserCircle2,
  MessageSquare, Sparkles, Eye, ArrowLeft,
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

const POLL_MS = 20_000;

function msgTime(iso: string) {
  return new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function avatarGradient(name: string) {
  const opts = ["#2dd4e8,#0ea5e9", "#818cf8,#6366f1", "#34d399,#059669", "#fb923c,#ea580c"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return `linear-gradient(135deg, ${opts[Math.abs(h) % opts.length]})`;
}

function Skeleton({ height, width, style }: { height: number; width?: number | string; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ height, width: width ?? "100%", ...style }} />;
}

export default function PortalPage() {
  const { data: session } = useSession();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  // Staff preview: /portal?client=<id> renders that client's portal
  const [previewId, setPreviewId] = useState<number | null | "pending">("pending");
  const threadRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<number>>(new Set());

  const isPreview = typeof previewId === "number";
  const qs = isPreview ? `?client_id=${previewId}` : "";

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("client");
    Promise.resolve().then(() => setPreviewId(param ? parseInt(param, 10) : null));
  }, []);

  const loadMessages = useCallback(() => {
    return fetch(`/api/portal/messages${qs}`)
      .then((r) => r.json())
      .then((msgs: Message[]) => {
        if (!Array.isArray(msgs)) return;
        setMessages(msgs);
        msgs.forEach((m) => seenIds.current.add(m.id));
      })
      .catch(() => {});
  }, [qs]);

  useEffect(() => {
    if (previewId === "pending") return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/portal/me${qs}`).then((r) => r.json()),
      fetch(`/api/portal/messages${qs}`).then((r) => r.json()),
    ]).then(([me, msgs]) => {
      if (cancelled) return;
      if (!me.error) setClient(me);
      if (Array.isArray(msgs)) {
        setMessages(msgs);
        msgs.forEach((m: Message) => seenIds.current.add(m.id));
      }
      setLoading(false);
    });
    const interval = setInterval(loadMessages, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [loadMessages, previewId, qs]);

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
      seenIds.current.add(msg.id);
      setMessages((prev) => [...prev, msg]);
      setDraft("");
    }
    setSending(false);
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });

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
          <Link
            href={`/clients/${previewId}/portal`}
            className="btn-ghost"
            style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem", minHeight: 0 }}
          >
            <ArrowLeft size={13} /> Exit Preview
          </Link>
        ) : (
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="btn-ghost"
            style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem", minHeight: 0 }}
          >
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
          <p style={{ color: "var(--text-2)", fontSize: "0.92rem", maxWidth: 520, lineHeight: 1.6 }}>
            Your window into everything we&apos;re working on together — updates from the team and a direct line to us.
          </p>
        </div>

        {loading ? (
          /* ── Skeleton loading state ── */
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
                <Skeleton height={12} />
                <Skeleton height={12} />
              </div>
            </div>
            <div className="card" style={{ padding: "1.25rem", display: "grid", gap: "0.85rem" }}>
              <Skeleton height={14} width="35%" />
              <Skeleton height={52} width="70%" style={{ borderRadius: 12 }} />
              <Skeleton height={52} width="60%" style={{ borderRadius: 12, justifySelf: "end" }} />
              <Skeleton height={52} width="65%" style={{ borderRadius: 12 }} />
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1.25rem" }}>
            {/* Your details */}
            {client && (
              <div className="card fade-up" style={{ padding: "1.4rem", animationDelay: "0.08s", position: "relative", overflow: "hidden" }}>
                <div className="hero-glow" />
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "1rem" }}>
                    <div style={{
                      width: 46, height: 46, borderRadius: 13, flexShrink: 0,
                      background: avatarGradient(client.business_name),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 900, fontSize: "0.95rem", color: "#07090f",
                      boxShadow: "0 4px 18px rgba(45,212,232,0.2)",
                    }}>
                      {client.business_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-0.01em" }}>{client.business_name}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.72rem", color: "var(--accent-3)", fontWeight: 700 }}>
                        <Sparkles size={11} /> Active client
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {client.contact_name && (
                      <span className="btn-ghost" style={{ minHeight: 0, padding: "0.4rem 0.75rem", fontSize: "0.78rem", cursor: "default" }}>
                        <UserCircle2 size={12} /> {client.contact_name}
                      </span>
                    )}
                    {client.phone && (
                      <a href={`tel:${client.phone}`} className="btn-ghost" style={{ minHeight: 0, padding: "0.4rem 0.75rem", fontSize: "0.78rem" }}>
                        <Phone size={12} /> {client.phone}
                      </a>
                    )}
                    {client.email && (
                      <a href={`mailto:${client.email}`} className="btn-ghost" style={{ minHeight: 0, padding: "0.4rem 0.75rem", fontSize: "0.78rem" }}>
                        <Mail size={12} /> {client.email}
                      </a>
                    )}
                    {client.website && (
                      <a href={client.website} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ minHeight: 0, padding: "0.4rem 0.75rem", fontSize: "0.78rem", color: "var(--accent)" }}>
                        <Globe size={12} /> {client.website.replace(/^https?:\/\//, "")}
                      </a>
                    )}
                  </div>

                  {client.assigned_to && (
                    <div style={{
                      marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border)",
                      display: "flex", alignItems: "center", gap: "0.65rem",
                    }}>
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

            {/* Messages */}
            <div className="card fade-up" style={{ overflow: "hidden", animationDelay: "0.16s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "1rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
                <MessageSquare size={15} color="var(--accent)" />
                <span style={{ fontWeight: 800, fontSize: "0.92rem" }}>Updates & Messages</span>
                <span style={{
                  marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.35rem",
                  fontSize: "0.68rem", color: "var(--text-3)", fontWeight: 600,
                }}>
                  <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-3)", display: "inline-block" }} />
                  Live
                </span>
              </div>

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

              {/* Composer */}
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

            <p className="fade-up" style={{ animationDelay: "0.24s", textAlign: "center", fontSize: "0.72rem", color: "var(--text-4)" }}>
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
