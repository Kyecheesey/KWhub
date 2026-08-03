import { sql, migrate } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { notifyAssignment } from "@/lib/notify";

export async function GET(req: Request) {
  await migrate();
  const clientId = new URL(req.url).searchParams.get("client_id");
  const rows = clientId
    ? await sql`SELECT * FROM client_jobs WHERE client_id = ${clientId} ORDER BY created_at DESC`
    : await sql`SELECT * FROM client_jobs ORDER BY created_at DESC`;
  return Response.json(rows);
}

export async function POST(req: Request) {
  await migrate();
  const { client_id, title, description, status, priority, assigned_to, due_date } = await req.json();
  if (!client_id) return Response.json({ error: "client_id required" }, { status: 400 });
  if (!title?.trim()) return Response.json({ error: "Title required" }, { status: 400 });
  const rows = await sql`
    INSERT INTO client_jobs (client_id, title, description, status, priority, assigned_to, due_date)
    VALUES (${client_id}, ${title.trim()}, ${description || null}, ${status || "todo"},
            ${priority || "medium"}, ${assigned_to || null}, ${due_date || null})
    RETURNING *
  `;
  const created = rows[0] as { id: number };
  await logEvent({ entity_type: "client_job", entity_id: created.id, entity_name: title.trim(), action: "created" });
  if (assigned_to) {
    const client = await sql`SELECT business_name FROM clients WHERE id = ${client_id}`;
    await notifyAssignment({
      kind: "client job", title: title.trim(), assignee: assigned_to,
      clientName: (client[0] as { business_name: string } | undefined)?.business_name,
      dueDate: due_date, priority, description,
    });
  }
  return Response.json(rows[0], { status: 201 });
}
