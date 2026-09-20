import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../auth";

/**
 * Log a cold call and sync what was learned back to the business's record:
 * receptionist becomes the contact when none is set, new emails/phones fill
 * empty fields, notes are appended, and the pipeline stage moves
 * (interested → qualified, not interested → lost, otherwise → contacted).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await migrate();
  const session = await auth();
  if (!session?.user || session.user.role !== "staff") {
    return Response.json({ error: "Staff only" }, { status: 403 });
  }
  const { id } = await params;
  const b = await request.json();

  const entry = (await sql`SELECT * FROM call_list WHERE id = ${id}`)[0] as
    | { id: number; record_type: string; record_id: number; called: boolean }
    | undefined;
  if (!entry) return Response.json({ error: "Not on the call list" }, { status: 404 });

  const called = b.called !== undefined ? Boolean(b.called) : entry.called;
  const interested = ["yes", "no"].includes(b.interested) ? b.interested : b.interested === null ? null : undefined;

  const rows = await sql`
    UPDATE call_list SET
      called = ${called},
      called_at = ${called ? sql`COALESCE(called_at, NOW())` : null},
      called_by = ${called ? (b.called_by ?? session.user.name ?? null) : null},
      receptionist_name = ${b.receptionist_name !== undefined ? (b.receptionist_name?.trim() || null) : sql`receptionist_name`},
      emails = ${b.emails !== undefined ? (b.emails?.trim() || null) : sql`emails`},
      phones = ${b.phones !== undefined ? (b.phones?.trim() || null) : sql`phones`},
      interested = ${interested !== undefined ? interested : sql`interested`},
      call_notes = ${b.call_notes !== undefined ? (b.call_notes?.trim() || null) : sql`call_notes`}
    WHERE id = ${id}
    RETURNING *
  `;
  const saved = rows[0] as {
    record_type: string; record_id: number; called: boolean;
    receptionist_name: string | null; emails: string | null; phones: string | null;
    interested: string | null; call_notes: string | null;
  };

  // ── Sync to the business's record ──
  if (b.sync) {
    const firstEmail = saved.emails?.split(/[,;\s]+/).filter((e) => e.includes("@"))[0] ?? null;
    const firstPhone = saved.phones?.split(/[,;]+/).map((p) => p.trim()).filter(Boolean)[0] ?? null;
    const when = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    const noteParts = [
      `— Call ${when} by ${session.user.name ?? "team"}:`,
      saved.receptionist_name && `spoke to ${saved.receptionist_name}`,
      saved.interested === "yes" ? "INTERESTED" : saved.interested === "no" ? "not interested" : null,
      saved.call_notes,
      saved.emails && `emails: ${saved.emails}`,
      saved.phones && `phones: ${saved.phones}`,
    ].filter(Boolean);
    const callNote = noteParts.length > 1 ? noteParts.join(" · ") : null;

    if (saved.record_type === "potential") {
      const nextStatus =
        saved.interested === "yes" ? "qualified"
        : saved.interested === "no" ? "lost"
        : saved.called ? "contacted" : null;
      await sql`
        UPDATE potentials SET
          contact_name = COALESCE(NULLIF(contact_name, ''), ${saved.receptionist_name}),
          email = COALESCE(NULLIF(email, ''), ${firstEmail}),
          phone = COALESCE(NULLIF(phone, ''), ${firstPhone}),
          notes = CASE WHEN ${callNote}::text IS NULL THEN notes
                       ELSE TRIM(BOTH E'\n' FROM COALESCE(notes, '') || E'\n' || ${callNote}) END,
          status = CASE WHEN ${nextStatus}::text IS NULL THEN status
                        WHEN status IN ('won') THEN status
                        ELSE ${nextStatus} END,
          updated_at = NOW()
        WHERE id = ${saved.record_id}
      `;
    } else if (saved.record_type === "client") {
      await sql`
        UPDATE clients SET
          contact_name = COALESCE(NULLIF(contact_name, ''), ${saved.receptionist_name}),
          email = COALESCE(NULLIF(email, ''), ${firstEmail}),
          phone = COALESCE(NULLIF(phone, ''), ${firstPhone}),
          notes = CASE WHEN ${callNote}::text IS NULL THEN notes
                       ELSE TRIM(BOTH E'\n' FROM COALESCE(notes, '') || E'\n' || ${callNote}) END
        WHERE id = ${saved.record_id}
      `;
    }
  }

  return Response.json({ success: true, entry: saved });
}
