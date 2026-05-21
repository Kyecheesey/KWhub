import { sql, migrate } from "@/lib/db";

export async function GET() {
  await migrate();
  const potentials = await sql`SELECT * FROM potentials ORDER BY updated_at DESC`;
  return Response.json(potentials);
}

export async function POST(request: Request) {
  await migrate();
  const { business_name, contact_name, phone, email, notes, status, assigned_to } = await request.json();
  if (!business_name) return Response.json({ error: "business_name is required" }, { status: 400 });
  const rows = await sql`
    INSERT INTO potentials (business_name, contact_name, phone, email, notes, status, assigned_to)
    VALUES (${business_name}, ${contact_name ?? null}, ${phone ?? null}, ${email ?? null}, ${notes ?? null}, ${status ?? "new"}, ${assigned_to ?? null})
    RETURNING *
  `;
  return Response.json(rows[0], { status: 201 });
}
