"use client";

import { useState } from "react";
import { KeyRound, X, Check, AlertCircle } from "lucide-react";

export default function ChangePassword({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCurrent(""); setNext(""); setConfirm("");
      setError(""); setDone(false);
    }
  }

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next.length < 8) { setError("New password must be at least 8 characters."); return; }
    if (next !== confirm) { setError("New passwords don't match."); return; }
    setBusy(true);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: current, new_password: next }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
    setDone(true);
  }

  const label = (text: string) => (
    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-2)", marginBottom: "0.35rem" }}>{text}</label>
  );

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 800, fontSize: "1.1rem", margin: 0 }}>
            <KeyRound size={17} /> Change Password
          </h2>
          <button onClick={onClose} className="btn-ghost" style={{ padding: "0.4rem" }}><X size={16} /></button>
        </div>

        {done ? (
          <div style={{ textAlign: "center", padding: "1rem 0" }}>
            <div style={{
              width: 44, height: 44, borderRadius: "50%", margin: "0 auto 0.75rem",
              background: "rgba(5,150,105,0.10)", border: "1px solid rgba(5,150,105,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Check size={20} color="var(--accent-3)" />
            </div>
            <p style={{ fontWeight: 700, color: "var(--text-1)", marginBottom: "0.25rem" }}>Password updated</p>
            <p style={{ fontSize: "0.8rem", color: "var(--text-3)", marginBottom: "1.25rem" }}>Use your new password next time you sign in.</p>
            <button onClick={onClose} className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>Done</button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "grid", gap: "1rem" }}>
            <div>
              {label("Current password")}
              <input className="field" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
            </div>
            <div>
              {label("New password")}
              <input className="field" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" required />
            </div>
            <div>
              {label("Confirm new password")}
              <input className="field" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            </div>
            {error && (
              <div style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                padding: "0.65rem 0.85rem", borderRadius: 10,
                background: "rgba(225,29,72,0.07)", border: "1px solid rgba(225,29,72,0.2)",
                color: "#e11d48", fontSize: "0.83rem",
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
              {busy ? "Saving…" : "Update Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
