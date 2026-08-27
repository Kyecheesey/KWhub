import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../auth";
import { oauthConfigured, PLATFORMS } from "@/lib/social/platforms";

async function staffSession() {
  const session = await auth();
  if (!session?.user || session.user.role === "client") return null;
  return session;
}

// GET /api/social-accounts?client_id= — never leaks tokens to the browser
export async function GET(request: Request) {
  await migrate();
  const session = await staffSession();
  if (!session) return Response.json({ error: "Staff only" }, { status: 403 });
  const p = new URL(request.url).searchParams;
  const clientId = p.get("client_id") ? parseInt(p.get("client_id")!, 10) : null;
  const rows = await sql`
    SELECT id, client_id, platform, account_name, status, connected_by, created_at,
           (access_token IS NOT NULL) AS has_token, token_expires_at
    FROM social_accounts
    WHERE (${clientId}::int IS NULL OR client_id = ${clientId})
    ORDER BY platform, account_name
  `;
  return Response.json({ accounts: rows, oauth: oauthConfigured(), platforms: PLATFORMS });
}

// POST /api/social-accounts — add a manual (no-token) account so the channel
// shows on the calendar even before OAuth is set up for that platform
export async function POST(request: Request) {
  await migrate();
  const session = await staffSession();
  if (!session) return Response.json({ error: "Staff only" }, { status: 403 });
  const body = await request.json();
  const clientId = parseInt(body.client_id, 10);
  if (!clientId) return Response.json({ error: "client_id is required" }, { status: 400 });
  if (!body.platform || !body.account_name?.trim()) {
    return Response.json({ error: "platform and account_name are required" }, { status: 400 });
  }
  const rows = await sql`
    INSERT INTO social_accounts (client_id, platform, account_name, status, connected_by)
    VALUES (${clientId}, ${body.platform}, ${body.account_name.trim()}, 'manual', ${session.user.name ?? null})
    RETURNING id, client_id, platform, account_name, status, connected_by, created_at
  `;
  return Response.json(rows[0], { status: 201 });
}

export async function DELETE(request: Request) {
  await migrate();
  const session = await staffSession();
  if (!session) return Response.json({ error: "Staff only" }, { status: 403 });
  const body = await request.json();
  await sql`DELETE FROM social_accounts WHERE id = ${body.id}`;
  await sql`UPDATE post_channels SET social_account_id = NULL WHERE social_account_id = ${body.id}`;
  return Response.json({ ok: true });
}
