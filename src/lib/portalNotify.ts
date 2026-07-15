import { sql } from "./db";
import { sendEmail } from "./email";

/**
 * Best-effort portal notifications — failures are swallowed so the
 * triggering request always succeeds even when email isn't configured.
 */

export async function notifyClient(clientId: number, subject: string, text: string) {
  try {
    const rows = await sql`
      SELECT c.email AS client_email, u.email AS user_email
      FROM clients c
      LEFT JOIN users u ON u.client_id = c.id AND u.role = 'client'
      WHERE c.id = ${clientId}
    `;
    const emails = new Set<string>();
    for (const r of rows as { client_email: string | null; user_email: string | null }[]) {
      if (r.client_email) emails.add(r.client_email.toLowerCase());
      if (r.user_email) emails.add(r.user_email.toLowerCase());
    }
    await Promise.all([...emails].map((to) => sendEmail({ to, subject, text })));
  } catch {
    // never block the caller
  }
}

export async function notifyStaff(clientId: number, subject: string, text: string) {
  try {
    const clientRows = await sql`SELECT assigned_to FROM clients WHERE id = ${clientId}`;
    const assigned = (clientRows[0] as { assigned_to: string | null } | undefined)?.assigned_to ?? null;

    let staff = assigned
      ? await sql`SELECT email FROM users WHERE role = 'staff' AND email IS NOT NULL AND LOWER(name) = ${assigned.toLowerCase()}`
      : [];
    if (staff.length === 0) {
      staff = await sql`SELECT email FROM users WHERE role = 'staff' AND email IS NOT NULL`;
    }
    const emails = new Set((staff as { email: string }[]).map((r) => r.email.toLowerCase()));
    await Promise.all([...emails].map((to) => sendEmail({ to, subject, text })));
  } catch {
    // never block the caller
  }
}
