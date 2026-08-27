import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../auth";

/**
 * One-shot aggregate for the staff dashboard — everything the command
 * centre needs in a single request instead of six.
 */
export async function GET() {
  await migrate();
  const session = await auth();
  if (!session?.user || session.user.role === "client") {
    return Response.json({ error: "Staff only" }, { status: 403 });
  }

  const [stats] = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM clients) AS clients,
      (SELECT COUNT(*)::int FROM potentials) AS potentials,
      (SELECT COUNT(*)::int FROM potentials WHERE status IN ('new','contacted','qualified','proposal')) AS active_pipeline,
      (SELECT COUNT(*)::int FROM potentials WHERE status = 'won') AS won,
      (SELECT COALESCE(SUM(value_cents), 0)::bigint FROM potentials WHERE status IN ('new','contacted','qualified','proposal')) AS pipeline_value_cents,
      (SELECT COUNT(*)::int FROM posts WHERE status = 'pending_approval') AS posts_pending,
      (SELECT COUNT(*)::int FROM posts WHERE status = 'changes_requested') AS posts_changes,
      (SELECT COUNT(*)::int FROM posts WHERE status = 'published' AND published_at > NOW() - INTERVAL '7 days') AS posts_published_week,
      (SELECT COUNT(*)::int FROM client_jobs WHERE kind = 'support' AND status != 'done') AS tickets_open,
      (SELECT COUNT(*)::int FROM client_jobs WHERE kind != 'support' AND status != 'done') AS jobs_open,
      (SELECT COUNT(*)::int FROM potentials WHERE follow_up_date IS NOT NULL AND follow_up_date <= CURRENT_DATE AND status NOT IN ('won','lost')) AS followups_due,
      (SELECT COUNT(*)::int FROM tasks WHERE status != 'done' AND completed_at IS NULL AND due_date IS NOT NULL AND due_date <= CURRENT_DATE) AS tasks_due,
      (SELECT COUNT(*)::int FROM invoices WHERE status = 'due' AND due_date IS NOT NULL AND due_date < CURRENT_DATE) AS invoices_overdue
  `;

  const attentionPosts = await sql`
    SELECT po.id, po.title, po.caption, po.status, po.scheduled_at, po.approval_note, c.business_name, po.client_id
    FROM posts po LEFT JOIN clients c ON c.id = po.client_id
    WHERE po.status IN ('pending_approval', 'changes_requested')
    ORDER BY (po.status = 'changes_requested') DESC, po.scheduled_at NULLS LAST
    LIMIT 8
  `;
  const tickets = await sql`
    SELECT j.id, j.title, j.status, j.priority, j.created_at, c.business_name, j.client_id
    FROM client_jobs j LEFT JOIN clients c ON c.id = j.client_id
    WHERE j.kind = 'support' AND j.status != 'done'
    ORDER BY (j.priority = 'high') DESC, j.created_at ASC
    LIMIT 8
  `;
  const followups = await sql`
    SELECT id, business_name, contact_name, follow_up_date, status
    FROM potentials
    WHERE follow_up_date IS NOT NULL AND follow_up_date <= CURRENT_DATE AND status NOT IN ('won','lost')
    ORDER BY follow_up_date ASC
    LIMIT 8
  `;
  const weekPosts = await sql`
    SELECT po.id, po.title, po.caption, po.status, po.scheduled_at, c.business_name, po.client_id,
      COALESCE((SELECT json_agg(pc.platform ORDER BY pc.id) FROM post_channels pc WHERE pc.post_id = po.id), '[]') AS platforms
    FROM posts po LEFT JOIN clients c ON c.id = po.client_id
    WHERE po.scheduled_at >= CURRENT_DATE - INTERVAL '1 day'
      AND po.scheduled_at < CURRENT_DATE + INTERVAL '8 days'
    ORDER BY po.scheduled_at ASC
    LIMIT 30
  `;
  const myTasks = await sql`
    SELECT id, title, due_date, priority FROM tasks
    WHERE status != 'done' AND completed_at IS NULL
      AND LOWER(assigned_to) = ${(session.user.name ?? "").toLowerCase()}
    ORDER BY due_date NULLS LAST, priority = 'high' DESC
    LIMIT 6
  `;
  const events = await sql`
    SELECT id, entity_type, entity_name, actor, action, detail, created_at
    FROM events ORDER BY created_at DESC LIMIT 10
  `;

  return Response.json({
    stats,
    attentionPosts,
    tickets,
    followups,
    weekPosts,
    myTasks,
    events,
  });
}
