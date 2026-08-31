import bcrypt from "bcryptjs";
import { sql, migrate } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendPush } from "@/lib/push";

/**
 * Public client sign-up (/signup form) — no login required.
 * Creates the business as a client (source='signup') with a portal login,
 * then notifies Kye by email and push about the new business.
 */

const SIGNUP_EMAIL = process.env.SIGNUP_NOTIFY_EMAIL ?? "director@kwinnovations.com.au";

export async function POST(request: Request) {
  await migrate();
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "Invalid request" }, { status: 400 });

  // Honeypot — bots fill every field; humans never see this one
  if (body.company) return Response.json({ ok: true });

  const business = String(body.business ?? "").trim();
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim();
  const website = String(body.website ?? "").trim();
  const about = String(body.about ?? "").trim();
  const password = String(body.password ?? "");

  if (!business || !name) {
    return Response.json({ error: "Please tell us your name and your business name." }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Please enter a valid email address — it becomes your portal login." }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "Please choose a password of at least 8 characters." }, { status: 400 });
  }
  if (business.length > 200 || name.length > 200 || about.length > 5000) {
    return Response.json({ error: "That's a bit long — please shorten it." }, { status: 400 });
  }

  // The email is the portal username, so it can only belong to one account
  const taken = await sql`SELECT 1 FROM users WHERE username = ${email}`;
  if (taken.length > 0) {
    return Response.json({ error: "An account already exists for that email — try signing in, or use Forgot password." }, { status: 409 });
  }

  // Self-signup is unverified, so it never attaches to an existing client's
  // portal — a lookalike could claim their data. Flag possible matches to
  // staff instead, who can merge from the hub.
  const match = (await sql`
    SELECT id, business_name FROM clients
    WHERE (LOWER(email) = ${email}) OR (business_name ILIKE ${business})
    ORDER BY (LOWER(email) = ${email}) DESC
    LIMIT 1
  `)[0] as { id: number; business_name: string } | undefined;

  const notes = [about && `About: ${about}`, `Signed up via kwinnovationshub.com.au/signup`]
    .filter(Boolean).join("\n");
  const client = (await sql`
    INSERT INTO clients (business_name, contact_name, phone, email, website, notes, source)
    VALUES (${business}, ${name}, ${phone || null}, ${email}, ${website || null}, ${notes}, 'signup')
    RETURNING id, business_name
  `)[0] as { id: number; business_name: string };

  const hash = await bcrypt.hash(password, 12);
  await sql`
    INSERT INTO users (name, username, email, password_hash, role, client_id)
    VALUES (${name}, ${email}, ${email}, ${hash}, 'client', ${client.id})
  `;

  // Tell Kye a new business signed up — email + push, best effort
  const summary =
    `New business signed up to the client portal\n\n` +
    `Business: ${business}${match ? ` — possible match to existing client "${match.business_name}" (#${match.id}), worth a merge check` : ""}\n` +
    `Contact: ${name}\n` +
    `Email: ${email}\n` +
    (phone ? `Phone: ${phone}\n` : "") +
    (website ? `Website: ${website}\n` : "") +
    (about ? `\nWhat they're after:\n${about}\n` : "") +
    `\nView them in the hub: https://kwinnovationshub.com.au/clients/${client.id}`;
  await sendEmail({ to: SIGNUP_EMAIL, subject: `New client sign-up: ${business}`, text: summary });
  await sendPush("kye", {
    title: "New client sign-up",
    body: `${business} — ${name}`,
    url: `/clients/${client.id}`,
  });

  // Welcome the new client — best effort, sign-up already succeeded
  await sendEmail({
    to: email,
    subject: "Welcome to the KW Innovations client portal",
    text:
      `Hi ${name.split(" ")[0]},\n\n` +
      `Thanks for signing up ${business} with KW Innovations — great to have you on board.\n\n` +
      `Your client portal is ready. Sign in with this email address at:\n` +
      `https://kwinnovationshub.com.au/login\n\n` +
      `Kye and the team have been notified and will be in touch shortly.\n\n` +
      `— KW Innovations`,
  });

  return Response.json({ ok: true }, { status: 201 });
}
