"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Users, Target, TrendingUp, ArrowRight, Megaphone, LifeBuoy,
  Bell, ClipboardList, PhoneCall, Kanban, CalendarDays, Briefcase,
  ThumbsUp, PencilLine, AlertTriangle, CircleDot, Activity, Plus,
  DollarSign, Receipt, ChevronRight,
} from "lucide-react";
import { getCached, setCached } from "@/lib/cache";
import { platformInfo } from "@/lib/social/platforms";

interface Stats {
  clients: number; potentials: number; active_pipeline: number; won: number;
  pipeline_value_cents: number; posts_pending: number; posts_changes: number;
  posts_published_week: number; tickets_open: number; jobs_open: number;
  followups_due: number; tasks_due: number; invoices_overdue: number;
}
interface AttentionPost { id: number; title: string | null; caption: string | null; status: string; scheduled_at: string | null; approval_note: string | null; business_name: string | null; client_id: number; }
interface Ticket { id: number; title: string; status: string; priority: string; created_at: string; business_name: string | null; client_id: number; }
interface Followup { id: number; business_name: string; contact_name: string | null; follow_up_date: string; status: string; }
interface WeekPost { id: number; title: string | null; caption: string | null; status: string; scheduled_at: string; business_name: string | null; client_id: number; platforms: string[]; }
interface MyTask { id: number; title: string; due_date: string | null; priority: string; }
interface EventRow { id: number; entity_type: string; entity_name: string | null; actor: string | null; action: string; detail: string | null; created_at: string; }

interface DashboardData {
  stats: Stats; attentionPosts: AttentionPost[]; tickets: Ticket[];
  followups: Followup[]; weekPosts: WeekPost[]; myTasks: MyTask[]; events: EventRow[];
}

const POST_STATUS: Record<string, { label: string; color: string }> = {
  pending_approval: { label: "Awaiting client", color: "#d97706" },
  changes_requested: { label: "Changes requested", color: "#dc2626" },
  approved: { label: "Approved", color: "#059669" },
  published: { label: "Published", color: "#4f46e5" },
  draft: { label: "Draft", color: "#8b95c0" },
};

function money(cents: number) {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(cents / 100);
}
function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function shortTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
}

export default function Home() {
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(() =>
    typeof window === "undefined" ? null : getCached<DashboardData>("/api/dashboard")
  );

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d: DashboardData) => {
        if (d && !("error" in d)) { setCached("/api/dashboard", d); setData(d); }
      })
      .catch(() => {});
  }, []);

  const firstName = (session?.user?.name ?? "").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
  const s = data?.stats;

  // Attention feed: everything that needs a human, most urgent first
  const attention = useMemo(() => {
    if (!data) return [];
    const items: { key: string; icon: React.FC<{ size?: number; color?: string }>; color: string; title: string; sub: string; href: string }[] = [];
    for (const p of data.attentionPosts) {
      const changes = p.status === "changes_requested";
      items.push({
        key: `post-${p.id}`,
        icon: changes ? PencilLine : ThumbsUp,
        color: changes ? "#dc2626" : "#d97706",
        title: `${changes ? "Changes requested" : "Awaiting approval"}: ${p.title || p.caption?.slice(0, 50) || "Untitled post"}`,
        sub: `${p.business_name ?? "Client"}${changes && p.approval_note ? ` — “${p.approval_note}”` : ""}`,
        href: `/content?client=${p.client_id}`,
      });
    }
    for (const t of data.tickets) {
      items.push({
        key: `ticket-${t.id}`,
        icon: LifeBuoy,
        color: t.priority === "high" ? "#dc2626" : "#0284c7",
        title: `${t.priority === "high" ? "URGENT support" : "Support"}: ${t.title}`,
        sub: `${t.business_name ?? "Client"} · raised ${timeAgo(t.created_at)}`,
        href: "/client-jobs",
      });
    }
    for (const f of data.followups) {
      items.push({
        key: `fup-${f.id}`,
        icon: Bell,
        color: "#d97706",
        title: `Follow up ${f.business_name}`,
        sub: `${f.contact_name ?? f.status} · due ${new Date(f.follow_up_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`,
        href: "/follow-ups",
      });
    }
    // changes_requested posts and urgent tickets bubble up via list order above
    return items.slice(0, 9);
  }, [data]);

  // 7-day content strip
  const week = useMemo(() => {
    const days: { date: Date; posts: WeekPost[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push({ date: d, posts: [] });
    }
    for (const p of data?.weekPosts ?? []) {
      const key = ymd(new Date(p.scheduled_at));
      const slot = days.find((d) => ymd(d.date) === key);
      if (slot) slot.posts.push(p);
    }
    return days;
  }, [data]);

  const kpis = [
    { label: "Clients", value: s?.clients, icon: Users, color: "#0891b2", href: "/clients", sub: "active accounts" },
    { label: "Pipeline", value: s?.active_pipeline, icon: TrendingUp, color: "#7c85f3", href: "/potentials", sub: s ? `${money(Number(s.pipeline_value_cents))} in play` : "" },
    { label: "Awaiting approval", value: s?.posts_pending, icon: Megaphone, color: "#d97706", href: "/content", sub: s?.posts_changes ? `${s.posts_changes} need changes` : "content" },
    { label: "Support open", value: s?.tickets_open, icon: LifeBuoy, color: "#0284c7", href: "/client-jobs", sub: "client requests" },
    { label: "Follow-ups due", value: s?.followups_due, icon: Bell, color: "#dc2626", href: "/follow-ups", sub: "today or overdue" },
    { label: "Posted this week", value: s?.posts_published_week, icon: Activity, color: "#059669", href: "/content", sub: "auto + manual" },
  ];

  const shortcuts = [
    { label: "Clients", icon: Users, href: "/clients" },
    { label: "Content", icon: Megaphone, href: "/content" },
    { label: "Jobs", icon: Briefcase, href: "/client-jobs" },
    { label: "Potentials", icon: Target, href: "/potentials" },
    { label: "Activities", icon: Kanban, href: "/activities" },
    { label: "Tasks", icon: ClipboardList, href: "/tasks" },
    { label: "Roster", icon: CalendarDays, href: "/roster" },
    { label: "Calls", icon: PhoneCall, href: "/call-list" },
  ];

  return (
    <div className="page">
      <style>{`
        .kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.7rem; margin-bottom: 1.4rem; }
        @media (max-width: 1100px) { .kpi-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 560px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
        .home-grid { display: grid; grid-template-columns: 1.7fr 1fr; gap: 1.1rem; align-items: start; }
        @media (max-width: 980px) { .home-grid { grid-template-columns: 1fr; } }
        .week-strip { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.45rem; }
        @media (max-width: 700px) { .week-strip { grid-template-columns: repeat(4, 1fr); } }
        .shortcut-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
      `}</style>

      {/* ── Compact header ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "0.85rem", marginBottom: "1.4rem" }}>
        <div>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--accent)", marginBottom: "0.3rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
            {today}
          </div>
          <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1 }}>
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href="/content" className="btn-primary" style={{ fontSize: "0.8rem" }}><Plus size={14} /> New post</Link>
          <Link href="/potentials" className="btn-ghost" style={{ fontSize: "0.8rem" }}><Target size={13} /> New potential</Link>
          <Link href="/tasks" className="btn-ghost" style={{ fontSize: "0.8rem" }}><ClipboardList size={13} /> New task</Link>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="kpi-grid">
        {kpis.map(({ label, value, icon: Icon, color, href, sub }) => (
          <Link key={label} href={href} className="stat-card" style={{ display: "block", textDecoration: "none", padding: "0.85rem 0.95rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.55rem" }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: `${color}14`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={13} color={color} />
              </div>
              <span style={{ fontSize: "0.66rem", fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", lineHeight: 1.2 }}>{label}</span>
            </div>
            <div style={{ fontSize: "1.55rem", fontWeight: 900, lineHeight: 1, color: value ? "var(--text-1)" : "var(--text-4)", marginBottom: 3 }}>
              {value ?? "–"}
            </div>
            <div style={{ fontSize: "0.66rem", color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
          </Link>
        ))}
      </div>

      <div className="home-grid">
        {/* ══ Left column ══ */}
        <div style={{ display: "grid", gap: "1.1rem", minWidth: 0 }}>
          {/* Needs attention */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.9rem 1.1rem", borderBottom: "1px solid var(--border)" }}>
              <AlertTriangle size={15} color="#d97706" />
              <span style={{ fontWeight: 800, fontSize: "0.9rem" }}>Needs attention</span>
              {attention.length > 0 && (
                <span style={{ marginLeft: "auto", fontSize: "0.68rem", fontWeight: 700, color: "#d97706", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 99, padding: "0.12rem 0.5rem" }}>
                  {attention.length}
                </span>
              )}
            </div>
            {attention.length === 0 ? (
              <p style={{ padding: "1.4rem 1.1rem", fontSize: "0.82rem", color: "var(--text-3)", textAlign: "center" }}>
                {data ? "All clear — nothing waiting on the team. 🎉" : "Loading…"}
              </p>
            ) : (
              <div>
                {attention.map((a) => {
                  const Icon = a.icon;
                  return (
                    <Link key={a.key} href={a.href} style={{ display: "flex", alignItems: "flex-start", gap: "0.7rem", padding: "0.7rem 1.1rem", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${a.color}12`, border: `1px solid ${a.color}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                        <Icon size={13} color={a.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.83rem", fontWeight: 700, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.sub}</div>
                      </div>
                      <ChevronRight size={14} color="var(--text-4)" style={{ flexShrink: 0, marginTop: 6 }} />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* This week's content */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.9rem 1.1rem", borderBottom: "1px solid var(--border)" }}>
              <Megaphone size={15} color="var(--accent)" />
              <span style={{ fontWeight: 800, fontSize: "0.9rem" }}>This week&apos;s content</span>
              <Link href="/content" className="btn-ghost" style={{ marginLeft: "auto", minHeight: 0, padding: "0.3rem 0.65rem", fontSize: "0.72rem" }}>
                Open planner <ArrowRight size={11} />
              </Link>
            </div>
            <div style={{ padding: "0.9rem 1.1rem" }}>
              <div className="week-strip">
                {week.map(({ date, posts }, i) => {
                  const isToday = i === 0;
                  return (
                    <div key={ymd(date)} style={{
                      borderRadius: 10, padding: "0.5rem 0.5rem 0.6rem", minHeight: 76,
                      background: isToday ? "rgba(79,70,229,0.06)" : "var(--surface-2)",
                      border: `1px solid ${isToday ? "rgba(79,70,229,0.25)" : "var(--border)"}`,
                    }}>
                      <div style={{ fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: isToday ? "var(--accent)" : "var(--text-3)", marginBottom: "0.35rem" }}>
                        {isToday ? "Today" : date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric" })}
                      </div>
                      <div style={{ display: "grid", gap: 3 }}>
                        {posts.length === 0 && <div style={{ fontSize: "0.64rem", color: "var(--text-4)" }}>—</div>}
                        {posts.slice(0, 3).map((p) => {
                          const st = POST_STATUS[p.status] ?? POST_STATUS.draft;
                          return (
                            <Link key={p.id} href={`/content?client=${p.client_id}`} title={`${p.business_name ?? ""}: ${p.title || p.caption || ""} · ${shortTime(p.scheduled_at)}`} style={{
                              display: "flex", alignItems: "center", gap: 4, textDecoration: "none",
                              fontSize: "0.62rem", fontWeight: 600, color: "var(--text-2)",
                              background: `${st.color}10`, border: `1px solid ${st.color}26`,
                              borderRadius: 6, padding: "0.14rem 0.3rem", overflow: "hidden",
                            }}>
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: st.color, flexShrink: 0 }} />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.business_name ?? p.title ?? "Post"}</span>
                              <span style={{ display: "inline-flex", gap: 2, flexShrink: 0 }}>
                                {(p.platforms ?? []).slice(0, 3).map((pl, j) => (
                                  <span key={j} style={{ width: 4, height: 4, borderRadius: "50%", background: platformInfo(pl).color }} />
                                ))}
                              </span>
                            </Link>
                          );
                        })}
                        {posts.length > 3 && <div style={{ fontSize: "0.6rem", color: "var(--text-3)" }}>+{posts.length - 3} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Business snapshot */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.9rem 1.1rem", borderBottom: "1px solid var(--border)" }}>
              <DollarSign size={15} color="#059669" />
              <span style={{ fontWeight: 800, fontSize: "0.9rem" }}>Business snapshot</span>
              <Link href="/insights" className="btn-ghost" style={{ marginLeft: "auto", minHeight: 0, padding: "0.3rem 0.65rem", fontSize: "0.72rem" }}>
                Insights <ArrowRight size={11} />
              </Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 0 }}>
              {[
                { label: "Pipeline value", value: s ? money(Number(s.pipeline_value_cents)) : "–", href: "/potentials" },
                { label: "Deals won", value: s?.won ?? "–", href: "/potentials" },
                { label: "Jobs in flight", value: s?.jobs_open ?? "–", href: "/client-jobs" },
                { label: "Overdue invoices", value: s?.invoices_overdue ?? "–", href: "/clients", danger: !!s?.invoices_overdue },
              ].map((m) => (
                <Link key={m.label} href={m.href} style={{ textDecoration: "none", padding: "0.9rem 1.1rem", borderRight: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "1.25rem", fontWeight: 900, color: m.danger ? "#dc2626" : "var(--text-1)", lineHeight: 1.1 }}>{m.value}</div>
                  <div style={{ fontSize: "0.66rem", color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 3 }}>{m.label}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ══ Right column ══ */}
        <div style={{ display: "grid", gap: "1.1rem", minWidth: 0 }}>
          {/* My tasks */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.9rem 1.1rem", borderBottom: "1px solid var(--border)" }}>
              <CircleDot size={15} color="var(--accent)" />
              <span style={{ fontWeight: 800, fontSize: "0.9rem" }}>My tasks</span>
              <Link href="/my-work" className="btn-ghost" style={{ marginLeft: "auto", minHeight: 0, padding: "0.3rem 0.65rem", fontSize: "0.72rem" }}>
                My work <ArrowRight size={11} />
              </Link>
            </div>
            {(data?.myTasks ?? []).length === 0 ? (
              <p style={{ padding: "1.1rem", fontSize: "0.78rem", color: "var(--text-3)", textAlign: "center" }}>
                {data ? "No open tasks assigned to you." : "Loading…"}
              </p>
            ) : (
              <div>
                {data!.myTasks.map((t) => {
                  const overdue = t.due_date && new Date(t.due_date) < new Date(new Date().toDateString());
                  return (
                    <Link key={t.id} href="/tasks" style={{ display: "flex", alignItems: "center", gap: "0.55rem", padding: "0.6rem 1.1rem", textDecoration: "none", borderBottom: "1px solid var(--border)" }}>
                      <span className={`priority-${t.priority}`} style={{ fontSize: "0.6rem" }}>●</span>
                      <span style={{ flex: 1, fontSize: "0.8rem", fontWeight: 600, color: "var(--text-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                      {t.due_date && (
                        <span style={{ fontSize: "0.66rem", fontWeight: 700, color: overdue ? "#dc2626" : "var(--text-3)", flexShrink: 0 }}>
                          {new Date(t.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent activity */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.9rem 1.1rem", borderBottom: "1px solid var(--border)" }}>
              <Activity size={15} color="var(--accent-3)" />
              <span style={{ fontWeight: 800, fontSize: "0.9rem" }}>Recent activity</span>
            </div>
            {(data?.events ?? []).length === 0 ? (
              <p style={{ padding: "1.1rem", fontSize: "0.78rem", color: "var(--text-3)", textAlign: "center" }}>
                {data ? "Quiet so far." : "Loading…"}
              </p>
            ) : (
              <div style={{ padding: "0.35rem 0" }}>
                {data!.events.map((e) => (
                  <div key={e.id} style={{ display: "flex", gap: "0.6rem", padding: "0.5rem 1.1rem", alignItems: "flex-start" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--surface-4)", flexShrink: 0, marginTop: 6 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: "0.76rem", color: "var(--text-1)", lineHeight: 1.4 }}>
                        <strong>{e.actor ?? "System"}</strong> {e.action} {e.entity_type}
                        {e.entity_name ? <strong> {e.entity_name}</strong> : ""}
                      </div>
                      <div style={{ fontSize: "0.64rem", color: "var(--text-3)" }}>{timeAgo(e.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shortcuts */}
          <div className="card" style={{ padding: "0.9rem 1rem" }}>
            <div className="section-label" style={{ marginBottom: "0.6rem" }}>Go to</div>
            <div className="shortcut-grid">
              {shortcuts.map(({ label, icon: Icon, href }) => (
                <Link key={label} href={href} style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem",
                  padding: "0.65rem 0.25rem", borderRadius: 10, textDecoration: "none",
                  background: "var(--surface-2)", border: "1px solid var(--border)",
                }}>
                  <Icon size={16} color="var(--accent)" />
                  <span style={{ fontSize: "0.64rem", fontWeight: 700, color: "var(--text-2)" }}>{label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Overdue invoices nudge */}
          {!!s?.invoices_overdue && (
            <Link href="/clients" className="card" style={{ display: "flex", alignItems: "center", gap: "0.7rem", padding: "0.85rem 1rem", textDecoration: "none", border: "1px solid rgba(220,38,38,0.25)" }}>
              <Receipt size={16} color="#dc2626" />
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-1)", flex: 1 }}>
                {s.invoices_overdue} overdue invoice{s.invoices_overdue === 1 ? "" : "s"} to chase
              </span>
              <ChevronRight size={14} color="var(--text-3)" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
