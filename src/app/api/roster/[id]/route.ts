import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../auth";

const isKye = (session: { user?: { email?: string | null; name?: string | null } } | null) =>
  (session?.user?.email ?? "").toLowerCase() === "kye" ||
  (session?.user?.name ?? "").toLowerCase() === "kye";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!isKye(session)) return Response.json({ error: "Only Kye can manage the roster" }, { status: 403 });
  await migrate();
  const { id } = await params;
  await sql`DELETE FROM roster_shifts WHERE id = ${Number(id)}`;
  return Response.json({ ok: true });
}
