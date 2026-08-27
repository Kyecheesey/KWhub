import { sql, migrate } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { notifyStaff } from "@/lib/portalNotify";

/**
 * Public IT support intake (/it-support form) — no login required.
 * Requests land on the Client Jobs board as kind='support'; when the
 * submitter matches a known client the ticket is attached to them and
 * shows in their portal. The director is always emailed.
 */

const SUPPORT_EMAIL = process.env.SUPPORT_NOTIFY_EMAIL ?? "director@kwinnovations.com.au";

export async function POST(request: Request) {
  await migrate();
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid request" }, { status: 400 });

  // Honeypot — bots fill every field; humans never see this one
  if (body.website) return Response.json({ ok: true });

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const business = String(body.business ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const title = String(body.title ?? "").trim();
  const details = String(body.details ?? "").trim();
  const priority = ["low", "medium", "high"].includes(body.priority) ? body.priority : "medium";

  if (!name || !title) return Response.json({ error: "Please tell us your name and what's wrong." }, { status: 400 });
  if (!email && !phone) return Response.json({ error: "Please leave an email or phone number so we can reach you." }, { status: 400 });
  if (title.length > 300 || details.length > 5000) return Response.json({ error: "That message is a bit long — please shorten it." }, { status: 400 });

  // Attach to a known client when we recognise the email or business name
  let client: { id: number; business_name: string } | undefined;
  if (email || business) {
    client = (await sql`
      SELECT id, business_name FROM clients
      WHERE (${email} != '' AND LOWER(email) = ${email.toLowerCase()})
         OR (${business} != '' AND business_name ILIKE ${business})
      ORDER BY (LOWER(email) = ${email.toLowerCase()}) DESC
      LIMIT 1
    `)[0] as { id: number; business_name: string } | undefined;
  }

  const contactLine = [`Submitted via kwinnovationshub.com.au/it-support by ${name}`,
    business && `Business: ${business}`, email && `Email: ${email}`, phone && `Phone: ${phone}`]
    .filter(Boolean).join(" · ");
  const description = details ? `${details}\n\n— ${contactLine}` : `— ${contactLine}`;

  const rows = await sql`
    INSERT INTO client_jobs (client_id, title, description, status, priority, kind, visible_to_client)
    VALUES (${client?.id ?? 0}, ${title}, ${description}, 'todo', ${priority}, 'support', ${!!client})
    RETURNING id
  `;
  const ticketId = (rows[0] as { id: number }).id;

  const summary =
    `New IT support request${priority === "high" ? " (URGENT)" : ""}\n\n` +
    `From: ${name}${business ? ` — ${business}` : ""}${client ? ` (matched to client: ${client.business_name})` : " (no matching client)"}\n` +
    `Contact: ${[email, phone].filter(Boolean).join(" · ") || "not provided"}\n\n` +
    `Issue: ${title}\n${details ? `\n${details}\n` : ""}\n` +
    `Ticket #${ticketId} — it's on the Client Jobs board.`;
  await sendEmail({ to: SUPPORT_EMAIL, subject: `IT Support #${ticketId}: ${title.slice(0, 80)}`, text: summary });
  if (client) {
    // Also notify the client's assigned staff member via the usual path
    await notifyStaff(client.id, `IT Support #${ticketId}: ${title.slice(0, 80)}`, summary);
  }

  return Response.json({ ok: true, ref: ticketId }, { status: 201 });
}
