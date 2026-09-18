import { sql, migrate } from "@/lib/db";
import { requirePartner, partnerOwnsClient } from "@/lib/partnerAuth";

// GET → one of this partner's clients, with counts for the detail page
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const id = parseInt((await params).id, 10);
  const rows = await sql`
    SELECT c.*,
      (SELECT COUNT(*)::int FROM users u WHERE u.role = 'client' AND u.client_id = c.id) AS portal_logins,
      (SELECT COUNT(*)::int FROM posts po WHERE po.client_id = c.id) AS post_count,
      (SELECT COUNT(*)::int FROM client_jobs j WHERE j.client_id = c.id AND j.status != 'done') AS open_jobs
    FROM clients c
    WHERE c.id = ${id} AND c.partner_id = ${r.scope.partnerId}
  `;
  if (rows.length === 0) return Response.json({ error: "Not one of your clients" }, { status: 403 });
  return Response.json(rows[0]);
}

// PATCH → update one of this partner's clients
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const id = parseInt((await params).id, 10);
  const owned = await partnerOwnsClient(r.scope.partnerId, id);
  if (!owned) return Response.json({ error: "Not one of your clients" }, { status: 403 });
  const b = await request.json();
  const rows = await sql`
    UPDATE clients SET
      business_name = COALESCE(${b.business_name ?? null}, business_name),
      contact_name  = COALESCE(${b.contact_name ?? null}, contact_name),
      phone         = COALESCE(${b.phone ?? null}, phone),
      email         = COALESCE(${b.email ?? null}, email),
      website       = COALESCE(${b.website ?? null}, website),
      notes         = COALESCE(${b.notes ?? null}, notes)
    WHERE id = ${id} AND partner_id = ${r.scope.partnerId}
    RETURNING *
  `;
  return Response.json(rows[0]);
}

// DELETE → remove one of this partner's clients (and its portal logins)
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const id = parseInt((await params).id, 10);
  const owned = await partnerOwnsClient(r.scope.partnerId, id);
  if (!owned) return Response.json({ error: "Not one of your clients" }, { status: 403 });
  await sql`DELETE FROM users WHERE role = 'client' AND client_id = ${id}`;
  await sql`DELETE FROM clients WHERE id = ${id} AND partner_id = ${r.scope.partnerId}`;
  return Response.json({ ok: true });
}
