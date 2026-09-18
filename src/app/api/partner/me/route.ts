import { sql, migrate } from "@/lib/db";
import { requirePartner } from "@/lib/partnerAuth";

// GET → the signed-in partner's org details + headline counts
export async function GET() {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const [orgRows, counts] = await Promise.all([
    sql`SELECT id, name, slug, contact_name, email, phone, logo_url, accent_color FROM partners WHERE id = ${r.scope.partnerId}`,
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

// PATCH {logo_url?, accent_color?} → white-label branding for this partner's
// workspace and their clients' portals
export async function PATCH(request: Request) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const body = await request.json();
  const accent = typeof body.accent_color === "string" ? body.accent_color.trim() : null;
  if (accent && !/^#[0-9a-fA-F]{6}$/.test(accent)) {
    return Response.json({ error: "accent_color must be a hex colour like #7c3aed" }, { status: 400 });
  }
  const logo = typeof body.logo_url === "string" ? body.logo_url.trim() : null;
  if (logo && !/^https:\/\//.test(logo)) {
    return Response.json({ error: "logo_url must be an https:// image URL" }, { status: 400 });
  }
  const rows = await sql`
    UPDATE partners SET
      logo_url = ${body.logo_url !== undefined ? (logo || null) : sql`logo_url`},
      accent_color = ${body.accent_color !== undefined ? (accent || null) : sql`accent_color`}
    WHERE id = ${r.scope.partnerId}
    RETURNING id, logo_url, accent_color
  `;
  return Response.json(rows[0]);
}
