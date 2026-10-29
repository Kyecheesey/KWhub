import { sql } from "./db";

export interface Agent {
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
}

/**
 * The KWI staff member a client deals with: the first person named in
 * clients.assigned_to ("Luka + Kye") who has contact details on their staff
 * account, otherwise Kye as Managing Director. Partner clients have none.
 */
export async function clientAgent(clientId: number): Promise<Agent | null> {
  const rows = await sql`SELECT assigned_to, partner_id FROM clients WHERE id = ${clientId}`;
  const client = rows[0] as { assigned_to: string | null; partner_id: number | null } | undefined;
  if (!client || client.partner_id) return null;

  const staff = (await sql`
    SELECT name, username, title, phone, email FROM users
    WHERE COALESCE(role, 'staff') = 'staff'
  `) as unknown as (Agent & { username: string })[];
  const byName = (n: string) => staff.find((s) => s.name.toLowerCase() === n.toLowerCase());
  const named = (client.assigned_to ?? "")
    .split(/\s*(?:\+|&|,|\/|\band\b)\s*/i)
    .map((n) => byName(n.trim()))
    .filter((s): s is Agent & { username: string } => !!s);
  const pick =
    named.find((s) => s.phone || s.title) ??
    staff.find((s) => s.username === "kye") ??
    named[0];
  if (!pick) return null;
  return { name: pick.name, title: pick.title, phone: pick.phone, email: pick.email };
}
