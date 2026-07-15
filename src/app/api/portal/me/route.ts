import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../auth";
import { resolvePortalScope } from "@/lib/portalAuth";

export async function GET(request: Request) {
  await migrate();
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Not signed in" }, { status: 401 });

  let clientId: number;
  if (session.user.role === "client") {
    if (!session.user.clientId) return Response.json({ error: "No linked client" }, { status: 403 });
    clientId = session.user.clientId;
  } else {
    // Staff preview: which client's portal to render
    const param = new URL(request.url).searchParams.get("client_id");
    if (!param) return Response.json({ error: "client_id is required for staff preview" }, { status: 400 });
    clientId = parseInt(param, 10);
  }

  const [rows, settings] = await Promise.all([
    sql`
      SELECT id, business_name, contact_name, phone, email, website, assigned_to, logo_url
      FROM clients WHERE id = ${clientId}
    `,
    sql`SELECT value FROM settings WHERE key = 'booking_url'`,
  ]);
  if (rows.length === 0) return Response.json({ error: "Client record not found" }, { status: 404 });
  const bookingUrl = (settings[0] as { value: string | null } | undefined)?.value ?? null;
  return Response.json({ ...rows[0], booking_url: bookingUrl });
}

// Staff set portal branding (logo)
export async function PATCH(request: Request) {
  await migrate();
  const body = await request.json();
  const r = await resolvePortalScope(request, { staffOnly: true, bodyClientId: body.client_id ?? null });
  if ("error" in r) return r.error;
  const rows = await sql`
    UPDATE clients SET logo_url = ${body.logo_url || null} WHERE id = ${r.scope.clientId}
    RETURNING id, logo_url
  `;
  if (rows.length === 0) return Response.json({ error: "Client not found" }, { status: 404 });
  return Response.json(rows[0]);
}
