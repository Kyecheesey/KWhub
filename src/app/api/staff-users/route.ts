import bcrypt from "bcryptjs";
import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../auth";
import { ACCESS_SECTIONS } from "@/lib/nav";

// Kye-only management of staff logins and their hub section access
// (users.allowed_sections; NULL = all sections). Section changes take
// effect the next time that user signs in.

const isKye = (session: { user?: { name?: string | null } } | null) =>
  (session?.user?.name ?? "").toLowerCase() === "kye";

function cleanSections(input: unknown): string | null {
  if (!Array.isArray(input)) return null; // null/absent = all sections
  const valid = new Set(ACCESS_SECTIONS.map((s) => s.href));
  const keys = input.filter((k): k is string => typeof k === "string" && valid.has(k));
  return JSON.stringify(keys);
}

export async function GET() {
  await migrate();
  const session = await auth();
  if (!isKye(session)) return Response.json({ error: "Only Kye can manage users" }, { status: 403 });
  const rows = await sql`
    SELECT id, name, username, email, allowed_sections, password_hash = 'locked' AS locked
    FROM users WHERE role = 'staff'
    ORDER BY (LOWER(username) = 'kye') DESC, name ASC
  `;
  return Response.json({
    users: (rows as { allowed_sections: string | null }[]).map((u) => ({
      ...u,
      allowed_sections: u.allowed_sections ? (JSON.parse(u.allowed_sections) as string[]) : null,
    })),
    sections: ACCESS_SECTIONS,
  });
}

// POST {name, username, password, email?, sections?: string[]|null} → create a staff user
export async function POST(request: Request) {
  await migrate();
  const session = await auth();
  if (!isKye(session)) return Response.json({ error: "Only Kye can manage users" }, { status: 403 });
  const b = await request.json();
  if (!b.name?.trim() || !b.username?.trim() || !b.password) {
    return Response.json({ error: "name, username and password are required" }, { status: 400 });
  }
  if (b.password.length < 8) return Response.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  const uname = b.username.trim().toLowerCase();
  const taken = await sql`SELECT 1 FROM users WHERE username = ${uname}`;
  if (taken.length > 0) return Response.json({ error: "That username is already taken." }, { status: 409 });
  const hash = await bcrypt.hash(b.password, 12);
  const rows = await sql`
    INSERT INTO users (name, username, password_hash, role, email, allowed_sections)
    VALUES (${b.name.trim()}, ${uname}, ${hash}, 'staff',
            ${b.email?.trim() || `${uname}@kwinnovations.com.au`}, ${cleanSections(b.sections)})
    RETURNING id, name, username, email
  `;
  return Response.json(rows[0], { status: 201 });
}

// PATCH {id, sections?: string[]|null, name?, email?} → update a staff user
export async function PATCH(request: Request) {
  await migrate();
  const session = await auth();
  if (!isKye(session)) return Response.json({ error: "Only Kye can manage users" }, { status: 403 });
  const b = await request.json();
  if (!b.id) return Response.json({ error: "id is required" }, { status: 400 });
  const rows = await sql`
    UPDATE users SET
      allowed_sections = ${b.sections !== undefined ? cleanSections(b.sections) : sql`allowed_sections`},
      name = COALESCE(${b.name?.trim() || null}, name),
      email = COALESCE(${b.email?.trim() || null}, email)
    WHERE id = ${b.id} AND role = 'staff'
    RETURNING id, name, username, allowed_sections
  `;
  if (rows.length === 0) return Response.json({ error: "User not found" }, { status: 404 });
  return Response.json(rows[0]);
}

// DELETE {id} → remove a staff user (never Kye)
export async function DELETE(request: Request) {
  await migrate();
  const session = await auth();
  if (!isKye(session)) return Response.json({ error: "Only Kye can manage users" }, { status: 403 });
  const { id } = await request.json();
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });
  const rows = await sql`
    DELETE FROM users WHERE id = ${id} AND role = 'staff' AND LOWER(username) != 'kye'
    RETURNING username
  `;
  if (rows.length === 0) return Response.json({ error: "User not found (Kye can't be deleted)" }, { status: 404 });
  return Response.json({ ok: true });
}
