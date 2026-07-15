import { sql } from "./db";
import { auth } from "../../auth";

export type EntityType = "client" | "potential" | "task" | "activity";

export interface EventRow {
  id: number;
  entity_type: EntityType;
  entity_id: number | null;
  entity_name: string | null;
  actor: string | null;
  action: string;
  detail: string | null;
  created_at: string;
}

/**
 * Append an event to the audit/timeline log. Never throws — the primary
 * operation must succeed even if logging fails (e.g. table not yet migrated).
 */
export async function logEvent(input: {
  entity_type: EntityType;
  entity_id: number | null;
  entity_name: string | null;
  action: string;
  detail?: string | null;
  actor?: string | null;
}) {
  try {
    let actor = input.actor ?? null;
    if (!actor) {
      const session = await auth();
      actor = session?.user?.name ?? null;
    }
    await sql`
      INSERT INTO events (entity_type, entity_id, entity_name, actor, action, detail)
      VALUES (${input.entity_type}, ${input.entity_id}, ${input.entity_name},
              ${actor}, ${input.action}, ${input.detail ?? null})
    `;
  } catch {
    // Logging must never break the request it rides on.
  }
}
