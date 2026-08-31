"use client";

import { useState } from "react";
import Link from "next/link";
import { Rocket, Send, CheckCircle2, Mail, LogIn, Eye, EyeOff } from "lucide-react";

/**
 * Public client sign-up — no login required. Shareable as
 * kwinnovationshub.com.au/signup. Creates the business as a client with a
 * portal login; logged-in clients are sent to their portal by the middleware.
 */

const BLANK = { business: "", name: "", email: "", phone: "", website: "", about: "", password: "", company: "" };

export default function PublicSignupPage() {
  const [form, setForm] = useState(BLANK);
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof BLANK) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    const res = await fetch("/api/public/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => null);
    setSending(false);
    if (!res.ok) { setError(data?.error ?? "Something went wrong — please try again."); return; }
    setDone(true);
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
            <div style={{ fontSize: "0.6rem", color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>Client Sign-Up</div>
          </div>
        </div>
        <Link href="/login" className="btn-ghost" style={{ padding: "0.45rem 0.85rem", fontSize: "0.8rem", minHeight: 0 }}>
          <LogIn size={13} /> Already a client? Sign in
        </Link>
      </header>

      <main style={{ flex: 1, width: "100%", maxWidth: 560, margin: "0 auto", padding: "2.5rem 1.25rem 3rem", position: "relative" }}>
        {done ? (
          <div className="card fade-up" style={{ padding: "2.25rem 1.75rem", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", margin: "0 auto 1rem", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={26} color="#059669" />
            </div>
            <h1 style={{ fontSize: "1.35rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: "0.4rem" }}>Welcome aboard!</h1>
            <p style={{ fontSize: "0.88rem", color: "var(--text-2)", lineHeight: 1.6, marginBottom: "1.25rem" }}>
              Thanks {form.name.split(" ")[0]} — {form.business} is signed up and the KW team has been notified.
              Your portal is ready: sign in with <strong>{form.email}</strong> and the password you chose.
            </p>
            <Link href="/login" className="btn-primary" style={{ fontSize: "0.85rem", display: "inline-flex" }}>
              <LogIn size={14} /> Sign in to your portal
            </Link>
          </div>
        ) : (
          <>
            <div className="fade-up" style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{ width: 52, height: 52, borderRadius: 15, margin: "0 auto 0.9rem", background: "rgba(79,70,229,0.08)", border: "1px solid rgba(79,70,229,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Rocket size={24} color="var(--accent)" />
              </div>
              <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 1.9rem)", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: "0.35rem" }}>
                Bring your business <span className="grad-text">on board.</span>
              </h1>
              <p style={{ fontSize: "0.88rem", color: "var(--text-2)", lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>
                Sign up to work with KW Innovations and get instant access to your client portal — jobs, approvals, files and support in one place.
              </p>
            </div>

            <form onSubmit={submit} className="card fade-up" style={{ padding: "1.5rem", display: "grid", gap: "0.75rem", animationDelay: "0.08s" }}>
              <input className="field" placeholder="Business name *" value={form.business} onChange={set("business")} required />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <input className="field" placeholder="Your name *" value={form.name} onChange={set("name")} required />
                <input className="field" type="tel" placeholder="Phone" value={form.phone} onChange={set("phone")} />
              </div>
              <input className="field" type="email" placeholder="Email * — this becomes your portal login" value={form.email} onChange={set("email")} required />
              <input className="field" type="url" placeholder="Website (if you have one)" value={form.website} onChange={set("website")} />
              <textarea className="field" placeholder="What are you after? e.g. a new website, marketing help, IT support…" rows={3} value={form.about} onChange={set("about")} style={{ resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
              <div style={{ position: "relative" }}>
                <input className="field" type={showPassword ? "text" : "password"} placeholder="Choose a portal password (8+ characters) *" value={form.password} onChange={set("password")} autoComplete="new-password" minLength={8} required style={{ width: "100%", paddingRight: "2.5rem" }} />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{ position: "absolute", right: "0.7rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: "0.2rem", display: "flex" }}>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {/* Honeypot — hidden from humans */}
              <input type="text" value={form.company} onChange={set("company")} tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} aria-hidden="true" />
              {error && (
                <div style={{ padding: "0.55rem 0.8rem", borderRadius: 9, fontSize: "0.8rem", background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", color: "#dc2626" }}>{error}</div>
              )}
              <button type="submit" className="btn-primary" disabled={sending || !form.business.trim() || !form.name.trim() || !form.email.trim() || form.password.length < 8} style={{ justifySelf: "start" }}>
                <Send size={14} /> {sending ? "Signing up…" : "Sign up"}
              </button>
            </form>

            <p className="fade-up" style={{ animationDelay: "0.14s", textAlign: "center", fontSize: "0.74rem", color: "var(--text-3)", marginTop: "1.25rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
              <Mail size={12} /> Questions first? <a href="mailto:director@kwinnovations.com.au" style={{ color: "var(--accent)", fontWeight: 700 }}>director@kwinnovations.com.au</a>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
