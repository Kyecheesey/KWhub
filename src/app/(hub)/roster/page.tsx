"use client";

import { useSession } from "next-auth/react";

// Roster cleared — Kaylie is the only person on it.
// Add shifts as: { day, time, person, hours, focus }
type Shift = { day: string; time: string; person: string; hours: number; focus: string };

const ROSTER_PEOPLE = [
  { name: "Kaylie", colour: "#22d3ee", gradient: "linear-gradient(135deg, #22d3ee 0%, #818cf8 100%)" },
];
const schedule: Shift[] = [];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const today = new Date().toLocaleDateString("en-AU", { weekday: "long" });

const focusColour = (focus: string) => {
  if (focus.includes("Lead") || focus.includes("research")) return "rgba(34,211,238,0.12)";
  if (focus.includes("Cold") || focus.includes("email")) return "rgba(129,140,248,0.12)";
  if (focus.includes("Call") || focus.includes("follow")) return "rgba(52,211,153,0.12)";
  if (focus.includes("CRM") || focus.includes("warm")) return "rgba(251,146,60,0.12)";
  if (focus.includes("sales")) return "rgba(248,113,113,0.12)";
  return "rgba(255,255,255,0.04)";
};

const focusDot = (focus: string) => {
  if (focus.includes("Lead") || focus.includes("research")) return "#22d3ee";
  if (focus.includes("Cold") || focus.includes("email")) return "#818cf8";
  if (focus.includes("Call") || focus.includes("follow")) return "#34d399";
  if (focus.includes("CRM") || focus.includes("warm")) return "#fb923c";
  if (focus.includes("sales")) return "#f87171";
  return "var(--text-3)";
};

export default function RosterPage() {
  const { data: session } = useSession();
  const currentUser = (session?.user?.name ?? "").toLowerCase();

  // Hours are private: you only see the hours on your own shifts.
  const isMine = (shift: Shift) => shift.person.toLowerCase() === currentUser;
  const myShifts = schedule.filter(isMine);
  const myHours = myShifts.reduce((s, r) => s + r.hours, 0);
  const me = ROSTER_PEOPLE.find((p) => p.name.toLowerCase() === currentUser);

  const shiftsForDay = (day: string) => schedule.filter((r) => r.day === day);

  return (
    <div className="page">
      <style>{`
        @keyframes rosterFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes rosterPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,211,238,0.35); }
          50%      { box-shadow: 0 0 0 6px rgba(34,211,238,0); }
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
          box-shadow: 0 8px 28px rgba(0,0,0,0.35);
        }
        .roster-day-row { transition: background 0.2s ease; }
        .roster-day-row:hover { background: rgba(255,255,255,0.03); }
        .roster-today-dot { animation: rosterPulse 2.2s ease-in-out infinite; }
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
            background: "linear-gradient(90deg, var(--text-1) 30%, #22d3ee 100%)",
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          }}>
            Weekly Roster
          </h1>
          <p style={{ color: "var(--text-3)", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
            Hours are private — you only see your own.
          </p>
        </div>
      </div>

      {/* People on the roster */}
      <div className="roster-anim" style={{ animationDelay: "0.05s", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.85rem", marginBottom: "1.5rem" }}>
        {ROSTER_PEOPLE.map((person) => {
          const mine = person.name.toLowerCase() === currentUser;
          return (
            <div key={person.name} className="roster-card" style={{ padding: "1.1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.9rem", position: "relative", overflow: "hidden" }}>
              <div style={{
                position: "absolute", inset: "0 0 auto 0", height: 3,
                background: person.gradient, opacity: 0.9,
              }} />
              {/* Avatar */}
              <div style={{
                width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
                background: person.gradient,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: "1.15rem", color: "#0c0e1a",
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
                      background: "rgba(34,211,238,0.14)", color: "#22d3ee",
                    }}>You</span>
                  )}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-3)", marginTop: 2 }}>
                  On the roster
                </div>
              </div>
              {/* Hours — only visible to the person themselves */}
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 900, color: mine ? person.colour : "var(--text-3)", lineHeight: 1 }}>
                  {mine ? myHours : "—"}
                </div>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.07em", marginTop: 3 }}>
                  {mine ? "hrs / week" : "hidden"}
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
            {schedule.length === 0 ? "No shifts yet" : `${schedule.length} shift${schedule.length === 1 ? "" : "s"}`}
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
              background: isToday ? "rgba(34,211,238,0.05)" : "transparent",
            }}>
              {/* Day label */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: 120, flexShrink: 0 }}>
                {isToday && (
                  <span className="roster-today-dot" style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: "#22d3ee", flexShrink: 0, display: "inline-block",
                  }} />
                )}
                <span style={{ fontWeight: isToday ? 800 : 600, color: isToday ? "#22d3ee" : "var(--text-1)", fontSize: "0.9rem" }}>
                  {day}
                </span>
              </div>

              {/* Shifts for the day */}
              {rows.length === 0 ? (
                <span style={{ fontSize: "0.8rem", color: "var(--text-3)", fontStyle: "italic" }}>
                  No one rostered
                </span>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                  {rows.map((row) => {
                    const mine = isMine(row);
                    return (
                      <div key={row.person} style={{
                        display: "flex", alignItems: "center", gap: "0.5rem",
                        padding: "0.35rem 0.7rem", borderRadius: 10,
                        background: focusColour(row.focus),
                        border: "1px solid var(--border)",
                      }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: focusDot(row.focus), flexShrink: 0 }} />
                        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-1)" }}>{row.person}</span>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{row.time}</span>
                        <span style={{
                          fontSize: "0.75rem", fontWeight: 700,
                          padding: "0.1rem 0.45rem", borderRadius: 20,
                          background: mine ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.05)",
                          color: mine ? "#22d3ee" : "var(--text-3)",
                        }}>
                          {mine ? `${row.hours}h` : "—"}
                        </span>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-2)" }}>{row.focus}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty-state / totals footer */}
      <div className="roster-card roster-anim" style={{
        animationDelay: "0.15s",
        padding: "1.1rem 1.25rem",
        display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center",
      }}>
        {schedule.length === 0 ? (
          <>
            <div style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-1)" }}>Fresh roster</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-3)", marginTop: 2 }}>
                The roster has been cleared — Kaylie&apos;s shifts will appear here once they&apos;re added.
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
