import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { sql, migrate } from "@/lib/db";

export async function POST(req: NextRequest) {
  await migrate();

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  if (rows.length === 0) {
    return NextResponse.json({ error: "Spreadsheet appears to be empty" }, { status: 400 });
  }

  // Flexible column matching — accept any reasonable header name
  function pick(row: Record<string, unknown>, ...keys: string[]): string {
    for (const k of keys) {
      const found = Object.keys(row).find(
        (rk) => rk.trim().toLowerCase().replace(/[\s_-]/g, "") === k.toLowerCase().replace(/[\s_-]/g, "")
      );
      if (found && row[found] !== undefined && String(row[found]).trim() !== "") {
        return String(row[found]).trim();
      }
    }
    return "";
  }

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const business_name = pick(row, "businessname", "business", "company", "companyname", "name", "organisation", "organization");
    if (!business_name) { skipped++; continue; }

    const contact_name = pick(row, "contactname", "contact", "firstname", "fullname", "person", "name");
    const phone        = pick(row, "phone", "phonenumber", "mobile", "cell", "telephone", "tel");
    const email        = pick(row, "email", "emailaddress", "mail");
    const notes        = pick(row, "notes", "note", "comments", "comment", "description");
    const status       = pick(row, "status", "stage", "pipeline") || "new";
    const assigned_to  = pick(row, "assignedto", "assignee", "owner", "agent", "assigned");

    // Normalise status value
    const validStatuses = ["new", "contacted", "qualified", "proposal", "won", "lost"];
    const normStatus = validStatuses.find((s) => s === status.toLowerCase()) ?? "new";

    await sql`
      INSERT INTO potentials (business_name, contact_name, phone, email, notes, status, assigned_to)
      VALUES (${business_name}, ${contact_name || null}, ${phone || null}, ${email || null}, ${notes || null}, ${normStatus}, ${assigned_to || null})
    `;
    imported++;
  }

  return NextResponse.json({ imported, skipped, total: rows.length });
}
