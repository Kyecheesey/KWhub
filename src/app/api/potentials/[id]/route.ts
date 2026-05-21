import { sql } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { business_name, contact_name, phone, email, notes, status, assigned_to } = await request.json();
  const rows = await sql`
    UPDATE potentials
    SET business_name=${business_name}, contact_name=${contact_name ?? null},
        phone=${phone ?? null}, email=${email ?? null}, notes=${notes ?? null},
        status=${status ?? "new"}, assigned_to=${assigned_to ?? null}, updated_at=NOW()
    WHERE id=${id}
    RETURNING *
  `;
  return Response.json(rows[0]);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await sql`DELETE FROM potentials WHERE id=${id}`;
  return Response.json({ success: true });
}
