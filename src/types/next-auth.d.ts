import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      role: "staff" | "client" | "partner";
      clientId: number | null;
      partnerId: number | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    clientId?: number | null;
    partnerId?: number | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    clientId?: number | null;
    partnerId?: number | null;
  }
}
