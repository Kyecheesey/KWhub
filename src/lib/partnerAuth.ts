import { auth } from "../../auth";
import { sql } from "@/lib/db";

export interface PartnerScope {
  partnerId: number;
  name: string | null;
  username: string | null;
}

/** Require a signed-in partner user (e.g. GC Media Group). */
export async function requirePartner(): Promise<{ scope: PartnerScope } | { error: Response }> {
  const session = await auth();
  if (!session?.user) {
    return { error: Response.json({ error: "Not signed in" }, { status: 401 }) };
  }
  if (session.user.role !== "partner" || !session.user.partnerId) {
    return { error: Response.json({ error: "Partner access only" }, { status: 403 }) };
  }
  return {
    scope: {
      partnerId: session.user.partnerId,
      name: session.user.name ?? null,
      username: session.user.email ?? null,
    },
  };
}

/** Assert a client belongs to this partner; returns the client row or null. */
export async function partnerOwnsClient(partnerId: number, clientId: number) {
  const rows = await sql`
    SELECT id, business_name FROM clients
    WHERE id = ${clientId} AND partner_id = ${partnerId}
  `;
  return (rows[0] as { id: number; business_name: string } | undefined) ?? null;
}
