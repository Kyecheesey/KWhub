import { sql, migrate } from "@/lib/db";
import { resolvePortalScope } from "@/lib/portalAuth";
import { getStripe } from "@/lib/stripe";

const INTERVALS = ["month", "quarter", "year"];

// GET → the client's billing plan (shown on the portal's Billing tab)
export async function GET(request: Request) {
  await migrate();
  const r = await resolvePortalScope(request);
  if ("error" in r) return r.error;
  const rows = await sql`
    SELECT plan_name, plan_amount_cents, plan_interval, stripe_customer_id FROM clients WHERE id = ${r.scope.clientId}
  `;
  const row = rows[0] as { plan_name: string | null; plan_amount_cents: number | null; plan_interval: string | null; stripe_customer_id: string | null } | undefined;
  if (!row) return Response.json({ error: "Client not found" }, { status: 404 });
  const { stripe_customer_id, ...plan } = row;
  // online_billing → the portal shows "Manage billing" (Stripe billing portal)
  return Response.json({ ...plan, online_billing: !!stripe_customer_id && !!getStripe() });
}

// PATCH {client_id, plan_name, amount, interval} → staff set the plan (blank name clears it)
export async function PATCH(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  const name = typeof body.plan_name === "string" ? body.plan_name.trim() : "";
  let cents: number | null = null;
  let interval: string | null = null;
  if (name) {
    cents = Math.round(Number(body.amount) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      return Response.json({ error: "A positive amount is required" }, { status: 400 });
    }
    interval = INTERVALS.includes(body.interval) ? body.interval : "month";
  }
  const rows = await sql`
    UPDATE clients SET plan_name = ${name || null}, plan_amount_cents = ${cents}, plan_interval = ${interval}
    WHERE id = ${r.scope.clientId}
    RETURNING plan_name, plan_amount_cents, plan_interval
  `;
  if (rows.length === 0) return Response.json({ error: "Client not found" }, { status: 404 });
  return Response.json(rows[0]);
}
