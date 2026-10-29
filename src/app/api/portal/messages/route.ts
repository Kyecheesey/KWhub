import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../auth";
import { notifyClient, notifyStaff } from "@/lib/portalNotify";
import { clientAgent } from "@/lib/agent";
import { sendEmail } from "@/lib/email";

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
  const clientId = parseInt(param, 10);
  if (Number.isNaN(clientId)) return { error: Response.json({ error: "client_id is required" }, { status: 400 }) };
  if (role === "partner") {
    // Partners may only read their own clients' threads
    const owned = await sql`SELECT 1 FROM clients WHERE id = ${clientId} AND partner_id = ${session.user.partnerId ?? -1}`;
    if (owned.length === 0) return { error: Response.json({ error: "Not one of your clients" }, { status: 403 }) };
  } else {
    // KWI staff read KWI's own clients' threads only
    const kwi = await sql`SELECT 1 FROM clients WHERE id = ${clientId} AND partner_id IS NULL`;
    if (kwi.length === 0) return { error: Response.json({ error: "That client belongs to a partner" }, { status: 403 }) };
  }
  return { session, clientId, role };
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
    if (role === "partner") {
      const owned = await sql`SELECT 1 FROM clients WHERE id = ${clientId} AND partner_id = ${session.user.partnerId ?? -1}`;
      if (owned.length === 0) return Response.json({ error: "Not one of your clients" }, { status: 403 });
    } else {
      const kwi = await sql`SELECT 1 FROM clients WHERE id = ${clientId} AND partner_id IS NULL`;
      if (kwi.length === 0) return Response.json({ error: "That client belongs to a partner" }, { status: 403 });
    }
  }

  const rows = await sql`
    INSERT INTO portal_messages (client_id, author, author_role, body)
    VALUES (${clientId}, ${session.user.name ?? null}, ${role}, ${body.trim()})
    RETURNING *
  `;

  const preview = body.trim().length > 160 ? `${body.trim().slice(0, 160)}…` : body.trim();
  if (role === "client") {
    // Email the client's agent (lib/agent); fall back to the usual staff alert
    const agent = await clientAgent(clientId);
    const biz = (await sql`SELECT business_name FROM clients WHERE id = ${clientId}`)[0] as { business_name: string } | undefined;
    const sent = agent?.email
      ? await sendEmail({
          to: agent.email,
          subject: `New portal message from ${biz?.business_name ?? session.user.name ?? "a client"}`,
          text:
            `Hi ${agent.name},\n\n${session.user.name ?? "Your client"}${biz ? ` (${biz.business_name})` : ""} sent a message in their portal:\n\n` +
            `"${body.trim()}"\n\nReply in KWI ONE: https://www.kwinnovationshub.com.au/clients/${clientId}/portal`,
        }).catch(() => ({ ok: false }))
      : { ok: false };
    if (!sent.ok) {
      await notifyStaff(clientId, `Portal message from ${session.user.name ?? "a client"}`,
        `${session.user.name ?? "A client"} wrote in their portal:\n\n"${preview}"`);
    }
  } else {
    await notifyClient(clientId, "New update from KW Innovations",
      `${session.user.name ?? "The KW team"} posted in your portal:\n\n"${preview}"\n\nSign in to reply.`);
  }
  return Response.json(rows[0], { status: 201 });
}
