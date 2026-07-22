"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

// Kaylie is the only person on the roster. Kye adds/removes her shifts;
// hours are masked server-side for everyone except the rostered person and Kye.
type Shift = { id: number; day: string; time: string; person: string; hours: number | null; focus: string | null };

const ROSTER_PEOPLE = [
  { name: "Kaylie", colour: "#7c3aed", gradient: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)" },
];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const today = new Date().toLocaleDateString("en-AU", { weekday: "long" });

const BLANK_FORM = { day: "Monday", time: "", person: ROSTER_PEOPLE[0].name, hours: "2", focus: "" };

const focusColour = (focus: string) => {
  if (focus.includes("Lead") || focus.includes("research")) return "rgba(124,58,237,0.10)";
  if (focus.includes("Cold") || focus.includes("email")) return "rgba(219,39,119,0.10)";
  if (focus.includes("Call") || focus.includes("follow")) return "rgba(13,148,136,0.10)";
  if (focus.includes("CRM") || focus.includes("warm")) return "rgba(234,88,12,0.10)";
  if (focus.includes("sales")) return "rgba(225,29,72,0.10)";
  return "rgba(76,49,138,0.06)";
};

const focusDot = (focus: string) => {
  if (focus.includes("Lead") || focus.includes("research")) return "#7c3aed";
  if (focus.includes("Cold") || focus.includes("email")) return "#db2777";
  if (focus.includes("Call") || focus.includes("follow")) return "#0d9488";
  if (focus.includes("CRM") || focus.includes("warm")) return "#ea580c";
  if (focus.includes("sales")) return "#e11d48";
  return "var(--text-3)";
};

export default function RosterPage() {
  const { data: session } = useSession();
  const currentUser = (session?.user?.name ?? "").toLowerCase();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/roster");
    if (res.ok) {
      const data = await res.json();
      setShifts(data.shifts ?? []);
      setCanManage(Boolean(data.canManage));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, hours: Number(form.hours) }),
    });
    if (res.ok) {
      setForm({ ...BLANK_FORM, day: form.day });
      await load();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not add shift");
    }
    setSaving(false);
  };

  const removeShift = async (id: number) => {
    await fetch(`/api/roster/${id}`, { method: "DELETE" });
    await load();
  };

  const isMine = (s: Shift) => s.person.toLowerCase() === currentUser;
  const myShifts = shifts.filter(isMine);
  const myHours = myShifts.reduce((sum, r) => sum + (r.hours ?? 0), 0);
  const me = ROSTER_PEOPLE.find((p) => p.name.toLowerCase() === currentUser);
  const personHours = (name: string) => {
    const rows = shifts.filter((s) => s.person.toLowerCase() === name.toLowerCase());
    if (rows.some((r) => r.hours === null)) return null; // hidden by the server
    return rows.reduce((sum, r) => sum + (r.hours ?? 0), 0);
  };

  const shiftsForDay = (day: string) => shifts.filter((r) => r.day === day);

  return (
    <div className="page">
      <style>{`
        @keyframes rosterFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes rosterPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.35); }
          50%      { box-shadow: 0 0 0 6px rgba(124,58,237,0); }
        }
        .roster-anim { animation: rosterFadeUp 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .roster-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }
        .roster-card:hover {
          border-color: var(--border-2);
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(50,30,100,0.14);
        }
        .roster-day-row { transition: background 0.2s ease; }
        .roster-day-row:hover { background: rgba(76,49,138,0.04); }
        .roster-today-dot { animation: rosterPulse 2.2s ease-in-out infinite; }
        .roster-del {
          background: none; border: none; cursor: pointer; padding: 2px 4px;
          color: var(--text-3); border-radius: 6px; line-height: 1;
          transition: color 0.15s ease, background 0.15s ease;
        }
        .roster-del:hover { color: var(--danger); background: rgba(225,29,72,0.10); }
        @media (prefers-reduced-motion: reduce) {
          .roster-anim, .roster-today-dot { animation: none; }
          .roster-card, .roster-day-row { transition: none; }
        }
      `}</style>

      {/* Header */}
      <div className="page-header roster-anim">
        <div>
          <h1 style={{
            fontSize: "1.5rem", fontWeight: 800, margin: 0,
            background: "linear-gradient(90deg, var(--text-1) 30%, #7c3aed 80%, #db2777 100%)",
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          }}>
            Weekly Roster
          </h1>
          <p style={{ color: "var(--text-3)", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
            Hours are private — you only see your own.
          </p>
        </div>
        {canManage && (
          <div className="page-header-actions">
            <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Close" : "+ Add Shift"}
            </button>
          </div>
        )}
      </div>

      {/* Add-shift form — Kye only */}
      {canManage && showForm && (
        <form onSubmit={addShift} className="roster-card roster-anim" style={{
          padding: "1.1rem 1.25rem", marginBottom: "1.5rem",
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "0.75rem", alignItems: "end",
        }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.7rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Person
            <select className="field" value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })}>
              {ROSTER_PEOPLE.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.7rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Day
            <select className="field" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.7rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Time
            <input className="field" required placeholder="1:30 pm – 3:30 pm" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.7rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Hours
            <input className="field" required type="number" min="0.5" max="24" step="0.5" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.7rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Focus
            <input className="field" placeholder="Cold emails and calls" value={form.focus} onChange={(e) => setForm({ ...form, focus: e.target.value })} />
          </label>
          <button type="submit" className="btn-primary" disabled={saving} style={{ height: 42 }}>
            {saving ? "Adding…" : "Add"}
          </button>
          {error && <div style={{ gridColumn: "1 / -1", color: "var(--danger)", fontSize: "0.82rem" }}>{error}</div>}
        </form>
      )}

      {/* People on the roster */}
      <div className="roster-anim" style={{ animationDelay: "0.05s", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.85rem", marginBottom: "1.5rem" }}>
        {ROSTER_PEOPLE.map((person) => {
          const mine = person.name.toLowerCase() === currentUser;
          const hrs = personHours(person.name);
          return (
            <div key={person.name} className="roster-card" style={{ padding: "1.1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.9rem", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: "0 0 auto 0", height: 3, background: person.gradient, opacity: 0.9 }} />
              <div style={{
                width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
                background: person.gradient,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: "1.15rem", color: "#fff",
              }}>
                {person.name[0]}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text-1)" }}>
                  {person.name}
                  {mine && (
                    <span style={{
                      marginLeft: "0.5rem", fontSize: "0.65rem", fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      padding: "0.15rem 0.5rem", borderRadius: 20,
                      background: "rgba(124,58,237,0.10)", color: "#7c3aed",
                    }}>You</span>
                  )}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: 2 }}>On the roster</div>
              </div>
              {/* Hours — visible to the person themselves (and Kye, who sets them) */}
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 900, color: hrs !== null ? person.colour : "var(--text-3)", lineHeight: 1 }}>
                  {hrs !== null ? hrs : "—"}
                </div>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 3 }}>
                  {hrs !== null ? "hrs / week" : "hidden"}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Week view */}
      <div className="roster-card roster-anim" style={{ animationDelay: "0.1s", overflow: "hidden", marginBottom: "1.5rem" }}>
        <div style={{
          padding: "0.85rem 1.25rem", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            This Week
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
            {loading ? "Loading…" : shifts.length === 0 ? "No shifts yet" : `${shifts.length} shift${shifts.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {DAYS.map((day, i) => {
          const isToday = day === today;
          const rows = shiftsForDay(day);
          return (
            <div key={day} className="roster-day-row" style={{
              display: "flex", alignItems: "center", gap: "1rem",
              padding: "0.85rem 1.25rem",
              borderBottom: i < DAYS.length - 1 ? "1px solid var(--border)" : "none",
              background: isToday ? "rgba(124,58,237,0.05)" : "transparent",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: 120, flexShrink: 0 }}>
                {isToday && (
                  <span className="roster-today-dot" style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: "#7c3aed", flexShrink: 0, display: "inline-block",
                  }} />
                )}
                <span style={{ fontWeight: isToday ? 800 : 600, color: isToday ? "#7c3aed" : "var(--text-1)", fontSize: "0.9rem" }}>
                  {day}
                </span>
              </div>

              {rows.length === 0 ? (
                <span style={{ fontSize: "0.8rem", color: "var(--text-3)", fontStyle: "italic" }}>
                  No one rostered
                </span>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                  {rows.map((row) => (
                    <div key={row.id} style={{
                      display: "flex", alignItems: "center", gap: "0.5rem",
                      padding: "0.35rem 0.7rem", borderRadius: 10,
                      background: focusColour(row.focus ?? ""),
                      border: "1px solid var(--border)",
                    }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: focusDot(row.focus ?? ""), flexShrink: 0 }} />
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-1)" }}>{row.person}</span>
                      <span style={{ fontSize: "0.78rem", color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{row.time}</span>
                      <span style={{
                        fontSize: "0.75rem", fontWeight: 700,
                        padding: "0.1rem 0.45rem", borderRadius: 20,
                        background: row.hours !== null ? "rgba(124,58,237,0.10)" : "rgba(76,49,138,0.06)",
                        color: row.hours !== null ? "#7c3aed" : "var(--text-3)",
                      }}>
                        {row.hours !== null ? `${row.hours}h` : "—"}
                      </span>
                      {row.focus && <span style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>{row.focus}</span>}
                      {canManage && (
                        <button type="button" className="roster-del" title="Remove shift" onClick={() => removeShift(row.id)}>
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer — empty state or your totals */}
      <div className="roster-card roster-anim" style={{
        animationDelay: "0.15s",
        padding: "1.1rem 1.25rem",
        display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center",
      }}>
        {shifts.length === 0 ? (
          <>
            <div style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-1)" }}>Fresh roster</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-3)", marginTop: 2 }}>
                {canManage
                  ? "Use “+ Add Shift” above to roster Kaylie's first shift."
                  : "Kaylie's shifts will appear here once they're added."}
              </div>
            </div>
          </>
        ) : me ? (
          <>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Your Week</span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: me.gradient }} />
              <span style={{ fontWeight: 700, color: "var(--text-1)", fontSize: "0.9rem" }}>{session?.user?.name}</span>
              <span style={{ fontWeight: 800, color: me.colour, fontSize: "0.9rem" }}>{myHours} hrs</span>
              <span style={{ fontSize: "0.82rem", color: "var(--text-3)" }}>across {myShifts.length} shift{myShifts.length === 1 ? "" : "s"}</span>
            </div>
          </>
        ) : (
          <span style={{ fontSize: "0.82rem", color: "var(--text-3)" }}>
            Hours are only visible to the person rostered.
          </span>
        )}
      </div>
    </div>
  );
}
