import { sql, migrate } from "@/lib/db";
import { resolvePortalScope } from "@/lib/portalAuth";
import { getStripe } from "@/lib/stripe";

// POST → a Stripe billing portal link for the signed-in client, where they
// manage payment details and download past invoices and receipts.
export async function POST(request: Request) {
  await migrate();
  const r = await resolvePortalScope(request);
  if ("error" in r) return r.error;
  if (r.scope.role !== "client") return Response.json({ error: "Only the client can open their billing portal" }, { status: 403 });
  const stripe = getStripe();
  const rows = await sql`SELECT stripe_customer_id FROM clients WHERE id = ${r.scope.clientId}`;
  const customer = (rows[0] as { stripe_customer_id: string | null } | undefined)?.stripe_customer_id;
  if (!stripe || !customer) return Response.json({ error: "Online billing isn't set up for your account yet." }, { status: 400 });
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${new URL(request.url).origin}/portal?section=invoices`,
    });
    return Response.json({ url: session.url });
  } catch (err) {
    return Response.json({ error: `Couldn't open billing: ${(err as Error).message}` }, { status: 502 });
  }
}
