import { sql } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { called, called_by } = await request.json();
  await sql`
    UPDATE call_list
    SET called=${called ? true : false},
        called_at=${called ? sql`NOW()` : null},
        called_by=${called_by ?? null}
    WHERE id=${id}
  `;
  return Response.json({ success: true });
}
