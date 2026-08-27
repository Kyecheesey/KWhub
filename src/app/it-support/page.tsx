"use client";

import { useState } from "react";
import Link from "next/link";
import { LifeBuoy, Send, CheckCircle2, Mail, LogIn } from "lucide-react";

/**
 * Public IT support intake — no login required. Shareable as
 * kwinnovationshub.com.au/it-support. Logged-in clients are redirected to
 * their portal's support tab by the middleware instead of seeing this.
 */

const BLANK = { name: "", business: "", email: "", phone: "", title: "", details: "", priority: "medium", website: "" };

export default function PublicSupportPage() {
  const [form, setForm] = useState(BLANK);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [ref, setRef] = useState<number | null>(null);

  const set = (k: keyof typeof BLANK) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    const res = await fetch("/api/public/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => null);
    setSending(false);
    if (!res.ok) { setError(data?.error ?? "Something went wrong — please try again."); return; }
    setRef(data?.ref ?? 0);
  }

  return (
    <div style={{ minHeight: "100vh", width: "100%", flex: 1, background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* Ambient background */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div className="login-blob" style={{ width: 420, height: 420, top: -140, right: -120, background: "rgba(45,212,232,0.09)" }} />
        <div className="login-blob" style={{ width: 360, height: 360, bottom: -140, left: -100, background: "rgba(124,133,243,0.08)", animationDelay: "-7s" }} />
      </div>

      {/* Header */}
      <header className="glass" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1.25rem", borderBottom: "1px solid var(--border)", position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#0891b2,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "0.75rem", color: "#fff", boxShadow: "0 2px 12px rgba(45,212,232,0.35)" }}>KW</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.88rem", letterSpacing: "-0.02em", lineHeight: 1.1 }}>KW Innovations</div>
            <div style={{ fontSize: "0.6rem", color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>IT Support</div>
          </div>
        </div>
        <Link href="/login" className="btn-ghost" style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem", minHeight: 0 }}>
          <LogIn size={13} /> Client login
        </Link>
      </header>

      <main style={{ flex: 1, width: "100%", maxWidth: 560, margin: "0 auto", padding: "2.5rem 1.25rem 3rem", position: "relative" }}>
        {ref !== null ? (
          <div className="card fade-up" style={{ padding: "2.25rem 1.75rem", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", margin: "0 auto 1rem", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={26} color="#059669" />
            </div>
            <h1 style={{ fontSize: "1.35rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.4rem" }}>Request received</h1>
            <p style={{ fontSize: "0.88rem", color: "var(--text-2)", lineHeight: 1.6, marginBottom: "0.35rem" }}>
              Thanks {form.name.split(" ")[0]} — the KW team has been notified and will be in touch{form.email ? ` at ${form.email}` : ""} shortly.
            </p>
            {ref > 0 && <p style={{ fontSize: "0.74rem", color: "var(--text-3)", marginBottom: "1.25rem" }}>Your reference: #{ref}</p>}
            <button className="btn-ghost" onClick={() => { setForm(BLANK); setRef(null); }} style={{ fontSize: "0.8rem" }}>
              Send another request
            </button>
          </div>
        ) : (
          <>
            <div className="fade-up" style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{ width: 52, height: 52, borderRadius: 15, margin: "0 auto 0.9rem", background: "rgba(79,70,229,0.08)", border: "1px solid rgba(79,70,229,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <LifeBuoy size={24} color="var(--accent)" />
              </div>
              <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 1.9rem)", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: "0.35rem" }}>
                Need a hand? <span className="grad-text">We&apos;re on it.</span>
              </h1>
              <p style={{ fontSize: "0.88rem", color: "var(--text-2)", lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>
                Tell us what&apos;s going on with your website, app or systems and the KW Innovations team will jump on it.
              </p>
            </div>

            <form onSubmit={submit} className="card fade-up" style={{ padding: "1.5rem", display: "grid", gap: "0.75rem", animationDelay: "0.08s" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <input className="field" placeholder="Your name *" value={form.name} onChange={set("name")} required />
                <input className="field" placeholder="Business name" value={form.business} onChange={set("business")} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <input className="field" type="email" placeholder="Email *" value={form.email} onChange={set("email")} />
                <input className="field" type="tel" placeholder="Phone" value={form.phone} onChange={set("phone")} />
              </div>
              <input className="field" placeholder="What's the issue? e.g. Contact form not sending *" value={form.title} onChange={set("title")} required />
              <textarea className="field" placeholder="Any extra detail — what you saw, when it started, what you've tried…" rows={4} value={form.details} onChange={set("details")} style={{ resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
              <select className="field" value={form.priority} onChange={set("priority")}>
                <option value="low">Low — when you get a chance</option>
                <option value="medium">Normal</option>
                <option value="high">Urgent — something is down</option>
              </select>
              {/* Honeypot — hidden from humans */}
              <input type="text" value={form.website} onChange={set("website")} tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} aria-hidden="true" />
              {error && (
                <div style={{ padding: "0.55rem 0.8rem", borderRadius: 9, fontSize: "0.8rem", background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", color: "#dc2626" }}>{error}</div>
              )}
              <button type="submit" className="btn-primary" disabled={sending || !form.name.trim() || !form.title.trim()} style={{ justifySelf: "start" }}>
                <Send size={14} /> {sending ? "Sending…" : "Send support request"}
              </button>
            </form>

            <p className="fade-up" style={{ animationDelay: "0.14s", textAlign: "center", fontSize: "0.74rem", color: "var(--text-3)", marginTop: "1.25rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
              <Mail size={12} /> Prefer email? <a href="mailto:director@kwinnovations.com.au" style={{ color: "var(--accent)", fontWeight: 700 }}>director@kwinnovations.com.au</a>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
