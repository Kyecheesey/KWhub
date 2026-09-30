import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { sql, migrate } from "@/lib/db";
import { sectionAllowed } from "@/lib/nav";

/**
 * Credential check for ProposalMe, so staff sign in there with their hub
 * username and password. Only ProposalMe's server can call it: the request
 * body is signed with the same shared secret as the webhook
 * (PROPOSALME_WEBHOOK_SECRET), and must be fresh. ProposalMe issues its own
 * session afterwards; nothing about the password is stored there.
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
  const secret = process.env.PROPOSALME_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "PROPOSALME_WEBHOOK_SECRET isn't set" }, { status: 503 });

  const rawBody = await request.text();
  if (!verify(rawBody, request.headers.get("x-proposalme-signature"), secret)) {
    return Response.json({ error: "Bad signature" }, { status: 401 });
  }
  let body: { username?: string; password?: string; at?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400 });
  }
  const sentAt = Date.parse(body.at ?? "");
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > MAX_SKEW_MS) {
    return Response.json({ error: "Stale request" }, { status: 400 });
  }
  const username = (body.username ?? "").trim();
  if (!username || !body.password) return Response.json({ error: "Wrong username or password" }, { status: 401 });

  await migrate();
  const rows = await sql`SELECT name, username, password_hash, role, allowed_sections FROM users WHERE username = ${username}`;
  const user = rows[0] as { name: string; username: string; password_hash: string; role: string | null; allowed_sections: string | null } | undefined;
  // Same response for an unknown user and a wrong password.
  if (!user || !(await bcrypt.compare(body.password, user.password_hash))) {
    return Response.json({ error: "Wrong username or password" }, { status: 401 });
  }
  if ((user.role ?? "staff") !== "staff") {
    return Response.json({ error: "Only KW team accounts can sign in to ProposalMe" }, { status: 403 });
  }
  // Respect Management → Users & access: Kye always, others need the Proposals section.
  let sections: string[] | null = null;
  try {
    const parsed = user.allowed_sections ? JSON.parse(user.allowed_sections) : null;
    if (Array.isArray(parsed)) sections = parsed.filter((s): s is string => typeof s === "string");
  } catch { /* bad data = all access, as at hub sign-in */ }
  if (user.name.toLowerCase() !== "kye" && !sectionAllowed("/proposals", sections)) {
    return Response.json({ error: "Your hub account doesn't have access to Proposals" }, { status: 403 });
  }
  return Response.json({ ok: true, user: { name: user.name, username: user.username } });
}
