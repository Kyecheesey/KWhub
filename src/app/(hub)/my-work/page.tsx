"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Briefcase, Kanban, ClipboardList, Calendar, CheckCircle2, ArrowRight } from "lucide-react";
import { swrJson } from "@/lib/cache";

interface WorkItem {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  due_date: string | null;
  client_id?: number;
}

interface Client { id: number; business_name: string; }

const PRIORITY_COLOR: Record<string, string> = { low: "#60a5fa", medium: "#d97706", high: "#dc2626" };
const STATUS_LABEL: Record<string, string> = {
  todo: "To Do", in_progress: "In Progress", in_review: "In Review", done: "Done",
  pending: "Pending",
};

function isOverdue(d: string | null, status: string) {
  if (!d || status === "done") return false;
  return new Date(d) < new Date(new Date().toDateString());
}
function fmt(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : null;
}

export default function MyWorkPage() {
  const { data: session } = useSession();
  const me = session?.user?.name ?? "";

  const [jobs, setJobs] = useState<WorkItem[]>([]);
  const [activities, setActivities] = useState<WorkItem[]>([]);
  const [tasks, setTasks] = useState<WorkItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    return Promise.all([
      swrJson<WorkItem[]>("/api/client-jobs", (d) => { setJobs(Array.isArray(d) ? d : []); setLoading(false); }),
      swrJson<WorkItem[]>("/api/activities", (d) => setActivities(Array.isArray(d) ? d : [])),
      swrJson<WorkItem[]>("/api/tasks", (d) => setTasks(Array.isArray(d) ? d : [])),
      swrJson<Client[]>("/api/clients", (d) => setClients(Array.isArray(d) ? d : [])),
    ]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const clientName = (id?: number) => clients.find((c) => c.id === id)?.business_name;
  const mine = (items: WorkItem[]) =>
    items.filter((i) => (i.assigned_to ?? "").toLowerCase() === me.toLowerCase() && i.status !== "done");

  const sections = [
    { key: "jobs", label: "Client Jobs", icon: Briefcase, href: "/client-jobs", items: mine(jobs) },
    { key: "activities", label: "Activities", icon: Kanban, href: "/activities", items: mine(activities) },
    { key: "tasks", label: "Tasks", icon: ClipboardList, href: "/tasks", items: mine(tasks) },
  ];

  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const overdue = sections.reduce((n, s) => n + s.items.filter((i) => isOverdue(i.due_date, i.status)).length, 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: "0.35rem" }}>KW | Innovations</p>
          <h1 style={{ fontSize: "1.85rem", fontWeight: 900, letterSpacing: "-0.02em", margin: 0 }}>My Work</h1>
          <p style={{ color: "var(--text-2)", fontSize: "0.875rem", marginTop: "0.3rem" }}>
            {loading ? "Loading…" : `${total} open item${total !== 1 ? "s" : ""}${overdue ? ` · ${overdue} overdue` : ""} · signed in as ${me}`}
          </p>
        </div>
      </div>

      {!loading && total === 0 ? (
        <div style={{ padding: "4rem", textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16 }}>
          <CheckCircle2 size={36} style={{ color: "#059669", margin: "0 auto 1rem" }} />
          <p style={{ color: "var(--text-2)", fontWeight: 600 }}>Nothing assigned to you — all clear!</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1.25rem" }}>
          {sections.filter((s) => s.items.length > 0).map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.key} className="card" style={{ overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.9rem 1.25rem", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 800, fontSize: "0.9rem" }}>
                    <Icon size={15} style={{ color: "var(--accent)" }} /> {s.label}
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--accent)", background: "rgba(79,70,229,0.08)", border: "1px solid rgba(79,70,229,0.2)", padding: "0.1rem 0.5rem", borderRadius: 99 }}>{s.items.length}</span>
                  </span>
                  <Link href={s.href} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}>
                    Open board <ArrowRight size={12} />
                  </Link>
                </div>
                {s.items.map((item, idx) => {
                  const od = isOverdue(item.due_date, item.status);
                  return (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1.25rem", borderBottom: idx < s.items.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY_COLOR[item.priority] ?? "var(--text-3)", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-3)", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                          <span>{STATUS_LABEL[item.status] ?? item.status}</span>
                          {clientName(item.client_id) && <span>{clientName(item.client_id)}</span>}
                          {item.due_date && (
                            <span style={{ color: od ? "#dc2626" : "var(--text-3)", fontWeight: od ? 700 : 400, display: "flex", alignItems: "center", gap: "0.2rem" }}>
                              <Calendar size={10} /> {fmt(item.due_date)}{od ? " ⚠" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
