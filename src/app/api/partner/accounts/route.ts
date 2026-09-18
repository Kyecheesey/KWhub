import bcrypt from "bcryptjs";
import { sql, migrate } from "@/lib/db";
import { requirePartner, partnerOwnsClient } from "@/lib/partnerAuth";
import { sendPortalWelcome } from "@/lib/portalNotify";

// Portal logins for a partner's clients. Mirrors /api/portal/accounts but
// every operation first proves the client belongs to this partner org.

// GET ?client_id= → portal logins for one of this partner's clients
export async function GET(request: Request) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const clientId = parseInt(new URL(request.url).searchParams.get("client_id") ?? "", 10);
  if (!clientId) return Response.json({ error: "client_id is required" }, { status: 400 });
  const owned = await partnerOwnsClient(r.scope.partnerId, clientId);
  if (!owned) return Response.json({ error: "Not one of your clients" }, { status: 403 });
  const rows = await sql`
    SELECT id, name, username, created_at FROM users
    WHERE role = 'client' AND client_id = ${clientId}
    ORDER BY created_at ASC
  `;
  return Response.json(rows);
}

// POST {client_id, username, password, display_name?, send_welcome?, email_password?}
// → create a portal login, optionally emailing the client their details
export async function POST(request: Request) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const { client_id, username, password, display_name, send_welcome, email_password } = await request.json();
  if (!client_id || !username?.trim() || !password) {
    return Response.json({ error: "client_id, username and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  const owned = await partnerOwnsClient(r.scope.partnerId, client_id);
  if (!owned) return Response.json({ error: "Not one of your clients" }, { status: 403 });
  const uname = username.trim().toLowerCase();
  const taken = await sql`SELECT 1 FROM users WHERE username = ${uname}`;
  if (taken.length > 0) return Response.json({ error: "That username is already taken." }, { status: 409 });
  const hash = await bcrypt.hash(password, 12);
  const rows = await sql`
    INSERT INTO users (name, username, password_hash, role, client_id, partner_id)
    VALUES (${display_name?.trim() || owned.business_name}, ${uname}, ${hash}, 'client', ${client_id}, ${r.scope.partnerId})
    RETURNING id, name, username, created_at
  `;

  let welcome: { ok: boolean; error?: string } | null = null;
  if (send_welcome) {
    const partner = (await sql`SELECT name FROM partners WHERE id = ${r.scope.partnerId}`)[0] as { name: string } | undefined;
    welcome = await sendPortalWelcome({
      clientId: client_id,
      businessName: owned.business_name,
      username: uname,
      password: email_password ? password : undefined,
      brandName: partner?.name ?? "your agency",
    });
  }
  return Response.json({ ...rows[0], welcome }, { status: 201 });
}

// PATCH {username, new_password} → reset a portal password for this partner's client
export async function PATCH(request: Request) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const { username, new_password } = await request.json();
  if (!username || !new_password || new_password.length < 8) {
    return Response.json({ error: "username and a new password of 8+ characters are required" }, { status: 400 });
  }
  const hash = await bcrypt.hash(new_password, 12);
  const rows = await sql`
    UPDATE users u SET password_hash = ${hash}
    FROM clients c
    WHERE u.username = ${username.toLowerCase()} AND u.role = 'client'
      AND c.id = u.client_id AND c.partner_id = ${r.scope.partnerId}
    RETURNING u.username
  `;
  if (rows.length === 0) return Response.json({ error: "Portal login not found" }, { status: 404 });
  return Response.json({ ok: true });
}

// DELETE {username} → remove a portal login belonging to this partner's client
export async function DELETE(request: Request) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const { username } = await request.json();
  if (!username) return Response.json({ error: "username is required" }, { status: 400 });
  const rows = await sql`
    DELETE FROM users u
    USING clients c
    WHERE u.username = ${username.toLowerCase()} AND u.role = 'client'
      AND c.id = u.client_id AND c.partner_id = ${r.scope.partnerId}
    RETURNING u.username
  `;
  if (rows.length === 0) return Response.json({ error: "Portal login not found" }, { status: 404 });
  return Response.json({ ok: true });
}
