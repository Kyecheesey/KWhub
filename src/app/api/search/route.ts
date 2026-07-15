import { sql, migrate } from "@/lib/db";

export async function GET(request: Request) {
  await migrate();
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ clients: [], potentials: [] });

  const like = `%${q}%`;
  const [clients, potentials] = await Promise.all([
    sql`
      SELECT id, business_name, contact_name, phone, email
      FROM clients
      WHERE business_name ILIKE ${like} OR contact_name ILIKE ${like}
         OR phone ILIKE ${like} OR email ILIKE ${like}
      ORDER BY business_name ASC LIMIT 6
    `,
    sql`
      SELECT id, business_name, contact_name, phone, email, status
      FROM potentials
      WHERE business_name ILIKE ${like} OR contact_name ILIKE ${like}
         OR phone ILIKE ${like} OR email ILIKE ${like}
      ORDER BY updated_at DESC LIMIT 6
    `,
  ]);
  return Response.json({ clients, potentials });
}
