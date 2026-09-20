import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../auth";
import { getEnvelope, signitConfigured } from "@/lib/signit";

const STATUSES = ["draft", "sent", "completed", "declined", "voided"];

async function staffSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== "staff") return null;
  return session;
}

// PATCH → update fields; {sync: true} refreshes status from Sign IT instead
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const session = await staffSession();
  if (!session) return Response.json({ error: "Staff only" }, { status: 403 });
  const { id } = await params;
  const b = await request.json();

  const existing = (await sql`SELECT * FROM contracts WHERE id = ${id}`)[0] as
    | { id: number; status: string; signit_envelope_id: string | null }
    | undefined;
  if (!existing) return Response.json({ error: "Contract not found" }, { status: 404 });

  if (b.sync) {
    if (!existing.signit_envelope_id) return Response.json({ error: "This contract isn't linked to Sign IT." }, { status: 400 });
    if (!signitConfigured()) return Response.json({ error: "Sign IT isn't connected yet (SIGNIT_API_KEY missing)." }, { status: 503 });
    const r = await getEnvelope(existing.signit_envelope_id);
    if (!r.ok) return Response.json({ error: r.error }, { status: 502 });
    const rows = await sql`
      UPDATE contracts SET
        status = ${r.envelope.status},
        sent_at = COALESCE(${r.envelope.sent_at ?? null}, sent_at),
        completed_at = COALESCE(${r.envelope.completed_at ?? null}, completed_at),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return Response.json({ ...rows[0], recipients: r.envelope.recipients ?? [] });
  }

  const status = b.status !== undefined ? b.status : existing.status;
  if (!STATUSES.includes(status)) return Response.json({ error: "Invalid status" }, { status: 400 });
  const rows = await sql`
    UPDATE contracts SET
      title = COALESCE(${b.title?.trim() || null}, title),
      client_id = ${b.client_id !== undefined ? (b.client_id || null) : sql`client_id`},
      counterparty_name = ${b.counterparty_name !== undefined ? (b.counterparty_name?.trim() || null) : sql`counterparty_name`},
      counterparty_email = ${b.counterparty_email !== undefined ? (b.counterparty_email?.trim() || null) : sql`counterparty_email`},
      notes = ${b.notes !== undefined ? (b.notes?.trim() || null) : sql`notes`},
      status = ${status},
      completed_at = ${status === "completed" ? sql`COALESCE(completed_at, NOW())` : sql`completed_at`},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
  return Response.json(rows[0]);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await migrate();
  const session = await staffSession();
  if (!session) return Response.json({ error: "Staff only" }, { status: 403 });
  const { id } = await params;
  await sql`DELETE FROM contracts WHERE id = ${id}`;
  return Response.json({ ok: true });
}
