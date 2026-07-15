import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../auth";

// Set the recovery email for a user (yourself, or anyone if you're Kye).
export async function POST(request: Request) {
  await migrate();
  const session = await auth();
  const me = session?.user?.email ?? ""; // username lives in the email field
  if (!me) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { username, email } = await request.json();
  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return Response.json({ error: "A valid email address is required." }, { status: 400 });
  }
  const target = (username ?? me).toLowerCase();
  if (target !== me.toLowerCase() && me.toLowerCase() !== "kye") {
    return Response.json({ error: "Only Kye can set other users' emails." }, { status: 403 });
  }

  const rows = await sql`
    UPDATE users SET email = ${email.trim().toLowerCase()} WHERE username = ${target} RETURNING username, email
  `;
  if (rows.length === 0) return Response.json({ error: "User not found." }, { status: 404 });
  return Response.json({ ok: true, ...rows[0] });
}
