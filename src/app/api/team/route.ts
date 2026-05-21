import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const members = db.prepare("SELECT * FROM team_members ORDER BY name ASC").all();
  return Response.json(members);
}

export async function POST(request: Request) {
  const { name, role } = await request.json();
  if (!name?.trim()) return Response.json({ error: "name required" }, { status: 400 });
  const db = getDb();
  const r = db.prepare("INSERT INTO team_members (name, role) VALUES (?, ?)").run(name.trim(), role ?? null);
  return Response.json(db.prepare("SELECT * FROM team_members WHERE id = ?").get(r.lastInsertRowid), { status: 201 });
}
