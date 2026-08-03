import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../../auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const { id } = await params;
  const rows = await sql`SELECT * FROM job_time_entries WHERE job_id = ${id} ORDER BY entry_date DESC, created_at DESC`;
  return Response.json(rows);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const { id } = await params;
  const { hours, note, entry_date } = await req.json();
  const h = Number(hours);
  if (!h || h <= 0 || h > 24) return Response.json({ error: "Hours must be between 0 and 24" }, { status: 400 });
  const session = await auth();
  const rows = await sql`
    INSERT INTO job_time_entries (job_id, person, hours, note, entry_date)
    VALUES (${id}, ${session?.user?.name ?? null}, ${h}, ${note || null}, ${entry_date || new Date().toISOString().slice(0, 10)})
    RETURNING *
  `;
  return Response.json(rows[0], { status: 201 });
}
