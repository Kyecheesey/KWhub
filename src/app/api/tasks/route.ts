import { sql, migrate } from "@/lib/db";

export async function GET() {
  await migrate();
  const rows = await sql`SELECT * FROM tasks ORDER BY due_date ASC NULLS LAST, created_at DESC`;
  return Response.json(rows);
}

export async function POST(req: Request) {
  await migrate();
  const { title, description, status, priority, assigned_to, assigned_by, due_date } = await req.json();
  if (!title?.trim()) return Response.json({ error: "Title required" }, { status: 400 });
  if (!assigned_to?.trim()) return Response.json({ error: "Must assign to someone" }, { status: 400 });
  const rows = await sql`
    INSERT INTO tasks (title, description, status, priority, assigned_to, assigned_by, due_date)
    VALUES (${title.trim()}, ${description || null}, ${status || "pending"}, ${priority || "medium"},
            ${assigned_to}, ${assigned_by || null}, ${due_date || null})
    RETURNING *
  `;
  return Response.json(rows[0], { status: 201 });
}
