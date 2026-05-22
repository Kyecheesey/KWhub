import { sql, migrate } from "@/lib/db";

export async function GET() {
  await migrate();
  const rows = await sql`SELECT * FROM activities ORDER BY created_at DESC`;
  return Response.json(rows);
}

export async function POST(req: Request) {
  await migrate();
  const { title, description, status, priority, assigned_to, due_date, tags } = await req.json();
  if (!title?.trim()) return Response.json({ error: "Title required" }, { status: 400 });
  const rows = await sql`
    INSERT INTO activities (title, description, status, priority, assigned_to, due_date, tags)
    VALUES (${title.trim()}, ${description || null}, ${status || "todo"}, ${priority || "medium"},
            ${assigned_to || null}, ${due_date || null}, ${tags || null})
    RETURNING *
  `;
  return Response.json(rows[0], { status: 201 });
}
