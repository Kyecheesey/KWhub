"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Target,
  FileText,
  UsersRound,
  Zap,
  ChevronRight,
  PhoneCall,
} from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/potentials", label: "Potentials", icon: Target },
  { href: "/call-list", label: "Call List", icon: PhoneCall },
  { href: "#", label: "Team Hub", icon: UsersRound, soon: true },
  { href: "#", label: "Policies", icon: FileText, soon: true },
  { href: "#", label: "AI Tools", icon: Zap, soon: true },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "1.5rem 1.25rem 1.25rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "linear-gradient(135deg, #22d3ee, #818cf8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: "0.85rem",
              color: "#0b0d14",
              flexShrink: 0,
            }}
          >
            KW
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.9rem", lineHeight: 1.1, color: "var(--text-1)" }}>
              Innovations
            </div>
            <div style={{ fontSize: "0.65rem", color: "var(--text-3)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Internal Hub
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0.75rem 0.75rem", display: "flex", flexDirection: "column", gap: "2px" }}>
        <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)", padding: "0.5rem 0.5rem 0.25rem" }}>
          Workspace
        </p>
        {nav.map(({ href, label, icon: Icon, soon }) => {
          const active = path === href && href !== "#";
          return (
            <Link
              key={label}
              href={href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.65rem",
                padding: "0.55rem 0.75rem",
                borderRadius: 10,
                textDecoration: "none",
                fontSize: "0.875rem",
                fontWeight: active ? 700 : 500,
                color: active ? "#0b0d14" : soon ? "var(--text-3)" : "var(--text-2)",
                background: active
                  ? "linear-gradient(135deg, #22d3ee, #0ea5e9)"
                  : "transparent",
                transition: "background 0.15s, color 0.15s",
                cursor: soon ? "default" : "pointer",
                position: "relative",
              }}
              onMouseEnter={
                !active && !soon
                  ? (e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                      (e.currentTarget as HTMLElement).style.color = "var(--text-1)";
                    }
                  : undefined
              }
              onMouseLeave={
                !active && !soon
                  ? (e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.color = "var(--text-2)";
                    }
                  : undefined
              }
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 2} />
              <span style={{ flex: 1 }}>{label}</span>
              {soon && (
                <span
                  style={{
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    background: "var(--surface-3)",
                    color: "var(--text-3)",
                    padding: "0.1rem 0.4rem",
                    borderRadius: 4,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  Soon
                </span>
              )}
              {active && <ChevronRight size={13} strokeWidth={3} />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "1rem 1rem",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "0.65rem",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #818cf8, #22d3ee)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            fontWeight: 800,
            color: "#0b0d14",
            flexShrink: 0,
          }}
        >
          KW
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            KW Innovations
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>Internal Only</div>
        </div>
      </div>
    </aside>
  );
}
