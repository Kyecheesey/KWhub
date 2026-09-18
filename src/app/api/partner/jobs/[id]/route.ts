import { sql, migrate } from "@/lib/db";
import { requirePartner } from "@/lib/partnerAuth";

async function ownedJob(partnerId: number, id: string) {
  const rows = await sql`
    SELECT j.id, j.status FROM client_jobs j
    JOIN clients c ON c.id = j.client_id
    WHERE j.id = ${id} AND c.partner_id = ${partnerId}
  `;
  return (rows[0] as { id: number; status: string } | undefined) ?? null;
}

// PATCH → update status / fields on one of this partner's jobs
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const { id } = await params;
  const job = await ownedJob(r.scope.partnerId, id);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  const b = await request.json();
  const status = ["todo", "in_progress", "done"].includes(b.status) ? b.status : job.status;
  const rows = await sql`
    UPDATE client_jobs SET
      title = COALESCE(${b.title ?? null}, title),
      description = COALESCE(${b.description ?? null}, description),
      status = ${status},
      priority = COALESCE(${b.priority ?? null}, priority),
      due_date = ${b.due_date !== undefined ? (b.due_date || null) : sql`due_date`},
      visible_to_client = COALESCE(${b.visible_to_client ?? null}, visible_to_client),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return Response.json(rows[0]);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const { id } = await params;
  const job = await ownedJob(r.scope.partnerId, id);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  await sql`DELETE FROM job_comments WHERE job_id = ${id}`;
  await sql`DELETE FROM client_jobs WHERE id = ${id}`;
  return Response.json({ ok: true });
}
