import { sql, migrate } from "@/lib/db";
import { resolvePortalScope } from "@/lib/portalAuth";
import { notifyClient } from "@/lib/portalNotify";

export async function GET(request: Request) {
  await migrate();
  const r = await resolvePortalScope(request);
  if ("error" in r) return r.error;
  const rows = await sql`
    SELECT * FROM invoices WHERE client_id = ${r.scope.clientId}
    ORDER BY (status != 'paid') DESC, due_date ASC NULLS LAST, created_at DESC
  `;
  return Response.json(rows);
}

export async function POST(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  const amount = Math.round(Number(body.amount) * 100);
  if (!body.number?.trim() || !Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "Invoice number and a positive amount are required" }, { status: 400 });
  }
  const rows = await sql`
    INSERT INTO invoices (client_id, number, amount_cents, due_date, status, pdf_url, pay_url)
    VALUES (${r.scope.clientId}, ${body.number.trim()}, ${amount},
            ${body.due_date || null}, ${body.status ?? "due"}, ${body.pdf_url || null}, ${body.pay_url || null})
    RETURNING *
  `;
  await notifyClient(
    r.scope.clientId,
    `New invoice from KW Innovations: ${body.number.trim()}`,
    `Invoice ${body.number.trim()} for $${(amount / 100).toFixed(2)} has been added to your portal${body.due_date ? `, due ${body.due_date}` : ""}.\n\nSign in to view it.`
  );
  return Response.json(rows[0], { status: 201 });
}

export async function PATCH(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  if (!body.id || !["due", "paid", "draft"].includes(body.status)) {
    return Response.json({ error: "id and a valid status are required" }, { status: 400 });
  }
  const rows = await sql`
    UPDATE invoices SET status = ${body.status}
    WHERE id = ${body.id} AND client_id = ${r.scope.clientId}
    RETURNING *
  `;
  if (rows.length === 0) return Response.json({ error: "Invoice not found" }, { status: 404 });
  return Response.json(rows[0]);
}

export async function DELETE(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  await sql`DELETE FROM invoices WHERE id = ${body.id} AND client_id = ${r.scope.clientId}`;
  return Response.json({ ok: true });
}
