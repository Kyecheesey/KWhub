import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { sql, migrate } from "@/lib/db";

/**
 * Potential/client lookup for ProposalMe's "New proposal" screen, so the
 * client's name, company and email can be filled in from the hub. Only
 * ProposalMe's server can call it (HMAC-signed with PROPOSALME_WEBHOOK_SECRET,
 * 5-minute window). Returns KWI records only (no partner clients).
 * Public route (proxy allows it); the signature is the auth.
 */

const MAX_SKEW_MS = 5 * 60 * 1000;

function verify(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.PROPOSALME_WEBHOOK_SECRET?.trim();
  if (!secret) return Response.json({ error: "PROPOSALME_WEBHOOK_SECRET isn't set" }, { status: 503 });
  const rawBody = await request.text();
  if (!verify(rawBody, request.headers.get("x-proposalme-signature"), secret)) {
    return Response.json({ error: "Bad signature", key: createHash("sha256").update(secret).digest("hex").slice(0, 8) }, { status: 401 });
  }
  let body: { q?: string; at?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400 });
  }
  const sentAt = Date.parse(body.at ?? "");
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > MAX_SKEW_MS) {
    return Response.json({ error: "Stale request" }, { status: 400 });
  }
  const q = (body.q ?? "").trim().slice(0, 80);
  if (q.length < 2) return Response.json({ results: [] });

  await migrate();
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const [pots, clients] = await Promise.all([
    sql`
      SELECT id, business_name, contact_name, email, status FROM potentials
      WHERE business_name ILIKE ${like} OR contact_name ILIKE ${like} OR email ILIKE ${like}
      ORDER BY updated_at DESC NULLS LAST LIMIT 6
    `,
    sql`
      SELECT id, business_name, contact_name, email FROM clients
      WHERE partner_id IS NULL AND (business_name ILIKE ${like} OR contact_name ILIKE ${like} OR email ILIKE ${like})
      ORDER BY business_name LIMIT 6
    `,
  ]);
  const results = [
    ...pots.map((r) => ({ type: "potential", id: r.id, company: r.business_name, name: r.contact_name, email: r.email, status: r.status })),
    ...clients.map((r) => ({ type: "client", id: r.id, company: r.business_name, name: r.contact_name, email: r.email })),
  ];
  return Response.json({ results });
}
