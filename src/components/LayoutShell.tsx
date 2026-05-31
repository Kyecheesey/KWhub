"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Menu, X, LayoutDashboard, Users, Target, PhoneCall,
  FileText, Zap, ChevronRight, LogOut, Kanban,
  ClipboardList, CalendarDays, UsersRound, Settings, Bell,
} from "lucide-react";

/* ─── Nav config ─── */
const navGroups = [
  {
    label: "Sales",
    items: [
      { href: "/",           label: "Dashboard",  icon: LayoutDashboard },
      { href: "/clients",    label: "Clients",    icon: Users },
      { href: "/potentials",  label: "Potentials",  icon: Target },
      { href: "/follow-ups",  label: "Follow-ups",  icon: Bell },
      { href: "/call-list",   label: "Call List",   icon: PhoneCall },
    ],
  },
  {
    label: "Team",
    items: [
      { href: "/activities", label: "Activities", icon: Kanban },
      { href: "/tasks",      label: "Tasks",      icon: ClipboardList },
      { href: "/roster",     label: "Roster",     icon: CalendarDays },
      { href: "/management", label: "Management", icon: Settings, kyeOnly: true },
    ],
  },
  {
    label: "Coming Soon",
    items: [
      { href: "#", label: "Team Hub",  icon: UsersRound, soon: true },
      { href: "#", label: "Policies",  icon: FileText,   soon: true },
      { href: "#", label: "AI Tools",  icon: Zap,        soon: true },
    ],
  },
];

const bottomTabs = [
  { href: "/",           label: "Home",       icon: LayoutDashboard },
  { href: "/clients",    label: "Clients",    icon: Users },
  { href: "/potentials", label: "Potentials", icon: Target },
  { href: "/roster",     label: "Roster",     icon: CalendarDays },
  { href: "/call-list",  label: "Calls",      icon: PhoneCall },
];

/* ─── Helpers ─── */
function avatarGradient(name: string) {
  const opts = ["#2dd4e8,#0ea5e9", "#818cf8,#6366f1", "#34d399,#059669", "#fb923c,#ea580c"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return `linear-gradient(135deg, ${opts[Math.abs(h) % opts.length]})`;
}

/* ─── Nav link ─── */
function NavLink({ href, label, icon: Icon, soon, active, onClick }: {
  href: string; label: string; icon: React.FC<{size?: number; strokeWidth?: number}>;
  soon?: boolean; active?: boolean; onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: "0.6rem",
        padding: "0.5rem 0.7rem", borderRadius: 9, textDecoration: "none",
        fontSize: "0.875rem", fontWeight: active ? 700 : 500,
        color: active ? "#eef1ff" : soon ? "var(--text-4)" : "var(--text-2)",
        background: active ? "var(--surface-3)" : "transparent",
        borderLeft: active ? "2.5px solid var(--accent)" : "2.5px solid transparent",
        transition: "background 0.12s, color 0.12s, border-color 0.12s",
        pointerEvents: soon ? "none" : "auto",
        position: "relative",
      }}
      onMouseEnter={!active && !soon ? (e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
        (e.currentTarget as HTMLElement).style.color = "var(--text-1)";
      } : undefined}
      onMouseLeave={!active && !soon ? (e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = "var(--text-2)";
      } : undefined}
    >
      <Icon size={15} strokeWidth={active ? 2.5 : 1.8} />
      <span style={{ flex: 1, letterSpacing: "-0.01em" }}>{label}</span>
      {soon && (
        <span style={{
          fontSize: "0.58rem", fontWeight: 700,
          background: "var(--surface-3)", color: "var(--text-3)",
          padding: "0.1rem 0.38rem", borderRadius: 4,
          textTransform: "uppercase", letterSpacing: "0.05em",
        }}>Soon</span>
      )}
    </Link>
  );
}

/* ─── Main component ─── */
export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const { data: session } = useSession();
  const userName = session?.user?.name ?? "";
  const isKye = userName.toLowerCase() === "kye";

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  /* Filter groups for this user */
  const groups = navGroups.map(g => ({
    ...g,
    items: g.items.filter(item => !(item as { kyeOnly?: boolean }).kyeOnly || isKye),
  })).filter(g => g.items.length > 0);

  /* ── Sidebar inner content (shared between desktop + drawer) ── */
  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <>
      {/* Logo */}
      <div style={{
        padding: "1.25rem 1rem 1.1rem",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg,#2dd4e8,#818cf8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 900, fontSize: "0.8rem", color: "#07090f",
            boxShadow: "0 2px 8px rgba(45,212,232,0.3)",
          }}>KW</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--text-1)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>Innovations</div>
            <div style={{ fontSize: "0.6rem", color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>Internal Hub</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: "0.3rem", borderRadius: 6, display: "flex" }}>
            <X size={17} />
          </button>
        )}
      </div>

      {/* Nav groups */}
      <nav style={{ flex: 1, padding: "0.85rem 0.65rem", display: "flex", flexDirection: "column", gap: "1.5rem", overflowY: "auto" }}>
        {groups.map(({ label, items }) => (
          <div key={label}>
            <p style={{
              fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em",
              textTransform: "uppercase", color: "var(--text-4)",
              padding: "0 0.5rem", marginBottom: "0.3rem",
            }}>{label}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              {items.map(item => (
                <NavLink
                  key={item.label}
                  {...item}
                  active={path === item.href && item.href !== "#"}
                  onClick={onClose}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "0.85rem 1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: avatarGradient(userName),
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.72rem", fontWeight: 800, color: "#07090f",
          }}>
            {userName.slice(0, 2).toUpperCase() || "KW"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.83rem", fontWeight: 700, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{userName || "KW Innovations"}</div>
            <div style={{ fontSize: "0.68rem", color: "var(--text-3)" }}>KW Innovations</div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", padding: "0.35rem", borderRadius: 7, display: "flex", transition: "color 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="desktop-sidebar" style={{
        width: "var(--sidebar-w)", flexShrink: 0,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        height: "100vh", position: "sticky", top: 0,
      }}>
        <SidebarContent />
      </aside>

      {/* ── Mobile top header ── */}
      <header className="mobile-header">
        <button onClick={() => setOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-1)", padding: "0.5rem", borderRadius: 8, display: "flex" }}>
          <Menu size={22} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: "linear-gradient(135deg,#2dd4e8,#818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: "0.68rem", color: "#07090f" }}>KW</div>
          <span style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--text-1)", letterSpacing: "-0.02em" }}>Innovations</span>
        </div>
        <div style={{ width: 38 }} />
      </header>

      {/* ── Mobile drawer ── */}
      <aside style={{
        position: "fixed", top: 0, left: 0, bottom: 0,
        width: 265, zIndex: 200,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)",
        willChange: "transform",
        boxShadow: open ? "8px 0 40px rgba(0,0,0,0.5)" : "none",
      }}>
        <SidebarContent onClose={() => setOpen(false)} />
      </aside>

      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 199,
          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)",
        }} />
      )}

      {/* ── Page content ── */}
      <main className="hub-main">{children}</main>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="bottom-tab-bar">
        {bottomTabs.map(({ href, label, icon: Icon }) => {
          const active = path === href;
          return (
            <Link key={href} href={href} style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: "0.2rem", flex: 1, padding: "0.5rem 0.2rem",
              textDecoration: "none",
              color: active ? "var(--accent)" : "var(--text-3)",
              transition: "color 0.15s",
            }}>
              <div style={{
                padding: "0.28rem 0.85rem", borderRadius: 99,
                background: active ? "rgba(45,212,232,0.1)" : "transparent",
                transition: "background 0.15s",
              }}>
                <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
              </div>
              <span style={{ fontSize: "0.6rem", fontWeight: active ? 700 : 500, letterSpacing: "0.01em" }}>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
