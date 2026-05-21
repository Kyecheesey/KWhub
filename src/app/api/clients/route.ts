import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const clients = db.prepare("SELECT * FROM clients ORDER BY business_name ASC").all();
  return Response.json(clients);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { business_name, contact_name, phone, email, website, notes, assigned_to } = body;
  if (!business_name) {
    return Response.json({ error: "business_name is required" }, { status: 400 });
  }
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO clients (business_name, contact_name, phone, email, website, notes, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(business_name, contact_name ?? null, phone ?? null, email ?? null, website ?? null, notes ?? null, assigned_to ?? null);
  const created = db.prepare("SELECT * FROM clients WHERE id = ?").get(result.lastInsertRowid);
  return Response.json(created, { status: 201 });
}
