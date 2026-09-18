import { sql, migrate } from "@/lib/db";
import { requirePartner, partnerOwnsClient } from "@/lib/partnerAuth";
import { notifyClient } from "@/lib/portalNotify";

// Portal message threads for a partner's clients — the same portal_messages
// table their clients write to from the portal's Messages tab.

// GET ?client_id= → the thread for one of this partner's clients
export async function GET(request: Request) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const clientId = parseInt(new URL(request.url).searchParams.get("client_id") ?? "", 10);
  if (!clientId) return Response.json({ error: "client_id is required" }, { status: 400 });
  const owned = await partnerOwnsClient(r.scope.partnerId, clientId);
  if (!owned) return Response.json({ error: "Not one of your clients" }, { status: 403 });
  const rows = await sql`
    SELECT * FROM portal_messages WHERE client_id = ${clientId} ORDER BY created_at ASC LIMIT 200
  `;
  return Response.json(rows);
}

// POST {client_id, body} → reply in the thread (emails the client)
export async function POST(request: Request) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const { client_id, body } = await request.json();
  if (!client_id || !body?.trim()) {
    return Response.json({ error: "client_id and body are required" }, { status: 400 });
  }
  const owned = await partnerOwnsClient(r.scope.partnerId, client_id);
  if (!owned) return Response.json({ error: "Not one of your clients" }, { status: 403 });

  // author_role 'staff' so the client portal renders it as the managing side
  const rows = await sql`
    INSERT INTO portal_messages (client_id, author, author_role, body)
    VALUES (${client_id}, ${r.scope.name ?? null}, 'staff', ${body.trim()})
    RETURNING *
  `;
  const partner = (await sql`SELECT name FROM partners WHERE id = ${r.scope.partnerId}`)[0] as { name: string } | undefined;
  const brand = partner?.name ?? "your agency";
  const preview = body.trim().length > 160 ? `${body.trim().slice(0, 160)}…` : body.trim();
  await notifyClient(client_id, `New update from ${brand}`,
    `${r.scope.name ?? brand} posted in your portal:\n\n"${preview}"\n\nSign in to reply.`);
  return Response.json(rows[0], { status: 201 });
}
