"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Menu, X, LayoutDashboard, Users, Target, PhoneCall,
  FileText, UsersRound, Zap, ChevronRight, LogOut,
} from "lucide-react";

const nav = [
  { href: "/",           label: "Dashboard",  icon: LayoutDashboard },
  { href: "/clients",    label: "Clients",     icon: Users },
  { href: "/potentials", label: "Potentials",  icon: Target },
  { href: "/call-list",  label: "Call List",   icon: PhoneCall },
  { href: "#", label: "Team Hub",  icon: UsersRound, soon: true },
  { href: "#", label: "Policies",  icon: FileText,   soon: true },
  { href: "#", label: "AI Tools",  icon: Zap,        soon: true },
];

const bottomTabs = [
  { href: "/",           label: "Dashboard",  icon: LayoutDashboard },
  { href: "/clients",    label: "Clients",    icon: Users },
  { href: "/potentials", label: "Potentials", icon: Target },
  { href: "/call-list",  label: "Calls",      icon: PhoneCall },
];

function avatarGradient(name: string) {
  const opts = ["#22d3ee,#0ea5e9","#818cf8,#6366f1","#34d399,#059669","#fb923c,#ea580c"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return `linear-gradient(135deg, ${opts[Math.abs(h) % opts.length]})`;
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const { data: session } = useSession();
  const userName = session?.user?.name ?? "";

  // Close drawer on route change
  useEffect(() => { setOpen(false); }, [path]);
  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const Drawer = (
    <aside style={{
      position: "fixed", top: 0, left: 0, bottom: 0,
      width: 260, zIndex: 200,
      background: "var(--surface)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      transform: open ? "translateX(0)" : "translateX(-100%)",
      transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
      willChange: "transform",
    }}>
      {/* Drawer header */}
      <div style={{ padding: "1.1rem 1rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#22d3ee,#818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "0.78rem", color: "#0b0d14" }}>KW</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "var(--text-1)" }}>Innovations</div>
            <div style={{ fontSize: "0.6rem", color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Internal Hub</div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: "0.4rem", borderRadius: 8, display: "flex" }}>
          <X size={18} />
        </button>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: "0.75rem", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)", padding: "0.4rem 0.5rem 0.2rem" }}>Workspace</p>
        {nav.map(({ href, label, icon: Icon, soon }) => {
          const active = path === href && href !== "#";
          return (
            <Link key={label} href={href} style={{
              display: "flex", alignItems: "center", gap: "0.65rem",
              padding: "0.65rem 0.75rem", borderRadius: 10, textDecoration: "none",
              fontSize: "0.9rem", fontWeight: active ? 700 : 500,
              color: active ? "#0b0d14" : soon ? "var(--text-3)" : "var(--text-2)",
              background: active ? "linear-gradient(135deg,#22d3ee,#0ea5e9)" : "transparent",
              pointerEvents: soon ? "none" : "auto",
            }}>
              <Icon size={17} strokeWidth={active ? 2.5 : 2} />
              <span style={{ flex: 1 }}>{label}</span>
              {soon && <span style={{ fontSize: "0.6rem", fontWeight: 700, background: "var(--surface-3)", color: "var(--text-3)", padding: "0.1rem 0.4rem", borderRadius: 4, textTransform: "uppercase" }}>Soon</span>}
              {active && <ChevronRight size={13} strokeWidth={3} />}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "0.9rem 1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: avatarGradient(userName), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.78rem", fontWeight: 800, color: "#0b0d14", flexShrink: 0 }}>
            {userName.slice(0, 2).toUpperCase() || "KW"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName || "KW Innovations"}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>Internal Only</div>
          </div>
          <button onClick={() => signOut({ callbackUrl: "/login" })} title="Sign out" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: "0.3rem", borderRadius: 6, display: "flex" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <aside className="desktop-sidebar" style={{
        width: 240, flexShrink: 0,
        background: "var(--surface)", borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        height: "100vh", position: "sticky", top: 0, overflow: "hidden",
      }}>
        {/* Logo */}
        <div style={{ padding: "1.5rem 1.25rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#22d3ee,#818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "0.85rem", color: "#0b0d14", flexShrink: 0 }}>KW</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.9rem", lineHeight: 1.1, color: "var(--text-1)" }}>Innovations</div>
              <div style={{ fontSize: "0.65rem", color: "var(--text-3)", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Internal Hub</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "0.75rem", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
          <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)", padding: "0.5rem 0.5rem 0.25rem" }}>Workspace</p>
          {nav.map(({ href, label, icon: Icon, soon }) => {
            const active = path === href && href !== "#";
            return (
              <Link key={label} href={href} style={{
                display: "flex", alignItems: "center", gap: "0.65rem",
                padding: "0.55rem 0.75rem", borderRadius: 10, textDecoration: "none",
                fontSize: "0.875rem", fontWeight: active ? 700 : 500,
                color: active ? "#0b0d14" : soon ? "var(--text-3)" : "var(--text-2)",
                background: active ? "linear-gradient(135deg,#22d3ee,#0ea5e9)" : "transparent",
                transition: "background 0.15s, color 0.15s",
                pointerEvents: soon ? "none" : "auto",
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
        <div style={{ borderTop: "1px solid var(--border)", padding: "0.85rem 1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: avatarGradient(userName), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.78rem", fontWeight: 800, color: "#0b0d14", flexShrink: 0 }}>
              {userName.slice(0, 2).toUpperCase() || "KW"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName || "KW Innovations"}</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-3)" }}>KW Innovations</div>
            </div>
            <button onClick={() => signOut({ callbackUrl: "/login" })} title="Sign out" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: "0.3rem", borderRadius: 6, display: "flex", transition: "color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile top header ── */}
      <header className="mobile-header">
        <button onClick={() => setOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-1)", padding: "0.5rem", borderRadius: 8, display: "flex", alignItems: "center" }}>
          <Menu size={22} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#22d3ee,#818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "0.72rem", color: "#0b0d14" }}>KW</div>
          <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--text-1)" }}>Innovations</span>
        </div>
        <div style={{ width: 38 }} /> {/* balance the hamburger */}
      </header>

      {/* ── Mobile drawer & overlay ── */}
      {Drawer}
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 199,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)",
        }} />
      )}

      {/* ── Page content ── */}
      <main className="hub-main">
        {children}
      </main>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="bottom-tab-bar">
        {bottomTabs.map(({ href, label, icon: Icon }) => {
          const active = path === href;
          return (
            <Link key={href} href={href} style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: "0.25rem", flex: 1, padding: "0.5rem 0.25rem",
              textDecoration: "none",
              color: active ? "#22d3ee" : "var(--text-3)",
              transition: "color 0.15s",
            }}>
              <div style={{
                padding: "0.3rem 0.9rem", borderRadius: 99,
                background: active ? "rgba(34,211,238,0.12)" : "transparent",
                transition: "background 0.15s",
              }}>
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              </div>
              <span style={{ fontSize: "0.65rem", fontWeight: active ? 700 : 500 }}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
