import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../auth";
import { proposalMeUrl } from "@/lib/proposals";

async function staffSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== "staff") return null;
  return session;
}

// GET → proposals mirrored from ProposalMe, with the linked potential/client name.
export async function GET() {
  await migrate();
  const session = await staffSession();
  if (!session) return Response.json({ error: "Staff only" }, { status: 403 });

  const rows = await sql`
    SELECT pr.*, po.business_name AS potential_name, po.status AS potential_status, c.business_name AS client_business
    FROM proposals pr
    LEFT JOIN potentials po ON po.id = pr.potential_id
    LEFT JOIN clients c ON c.id = pr.client_id
    ORDER BY COALESCE(pr.responded_at, pr.last_viewed_at, pr.published_at, pr.created_at) DESC
  `;
  return Response.json({
    proposals: rows,
    connected: !!process.env.PROPOSALME_WEBHOOK_SECRET,
    proposalme_url: proposalMeUrl(),
  });
}
