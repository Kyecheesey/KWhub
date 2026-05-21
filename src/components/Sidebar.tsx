"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, Users, Target, FileText,
  UsersRound, Zap, ChevronRight, PhoneCall, LogOut,
} from "lucide-react";

const nav = [
  { href: "/",          label: "Dashboard",  icon: LayoutDashboard },
  { href: "/clients",   label: "Clients",    icon: Users },
  { href: "/potentials",label: "Potentials", icon: Target },
  { href: "/call-list", label: "Call List",  icon: PhoneCall },
  { href: "#", label: "Team Hub",  icon: UsersRound, soon: true },
  { href: "#", label: "Policies",  icon: FileText,   soon: true },
  { href: "#", label: "AI Tools",  icon: Zap,        soon: true },
];

function avatarColor(name: string) {
  const colors = ["#22d3ee,#0ea5e9","#818cf8,#6366f1","#34d399,#059669","#fb923c,#ea580c","#f472b6,#db2777"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

export default function Sidebar() {
  const path = usePathname();
  const { data: session } = useSession();
  const userName = session?.user?.name ?? "…";
  const gradient = `linear-gradient(135deg, ${avatarColor(userName)})`;

  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: "var(--surface)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      height: "100vh", position: "sticky", top: 0, overflow: "hidden",
    }}>
      {/* Logo */}
      <div style={{ padding: "1.5rem 1.25rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, #22d3ee, #818cf8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: "0.85rem", color: "#0b0d14", flexShrink: 0,
          }}>
            KW
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.9rem", lineHeight: 1.1, color: "var(--text-1)" }}>Innovations</div>
            <div style={{ fontSize: "0.65rem", color: "var(--text-3)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Internal Hub</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "0.75rem", display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto" }}>
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
                display: "flex", alignItems: "center", gap: "0.65rem",
                padding: "0.55rem 0.75rem", borderRadius: 10,
                textDecoration: "none", fontSize: "0.875rem",
                fontWeight: active ? 700 : 500,
                color: active ? "#0b0d14" : soon ? "var(--text-3)" : "var(--text-2)",
                background: active ? "linear-gradient(135deg, #22d3ee, #0ea5e9)" : "transparent",
                transition: "background 0.15s, color 0.15s",
                cursor: soon ? "default" : "pointer",
              }}
              onMouseEnter={!active && !soon ? (e) => { (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; (e.currentTarget as HTMLElement).style.color = "var(--text-1)"; } : undefined}
              onMouseLeave={!active && !soon ? (e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--text-2)"; } : undefined}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 2} />
              <span style={{ flex: 1 }}>{label}</span>
              {soon && <span style={{ fontSize: "0.6rem", fontWeight: 700, background: "var(--surface-3)", color: "var(--text-3)", padding: "0.1rem 0.4rem", borderRadius: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>Soon</span>}
              {active && <ChevronRight size={13} strokeWidth={3} />}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "0.85rem 1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: gradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.78rem", fontWeight: 800, color: "#0b0d14", flexShrink: 0,
          }}>
            {userName.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {userName}
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>KW Innovations</div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-3)", padding: "0.3rem", borderRadius: 6,
              display: "flex", alignItems: "center",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
