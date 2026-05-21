"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Lock, User, LogIn, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: "1rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(34,211,238,0.06) 0%, transparent 70%)",
      }} />

      <div style={{ width: "100%", maxWidth: 400, position: "relative" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "linear-gradient(135deg, #22d3ee, #818cf8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: "1.1rem", color: "#0b0d14",
            margin: "0 auto 1rem",
            boxShadow: "0 8px 32px rgba(34,211,238,0.25)",
          }}>
            KW
          </div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 900, margin: "0 0 0.25rem", letterSpacing: "-0.02em" }}>
            KW Innovations
          </h1>
          <p style={{ color: "var(--text-3)", fontSize: "0.85rem", margin: 0 }}>Internal Hub — sign in to continue</p>
        </div>

        {/* Card */}
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border-2)",
          borderRadius: 20,
          padding: "2rem",
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.4rem" }}>
                Username
              </label>
              <div style={{ position: "relative" }}>
                <User size={15} style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
                <input
                  className="field"
                  style={{ paddingLeft: "2.25rem" }}
                  placeholder="kye / luka / aksel"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().trim())}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.4rem" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock size={15} style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }} />
                <input
                  className="field"
                  type="password"
                  style={{ paddingLeft: "2.25rem" }}
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
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

        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.75rem", color: "var(--text-3)" }}>
          Internal use only · KW Innovations
        </p>
      </div>
    </div>
  );
}
