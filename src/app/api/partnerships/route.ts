import bcrypt from "bcryptjs";
import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../auth";

// Kye-only management of partner organisations (e.g. GC Media Group):
// create partners, create their workspace logins, reset their passwords.
// Partner data itself lives behind /partner — this is just the directory.

const isKye = (session: { user?: { email?: string | null; name?: string | null } } | null) =>
  (session?.user?.name ?? "").toLowerCase() === "kye";

export async function GET() {
  await migrate();
  const session = await auth();
  if (!isKye(session)) return Response.json({ error: "Only Kye can manage partnerships" }, { status: 403 });
  const partners = await sql`
    SELECT p.*,
      (SELECT COUNT(*)::int FROM clients c WHERE c.partner_id = p.id) AS client_count,
      (SELECT COUNT(*)::int FROM posts po JOIN clients c ON c.id = po.client_id
        WHERE c.partner_id = p.id) AS post_count,
      COALESCE((SELECT json_agg(json_build_object(
        'id', u.id, 'name', u.name, 'username', u.username,
        'locked', u.password_hash = 'locked'
      ) ORDER BY u.id) FROM users u WHERE u.role = 'partner' AND u.partner_id = p.id), '[]') AS users
    FROM partners p
    ORDER BY p.name ASC
  `;
  return Response.json(partners);
}

export async function POST(request: Request) {
  await migrate();
  const session = await auth();
  if (!isKye(session)) return Response.json({ error: "Only Kye can manage partnerships" }, { status: 403 });
  const body = await request.json();

  if (body.action === "create_partner") {
    if (!body.name?.trim()) return Response.json({ error: "Partner name is required" }, { status: 400 });
    const slug = body.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const exists = await sql`SELECT 1 FROM partners WHERE slug = ${slug}`;
    if (exists.length > 0) return Response.json({ error: "A partner with that name already exists" }, { status: 409 });
    const rows = await sql`
      INSERT INTO partners (name, slug, contact_name, email, phone, notes)
      VALUES (${body.name.trim()}, ${slug}, ${body.contact_name ?? null}, ${body.email ?? null},
              ${body.phone ?? null}, ${body.notes ?? null})
      RETURNING *
    `;
    return Response.json(rows[0], { status: 201 });
  }

  if (body.action === "create_user") {
    const { partner_id, name, username, password } = body;
    if (!partner_id || !name?.trim() || !username?.trim() || !password) {
      return Response.json({ error: "partner_id, name, username and password are required" }, { status: 400 });
    }
    if (password.length < 8) return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    const uname = username.trim().toLowerCase();
    const taken = await sql`SELECT 1 FROM users WHERE username = ${uname}`;
    if (taken.length > 0) return Response.json({ error: "That username is already taken." }, { status: 409 });
    const hash = await bcrypt.hash(password, 12);
    const rows = await sql`
      INSERT INTO users (name, username, password_hash, role, partner_id)
      VALUES (${name.trim()}, ${uname}, ${hash}, 'partner', ${partner_id})
      RETURNING id, name, username
    `;
    return Response.json(rows[0], { status: 201 });
  }

  if (body.action === "reset_password") {
    const { username, new_password } = body;
    if (!username || !new_password || new_password.length < 8) {
      return Response.json({ error: "username and a new password of 8+ characters are required" }, { status: 400 });
    }
    const hash = await bcrypt.hash(new_password, 12);
    const rows = await sql`
      UPDATE users SET password_hash = ${hash}
      WHERE username = ${username.toLowerCase()} AND role = 'partner'
      RETURNING username
    `;
    if (rows.length === 0) return Response.json({ error: "Partner login not found" }, { status: 404 });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown action" }, { status: 400 });
}
