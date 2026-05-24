"use client";

const schedule = [
  { day: "Monday",    time: "1:30 pm – 3:30 pm",   luka: 2, aksel: 2, focus: "Lead setup, scripts, business research" },
  { day: "Tuesday",   time: "2:30 pm – 4:30 pm",   luka: 2, aksel: 2, focus: "Cold emails and calls" },
  { day: "Wednesday", time: "2:30 pm – 4:30 pm",   luka: 2, aksel: 2, focus: "Calls and follow ups" },
  { day: "Thursday",  time: "3:00 pm – 5:00 pm",   luka: 2, aksel: 2, focus: "Follow ups, CRM updates, warm leads" },
  { day: "Friday",    time: "10:00 am – 12:00 pm", luka: 2, aksel: 2, focus: "Main sales push" },
];

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
  const totalHours = schedule.reduce((s, r) => s + r.luka + r.aksel, 0);

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-1)", margin: 0 }}>
            Weekly Roster
          </h1>
          <p style={{ color: "var(--text-3)", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
            Luka &amp; Aksel — updated schedule
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Luka", hours: 10, color: "#22d3ee" },
          { label: "Aksel", hours: 10, color: "#818cf8" },
          { label: "Combined", hours: totalHours, color: "#34d399" },
          { label: "Days/Week", hours: schedule.length, color: "#fb923c", suffix: " days" },
        ].map(({ label, hours, color, suffix }) => (
          <div key={label} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 14, padding: "1rem 1.1rem",
          }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>{label}</div>
            <div style={{ fontSize: "1.75rem", fontWeight: 900, color, lineHeight: 1 }}>
              {hours}<span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-3)", marginLeft: 2 }}>{suffix ?? " hrs"}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Schedule table — desktop */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", marginBottom: "1.5rem" }}>
        {/* Table header */}
        <div style={{
          display: "grid", gridTemplateColumns: "130px 170px 80px 80px 1fr",
          padding: "0.65rem 1.25rem",
          borderBottom: "1px solid var(--border)",
          fontSize: "0.7rem", fontWeight: 700, color: "var(--text-3)",
          textTransform: "uppercase", letterSpacing: "0.08em", gap: "0.75rem",
        }} className="roster-table-header">
          <span>Day</span>
          <span>Time</span>
          <span style={{ textAlign: "center" }}>Luka</span>
          <span style={{ textAlign: "center" }}>Aksel</span>
          <span>Focus</span>
        </div>

        {schedule.map((row, i) => {
          const isToday = row.day === today;
          return (
            <div key={row.day} style={{
              display: "grid", gridTemplateColumns: "130px 170px 80px 80px 1fr",
              padding: "0.9rem 1.25rem", gap: "0.75rem",
              alignItems: "center",
              borderBottom: i < schedule.length - 1 ? "1px solid var(--border)" : "none",
              background: isToday ? "rgba(34,211,238,0.06)" : "transparent",
              transition: "background 0.15s",
            }} className="roster-table-row">
              {/* Day */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {isToday && (
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "#22d3ee", flexShrink: 0, display: "inline-block",
                    boxShadow: "0 0 6px #22d3ee",
                  }} />
                )}
                <span style={{ fontWeight: isToday ? 800 : 600, color: isToday ? "#22d3ee" : "var(--text-1)", fontSize: "0.9rem" }}>
                  {row.day}
                </span>
              </div>

              {/* Time */}
              <span style={{ fontSize: "0.82rem", color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>
                {row.time}
              </span>

              {/* Luka hrs */}
              <div style={{ textAlign: "center" }}>
                <span style={{
                  display: "inline-block", padding: "0.2rem 0.6rem",
                  borderRadius: 20, fontSize: "0.8rem", fontWeight: 700,
                  background: "rgba(34,211,238,0.12)", color: "#22d3ee",
                }}>
                  {row.luka}h
                </span>
              </div>

              {/* Aksel hrs */}
              <div style={{ textAlign: "center" }}>
                <span style={{
                  display: "inline-block", padding: "0.2rem 0.6rem",
                  borderRadius: 20, fontSize: "0.8rem", fontWeight: 700,
                  background: "rgba(129,140,248,0.12)", color: "#818cf8",
                }}>
                  {row.aksel}h
                </span>
              </div>

              {/* Focus */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: focusDot(row.focus), flexShrink: 0,
                }} />
                <span style={{
                  fontSize: "0.83rem", color: "var(--text-2)",
                  padding: "0.25rem 0.6rem",
                  background: focusColour(row.focus),
                  borderRadius: 8,
                }}>
                  {row.focus}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile cards */}
      <div className="roster-mobile-cards">
        {schedule.map((row) => {
          const isToday = row.day === today;
          return (
            <div key={row.day} style={{
              background: isToday ? "rgba(34,211,238,0.05)" : "var(--surface)",
              border: `1px solid ${isToday ? "#22d3ee44" : "var(--border)"}`,
              borderRadius: 14, padding: "1rem",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                  {isToday && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22d3ee", boxShadow: "0 0 6px #22d3ee", display: "inline-block" }} />}
                  <span style={{ fontWeight: 800, fontSize: "0.95rem", color: isToday ? "#22d3ee" : "var(--text-1)" }}>{row.day}</span>
                </div>
                <span style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>{row.time}</span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem" }}>
                <span style={{ padding: "0.2rem 0.65rem", borderRadius: 20, fontSize: "0.78rem", fontWeight: 700, background: "rgba(34,211,238,0.12)", color: "#22d3ee" }}>Luka {row.luka}h</span>
                <span style={{ padding: "0.2rem 0.65rem", borderRadius: 20, fontSize: "0.78rem", fontWeight: 700, background: "rgba(129,140,248,0.12)", color: "#818cf8" }}>Aksel {row.aksel}h</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: focusDot(row.focus), flexShrink: 0 }} />
                <span style={{ fontSize: "0.82rem", color: "var(--text-2)" }}>{row.focus}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 14, padding: "1rem 1.25rem",
        display: "flex", gap: "2rem", flexWrap: "wrap",
      }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", alignSelf: "center" }}>Weekly Totals</div>
        {[
          { name: "Luka", hours: 10, color: "#22d3ee" },
          { name: "Aksel", hours: 10, color: "#818cf8" },
        ].map(({ name, hours, color }) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
            <span style={{ fontWeight: 700, color: "var(--text-1)", fontSize: "0.9rem" }}>{name}</span>
            <span style={{ fontWeight: 800, color, fontSize: "0.9rem" }}>{hours} hrs</span>
          </div>
        ))}
        <div style={{ marginLeft: "auto", fontSize: "0.82rem", color: "var(--text-3)" }}>
          {totalHours} combined hours/week
        </div>
      </div>
    </div>
  );
}
