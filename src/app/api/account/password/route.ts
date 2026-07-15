import bcrypt from "bcryptjs";
import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../auth";

export async function POST(request: Request) {
  await migrate();
  const session = await auth();
  const me = session?.user?.email ?? ""; // email field holds the username (see auth.ts authorize)
  if (!me) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { username, current_password, new_password } = await request.json();
  if (!new_password || new_password.length < 8) {
    return Response.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  const target = (username ?? me).toLowerCase();
  const isAdminReset = target !== me.toLowerCase();

  if (isAdminReset) {
    // Only Kye can reset someone else's password
    if (me.toLowerCase() !== "kye") {
      return Response.json({ error: "Only Kye can reset other passwords." }, { status: 403 });
    }
  } else {
    // Changing your own password requires the current one
    const rows = await sql`SELECT password_hash FROM users WHERE username = ${target}`;
    const user = rows[0] as { password_hash: string } | undefined;
    if (!user) return Response.json({ error: "User not found." }, { status: 404 });
    const valid = await bcrypt.compare(current_password ?? "", user.password_hash);
    if (!valid) return Response.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  const hash = await bcrypt.hash(new_password, 12);
  const updated = await sql`
    UPDATE users SET password_hash = ${hash} WHERE username = ${target} RETURNING username
  `;
  if (updated.length === 0) return Response.json({ error: "User not found." }, { status: 404 });

  return Response.json({ ok: true, username: target });
}
