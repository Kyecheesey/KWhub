import { sql, migrate } from "@/lib/db";

export async function GET() {
  await migrate();
  const clients = await sql`SELECT * FROM clients ORDER BY business_name ASC`;
  return Response.json(clients);
}

export async function POST(request: Request) {
  await migrate();
  const { business_name, contact_name, phone, email, website, notes, assigned_to } = await request.json();
  if (!business_name) return Response.json({ error: "business_name is required" }, { status: 400 });
  const rows = await sql`
    INSERT INTO clients (business_name, contact_name, phone, email, website, notes, assigned_to)
    VALUES (${business_name}, ${contact_name ?? null}, ${phone ?? null}, ${email ?? null}, ${website ?? null}, ${notes ?? null}, ${assigned_to ?? null})
    RETURNING *
  `;
  return Response.json(rows[0], { status: 201 });
}
