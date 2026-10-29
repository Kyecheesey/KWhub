import Stripe from "stripe";
import { sql } from "./db";
import { notifyClient } from "./portalNotify";
import { logEvent } from "./events";

/**
 * Stripe billing for KWI clients. Each client can be linked to a Stripe
 * customer (clients.stripe_customer_id); their Stripe invoices are mirrored
 * into the portal's invoices table (invoices.stripe_invoice_id), kept up to
 * date by /api/stripe/webhook and the staff "Sync" action.
 *
 * Needs STRIPE_SECRET_KEY (and STRIPE_WEBHOOK_SECRET for the webhook);
 * everything Stripe-related stays switched off until they're set.
 */

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!_stripe) _stripe = new Stripe(key);
  return _stripe;
}

/** Monthly plans default to "pay by the invoice link within 14 days" (lib/policies billing terms). */
export const DAYS_UNTIL_DUE = 14;

function customerId(c: string | { id: string } | null): string | null {
  if (!c) return null;
  return typeof c === "string" ? c : c.id;
}

/**
 * Mirror one Stripe invoice into the portal. Drafts aren't shown; voided or
 * uncollectible invoices are removed. Notifies the client when a new invoice
 * that's due first appears.
 */
export async function upsertStripeInvoice(inv: Stripe.Invoice): Promise<"saved" | "removed" | "skipped"> {
  if (!inv.id) return "skipped";
  const status = inv.status;
  if (status === "void" || status === "uncollectible" || status === "draft" || !status) {
    const removed = await sql`DELETE FROM invoices WHERE stripe_invoice_id = ${inv.id} RETURNING id`;
    return removed.length > 0 ? "removed" : "skipped";
  }
  const cus = customerId(inv.customer);
  if (!cus) return "skipped";
  const clients = await sql`SELECT id, business_name FROM clients WHERE stripe_customer_id = ${cus}`;
  const client = clients[0] as { id: number; business_name: string } | undefined;
  if (!client) return "skipped";

  const portalStatus = status === "paid" ? "paid" : "due";
  const number = inv.number ?? inv.id;
  const dueDate = inv.due_date ? new Date(inv.due_date * 1000).toISOString().slice(0, 10) : null;
  const rows = await sql`
    INSERT INTO invoices (client_id, number, amount_cents, due_date, status, pdf_url, pay_url, stripe_invoice_id)
    VALUES (${client.id}, ${number}, ${inv.total}, ${dueDate}, ${portalStatus},
            ${inv.invoice_pdf ?? null}, ${inv.hosted_invoice_url ?? null}, ${inv.id})
    ON CONFLICT (stripe_invoice_id) DO UPDATE SET
      client_id = EXCLUDED.client_id, number = EXCLUDED.number, amount_cents = EXCLUDED.amount_cents,
      due_date = EXCLUDED.due_date, status = EXCLUDED.status,
      pdf_url = EXCLUDED.pdf_url, pay_url = EXCLUDED.pay_url
    RETURNING (xmax = 0) AS inserted, status
  `;
  const row = rows[0] as { inserted: boolean } | undefined;
  if (row?.inserted && portalStatus === "due") {
    const amount = (inv.total / 100).toFixed(2);
    await notifyClient(
      client.id,
      `New invoice from KW Innovations: ${number}`,
      `Invoice ${number} for $${amount} has been added to your portal${dueDate ? `, due ${dueDate}` : ""}.\n\nSign in to view or pay it.`
    );
  }
  return "saved";
}

/** Pull every invoice for a customer from Stripe into the portal. */
export async function syncCustomerInvoices(stripe: Stripe, customer: string): Promise<number> {
  let count = 0;
  for await (const inv of stripe.invoices.list({ customer, limit: 100 })) {
    if ((await upsertStripeInvoice(inv)) === "saved") count++;
  }
  return count;
}

/** Keep the client's plan in line with their Stripe subscription. */
export async function applySubscription(sub: Stripe.Subscription): Promise<void> {
  const cus = customerId(sub.customer);
  if (!cus) return;
  const ended = ["canceled", "incomplete_expired"].includes(sub.status);
  if (ended) {
    const rows = await sql`
      UPDATE clients SET stripe_subscription_id = NULL
      WHERE stripe_customer_id = ${cus} AND stripe_subscription_id = ${sub.id}
      RETURNING id, business_name
    `;
    const c = rows[0] as { id: number; business_name: string } | undefined;
    if (c) await logEvent({ entity_type: "client", entity_id: c.id, entity_name: c.business_name, action: "subscription ended", actor: "Stripe" });
    return;
  }
  const price = sub.items.data[0]?.price;
  const amount = price?.unit_amount ?? null;
  const rec = price?.recurring;
  const interval = !rec ? null
    : rec.interval === "year" ? "year"
    : rec.interval === "month" && rec.interval_count === 3 ? "quarter"
    : rec.interval === "month" && rec.interval_count === 1 ? "month"
    : null;
  if (amount && interval) {
    await sql`
      UPDATE clients SET stripe_subscription_id = ${sub.id},
        plan_amount_cents = ${amount}, plan_interval = ${interval}
      WHERE stripe_customer_id = ${cus}
    `;
  } else {
    await sql`UPDATE clients SET stripe_subscription_id = ${sub.id} WHERE stripe_customer_id = ${cus}`;
  }
}
