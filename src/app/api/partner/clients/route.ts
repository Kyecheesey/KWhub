import { sql, migrate } from "@/lib/db";
import { requirePartner } from "@/lib/partnerAuth";

// GET → this partner's clients, with portal login + content counts
export async function GET() {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const rows = await sql`
    SELECT c.*,
      (SELECT COUNT(*)::int FROM users u WHERE u.role = 'client' AND u.client_id = c.id) AS portal_logins,
      (SELECT COUNT(*)::int FROM posts po WHERE po.client_id = c.id) AS post_count
    FROM clients c
    WHERE c.partner_id = ${r.scope.partnerId}
    ORDER BY c.business_name ASC
  `;
  return Response.json(rows);
}

// POST {business_name, ...} → create a client under this partner
export async function POST(request: Request) {
  await migrate();
  const r = await requirePartner();
  if ("error" in r) return r.error;
  const { business_name, contact_name, phone, email, website, notes } = await request.json();
  if (!business_name?.trim()) {
    return Response.json({ error: "business_name is required" }, { status: 400 });
  }
  const rows = await sql`
    INSERT INTO clients (business_name, contact_name, phone, email, website, notes, source, partner_id)
    VALUES (${business_name.trim()}, ${contact_name ?? null}, ${phone ?? null}, ${email ?? null},
            ${website ?? null}, ${notes ?? null}, 'partner', ${r.scope.partnerId})
    RETURNING *
  `;
  return Response.json(rows[0], { status: 201 });
}
