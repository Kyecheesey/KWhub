import bcrypt from "bcryptjs";
import { sql, migrate } from "@/lib/db";

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  await migrate();
  const { username, code, new_password } = await request.json();
  if (!username?.trim() || !code?.trim() || !new_password) {
    return Response.json({ error: "Username, code and new password are required." }, { status: 400 });
  }
  if (new_password.length < 8) {
    return Response.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }
  const uname = username.trim().toLowerCase();

  const rows = await sql`
    SELECT * FROM password_resets
    WHERE username = ${uname} AND used = FALSE
    ORDER BY created_at DESC LIMIT 1
  `;
  const reset = rows[0] as {
    id: number; code_hash: string; expires_at: string; attempts: number;
  } | undefined;

  const invalid = Response.json({ error: "Invalid or expired code. Request a new one." }, { status: 400 });
  if (!reset) return invalid;
  if (new Date(reset.expires_at) < new Date() || reset.attempts >= MAX_ATTEMPTS) {
    await sql`DELETE FROM password_resets WHERE id = ${reset.id}`;
    return invalid;
  }

  const match = await bcrypt.compare(code.trim(), reset.code_hash);
  if (!match) {
    await sql`UPDATE password_resets SET attempts = attempts + 1 WHERE id = ${reset.id}`;
    return invalid;
  }

  const hash = await bcrypt.hash(new_password, 12);
  const updated = await sql`
    UPDATE users SET password_hash = ${hash} WHERE username = ${uname} RETURNING username
  `;
  await sql`UPDATE password_resets SET used = TRUE WHERE id = ${reset.id}`;
  if (updated.length === 0) return invalid;

  return Response.json({ ok: true });
}
