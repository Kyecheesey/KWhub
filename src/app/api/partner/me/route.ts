import { sql, migrate } from "@/lib/db";
import { requirePartner } from "@/lib/partnerAuth";

// GET → the signed-in partner's org details + headline counts
export async function GET() {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const [orgRows, counts] = await Promise.all([
    sql`SELECT id, name, slug, contact_name, email, phone FROM partners WHERE id = ${r.scope.partnerId}`,
    sql`
      SELECT
        (SELECT COUNT(*)::int FROM clients WHERE partner_id = ${r.scope.partnerId}) AS clients,
        (SELECT COUNT(*)::int FROM posts po JOIN clients c ON c.id = po.client_id
          WHERE c.partner_id = ${r.scope.partnerId} AND po.status = 'scheduled') AS scheduled_posts,
        (SELECT COUNT(*)::int FROM posts po JOIN clients c ON c.id = po.client_id
          WHERE c.partner_id = ${r.scope.partnerId} AND po.status = 'pending_approval') AS pending_approval
    `,
  ]);
  if (!orgRows[0]) return Response.json({ error: "Partner not found" }, { status: 404 });
  return Response.json({ partner: orgRows[0], user: { name: r.scope.name }, counts: counts[0] });
}
