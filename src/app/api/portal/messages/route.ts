import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../auth";

async function resolveClientId(request: Request) {
  const session = await auth();
  if (!session?.user) return { error: Response.json({ error: "Not signed in" }, { status: 401 }) };
  const role = session.user.role;
  if (role === "client") {
    if (!session.user.clientId) return { error: Response.json({ error: "No linked client" }, { status: 403 }) };
    return { session, clientId: session.user.clientId, role };
  }
  const url = new URL(request.url);
  const param = url.searchParams.get("client_id");
  if (!param) return { error: Response.json({ error: "client_id is required" }, { status: 400 }) };
  return { session, clientId: parseInt(param, 10), role };
}

export async function GET(request: Request) {
  await migrate();
  const r = await resolveClientId(request);
  if ("error" in r) return r.error;
  const rows = await sql`
    SELECT * FROM portal_messages WHERE client_id = ${r.clientId} ORDER BY created_at ASC LIMIT 200
  `;
  return Response.json(rows);
}

export async function POST(request: Request) {
  await migrate();
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { body, client_id } = await request.json();
  if (!body?.trim()) return Response.json({ error: "Message body is required" }, { status: 400 });

  const role = session.user.role;
  let clientId: number;
  if (role === "client") {
    if (!session.user.clientId) return Response.json({ error: "No linked client" }, { status: 403 });
    clientId = session.user.clientId;
  } else {
    if (!client_id) return Response.json({ error: "client_id is required" }, { status: 400 });
    clientId = client_id;
  }

  const rows = await sql`
    INSERT INTO portal_messages (client_id, author, author_role, body)
    VALUES (${clientId}, ${session.user.name ?? null}, ${role}, ${body.trim()})
    RETURNING *
  `;
  return Response.json(rows[0], { status: 201 });
}
