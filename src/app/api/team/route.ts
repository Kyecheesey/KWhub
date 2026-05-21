import { sql, migrate } from "@/lib/db";

export async function GET() {
  await migrate();
  const members = await sql`SELECT * FROM team_members ORDER BY name ASC`;
  return Response.json(members);
}

export async function POST(request: Request) {
  await migrate();
  const { name, role } = await request.json();
  if (!name?.trim()) return Response.json({ error: "name required" }, { status: 400 });
  const rows = await sql`
    INSERT INTO team_members (name, role) VALUES (${name.trim()}, ${role ?? null}) RETURNING *
  `;
  return Response.json(rows[0], { status: 201 });
}
