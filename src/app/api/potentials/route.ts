import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const potentials = db.prepare("SELECT * FROM potentials ORDER BY updated_at DESC").all();
  return Response.json(potentials);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { business_name, contact_name, phone, email, notes, status, assigned_to } = body;
  if (!business_name) {
    return Response.json({ error: "business_name is required" }, { status: 400 });
  }
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO potentials (business_name, contact_name, phone, email, notes, status, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      business_name,
      contact_name ?? null,
      phone ?? null,
      email ?? null,
      notes ?? null,
      status ?? "new",
      assigned_to ?? null
    );
  const created = db.prepare("SELECT * FROM potentials WHERE id = ?").get(result.lastInsertRowid);
  return Response.json(created, { status: 201 });
}
