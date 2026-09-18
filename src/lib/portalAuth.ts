import { auth } from "../../auth";
import { sql } from "@/lib/db";

export interface PortalScope {
  clientId: number;
  role: "staff" | "client";
  name: string | null;
  username: string | null;
}

/**
 * Resolve which client's portal data a request may touch.
 * Clients are always locked to their own client_id; staff pass ?client_id=
 * (GET) or client_id in the body (mutations, resolved by the caller).
 * Partner users (e.g. GC Media Group) act as the managing side too, but only
 * for clients belonging to their own partner org — KWI and partner data
 * never cross.
 */
export async function resolvePortalScope(
  request: Request,
  opts: { staffOnly?: boolean; bodyClientId?: number | null } = {}
): Promise<{ scope: PortalScope } | { error: Response }> {
  const session = await auth();
  if (!session?.user) {
    return { error: Response.json({ error: "Not signed in" }, { status: 401 }) };
  }
  const role = session.user.role;
  const name = session.user.name ?? null;
  const username = session.user.email ?? null;

  if (role === "client") {
    if (opts.staffOnly) {
      return { error: Response.json({ error: "Staff only" }, { status: 403 }) };
    }
    if (!session.user.clientId) {
      return { error: Response.json({ error: "No linked client" }, { status: 403 }) };
    }
    return { scope: { clientId: session.user.clientId, role, name, username } };
  }

  const fromBody = opts.bodyClientId;
  const fromQuery = new URL(request.url).searchParams.get("client_id");
  const clientId = fromBody ?? (fromQuery ? parseInt(fromQuery, 10) : NaN);
  if (!clientId || Number.isNaN(clientId)) {
    return { error: Response.json({ error: "client_id is required" }, { status: 400 }) };
  }

  if (role === "partner") {
    const partnerId = session.user.partnerId;
    if (!partnerId) {
      return { error: Response.json({ error: "No linked partner" }, { status: 403 }) };
    }
    const owned = await sql`SELECT 1 FROM clients WHERE id = ${clientId} AND partner_id = ${partnerId}`;
    if (owned.length === 0) {
      return { error: Response.json({ error: "Not one of your clients" }, { status: 403 }) };
    }
  }

  return { scope: { clientId, role: "staff", name, username } };
}
