import type Stripe from "stripe";
import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../auth";
import { logEvent } from "@/lib/events";
import { getStripe, syncCustomerInvoices, DAYS_UNTIL_DUE } from "@/lib/stripe";

// KWI staff only: this is KWI's own Stripe account, so partner orgs (and
// clients) never reach it — proxy.ts keeps both out of /api/stripe too.
async function requireStaff() {
  const session = await auth();
  if (!session?.user) return { error: Response.json({ error: "Not signed in" }, { status: 401 }) };
  if (session.user.role !== "staff") return { error: Response.json({ error: "Staff only" }, { status: 403 }) };
  return { session };
}

interface ClientRow {
  id: number; business_name: string; email: string | null; partner_id: number | null;
  plan_name: string | null; plan_amount_cents: number | null; plan_interval: string | null;
  stripe_customer_id: string | null; stripe_subscription_id: string | null;
}

async function loadClient(id: number): Promise<ClientRow | undefined> {
  const rows = await sql`
    SELECT id, business_name, email, partner_id, plan_name, plan_amount_cents, plan_interval,
      stripe_customer_id, stripe_subscription_id
    FROM clients WHERE id = ${id}
  `;
  return rows[0] as unknown as ClientRow | undefined;
}

// GET ?client_id= → the client's Stripe link and subscription status
export async function GET(request: Request) {
  await migrate();
  const r = await requireStaff();
  if ("error" in r) return r.error;
  const id = parseInt(new URL(request.url).searchParams.get("client_id") ?? "", 10);
  const client = Number.isNaN(id) ? undefined : await loadClient(id);
  if (!client) return Response.json({ error: "Client not found" }, { status: 404 });
  const stripe = getStripe();
  let subscription: { status: string; amount_cents: number | null; interval: string | null; next_invoice_at: string | null } | null = null;
  if (stripe && client.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(client.stripe_subscription_id);
      const item = sub.items.data[0];
      subscription = {
        status: sub.status,
        amount_cents: item?.price.unit_amount ?? null,
        interval: item?.price.recurring?.interval ?? null,
        next_invoice_at: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
      };
    } catch { /* deleted in Stripe; the webhook clears it */ }
  }
  return Response.json({
    configured: !!stripe,
    webhook_configured: !!process.env.STRIPE_WEBHOOK_SECRET?.trim(),
    customer_id: client.stripe_customer_id,
    subscription_id: client.stripe_subscription_id,
    subscription,
  });
}

// POST {client_id, action, customer_id?}
//   link       → attach an existing Stripe customer (cus_…), pick up its subscription and invoices
//   subscribe  → create the customer if needed, then a subscription for the client's plan,
//                invoiced each period and payable by link within DAYS_UNTIL_DUE days
//   sync       → re-pull the customer's invoices into the portal
//   unlink     → detach (nothing is changed or cancelled in Stripe)
export async function POST(request: Request) {
  await migrate();
  const r = await requireStaff();
  if ("error" in r) return r.error;
  const stripe = getStripe();
  if (!stripe) return Response.json({ error: "Stripe isn't connected yet: add STRIPE_SECRET_KEY in Vercel." }, { status: 503 });
  const body = await request.json();
  const client = await loadClient(parseInt(String(body.client_id), 10));
  if (!client) return Response.json({ error: "Client not found" }, { status: 404 });
  if (client.partner_id) return Response.json({ error: "Partner clients are billed by their partner, not KWI's Stripe." }, { status: 400 });
  const log = (action: string, detail?: string) =>
    logEvent({ entity_type: "client", entity_id: client.id, entity_name: client.business_name, action, detail });

  try {
    if (body.action === "link") {
      const cusId = String(body.customer_id ?? "").trim();
      if (!cusId.startsWith("cus_")) return Response.json({ error: "Paste a Stripe customer ID (starts with cus_)." }, { status: 400 });
      const cus = await stripe.customers.retrieve(cusId);
      if (cus.deleted) return Response.json({ error: "That customer was deleted in Stripe." }, { status: 400 });
      const taken = await sql`SELECT business_name FROM clients WHERE stripe_customer_id = ${cusId} AND id != ${client.id}`;
      if (taken.length > 0) {
        return Response.json({ error: `That customer is already linked to ${(taken[0] as { business_name: string }).business_name}.` }, { status: 409 });
      }
      const subs = await stripe.subscriptions.list({ customer: cusId, status: "active", limit: 1 });
      await sql`
        UPDATE clients SET stripe_customer_id = ${cusId}, stripe_subscription_id = ${subs.data[0]?.id ?? null}
        WHERE id = ${client.id}
      `;
      const synced = await syncCustomerInvoices(stripe, cusId);
      await log("linked Stripe customer", cusId);
      return Response.json({ ok: true, synced });
    }

    if (body.action === "subscribe") {
      if (!client.plan_name || !client.plan_amount_cents) {
        return Response.json({ error: "Set the plan name and amount first." }, { status: 400 });
      }
      if (client.stripe_subscription_id) {
        return Response.json({ error: "This client already has a Stripe subscription." }, { status: 409 });
      }
      let cusId = client.stripe_customer_id;
      if (!cusId) {
        if (!client.email) return Response.json({ error: "Add an email to the client record first. Stripe sends invoices there." }, { status: 400 });
        const cus = await stripe.customers.create({
          name: client.business_name, email: client.email,
          metadata: { kwhub_client_id: String(client.id) },
        });
        cusId = cus.id;
        await sql`UPDATE clients SET stripe_customer_id = ${cusId} WHERE id = ${client.id}`;
      }
      const product = await stripe.products.create({
        name: `${client.plan_name} (${client.business_name})`,
        metadata: { kwhub_client_id: String(client.id) },
      });
      const recurring: Stripe.SubscriptionCreateParams.Item.PriceData.Recurring =
        client.plan_interval === "year" ? { interval: "year" }
        : client.plan_interval === "quarter" ? { interval: "month", interval_count: 3 }
        : { interval: "month" };
      const sub = await stripe.subscriptions.create({
        customer: cusId,
        items: [{ price_data: { currency: "aud", product: product.id, unit_amount: client.plan_amount_cents, recurring } }],
        collection_method: "send_invoice",
        days_until_due: DAYS_UNTIL_DUE,
        metadata: { kwhub_client_id: String(client.id) },
      });
      await sql`UPDATE clients SET stripe_subscription_id = ${sub.id} WHERE id = ${client.id}`;
      await log("started Stripe subscription", `${client.plan_name} · $${(client.plan_amount_cents / 100).toFixed(2)} per ${client.plan_interval ?? "month"}`);
      return Response.json({ ok: true, customer_id: cusId, subscription_id: sub.id });
    }

    if (body.action === "sync") {
      if (!client.stripe_customer_id) return Response.json({ error: "Link a Stripe customer first." }, { status: 400 });
      const synced = await syncCustomerInvoices(stripe, client.stripe_customer_id);
      return Response.json({ ok: true, synced });
    }

    if (body.action === "unlink") {
      await sql`UPDATE clients SET stripe_customer_id = NULL, stripe_subscription_id = NULL WHERE id = ${client.id}`;
      await log("unlinked Stripe customer", client.stripe_customer_id ?? undefined);
      return Response.json({ ok: true });
    }
  } catch (err) {
    return Response.json({ error: `Stripe: ${(err as Error).message}` }, { status: 502 });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
