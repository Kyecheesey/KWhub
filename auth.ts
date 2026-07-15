import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { sql, migrate } from "@/lib/db";

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
        const user = rows[0] as {
          id: number; name: string; username: string; password_hash: string;
          role: string | null; client_id: number | null;
        } | undefined;
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password as string, user.password_hash);
        if (!valid) return null;
        return {
          id: String(user.id),
          name: user.name,
          email: user.username,
          role: user.role ?? "staff",
          clientId: user.client_id,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role ?? "staff";
        token.clientId = (user as { clientId?: number | null }).clientId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role === "client" ? "client" : "staff";
        session.user.clientId = (token.clientId as number | null) ?? null;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
});
