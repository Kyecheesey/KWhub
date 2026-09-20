import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      role: "staff" | "client" | "partner";
      clientId: number | null;
      partnerId: number | null;
      /** Hub sections this staff user may open; null = all sections */
      sections: string[] | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    clientId?: number | null;
    partnerId?: number | null;
    sections?: string[] | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    clientId?: number | null;
    partnerId?: number | null;
    sections?: string[] | null;
  }
}
