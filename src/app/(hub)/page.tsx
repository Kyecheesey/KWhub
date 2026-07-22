"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Users, Target, TrendingUp, ArrowRight, CheckCircle2,
  Clock, Award, PhoneCall, Kanban, ClipboardList, CalendarDays,
  Bell, FileText, UsersRound, Zap, Circle, CheckCircle,
} from "lucide-react";

interface Stats {
  clients: number;
  potentials: number;
  won: number;
  active: number;
}

interface FeedItem {
  id: number;
  title: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
  kind: "activity" | "task";
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default function Home() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats>({ clients: 0, potentials: 0, won: 0, active: 0 });
  const [feed, setFeed] = useState<FeedItem[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/clients"),
      fetch("/api/potentials"),
      fetch("/api/activities"),
      fetch("/api/tasks"),
    ])
      .then(([c, p, a, t]) => Promise.all([c.json(), p.json(), a.json(), t.json()]))
      .then(([clients, potentials, activities, tasks]) => {
        setStats({
          clients: clients.length,
          potentials: potentials.length,
          won: potentials.filter((p: { status: string }) => p.status === "won").length,
          active: potentials.filter((p: { status: string }) =>
            ["new", "contacted", "qualified", "proposal"].includes(p.status)
          ).length,
        });

        const combined: FeedItem[] = [
          ...activities.map((a: { id: number; title: string; status: string; assigned_to: string | null; created_at: string }) => ({
            id: a.id, title: a.title, status: a.status, assigned_to: a.assigned_to, created_at: a.created_at, kind: "activity" as const,
          })),
          ...tasks.map((t: { id: number; title: string; status: string; assigned_to: string | null; created_at: string }) => ({
            id: t.id, title: t.title, status: t.status, assigned_to: t.assigned_to, created_at: t.created_at, kind: "task" as const,
          })),
        ]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 6);
        setFeed(combined);
      });
  }, []);

  const firstName = (session?.user?.name ?? "").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const statCards = [
    { label: "Current Clients", value: stats.clients, icon: Users, color: "#0891b2", bg: "rgba(124,58,237,0.07)", border: "rgba(45,212,232,0.15)", href: "/clients" },
    { label: "Potentials", value: stats.potentials, icon: Target, color: "#7c85f3", bg: "rgba(124,133,243,0.08)", border: "rgba(124,133,243,0.15)", href: "/potentials" },
    { label: "Active Pipeline", value: stats.active, icon: TrendingUp, color: "#ea580c", bg: "rgba(251,146,60,0.08)", border: "rgba(251,146,60,0.15)", href: "/potentials" },
    { label: "Deals Won", value: stats.won, icon: Award, color: "#10b981", bg: "rgba(54,211,153,0.08)", border: "rgba(54,211,153,0.15)", href: "/potentials" },
  ];

  const quickActions = [
    { label: "New Potential", icon: Target, href: "/potentials" },
    { label: "New Task", icon: ClipboardList, href: "/tasks" },
    { label: "Call List", icon: PhoneCall, href: "/call-list" },
    { label: "Follow-ups", icon: Bell, href: "/follow-ups" },
  ];

  const modules = [
    { title: "Current Clients", desc: "Full client database — import directly from kwinnovations.com.au, add manually, search and export.", icon: Users, href: "/clients", gradient: "linear-gradient(135deg, #0891b2 0%, #0ea5e9 100%)", live: true },
    { title: "Potentials CRM", desc: "Track every potential client through New → Contacted → Qualified → Proposal → Won/Lost with notes.", icon: Target, href: "/potentials", gradient: "linear-gradient(135deg, #7c85f3 0%, #6366f1 100%)", live: true },
    { title: "Activities", desc: "Kanban board for team activities — plan, track and move work through to done.", icon: Kanban, href: "/activities", gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)", live: true },
    { title: "Tasks", desc: "Assign and track tasks across the team with due dates and priority.", icon: ClipboardList, href: "/tasks", gradient: "linear-gradient(135deg, #ea580c 0%, #ea580c 100%)", live: true },
    { title: "Roster", desc: "Weekly schedule for the team, synced with the shared calendar.", icon: CalendarDays, href: "/roster", gradient: "linear-gradient(135deg, #db2777 0%, #db2777 100%)", live: true },
    { title: "Call List", desc: "Working call list for outbound outreach and follow-through.", icon: PhoneCall, href: "/call-list", gradient: "linear-gradient(135deg, #0891b2 0%, #0891b2 100%)", live: true },
    { title: "Team Hub", desc: "Staff profiles, roles, onboarding checklists and internal contacts.", icon: UsersRound, href: "#", gradient: "linear-gradient(135deg, #94a3b8 0%, #475569 100%)", live: false },
    { title: "AI Tools", desc: "AI-assisted drafting, summarisation and lead research.", icon: Zap, href: "#", gradient: "linear-gradient(135deg, #94a3b8 0%, #475569 100%)", live: false },
  ];

  return (
    <div className="page">

      {/* Hero */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 20,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          padding: "2.5rem 2.5rem",
          marginBottom: "2rem",
        }}
      >
        <div className="hero-glow" />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.35rem",
                fontSize: "0.7rem", fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase",
                color: "var(--accent)",
                background: "rgba(45,212,232,0.1)",
                border: "1px solid rgba(124,58,237,0.2)",
                padding: "0.2rem 0.65rem", borderRadius: 99,
              }}
            >
              <span
                style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "var(--accent)",
                  display: "inline-block",
                  animation: "pulse 2s infinite",
                }}
              />
              KW | Innovations
            </span>
          </div>
          <h1
            style={{
              fontSize: "clamp(2rem, 4vw, 3rem)",
              fontWeight: 900,
              lineHeight: 1.1,
              margin: "0 0 0.75rem",
              letterSpacing: "-0.02em",
            }}
          >
            {greeting}{firstName ? `, ${firstName}` : ""}
            <span className="grad-text"> 👋</span>
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "1rem", maxWidth: 520, marginBottom: "1.75rem", lineHeight: 1.6 }}>
            Your central workspace — clients, pipeline, team and tools all in one place.
          </p>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            {quickActions.map(({ label, icon: Icon, href }) => (
              <Link key={label} href={href} className="btn-ghost">
                <Icon size={14} /> {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        {statCards.map(({ label, value, icon: Icon, color, bg, border, href }) => (
          <Link
            key={label}
            href={href}
            className="stat-card"
            style={{
              display: "block",
              textDecoration: "none",
              border: `1px solid ${border}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <div
                style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Icon size={18} color={color} strokeWidth={2} />
              </div>
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 900, lineHeight: 1, color: "var(--text-1)", marginBottom: "0.3rem" }}>
              {value}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-2)", fontWeight: 500 }}>{label}</div>
          </Link>
        ))}
      </div>

      <div className="dashboard-grid" style={{ marginBottom: "0.5rem" }}>
        {/* Module grid */}
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-2)", marginBottom: "1rem", letterSpacing: "0.04em" }}>
            Modules
          </h2>
          <div className="module-grid">
            {modules.map(({ title, desc, icon: Icon, href, gradient, live }) => (
              <div
                key={title}
                className="card"
                style={{
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  opacity: live ? 1 : 0.55,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div
                    style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: gradient,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={18} color="#ffffff" strokeWidth={2.5} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{title}</div>
                    {live ? (
                      <span
                        style={{
                          fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: "var(--accent-3)",
                          background: "rgba(54,211,153,0.1)",
                          border: "1px solid rgba(54,211,153,0.2)",
                          padding: "0.1rem 0.45rem", borderRadius: 99,
                        }}
                      >
                        Live
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3)" }}>
                        <Clock size={9} style={{ display: "inline", marginRight: 3 }} />Coming soon
                      </span>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: "0.825rem", color: "var(--text-2)", lineHeight: 1.6, margin: 0, flex: 1 }}>{desc}</p>
                {live ? (
                  <Link href={href} className="btn-ghost" style={{ alignSelf: "flex-start" }}>
                    Open <ArrowRight size={13} />
                  </Link>
                ) : (
                  <span className="btn-ghost" style={{ alignSelf: "flex-start", opacity: 0.5, cursor: "not-allowed" }}>
                    Coming soon
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity feed */}
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-2)", marginBottom: "1rem", letterSpacing: "0.04em" }}>
            Recent Activity
          </h2>
          <div className="card" style={{ padding: "0.5rem" }}>
            {feed.length === 0 && (
              <p style={{ padding: "1.25rem 1rem", color: "var(--text-3)", fontSize: "0.85rem" }}>Nothing yet.</p>
            )}
            {feed.map((item) => {
              const done = item.status === "done";
              return (
                <Link
                  key={`${item.kind}-${item.id}`}
                  href={item.kind === "task" ? "/tasks" : "/activities"}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: "0.6rem",
                    padding: "0.65rem 0.75rem", borderRadius: 10,
                    textDecoration: "none", color: "inherit",
                  }}
                >
                  {done ? (
                    <CheckCircle size={15} color="var(--accent-3)" style={{ marginTop: 1, flexShrink: 0 }} />
                  ) : (
                    <Circle size={15} color="var(--text-3)" style={{ marginTop: 1, flexShrink: 0 }} />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: "0.83rem", fontWeight: 600, color: "var(--text-1)",
                      textDecoration: done ? "line-through" : "none",
                      opacity: done ? 0.6 : 1,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>
                      {item.assigned_to ? `${item.assigned_to} · ` : ""}{timeAgo(item.created_at)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-2)", margin: "1.5rem 0 1rem", letterSpacing: "0.04em" }}>
            Coming Soon
          </h2>
          <div className="card" style={{ padding: "1rem 1.1rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", fontSize: "0.8rem", color: "var(--text-3)" }}>
              <FileText size={14} /> Policies & procedures library
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", fontSize: "0.8rem", color: "var(--text-3)" }}>
              <CheckCircle2 size={14} /> Client onboarding checklists
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
