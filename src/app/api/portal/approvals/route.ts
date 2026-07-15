import { sql, migrate } from "@/lib/db";
import { resolvePortalScope } from "@/lib/portalAuth";
import { notifyClient, notifyStaff } from "@/lib/portalNotify";

export async function GET(request: Request) {
  await migrate();
  const r = await resolvePortalScope(request);
  if ("error" in r) return r.error;
  const rows = await sql`
    SELECT * FROM approvals WHERE client_id = ${r.scope.clientId}
    ORDER BY (status = 'pending') DESC, created_at DESC
  `;
  return Response.json(rows);
}

// Staff request an approval from the client
export async function POST(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  if (!body.title?.trim()) return Response.json({ error: "Title is required" }, { status: 400 });
  const rows = await sql`
    INSERT INTO approvals (client_id, title, description, created_by)
    VALUES (${r.scope.clientId}, ${body.title.trim()}, ${body.description ?? null}, ${r.scope.name})
    RETURNING *
  `;
  await notifyClient(
    r.scope.clientId,
    `Approval requested: ${body.title.trim()}`,
    `KW Innovations has requested your approval on "${body.title.trim()}".\n\nSign in to your portal to approve or request changes.`
  );
  return Response.json(rows[0], { status: 201 });
}

// Client responds (approve / request changes); staff may also cancel via status
export async function PATCH(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  const { id, status, response_note } = body;
  if (!id || !["approved", "changes_requested", "pending"].includes(status)) {
    return Response.json({ error: "id and a valid status are required" }, { status: 400 });
  }
  if (r.scope.role === "client" && status === "pending") {
    return Response.json({ error: "Only staff can reopen an approval" }, { status: 403 });
  }
  const rows = await sql`
    UPDATE approvals SET
      status = ${status},
      response_note = ${response_note ?? null},
      responded_at = ${status === "pending" ? null : sql`NOW()`}
    WHERE id = ${id} AND client_id = ${r.scope.clientId}
    RETURNING *
  `;
  if (rows.length === 0) return Response.json({ error: "Approval not found" }, { status: 404 });
  const approval = rows[0] as { title: string };

  if (r.scope.role === "client" && status !== "pending") {
    const verdict = status === "approved" ? "APPROVED" : "requested changes on";
    // Drop a record into the message thread so the decision is visible in context
    await sql`
      INSERT INTO portal_messages (client_id, author, author_role, body)
      VALUES (${r.scope.clientId}, ${r.scope.name}, 'client',
              ${`${status === "approved" ? "✅ Approved" : "✏️ Changes requested"}: ${approval.title}${response_note ? ` — ${response_note}` : ""}`})
    `;
    await notifyStaff(
      r.scope.clientId,
      `Client ${verdict === "APPROVED" ? "approved" : "requested changes"}: ${approval.title}`,
      `${r.scope.name ?? "The client"} ${verdict} "${approval.title}".${response_note ? `\n\nNote: ${response_note}` : ""}`
    );
  }
  return Response.json(rows[0]);
}

export async function DELETE(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  await sql`DELETE FROM approvals WHERE id = ${body.id} AND client_id = ${r.scope.clientId}`;
  return Response.json({ ok: true });
}
