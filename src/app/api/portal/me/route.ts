import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../auth";

export async function GET() {
  await migrate();
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (session.user.role !== "client" || !session.user.clientId) {
    return Response.json({ error: "Not a client account" }, { status: 403 });
  }
  const rows = await sql`
    SELECT id, business_name, contact_name, phone, email, website, assigned_to
    FROM clients WHERE id = ${session.user.clientId}
  `;
  if (rows.length === 0) return Response.json({ error: "Client record not found" }, { status: 404 });
  return Response.json(rows[0]);
}
