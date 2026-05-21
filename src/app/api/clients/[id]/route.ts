import { getDb } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { business_name, contact_name, phone, email, website, notes, assigned_to } = body;
  const db = getDb();
  db.prepare(
    "UPDATE clients SET business_name=?, contact_name=?, phone=?, email=?, website=?, notes=?, assigned_to=? WHERE id=?"
  ).run(business_name, contact_name ?? null, phone ?? null, email ?? null, website ?? null, notes ?? null, assigned_to ?? null, id);
  const updated = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
  return Response.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM clients WHERE id = ?").run(id);
  return Response.json({ success: true });
}
