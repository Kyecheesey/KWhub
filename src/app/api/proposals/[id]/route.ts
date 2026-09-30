import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../auth";
import { logEvent } from "@/lib/events";

async function staffSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== "staff") return null;
  return session;
}

// PATCH { potential_id } | { client_id } | { unlink: true } → link a proposal to a hub record.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const session = await staffSession();
  if (!session) return Response.json({ error: "Staff only" }, { status: 403 });
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) return Response.json({ error: "Bad id" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { potential_id?: number | null; client_id?: number | null; unlink?: boolean };
  const found = await sql`SELECT id, title FROM proposals WHERE id = ${id}`;
  if (!found[0]) return Response.json({ error: "Not found" }, { status: 404 });
  const title = found[0].title as string;

  if (body.unlink) {
    await sql`UPDATE proposals SET potential_id = NULL, client_id = NULL, updated_at = NOW() WHERE id = ${id}`;
    return Response.json({ ok: true });
  }
  if (body.potential_id) {
    const r = await sql`SELECT id, business_name FROM potentials WHERE id = ${body.potential_id}`;
    if (!r[0]) return Response.json({ error: "Potential not found" }, { status: 404 });
    await sql`UPDATE proposals SET potential_id = ${body.potential_id}, client_id = NULL, updated_at = NOW() WHERE id = ${id}`;
    await logEvent({ entity_type: "potential", entity_id: body.potential_id, entity_name: r[0].business_name as string, action: "proposal_linked", detail: title });
    return Response.json({ ok: true });
  }
  if (body.client_id) {
    const r = await sql`SELECT id, business_name FROM clients WHERE id = ${body.client_id}`;
    if (!r[0]) return Response.json({ error: "Client not found" }, { status: 404 });
    await sql`UPDATE proposals SET client_id = ${body.client_id}, potential_id = NULL, updated_at = NOW() WHERE id = ${id}`;
    await logEvent({ entity_type: "client", entity_id: body.client_id, entity_name: r[0].business_name as string, action: "proposal_linked", detail: title });
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Nothing to change" }, { status: 400 });
}

// DELETE → remove the hub's mirror row (the proposal itself stays in ProposalMe).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const session = await staffSession();
  if (!session) return Response.json({ error: "Staff only" }, { status: 403 });
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) return Response.json({ error: "Bad id" }, { status: 400 });
  await sql`DELETE FROM proposals WHERE id = ${id}`;
  return Response.json({ ok: true });
}
