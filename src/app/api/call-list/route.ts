import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();

  // Join call_list with clients and potentials to get full record details
  const rows = db.prepare(`
    SELECT
      cl.id,
      cl.record_type,
      cl.record_id,
      cl.notes       AS call_notes,
      cl.called,
      cl.called_at,
      cl.called_by,
      cl.created_at,
      COALESCE(c.business_name, p.business_name) AS business_name,
      COALESCE(c.contact_name,  p.contact_name)  AS contact_name,
      COALESCE(c.phone,         p.phone)          AS phone,
      COALESCE(c.email,         p.email)          AS email,
      COALESCE(c.assigned_to,   p.assigned_to)    AS assigned_to,
      p.status AS potential_status
    FROM call_list cl
    LEFT JOIN clients    c ON cl.record_type = 'client'    AND cl.record_id = c.id
    LEFT JOIN potentials p ON cl.record_type = 'potential' AND cl.record_id = p.id
    ORDER BY cl.called ASC, cl.created_at DESC
  `).all();

  return Response.json(rows);
}

export async function POST(request: Request) {
  const { record_type, record_id, notes } = await request.json();
  if (!record_type || !record_id) return Response.json({ error: "record_type and record_id required" }, { status: 400 });
  const db = getDb();
  try {
    db.prepare(
      "INSERT INTO call_list (record_type, record_id, notes) VALUES (?, ?, ?)"
    ).run(record_type, record_id, notes ?? null);
  } catch {
    // Already on list — that's fine
  }
  return Response.json({ success: true });
}

export async function DELETE(request: Request) {
  const { record_type, record_id } = await request.json();
  getDb().prepare("DELETE FROM call_list WHERE record_type = ? AND record_id = ?").run(record_type, record_id);
  return Response.json({ success: true });
}
