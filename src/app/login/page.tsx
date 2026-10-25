"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Lock, User, LogIn, AlertCircle, Eye, EyeOff,
  Users, Target, CalendarDays, CheckCircle2, Sparkles, ArrowRight,
} from "lucide-react";
import { Logo, LogoMark, SplashScreen, SPLASH_HANDOFF_KEY } from "@/components/Logo";

const highlights = [
  { icon: Users, label: "Clients & pipeline in one place", sub: "Every account, job and approval" },
  { icon: Target, label: "Track every potential from lead to won", sub: "Follow-ups, calls and proposals" },
  { icon: CalendarDays, label: "Roster, tasks and team activity", sub: "Know what everyone's working on" },
];

const AUDIENCES = [["staff", "Staff"], ["client", "Client Portal"], ["partner", "Partner"]] as const;

type Mode = "signin" | "forgot" | "reset" | "reset-done";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [audience, setAudience] = useState<"staff" | "client" | "partner">("staff");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  // Loading screen: "intro" on first paint, "entering" after a successful sign-in
  const [splash, setSplash] = useState<"intro" | "intro-leaving" | "entering" | null>("intro");
  const [splashMsg, setSplashMsg] = useState("Starting KWI ONE…");
  const router = useRouter();

  useEffect(() => {
    const fast = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t1 = setTimeout(() => setSplash((v) => (v === "intro" ? "intro-leaving" : v)), fast ? 350 : 1100);
    const t2 = setTimeout(() => setSplash((v) => (v === "intro-leaving" ? null : v)), fast ? 500 : 1550);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setInfo("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });
    if (res?.error) {
      setLoading(false);
      setError("Incorrect username or password.");
      setShakeKey((k) => k + 1);
    } else {
      const next = new URLSearchParams(window.location.search).get("next");
      const dest = next && next.startsWith("/") ? next : "/";
      setSplashMsg("Signing you in…");
      setSplash("entering");
      router.prefetch(dest);
      try { sessionStorage.setItem(SPLASH_HANDOFF_KEY, "1"); } catch {}
      setTimeout(() => setSplashMsg("Loading your workspace…"), 650);
      setTimeout(() => {
        router.push(dest);
        router.refresh();
      }, 1200);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
    setInfo(data.message);
    setMode("reset");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, code, new_password: newPassword }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
    setPassword("");
    setCode("");
    setNewPassword("");
    setMode("reset-done");
  }

  const today = new Date().toLocaleDateString("en-AU", {
    weekday: "long", day: "numeric", month: "long",
  });

  const audienceIdx = AUDIENCES.findIndex(([k]) => k === audience);

  return (
    <div className="login-shell">
      {splash && (
        <div onClick={() => splash.startsWith("intro") && setSplash(null)}>
          <SplashScreen message={splashMsg} leaving={splash === "intro-leaving"} />
        </div>
      )}

      {/* ── Brand panel (desktop only) ── */}
      <aside className="login-brand">
        <div className="login-grid" />
        <div className="login-orbit"><span className="login-orbit-dot" /></div>
        <div className="login-blob" style={{ width: 360, height: 360, top: -120, left: -80, background: "rgba(99,102,241,0.30)" }} />
        <div className="login-blob" style={{ width: 300, height: 300, bottom: -120, right: 40, background: "rgba(34,211,238,0.18)", animationDelay: "-6s" }} />

        <div style={{ position: "relative" }}>
          <Logo size={42} sub="by KW Innovations" dark />
        </div>

        <div style={{ position: "relative", maxWidth: 480 }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: "0.85rem", display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#22d3ee", display: "inline-block" }} />
            {today}
          </p>
          <h1 style={{ fontSize: "clamp(2.2rem, 3.4vw, 3rem)", fontWeight: 900, letterSpacing: "-0.035em", lineHeight: 1.04, marginBottom: "1rem" }}>
            One place for<br />everything <span className="grad-text-brand">KWI.</span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.98rem", lineHeight: 1.65, maxWidth: 410, marginBottom: "2rem" }}>
            Clients, pipeline, content and the team — one workspace, built for how we actually work.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxWidth: 400 }}>
            {highlights.map(({ icon: Icon, label, sub }, i) => (
              <div key={label} className="login-feature login-fade-up" style={{ animationDelay: `${0.15 + i * 0.07}s` }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: "linear-gradient(135deg, rgba(99,102,241,0.35), rgba(34,211,238,0.2))",
                  border: "1px solid rgba(255,255,255,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={15} color="#ffffff" />
                </div>
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff" }}>{label}</div>
                  <div style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ position: "relative", fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Sparkles size={12} /> Built by KW Innovations
        </p>
      </aside>

      {/* ── Form panel ── */}
      <div className="login-form-col">
        <div style={{ width: "100%", maxWidth: 390, position: "relative" }}>
          <div className="login-fade-up" style={{ marginBottom: "1.6rem" }}>
            <div className="login-mobile-logo">
              <LogoMark size={56} style={{ borderRadius: 15, boxShadow: "0 12px 36px rgba(79,70,229,0.35)", margin: "0 auto 1.4rem" }} />
            </div>
            <h1 style={{ fontSize: "1.65rem", fontWeight: 900, margin: "0 0 0.3rem", letterSpacing: "-0.03em", textAlign: "center" }}>
              {mode === "signin" ? "Welcome back" : mode === "reset-done" ? "You're all set" : "Reset your password"}
            </h1>
            <p style={{ color: "var(--text-3)", fontSize: "0.87rem", margin: 0, textAlign: "center" }}>
              {mode !== "signin" ? "We'll get you back into KWI ONE in a minute."
                : audience === "staff" ? "Sign in to KWI ONE"
                : audience === "partner" ? "Sign in to your partner workspace"
                : "Sign in to your client portal"}
            </p>
          </div>

          {/* Staff / Client / Partner toggle */}
          {mode === "signin" && (
            <div className="seg login-fade-up" style={{ animationDelay: "0.04s", marginBottom: "1rem" }}>
              <span className="seg-thumb" style={{ left: 4, width: `calc((100% - 8px) / ${AUDIENCES.length})`, transform: `translateX(${audienceIdx * 100}%)` }} />
              {AUDIENCES.map(([key, label]) => (
                <button key={key} type="button" aria-pressed={audience === key} onClick={() => setAudience(key)}>
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Card */}
          <div key={shakeKey} className={`login-card ${shakeKey ? "shake" : "login-fade-up"}`} style={{ animationDelay: shakeKey ? "0s" : "0.08s" }}>
            {(error || info) && (
              <div style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                padding: "0.65rem 0.85rem", borderRadius: 10, marginBottom: "1rem",
                background: error ? "rgba(220,38,38,0.07)" : "rgba(79,70,229,0.07)",
                border: `1px solid ${error ? "rgba(220,38,38,0.2)" : "rgba(79,70,229,0.2)"}`,
                color: error ? "#dc2626" : "var(--accent)", fontSize: "0.83rem",
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                {error || info}
              </div>
            )}

            {mode === "signin" && (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label htmlFor="username" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.4rem" }}>
                    Username
                  </label>
                  <div style={{ position: "relative" }}>
                    <User size={15} style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
                    <input
                      id="username"
                      className="field"
                      style={{ paddingLeft: "2.25rem" }}
                      placeholder={audience === "staff" ? "Your username" : audience === "partner" ? "Your partner username" : "Your portal username"}
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                      autoComplete="username"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.4rem" }}>
                    Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <Lock size={15} style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
                    <input
                      id="password"
                      className="field"
                      type={showPassword ? "text" : "password"}
                      style={{ paddingLeft: "2.25rem", paddingRight: "2.5rem" }}
                      placeholder="••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      style={{
                        position: "absolute", right: "0.7rem", top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", cursor: "pointer", color: "var(--text-3)",
                        padding: "0.2rem", display: "flex",
                      }}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                  style={{ width: "100%", justifyContent: "center", padding: "0.75rem", marginTop: "0.25rem", fontSize: "0.9rem" }}
                >
                  {loading ? <span className="btn-spinner" /> : <LogIn size={15} />}
                  {loading ? "Signing in…" : "Sign in"}
                  {!loading && <ArrowRight size={15} style={{ marginLeft: "auto" }} />}
                </button>

                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: "0.78rem", padding: "0.25rem", textAlign: "center" }}
                >
                  Forgot password?
                </button>

                {audience === "client" && (
                  <p style={{ fontSize: "0.78rem", color: "var(--text-3)", textAlign: "center", margin: 0 }}>
                    New to KW Innovations?{" "}
                    <a href="/signup" style={{ color: "var(--accent)", fontWeight: 700 }}>Sign up your business</a>
                  </p>
                )}
              </form>
            )}

            {mode === "forgot" && (
              <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <p style={{ fontSize: "0.83rem", color: "var(--text-2)", lineHeight: 1.5, margin: 0 }}>
                  Enter your username and we&apos;ll email a 6-digit verification code to the address on file.
                </p>
                <div>
                  <label htmlFor="forgot-username" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.4rem" }}>
                    Username
                  </label>
                  <div style={{ position: "relative" }}>
                    <User size={15} style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
                    <input
                      id="forgot-username"
                      className="field"
                      style={{ paddingLeft: "2.25rem" }}
                      placeholder="Your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                      autoComplete="username"
                      autoFocus
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "0.7rem" }}>
                  {loading ? "Sending…" : "Email Me a Code"}
                </button>
                <button type="button" onClick={() => switchMode("signin")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: "0.78rem", padding: "0.25rem" }}>
                  Back to sign in
                </button>
              </form>
            )}

            {mode === "reset" && (
              <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label htmlFor="reset-code" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.4rem" }}>
                    6-digit code
                  </label>
                  <input
                    id="reset-code"
                    className="field"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    style={{ textAlign: "center", letterSpacing: "0.4em", fontWeight: 700, fontSize: "1.05rem" }}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label htmlFor="reset-password" style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.4rem" }}>
                    New password
                  </label>
                  <div style={{ position: "relative" }}>
                    <Lock size={15} style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
                    <input
                      id="reset-password"
                      className="field"
                      type="password"
                      style={{ paddingLeft: "2.25rem" }}
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "0.7rem" }}>
                  {loading ? "Resetting…" : "Reset Password"}
                </button>
                <button type="button" onClick={() => switchMode("forgot")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: "0.78rem", padding: "0.25rem" }}>
                  Didn&apos;t get a code? Send again
                </button>
              </form>
            )}

            {mode === "reset-done" && (
              <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", margin: "0 auto 0.75rem",
                  background: "rgba(5,150,105,0.10)", border: "1px solid rgba(5,150,105,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <CheckCircle2 size={20} color="#10b981" />
                </div>
                <p style={{ fontWeight: 700, color: "var(--text-1)", marginBottom: "0.25rem" }}>Password reset</p>
                <p style={{ fontSize: "0.8rem", color: "var(--text-3)", marginBottom: "1.25rem" }}>Sign in with your new password.</p>
                <button onClick={() => switchMode("signin")} className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                  Back to Sign In
                </button>
              </div>
            )}
          </div>

          <p className="login-fade-up" style={{ animationDelay: "0.16s", textAlign: "center", marginTop: "1.5rem", fontSize: "0.75rem", color: "var(--text-3)" }}>
            {audience === "partner" ? "Partner access · Powered by KWI ONE" : "KWI ONE · Internal use only · KW Innovations"}
          </p>
        </div>
      </div>
    </div>
  );
}
