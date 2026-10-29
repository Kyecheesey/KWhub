import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { sql, migrate } from "@/lib/db";

interface UserRow {
  id: number; name: string; username: string; password_hash: string;
  role: string | null; client_id: number | null; partner_id: number | null;
  allowed_sections: string | null;
}

// How often a signed-in session is checked against the users table, so a
// deleted login, a reset password or changed access takes effect within
// minutes instead of when the 30-day session cookie expires.
const RECHECK_MS = 5 * 60_000;

function parseSections(raw: string | null): string[] | null {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === "string");
  } catch { /* treat bad data as all-access */ }
  return null;
}

// Changes whenever the password does, without putting the hash in the token
function passwordVersion(hash: string): string {
  return createHash("sha256").update(hash).digest("hex").slice(0, 16);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        await migrate();
        const rows = await sql`
          SELECT * FROM users WHERE username = ${credentials.username as string}
        `;
        const user = rows[0] as unknown as UserRow | undefined;
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password as string, user.password_hash);
        if (!valid) return null;
        return {
          id: String(user.id),
          name: user.name,
          email: user.username,
          role: user.role ?? "staff",
          clientId: user.client_id,
          partnerId: user.partner_id,
          sections: parseSections(user.allowed_sections),
          pwv: passwordVersion(user.password_hash),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? "staff";
        token.clientId = (user as { clientId?: number | null }).clientId ?? null;
        token.partnerId = (user as { partnerId?: number | null }).partnerId ?? null;
        token.sections = (user as { sections?: string[] | null }).sections ?? null;
        token.pwv = (user as { pwv?: string }).pwv;
        token.checkedAt = Date.now();
        return token;
      }
      const due = Date.now() - ((token.checkedAt as number | undefined) ?? 0) > RECHECK_MS;
      if (!due && trigger !== "update") return token;
      try {
        const rows = await sql`
          SELECT id, name, username, password_hash, role, client_id, partner_id, allowed_sections
          FROM users WHERE id = ${Number(token.sub)}
        `;
        const u = rows[0] as unknown as UserRow | undefined;
        if (!u) return null; // login deleted: sign out
        const pwv = passwordVersion(u.password_hash);
        // Reset by someone else: sign out. The user's own change sends
        // trigger "update" (ChangePassword) and keeps them signed in.
        if (trigger !== "update" && token.pwv && token.pwv !== pwv) return null;
        token.name = u.name;
        token.email = u.username;
        token.role = u.role ?? "staff";
        token.clientId = u.client_id;
        token.partnerId = u.partner_id;
        token.sections = parseSections(u.allowed_sections);
        token.pwv = pwv;
        token.checkedAt = Date.now();
      } catch {
        // Database unreachable: keep the session and try again next request
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role =
          token.role === "client" ? "client" : token.role === "partner" ? "partner" : "staff";
        session.user.clientId = (token.clientId as number | null) ?? null;
        session.user.partnerId = (token.partnerId as number | null) ?? null;
        session.user.sections = (token.sections as string[] | null) ?? null;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
});
