import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../auth";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const isKye = (session: { user?: { email?: string | null; name?: string | null } } | null) =>
  (session?.user?.email ?? "").toLowerCase() === "kye" ||
  (session?.user?.name ?? "").toLowerCase() === "kye";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role === "client") {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  await migrate();
  const me = (session.user.name ?? "").toLowerCase();
  const manager = isKye(session);
  const rows = await sql`SELECT * FROM roster_shifts ORDER BY created_at ASC`;
  // Hours are private: only the rostered person (and Kye, who sets them) sees them
  const shifts = (rows as { id: number; day: string; time: string; person: string; hours: number; focus: string | null }[])
    .map((r) => ({
      ...r,
      hours: manager || r.person.toLowerCase() === me ? r.hours : null,
    }));
  return Response.json({ shifts, canManage: manager });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!isKye(session)) return Response.json({ error: "Only Kye can manage the roster" }, { status: 403 });
  await migrate();
  const { day, time, person, hours, focus } = await req.json();
  if (!DAYS.includes(day)) return Response.json({ error: "Invalid day" }, { status: 400 });
  if (!time?.trim()) return Response.json({ error: "Time required" }, { status: 400 });
  if (!person?.trim()) return Response.json({ error: "Person required" }, { status: 400 });
  const hrs = Number(hours);
  if (!Number.isFinite(hrs) || hrs <= 0 || hrs > 24) return Response.json({ error: "Hours must be between 0 and 24" }, { status: 400 });
  const rows = await sql`
    INSERT INTO roster_shifts (day, time, person, hours, focus)
    VALUES (${day}, ${time.trim()}, ${person.trim()}, ${hrs}, ${focus?.trim() || null})
    RETURNING *
  `;
  return Response.json(rows[0], { status: 201 });
}
