import { sql } from "./db";
import { sendEmail } from "./email";
import { sendPush } from "./push";

/**
 * Best-effort portal notifications — failures are swallowed so the
 * triggering request always succeeds even when email isn't configured.
 */

/**
 * Welcome email when a portal login is created: username, sign-in link and
 * (when the creator opts in) the starting password. Sent to the client's
 * email on file plus the login username when it looks like an email.
 */
export async function sendPortalWelcome(opts: {
  clientId: number;
  businessName: string;
  username: string;
  password?: string;
  brandName: string;
}) {
  try {
    const rows = await sql`SELECT email FROM clients WHERE id = ${opts.clientId}`;
    const emails = new Set<string>();
    const onFile = (rows[0] as { email: string | null } | undefined)?.email;
    if (onFile) emails.add(onFile.toLowerCase());
    if (opts.username.includes("@")) emails.add(opts.username.toLowerCase());
    if (emails.size === 0) return { ok: false, error: "No email on file for this client." };
    const text =
      `Hi ${opts.businessName},\n\n` +
      `Your client portal with ${opts.brandName} is ready. Sign in any time to see your ` +
      `content for approval, projects and updates.\n\n` +
      `Sign in: https://kwinnovationshub.com.au/login (choose Client Portal)\n` +
      `Username: ${opts.username}\n` +
      (opts.password ? `Temporary password: ${opts.password}\n\nPlease change it after your first sign-in (Forgot password on the login page also works any time).\n` : `Your password: shared with you separately by ${opts.brandName}.\n`) +
      `\n— ${opts.brandName}`;
    const results = await Promise.all([...emails].map((to) =>
      sendEmail({ to, subject: `Your ${opts.brandName} client portal is ready`, text })
    ));
    return results.some((r) => r.ok) ? { ok: true } : { ok: false, error: results[0]?.error ?? "Email failed" };
  } catch {
    return { ok: false, error: "Email failed" };
  }
}

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
    const clientRows = await sql`SELECT assigned_to, partner_id FROM clients WHERE id = ${clientId}`;
    const clientRow = clientRows[0] as { assigned_to: string | null; partner_id: number | null } | undefined;
    const assigned = clientRow?.assigned_to ?? null;

    // Partner-owned clients notify their partner org (e.g. GC Media Group),
    // never KWI staff — the two businesses stay separate.
    if (clientRow?.partner_id) {
      const partnerUsers = await sql`
        SELECT username, email FROM users
        WHERE role = 'partner' AND partner_id = ${clientRow.partner_id}
      `;
      const rows = partnerUsers as { username: string; email: string | null }[];
      const emails = new Set(rows.map((r) => r.email?.toLowerCase()).filter(Boolean) as string[]);
      await Promise.all([
        ...[...emails].map((to) => sendEmail({ to, subject, text })),
        // Ping their phones too — partners live on push
        ...rows.map((r) => sendPush(r.username, { title: subject, body: text.slice(0, 180), url: "/partner" })),
      ]);
      return;
    }

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
