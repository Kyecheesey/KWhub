import { sql } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await sql`DELETE FROM team_members WHERE id=${id}`;
  return Response.json({ success: true });
}
