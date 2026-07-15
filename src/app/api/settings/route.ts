import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../auth";

const EDITABLE_KEYS = ["booking_url"];

export async function GET() {
  await migrate();
  const session = await auth();
  if (!session?.user || session.user.role === "client") {
    return Response.json({ error: "Staff only" }, { status: 403 });
  }
  const rows = await sql`SELECT key, value FROM settings`;
  const out: Record<string, string | null> = {};
  for (const r of rows as { key: string; value: string | null }[]) out[r.key] = r.value;
  return Response.json(out);
}

export async function POST(request: Request) {
  await migrate();
  const session = await auth();
  if ((session?.user?.email ?? "").toLowerCase() !== "kye") {
    return Response.json({ error: "Only Kye can change settings" }, { status: 403 });
  }
  const { key, value } = await request.json();
  if (!EDITABLE_KEYS.includes(key)) {
    return Response.json({ error: "Unknown setting" }, { status: 400 });
  }
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${value ?? null}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
  return Response.json({ ok: true });
}
