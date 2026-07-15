import { sql, migrate } from "@/lib/db";
import { logEvent, type EntityType } from "@/lib/events";

const ENTITY_TYPES = ["client", "potential", "task", "activity"];

export async function GET(request: Request) {
  await migrate();
  const url = new URL(request.url);
  const entityType = url.searchParams.get("entity_type");
  const entityId = url.searchParams.get("entity_id");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 500);

  if (entityType && entityId) {
    const rows = await sql`
      SELECT * FROM events
      WHERE entity_type = ${entityType} AND entity_id = ${parseInt(entityId, 10)}
      ORDER BY created_at DESC LIMIT ${limit}
    `;
    return Response.json(rows);
  }
  const rows = await sql`SELECT * FROM events ORDER BY created_at DESC LIMIT ${limit}`;
  return Response.json(rows);
}

// Client-side logged events (e.g. "called via phone app", "emailed")
export async function POST(request: Request) {
  await migrate();
  const { entity_type, entity_id, entity_name, action, detail } = await request.json();
  if (!ENTITY_TYPES.includes(entity_type) || !action) {
    return Response.json({ error: "entity_type and action are required" }, { status: 400 });
  }
  await logEvent({
    entity_type: entity_type as EntityType,
    entity_id: entity_id ?? null,
    entity_name: entity_name ?? null,
    action,
    detail,
  });
  return Response.json({ ok: true }, { status: 201 });
}
