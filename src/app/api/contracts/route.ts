import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../auth";
import { logEvent } from "@/lib/events";
import { createEnvelope, getEnvelope, signitConfigured, signitEnvelopeUrl } from "@/lib/signit";

async function staffSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== "staff") return null;
  return session;
}

// GET ?sync=1 → contracts with client names; sync=1 also refreshes any
// non-final Sign IT envelopes first (best effort).
export async function GET(request: Request) {
  await migrate();
  const session = await staffSession();
  if (!session) return Response.json({ error: "Staff only" }, { status: 403 });

  if (new URL(request.url).searchParams.get("sync") === "1" && signitConfigured()) {
    const open = await sql`
      SELECT id, signit_envelope_id FROM contracts
      WHERE signit_envelope_id IS NOT NULL AND status NOT IN ('completed', 'voided', 'declined')
      LIMIT 25
    `;
    await Promise.all((open as { id: number; signit_envelope_id: string }[]).map(async (c) => {
      const r = await getEnvelope(c.signit_envelope_id);
      if (!r.ok) return;
      await sql`
        UPDATE contracts SET
          status = ${r.envelope.status},
          sent_at = COALESCE(${r.envelope.sent_at ?? null}, sent_at),
          completed_at = COALESCE(${r.envelope.completed_at ?? null}, completed_at),
          updated_at = NOW()
        WHERE id = ${c.id}
      `;
    }));
  }

  const rows = await sql`
    SELECT ct.*, c.business_name
    FROM contracts ct
    LEFT JOIN clients c ON c.id = ct.client_id
    ORDER BY (ct.status IN ('completed', 'voided', 'declined')) ASC, ct.created_at DESC
  `;
  return Response.json({
    contracts: rows,
    signit_connected: signitConfigured(),
    signit_url: (process.env.SIGNIT_APP_URL ?? "https://signitdigital.com").replace(/\/$/, ""),
  });
}

// POST → create a contract; with pdf_base64 (and Sign IT connected) it also
// creates a draft envelope in Sign IT and returns the editor deep link.
export async function POST(request: Request) {
  await migrate();
  const session = await staffSession();
  if (!session) return Response.json({ error: "Staff only" }, { status: 403 });
  const b = await request.json();
  if (!b.title?.trim()) return Response.json({ error: "A contract title is required" }, { status: 400 });

  let envelopeId: string | null = null;
  let status = "draft";
  let signitError: string | null = null;

  if (b.pdf_base64) {
    if (!signitConfigured()) {
      signitError = "Sign IT isn't connected yet (SIGNIT_API_KEY missing) — contract saved as a manual record.";
    } else {
      const recipients = (b.counterparty_email?.trim()
        ? [{ name: b.counterparty_name?.trim() || b.counterparty_email.trim(), email: b.counterparty_email.trim() }]
        : []) as { name: string; email: string }[];
      const r = await createEnvelope({
        title: b.title.trim(),
        pdfBase64: b.pdf_base64,
        message: b.notes?.trim() || undefined,
        recipients,
      });
      if (r.ok) {
        envelopeId = r.envelope.id;
        status = r.envelope.status || "draft";
      } else {
        signitError = `${r.error} — contract saved as a manual record.`;
      }
    }
  }

  const rows = await sql`
    INSERT INTO contracts (client_id, counterparty_name, counterparty_email, title, status, signit_envelope_id, notes, created_by)
    VALUES (${b.client_id || null}, ${b.counterparty_name?.trim() || null}, ${b.counterparty_email?.trim() || null},
            ${b.title.trim()}, ${status}, ${envelopeId}, ${b.notes?.trim() || null}, ${session.user.name ?? null})
    RETURNING *
  `;
  const created = rows[0] as { id: number };
  await logEvent({ entity_type: "contract", entity_id: created.id, entity_name: b.title.trim(), actor: session.user.name ?? undefined, action: "created" });
  return Response.json({
    ...rows[0],
    signit_error: signitError,
    signit_editor_url: envelopeId ? signitEnvelopeUrl(envelopeId) : null,
  }, { status: 201 });
}
