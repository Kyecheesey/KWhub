import { sql } from "@/lib/db";

export async function GET() {
  const clients = await sql`SELECT * FROM clients ORDER BY business_name ASC`;
  if (clients.length === 0) return new Response("No clients to export", { status: 404 });
  const headers = Object.keys(clients[0]);
  const csv = [
    headers.join(","),
    ...clients.map((row) => headers.map((h) => JSON.stringify(row[h] ?? "")).join(",")),
  ].join("\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="clients.csv"' },
  });
}
