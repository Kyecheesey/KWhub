import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const potentials = db
    .prepare("SELECT * FROM potentials ORDER BY updated_at DESC")
    .all() as Record<string, unknown>[];
  if (potentials.length === 0) {
    return new Response("No potentials to export", { status: 404 });
  }
  const headers = Object.keys(potentials[0]);
  const csv = [
    headers.join(","),
    ...potentials.map((row) =>
      headers.map((h) => JSON.stringify(row[h] ?? "")).join(",")
    ),
  ].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="potentials.csv"',
    },
  });
}
