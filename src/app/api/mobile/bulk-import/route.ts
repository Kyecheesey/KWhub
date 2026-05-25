import { sql, migrate } from "@/lib/db";

// One-time bulk import endpoint — secured by secret token
const SECRET = "kw-bulk-2026";

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
