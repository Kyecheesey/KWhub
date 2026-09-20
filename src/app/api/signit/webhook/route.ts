import { createHmac, timingSafeEqual } from "node:crypto";
import { sql, migrate } from "@/lib/db";

/**
 * Sign IT Digital webhook receiver — flips contract statuses the moment an
 * envelope completes, declines or expires (no manual sync needed).
 * Register https://<hub>/api/signit/webhook under Sign IT → Settings →
 * Webhooks and put the signing secret in SIGNIT_WEBHOOK_SECRET.
 * Public route (proxy allows it); the HMAC signature is the auth.
 */

function verify(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  try {
    const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
    const t = parts.t;
    const v1 = parts.v1;
    if (!t || !v1) return false;
    const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
    const a = Buffer.from(v1);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const EVENT_STATUS: Record<string, string> = {
  "envelope.completed": "completed",
  "envelope.declined": "declined",
  "envelope.expired": "voided",
};

export async function POST(request: Request) {
  const secret = process.env.SIGNIT_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "SIGNIT_WEBHOOK_SECRET isn't set" }, { status: 503 });

  const rawBody = await request.text();
  if (!verify(rawBody, request.headers.get("x-signit-signature"), secret)) {
    return Response.json({ error: "Bad signature" }, { status: 401 });
  }

  const event = request.headers.get("x-signit-event") ?? "";
  const status = EVENT_STATUS[event];
  if (!status) return Response.json({ ok: true, ignored: event });

  let envelopeId: string | undefined;
  try {
    const body = JSON.parse(rawBody) as { envelope?: { id?: string }; envelope_id?: string; id?: string };
    envelopeId = body.envelope?.id ?? body.envelope_id ?? body.id;
  } catch { /* fall through */ }
  if (!envelopeId) return Response.json({ error: "No envelope id in payload" }, { status: 400 });

  await migrate();
  const rows = await sql`
    UPDATE contracts SET
      status = ${status},
      completed_at = ${status === "completed" ? sql`COALESCE(completed_at, NOW())` : sql`completed_at`},
      updated_at = NOW()
    WHERE signit_envelope_id = ${envelopeId}
    RETURNING id, title
  `;
  return Response.json({ ok: true, updated: rows.length });
}
