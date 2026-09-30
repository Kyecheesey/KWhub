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
  type: "follow_up" | "task" | "stale" | "portal" | "signup" | "proposal";
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

  const [potRows, taskRows, portalRows, signupRows, proposalRows] = await Promise.all([
    sql`SELECT id, business_name, status, assigned_to, follow_up_date, updated_at FROM potentials`,
    sql`SELECT id, title, status, assigned_to, due_date FROM tasks WHERE status != 'done'`,
    sql`
      SELECT pm.id, pm.client_id, pm.body, c.business_name
      FROM portal_messages pm JOIN clients c ON c.id = pm.client_id
      WHERE c.partner_id IS NULL
        AND pm.author_role = 'client' AND pm.created_at > NOW() - INTERVAL '48 hours'
      ORDER BY pm.created_at DESC LIMIT 10
    `,
    sql`
      SELECT id, business_name, contact_name FROM clients
      WHERE partner_id IS NULL AND source = 'signup' AND created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC LIMIT 10
    `,
    // ProposalMe: fresh answers, and first opens still waiting on an answer
    sql`
      SELECT id, title, client_name, stage, last_answer, package, responded_at, first_viewed_at
      FROM proposals
      WHERE stage NOT IN ('won', 'lost')
        AND (responded_at > NOW() - INTERVAL '48 hours'
             OR (answers = 0 AND first_viewed_at > NOW() - INTERVAL '24 hours'))
      ORDER BY COALESCE(responded_at, first_viewed_at) DESC LIMIT 10
    `,
  ]);
  const pots = potRows as unknown as Pot[];
  const tasks = taskRows as unknown as Task[];
  const portalMsgs = portalRows as unknown as { id: number; client_id: number; body: string; business_name: string }[];
  const signups = signupRows as unknown as { id: number; business_name: string; contact_name: string | null }[];
  const proposals = proposalRows as unknown as {
    id: number; title: string; client_name: string | null; stage: string;
    last_answer: string | null; package: string | null; responded_at: string | null; first_viewed_at: string | null;
  }[];

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

  for (const m of portalMsgs) {
    items.push({
      id: `portal-${m.id}`,
      type: "portal",
      title: m.business_name,
      detail: `Client message: "${m.body.length > 60 ? `${m.body.slice(0, 60)}…` : m.body}"`,
      href: `/clients/${m.client_id}/portal`,
      urgency: "medium",
    });
  }

  for (const s of signups) {
    items.push({
      id: `signup-${s.id}`,
      type: "signup",
      title: s.business_name,
      detail: `New business signed up${s.contact_name ? ` — ${s.contact_name}` : ""}`,
      href: `/clients/${s.id}`,
      urgency: "medium",
    });
  }

  for (const p of proposals) {
    const answered = !!p.responded_at && Date.now() - new Date(p.responded_at).getTime() < 2 * DAY;
    items.push({
      id: answered ? `proposal-answer-${p.id}-${p.responded_at}` : `proposal-open-${p.id}`,
      type: "proposal",
      title: p.client_name || p.title,
      detail: answered
        ? `Answered your proposal: ${p.last_answer}${p.package ? ` (${p.package})` : ""}`
        : "Opened your proposal",
      href: "/proposals",
      urgency: answered && p.stage === "accepted" ? "high" : answered ? "medium" : "low",
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => order[a.urgency] - order[b.urgency]);
  return Response.json(items);
}
