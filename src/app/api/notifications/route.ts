import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../auth";

interface Pot {
  id: number; business_name: string; status: string;
  assigned_to: string | null; follow_up_date: string | null; updated_at: string;
}
interface Task {
  id: number; title: string; status: string;
  assigned_to: string; due_date: string | null;
}

export interface Notification {
  id: string;
  type: "follow_up" | "task" | "stale";
  title: string;
  detail: string;
  href: string;
  urgency: "high" | "medium" | "low";
}

const ACTIVE_STAGES = ["contacted", "qualified", "proposal"];
const DAY = 86400000;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function followUpDue(p: Pot): number | null {
  // Days until due (negative = overdue). Mirrors the follow-ups page logic.
  let due: Date;
  if (p.follow_up_date) {
    due = new Date(p.follow_up_date);
  } else if (ACTIVE_STAGES.includes(p.status)) {
    due = new Date(p.updated_at);
    due.setDate(due.getDate() + 5);
  } else {
    return null;
  }
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - startOfToday().getTime()) / DAY);
}

export async function GET() {
  await migrate();
  const session = await auth();
  const me = (session?.user?.name ?? "").toLowerCase();

  const [potRows, taskRows] = await Promise.all([
    sql`SELECT id, business_name, status, assigned_to, follow_up_date, updated_at FROM potentials`,
    sql`SELECT id, title, status, assigned_to, due_date FROM tasks WHERE status != 'done'`,
  ]);
  const pots = potRows as unknown as Pot[];
  const tasks = taskRows as unknown as Task[];

  const items: Notification[] = [];

  for (const p of pots) {
    const diff = followUpDue(p);
    if (diff === null || diff > 0) continue;
    items.push({
      id: `fu-${p.id}`,
      type: "follow_up",
      title: p.business_name,
      detail: diff === 0 ? "Follow-up due today" : `Follow-up ${Math.abs(diff)}d overdue`,
      href: "/follow-ups",
      urgency: diff < 0 ? "high" : "medium",
    });
  }

  const today = startOfToday();
  for (const t of tasks) {
    if (t.assigned_to.toLowerCase() !== me) continue;
    const overdue = t.due_date && new Date(t.due_date) < today;
    items.push({
      id: `task-${t.id}`,
      type: "task",
      title: t.title,
      detail: overdue ? "Task overdue" : "Open task assigned to you",
      href: "/tasks",
      urgency: overdue ? "high" : "low",
    });
  }

  const staleCutoff = Date.now() - 14 * DAY;
  for (const p of pots) {
    if (!["new", ...ACTIVE_STAGES].includes(p.status)) continue;
    if (new Date(p.updated_at).getTime() > staleCutoff) continue;
    if (followUpDue(p) !== null && (followUpDue(p) as number) <= 0) continue; // already surfaced
    items.push({
      id: `stale-${p.id}`,
      type: "stale",
      title: p.business_name,
      detail: "No activity for 14+ days",
      href: "/potentials",
      urgency: "low",
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => order[a.urgency] - order[b.urgency]);
  return Response.json(items);
}
