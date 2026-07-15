import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { sql, migrate } from "@/lib/db";
import { sendEmail } from "@/lib/email";

// Public route (middleware skips /api/auth/*). Responses never reveal
// whether an account exists — except for config errors, which are ours.
export async function POST(request: Request) {
  await migrate();
  const { username } = await request.json();
  if (!username?.trim()) {
    return Response.json({ error: "Username is required." }, { status: 400 });
  }
  const uname = username.trim().toLowerCase();
  const generic = {
    ok: true,
    message: "If that account has an email on file, a 6-digit code is on its way.",
  };

  const rows = await sql`
    SELECT u.username, u.role, u.email AS user_email, c.email AS client_email
    FROM users u
    LEFT JOIN clients c ON c.id = u.client_id
    WHERE u.username = ${uname}
  `;
  const user = rows[0] as { username: string; role: string; user_email: string | null; client_email: string | null } | undefined;
  const email = user?.user_email ?? user?.client_email ?? null;
  if (!user || !email) return Response.json(generic);

  const code = String(randomInt(100000, 1000000));
  const codeHash = await bcrypt.hash(code, 10);
  await sql`DELETE FROM password_resets WHERE username = ${uname}`;
  await sql`
    INSERT INTO password_resets (username, code_hash, expires_at)
    VALUES (${uname}, ${codeHash}, NOW() + INTERVAL '15 minutes')
  `;

  const sent = await sendEmail({
    to: email,
    subject: "Your KW Hub password reset code",
    text: [
      `Hi,`,
      ``,
      `Your KW Innovations Hub password reset code is: ${code}`,
      ``,
      `It expires in 15 minutes. If you didn't request this, you can ignore this email.`,
    ].join("\n"),
  });

  if (!sent.ok) {
    // Config problems are our fault, not an information leak — be clear.
    await sql`DELETE FROM password_resets WHERE username = ${uname}`;
    return Response.json({ error: sent.error }, { status: 503 });
  }

  return Response.json(generic);
}
