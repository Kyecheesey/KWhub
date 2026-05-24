import { sql, migrate } from "@/lib/db";

export async function GET() {
  await migrate();
  const rows = await sql`SELECT * FROM checklist ORDER BY created_at ASC`;
  return Response.json(rows);
}

export async function POST(req: Request) {
  await migrate();
  const { text } = await req.json();
  if (!text?.trim()) return Response.json({ error: "Text required" }, { status: 400 });
  const rows = await sql`
    INSERT INTO checklist (text) VALUES (${text.trim()}) RETURNING *
  `;
  return Response.json(rows[0], { status: 201 });
}
