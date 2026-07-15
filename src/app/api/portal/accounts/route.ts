import bcrypt from "bcryptjs";
import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../auth";

async function requireStaff() {
  const session = await auth();
  if (!session?.user) return { error: Response.json({ error: "Not signed in" }, { status: 401 }) };
  if (session.user.role === "client") return { error: Response.json({ error: "Staff only" }, { status: 403 }) };
  return { session };
}

// GET ?client_id= → the portal login (if any) for a client
export async function GET(request: Request) {
  await migrate();
  const r = await requireStaff();
  if ("error" in r) return r.error;
  const clientId = new URL(request.url).searchParams.get("client_id");
  if (!clientId) return Response.json({ error: "client_id is required" }, { status: 400 });
  const rows = await sql`
    SELECT id, name, username, created_at FROM users
    WHERE role = 'client' AND client_id = ${parseInt(clientId, 10)}
  `;
  return Response.json(rows[0] ?? null);
}

// POST {client_id, username, password} → create a portal login for a client
export async function POST(request: Request) {
  await migrate();
  const r = await requireStaff();
  if ("error" in r) return r.error;
  const { client_id, username, password } = await request.json();
  if (!client_id || !username?.trim() || !password) {
    return Response.json({ error: "client_id, username and password are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  const uname = username.trim().toLowerCase();

  const clientRows = await sql`SELECT business_name FROM clients WHERE id = ${client_id}`;
  const client = clientRows[0] as { business_name: string } | undefined;
  if (!client) return Response.json({ error: "Client not found" }, { status: 404 });

  const taken = await sql`SELECT 1 FROM users WHERE username = ${uname}`;
  if (taken.length > 0) return Response.json({ error: "That username is already taken." }, { status: 409 });

  const existing = await sql`SELECT 1 FROM users WHERE role = 'client' AND client_id = ${client_id}`;
  if (existing.length > 0) return Response.json({ error: "This client already has a portal login." }, { status: 409 });

  const hash = await bcrypt.hash(password, 12);
  const rows = await sql`
    INSERT INTO users (name, username, password_hash, role, client_id)
    VALUES (${client.business_name}, ${uname}, ${hash}, 'client', ${client_id})
    RETURNING id, name, username, created_at
  `;
  return Response.json(rows[0], { status: 201 });
}

// PATCH {username, new_password} → reset a client portal password (staff)
export async function PATCH(request: Request) {
  await migrate();
  const r = await requireStaff();
  if ("error" in r) return r.error;
  const { username, new_password } = await request.json();
  if (!username || !new_password || new_password.length < 8) {
    return Response.json({ error: "username and a new password of 8+ characters are required" }, { status: 400 });
  }
  const hash = await bcrypt.hash(new_password, 12);
  const rows = await sql`
    UPDATE users SET password_hash = ${hash}
    WHERE username = ${username.toLowerCase()} AND role = 'client'
    RETURNING username
  `;
  if (rows.length === 0) return Response.json({ error: "Portal login not found" }, { status: 404 });
  return Response.json({ ok: true });
}

// DELETE {username} → remove a client's portal access (staff)
export async function DELETE(request: Request) {
  await migrate();
  const r = await requireStaff();
  if ("error" in r) return r.error;
  const { username } = await request.json();
  if (!username) return Response.json({ error: "username is required" }, { status: 400 });
  const rows = await sql`
    DELETE FROM users WHERE username = ${username.toLowerCase()} AND role = 'client'
    RETURNING username
  `;
  if (rows.length === 0) return Response.json({ error: "Portal login not found" }, { status: 404 });
  return Response.json({ ok: true });
}
