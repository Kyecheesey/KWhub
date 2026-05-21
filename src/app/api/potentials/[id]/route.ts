import { getDb } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { business_name, contact_name, phone, email, notes, status, assigned_to } = body;
  const db = getDb();
  db.prepare(
    "UPDATE potentials SET business_name=?, contact_name=?, phone=?, email=?, notes=?, status=?, assigned_to=?, updated_at=datetime('now') WHERE id=?"
  ).run(business_name, contact_name ?? null, phone ?? null, email ?? null, notes ?? null, status ?? "new", assigned_to ?? null, id);
  const updated = db.prepare("SELECT * FROM potentials WHERE id = ?").get(id);
  return Response.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM potentials WHERE id = ?").run(id);
  return Response.json({ success: true });
}
