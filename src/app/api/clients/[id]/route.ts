import { sql } from "@/lib/db";
import { logEvent } from "@/lib/events";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { business_name, contact_name, phone, email, website, notes, assigned_to } = await request.json();
  const prev = await sql`SELECT assigned_to FROM clients WHERE id=${id}`;
  const rows = await sql`
    UPDATE clients
    SET business_name=${business_name}, contact_name=${contact_name ?? null},
        phone=${phone ?? null}, email=${email ?? null}, website=${website ?? null},
        notes=${notes ?? null}, assigned_to=${assigned_to ?? null}
    WHERE id=${id}
    RETURNING *
  `;
  const old = prev[0] as { assigned_to: string | null } | undefined;
  if (old && (assigned_to ?? null) !== old.assigned_to) {
    await logEvent({
      entity_type: "client", entity_id: Number(id), entity_name: business_name,
      action: "reassigned",
      detail: `${old.assigned_to ?? "Unassigned"} → ${assigned_to ?? "Unassigned"}`,
    });
  } else {
    await logEvent({ entity_type: "client", entity_id: Number(id), entity_name: business_name, action: "updated" });
  }
  return Response.json(rows[0]);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const prev = await sql`SELECT business_name FROM clients WHERE id=${id}`;
  await sql`DELETE FROM clients WHERE id=${id}`;
  await logEvent({
    entity_type: "client", entity_id: Number(id),
    entity_name: (prev[0] as { business_name: string } | undefined)?.business_name ?? null,
    action: "deleted",
  });
  return Response.json({ success: true });
}
