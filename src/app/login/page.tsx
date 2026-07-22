"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Lock, User, LogIn, AlertCircle, Eye, EyeOff,
  Users, Target, CalendarDays, CheckCircle2,
} from "lucide-react";

const highlights = [
  { icon: Users, label: "Clients & pipeline in one place" },
  { icon: Target, label: "Track every potential from lead to won" },
  { icon: CalendarDays, label: "Roster, tasks and team activity" },
];

type Mode = "signin" | "forgot" | "reset" | "reset-done";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [audience, setAudience] = useState<"staff" | "client">("staff");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
    setLoading(false);
    if (res?.error) {
      setError("Incorrect username or password.");
    } else {
      router.push("/");
      router.refresh();
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

  return (
    <div className="login-shell">
      {/* ── Brand panel (desktop only) ── */}
      <aside className="login-brand">
        <div className="login-blob" style={{ width: 340, height: 340, top: -80, right: -80, background: "rgba(124,58,237,0.14)" }} />
        <div className="login-blob" style={{ width: 300, height: 300, bottom: -100, left: -60, background: "rgba(219,39,119,0.10)" }} />

        <div style={{ position: "relative" }}>
          <div style={{
            width: 46, height: 46, borderRadius: 13,
            background: "linear-gradient(135deg,#0891b2,#4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: "1rem", color: "#ffffff",
            boxShadow: "0 8px 28px rgba(124,58,237,0.28)",
          }}>KW</div>
        </div>

        <div style={{ position: "relative" }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: "0.6rem" }}>
            {today}
          </p>
          <h1 style={{ fontSize: "2.4rem", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.08, marginBottom: "0.9rem", maxWidth: 460 }}>
            The internal hub for <span className="grad-text">KW Innovations</span>
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.95rem", lineHeight: 1.65, maxWidth: 400, marginBottom: "2rem" }}>
            One workspace for clients, pipeline and the team — built for how we actually work.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {highlights.map(({ icon: Icon, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                  background: "var(--surface-2)", border: "1px solid var(--border-2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={14} color="var(--accent)" />
                </div>
                <span style={{ fontSize: "0.85rem", color: "var(--text-2)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ position: "relative", fontSize: "0.75rem", color: "var(--text-4)" }}>
          Internal use only · KW Innovations
        </p>
      </aside>

      {/* ── Form panel ── */}
      <div className="login-form-col">
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(124,58,237,0.05) 0%, transparent 70%)",
        }} />

        <div style={{ width: "100%", maxWidth: 380, position: "relative" }}>
          {/* Logo — mobile only */}
          <div className="login-fade-up" style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: "linear-gradient(135deg, #0891b2, #4f46e5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 900, fontSize: "1.1rem", color: "#ffffff",
              margin: "0 auto 1rem",
              boxShadow: "0 8px 32px rgba(124,58,237,0.25)",
            }}>
              KW
            </div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 900, margin: "0 0 0.25rem", letterSpacing: "-0.02em" }}>
              Welcome back
            </h1>
            <p style={{ color: "var(--text-3)", fontSize: "0.85rem", margin: 0 }}>
              {audience === "staff" ? "Sign in to the KW Innovations hub" : "Sign in to your client portal"}
            </p>
          </div>

          {/* Staff / Client toggle */}
          <div className="login-fade-up" style={{
            animationDelay: "0.04s",
            display: "flex", background: "var(--surface)", border: "1px solid var(--border-2)",
            borderRadius: 12, padding: 4, marginBottom: "1rem",
          }}>
            {([["staff", "Staff"], ["client", "Client Portal"]] as const).map(([key, label]) => {
              const active = audience === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAudience(key)}
                  style={{
                    flex: 1, padding: "0.5rem 0.75rem", borderRadius: 9, border: "none",
                    cursor: "pointer", fontSize: "0.82rem", fontWeight: active ? 700 : 500,
                    background: active ? "var(--surface-3)" : "transparent",
                    color: active ? "var(--text-1)" : "var(--text-3)",
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Card */}
          <div
            className="login-fade-up"
            style={{
              animationDelay: "0.08s",
              background: "var(--surface)",
              border: "1px solid var(--border-2)",
              borderRadius: 20,
              padding: "2rem",
              boxShadow: "0 24px 64px rgba(50,30,100,0.18)",
            }}
          >
            {(error || info) && (
              <div style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                padding: "0.65rem 0.85rem", borderRadius: 10, marginBottom: "1rem",
                background: error ? "rgba(225,29,72,0.07)" : "rgba(124,58,237,0.07)",
                border: `1px solid ${error ? "rgba(225,29,72,0.2)" : "rgba(124,58,237,0.2)"}`,
                color: error ? "#e11d48" : "var(--accent)", fontSize: "0.83rem",
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
                      placeholder={audience === "staff" ? "Your username" : "Your portal username"}
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
                  style={{ width: "100%", justifyContent: "center", padding: "0.7rem", marginTop: "0.25rem" }}
                >
                  <LogIn size={15} />
                  {loading ? "Signing in…" : "Sign In"}
                </button>

                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: "0.78rem", padding: "0.25rem", textAlign: "center" }}
                >
                  Forgot password?
                </button>
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
            Internal use only · KW Innovations
          </p>
        </div>
      </div>
    </div>
  );
}
