import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../auth";

export async function GET(request: Request) {
  await migrate();
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Not signed in" }, { status: 401 });

  let clientId: number;
  if (session.user.role === "client") {
    if (!session.user.clientId) return Response.json({ error: "No linked client" }, { status: 403 });
    clientId = session.user.clientId;
  } else {
    // Staff preview: which client's portal to render
    const param = new URL(request.url).searchParams.get("client_id");
    if (!param) return Response.json({ error: "client_id is required for staff preview" }, { status: 400 });
    clientId = parseInt(param, 10);
  }

  const rows = await sql`
    SELECT id, business_name, contact_name, phone, email, website, assigned_to
    FROM clients WHERE id = ${clientId}
  `;
  if (rows.length === 0) return Response.json({ error: "Client record not found" }, { status: 404 });
  return Response.json(rows[0]);
}
