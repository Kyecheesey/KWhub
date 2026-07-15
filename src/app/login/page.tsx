"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Lock, User, LogIn, AlertCircle, Eye, EyeOff,
  Users, Target, CalendarDays,
} from "lucide-react";

const highlights = [
  { icon: Users, label: "Clients & pipeline in one place" },
  { icon: Target, label: "Track every potential from lead to won" },
  { icon: CalendarDays, label: "Roster, tasks and team activity" },
];

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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

  const today = new Date().toLocaleDateString("en-AU", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="login-shell">
      {/* ── Brand panel (desktop only) ── */}
      <aside className="login-brand">
        <div className="login-blob" style={{ width: 340, height: 340, top: -80, right: -80, background: "rgba(45,212,232,0.16)" }} />
        <div className="login-blob" style={{ width: 300, height: 300, bottom: -100, left: -60, background: "rgba(124,133,243,0.14)" }} />

        <div style={{ position: "relative" }}>
          <div style={{
            width: 46, height: 46, borderRadius: 13,
            background: "linear-gradient(135deg,#2dd4e8,#818cf8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: "1rem", color: "#07090f",
            boxShadow: "0 8px 28px rgba(45,212,232,0.28)",
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
          background: "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(34,211,238,0.06) 0%, transparent 70%)",
        }} />

        <div style={{ width: "100%", maxWidth: 380, position: "relative" }}>
          {/* Logo — mobile only */}
          <div className="login-fade-up" style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: "linear-gradient(135deg, #2dd4e8, #818cf8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 900, fontSize: "1.1rem", color: "#07090f",
              margin: "0 auto 1rem",
              boxShadow: "0 8px 32px rgba(45,212,232,0.25)",
            }}>
              KW
            </div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 900, margin: "0 0 0.25rem", letterSpacing: "-0.02em" }}>
              Welcome back
            </h1>
            <p style={{ color: "var(--text-3)", fontSize: "0.85rem", margin: 0 }}>Sign in to the KW Innovations hub</p>
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
              boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
            }}
          >
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
                    placeholder="kye / luka / aksel"
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

              {error && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.65rem 0.85rem", borderRadius: 10,
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.2)",
                  color: "#f87171", fontSize: "0.83rem",
                }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ width: "100%", justifyContent: "center", padding: "0.7rem", marginTop: "0.25rem" }}
              >
                <LogIn size={15} />
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
          </div>

          <p className="login-fade-up" style={{ animationDelay: "0.16s", textAlign: "center", marginTop: "1.5rem", fontSize: "0.75rem", color: "var(--text-3)" }}>
            Internal use only · KW Innovations
          </p>
        </div>
      </div>
    </div>
  );
}
