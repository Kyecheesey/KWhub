"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Users,
  Target,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Clock,
  Award,
} from "lucide-react";

interface Stats {
  clients: number;
  potentials: number;
  won: number;
  active: number;
}

export default function Home() {
  const [stats, setStats] = useState<Stats>({ clients: 0, potentials: 0, won: 0, active: 0 });

  useEffect(() => {
    Promise.all([fetch("/api/clients"), fetch("/api/potentials")])
      .then(([c, p]) => Promise.all([c.json(), p.json()]))
      .then(([clients, potentials]) => {
        setStats({
          clients: clients.length,
          potentials: potentials.length,
          won: potentials.filter((p: { status: string }) => p.status === "won").length,
          active: potentials.filter((p: { status: string }) =>
            ["new", "contacted", "qualified", "proposal"].includes(p.status)
          ).length,
        });
      });
  }, []);

  const statCards = [
    {
      label: "Current Clients",
      value: stats.clients,
      icon: Users,
      color: "#22d3ee",
      bg: "rgba(34,211,238,0.08)",
      border: "rgba(34,211,238,0.15)",
      href: "/clients",
    },
    {
      label: "Potentials",
      value: stats.potentials,
      icon: Target,
      color: "#818cf8",
      bg: "rgba(129,140,248,0.08)",
      border: "rgba(129,140,248,0.15)",
      href: "/potentials",
    },
    {
      label: "Active Pipeline",
      value: stats.active,
      icon: TrendingUp,
      color: "#fb923c",
      bg: "rgba(251,146,60,0.08)",
      border: "rgba(251,146,60,0.15)",
      href: "/potentials",
    },
    {
      label: "Deals Won",
      value: stats.won,
      icon: Award,
      color: "#34d399",
      bg: "rgba(52,211,153,0.08)",
      border: "rgba(52,211,153,0.15)",
      href: "/potentials",
    },
  ];

  const modules = [
    {
      title: "Current Clients",
      desc: "Full client database — import directly from kwinnovations.com.au, add manually, search and export.",
      icon: Users,
      href: "/clients",
      gradient: "linear-gradient(135deg, #22d3ee 0%, #0ea5e9 100%)",
      live: true,
    },
    {
      title: "Potentials CRM",
      desc: "Track every potential client through New → Contacted → Qualified → Proposal → Won/Lost with notes.",
      icon: Target,
      href: "/potentials",
      gradient: "linear-gradient(135deg, #818cf8 0%, #6366f1 100%)",
      live: true,
    },
    {
      title: "Team Hub",
      desc: "Staff profiles, roles, onboarding checklists and internal contacts.",
      icon: Users,
      href: "#",
      gradient: "linear-gradient(135deg, #34d399 0%, #059669 100%)",
      live: false,
    },
    {
      title: "Policies & Procedures",
      desc: "Central library for company policies, SOPs, guides and templates.",
      icon: CheckCircle2,
      href: "#",
      gradient: "linear-gradient(135deg, #fb923c 0%, #ea580c 100%)",
      live: false,
    },
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
                color: "#22d3ee",
                background: "rgba(34,211,238,0.1)",
                border: "1px solid rgba(34,211,238,0.2)",
                padding: "0.2rem 0.65rem", borderRadius: 99,
              }}
            >
              <span
                style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "#22d3ee",
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
            Internal{" "}
            <span className="grad-text">Hub</span>
          </h1>
          <p style={{ color: "var(--text-2)", fontSize: "1rem", maxWidth: 520, marginBottom: "1.75rem", lineHeight: 1.6 }}>
            Your central workspace — clients, pipeline, team, documents and AI tools all in one place.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <Link href="/clients" className="btn-primary">
              <Users size={15} /> View Clients <ArrowRight size={14} />
            </Link>
            <Link href="/potentials" className="btn-ghost">
              <Target size={15} /> Potentials Pipeline
            </Link>
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
              background: "var(--surface)",
              border: `1px solid ${border}`,
              borderRadius: 16,
              padding: "1.25rem 1.25rem",
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

      {/* Module grid */}
      <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-2)", marginBottom: "1rem", letterSpacing: "0.04em" }}>
        Modules
      </h2>
      <div className="module-grid">
        {modules.map(({ title, desc, icon: Icon, href, gradient, live }) => (
          <div
            key={title}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 16,
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
                <Icon size={18} color="#0b0d14" strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{title}</div>
                {live ? (
                  <span
                    style={{
                      fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "#34d399",
                      background: "rgba(52,211,153,0.1)",
                      border: "1px solid rgba(52,211,153,0.2)",
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
              <Link
                href={href}
                className="btn-ghost"
                style={{ alignSelf: "flex-start" }}
              >
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
  );
}
