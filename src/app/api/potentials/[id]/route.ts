import { sql } from "@/lib/db";
import { logEvent } from "@/lib/events";

const STAGE_LABELS: Record<string, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified",
  proposal: "Proposal Sent", won: "Won", lost: "Lost",
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { business_name, contact_name, phone, email, notes, status, assigned_to, contact_method, follow_up_date } = await request.json();
  const prev = await sql`SELECT status, assigned_to FROM potentials WHERE id=${id}`;
  const rows = await sql`
    UPDATE potentials
    SET business_name=${business_name}, contact_name=${contact_name ?? null},
        phone=${phone ?? null}, email=${email ?? null}, notes=${notes ?? null},
        status=${status ?? "new"}, assigned_to=${assigned_to ?? null},
        contact_method=${contact_method ?? null},
        follow_up_date=${follow_up_date ?? null},
        updated_at=NOW()
    WHERE id=${id}
    RETURNING *
  `;
  const old = prev[0] as { status: string; assigned_to: string | null } | undefined;
  if (old && status && old.status !== status) {
    await logEvent({
      entity_type: "potential", entity_id: Number(id), entity_name: business_name,
      action: "stage_changed",
      detail: `${STAGE_LABELS[old.status] ?? old.status} → ${STAGE_LABELS[status] ?? status}`,
    });
  } else if (old && (assigned_to ?? null) !== old.assigned_to) {
    await logEvent({
      entity_type: "potential", entity_id: Number(id), entity_name: business_name,
      action: "reassigned",
      detail: `${old.assigned_to ?? "Unassigned"} → ${assigned_to ?? "Unassigned"}`,
    });
  } else {
    await logEvent({
      entity_type: "potential", entity_id: Number(id), entity_name: business_name,
      action: "updated",
    });
  }
  return Response.json(rows[0]);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const prev = await sql`SELECT business_name FROM potentials WHERE id=${id}`;
  await sql`DELETE FROM potentials WHERE id=${id}`;
  await logEvent({
    entity_type: "potential", entity_id: Number(id),
    entity_name: (prev[0] as { business_name: string } | undefined)?.business_name ?? null,
    action: "deleted",
  });
  return Response.json({ success: true });
}
