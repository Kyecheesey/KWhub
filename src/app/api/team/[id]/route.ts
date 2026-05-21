import { getDb } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  getDb().prepare("DELETE FROM team_members WHERE id = ?").run(id);
  return Response.json({ success: true });
}
