import { sql, migrate } from "@/lib/db";
const SECRET = "kw-bulk-2026";
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== SECRET) return Response.json({ error: "Forbidden" }, { status: 403 });
  await migrate();
  const rows = await sql`SELECT * FROM potentials ORDER BY status, assigned_to, business_name`;
  return Response.json(rows);
}
export async function POST(req: Request) {
  const { secret, records } = await req.json();
  if (secret !== SECRET) return Response.json({ error: "Forbidden" }, { status: 403 });
  await migrate();
  let imported = 0;
  for (const r of records) {
    await sql`
      INSERT INTO potentials (business_name, contact_name, phone, email, notes, status, assigned_to, contact_method)
      VALUES (${r.business_name}, ${r.contact_name ?? null}, ${r.phone ?? null}, ${r.email ?? null},
              ${r.notes ?? null}, ${r.status}, ${r.assigned_to}, ${r.contact_method ?? null})
    `;
    imported++;
  }
  return Response.json({ imported });
}
