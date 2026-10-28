import type Stripe from "stripe";
import { sql, migrate } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { getStripe, upsertStripeInvoice, applySubscription } from "@/lib/stripe";

// Stripe → hub: mirrors invoices into client portals and keeps plans and
// subscriptions in sync. Public route (see proxy.ts); trust comes from the
// Stripe-Signature check against STRIPE_WEBHOOK_SECRET.
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) return Response.json({ error: "Stripe isn't configured" }, { status: 503 });

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, request.headers.get("stripe-signature") ?? "", secret);
  } catch (err) {
    return Response.json({ error: `Bad signature: ${(err as Error).message}` }, { status: 400 });
  }

  await migrate();
  switch (event.type) {
    case "invoice.finalized":
    case "invoice.updated":
    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.voided":
    case "invoice.marked_uncollectible": {
      const inv = event.data.object;
      await upsertStripeInvoice(inv);
      if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
        const rows = await sql`SELECT client_id FROM invoices WHERE stripe_invoice_id = ${inv.id ?? ""}`;
        const clientId = (rows[0] as { client_id: number } | undefined)?.client_id;
        if (clientId) {
          const c = await sql`SELECT business_name FROM clients WHERE id = ${clientId}`;
          await logEvent({
            entity_type: "client", entity_id: clientId,
            entity_name: (c[0] as { business_name: string } | undefined)?.business_name ?? null,
            action: event.type === "invoice.paid" ? "invoice paid" : "invoice payment failed",
            detail: `${inv.number ?? inv.id} · $${(inv.total / 100).toFixed(2)}`,
            actor: "Stripe",
          });
        }
      }
      break;
    }
    case "invoice.deleted":
      await sql`DELETE FROM invoices WHERE stripe_invoice_id = ${event.data.object.id ?? ""}`;
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await applySubscription(event.data.object);
      break;
  }
  return Response.json({ received: true });
}
