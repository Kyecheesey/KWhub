import { sql } from "./db";
import { sendEmail } from "./email";
import { auth } from "../../auth";

/**
 * Email the assignee when they're assigned a card on a board.
 * Looks up the assignee's email from the users table by name; skips silently
 * when the user has no email or email isn't configured. Never throws — the
 * primary operation must succeed even if the notification fails.
 */
export async function notifyAssignment(input: {
  kind: "client job" | "activity" | "task";
  title: string;
  assignee: string;
  clientName?: string | null;
  dueDate?: string | null;
  priority?: string | null;
  description?: string | null;
}) {
  try {
    const rows = await sql`SELECT email FROM users WHERE LOWER(name) = LOWER(${input.assignee})`;
    const email = (rows[0] as { email: string | null } | undefined)?.email;
    if (!email) return;

    let assignedBy: string | null = null;
    try {
      const session = await auth();
      assignedBy = session?.user?.name ?? null;
    } catch {
      // no session context (e.g. mobile API) — send without attribution
    }

    const lines = [
      `You've been assigned a ${input.kind} in the KW | Innovations Hub${assignedBy ? ` by ${assignedBy}` : ""}:`,
      "",
      `  ${input.title}`,
      input.clientName ? `  Client: ${input.clientName}` : null,
      input.priority ? `  Priority: ${input.priority}` : null,
      input.dueDate ? `  Due: ${input.dueDate.slice(0, 10)}` : null,
      input.description ? `\n${input.description}` : null,
      "",
      "Open the hub: https://kwinnovationshub.com.au",
    ].filter((l): l is string => l != null);

    await sendEmail({
      to: email,
      subject: `New ${input.kind} assigned to you: ${input.title}`,
      text: lines.join("\n"),
    });
  } catch {
    // Notifications must never break the request they ride on.
  }
}
