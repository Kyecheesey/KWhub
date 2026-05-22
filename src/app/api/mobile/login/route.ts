import { compare } from "bcryptjs";
import { SignJWT } from "jose";
import { sql, migrate } from "@/lib/db";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  const { username, password } = await request.json();
  if (!username || !password) {
    return Response.json({ error: "username and password required" }, { status: 400, headers: corsHeaders });
  }
  await migrate();
  const rows = await sql`SELECT * FROM users WHERE username = ${username}`;
  const user = rows[0] as { id: number; name: string; username: string; password_hash: string } | undefined;
  if (!user) return Response.json({ error: "Invalid credentials" }, { status: 401, headers: corsHeaders });
  const valid = await compare(password, user.password_hash);
  if (!valid) return Response.json({ error: "Invalid credentials" }, { status: 401, headers: corsHeaders });

  const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
  const token = await new SignJWT({ name: user.name, username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);

  return Response.json({ token, name: user.name, username: user.username }, { headers: corsHeaders });
}
