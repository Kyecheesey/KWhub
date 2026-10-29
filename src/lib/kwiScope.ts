import { sql } from "./db";

/**
 * KWI staff work on KWI's own clients only. Partner organisations (e.g. GC
 * Media Group) own their clients outright (clients.partner_id), and the two
 * businesses never touch each other's records.
 */
export async function isKwiClient(clientId: number): Promise<boolean> {
  if (!Number.isFinite(clientId)) return false;
  const rows = await sql`SELECT 1 FROM clients WHERE id = ${clientId} AND partner_id IS NULL`;
  return rows.length > 0;
}

export const notKwiClient = () =>
  Response.json({ error: "That client isn't one of KWI's" }, { status: 404 });

/** A job is KWI's unless its client belongs to a partner (public tickets use client_id 0). */
export async function isKwiJob(jobId: number): Promise<boolean> {
  if (!Number.isFinite(jobId)) return false;
  const rows = await sql`
    SELECT 1 FROM client_jobs j
    WHERE j.id = ${jobId}
      AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = j.client_id AND c.partner_id IS NOT NULL)
  `;
  return rows.length > 0;
}

/** A post is KWI's when its client is. */
export async function isKwiPost(postId: number): Promise<boolean> {
  if (!Number.isFinite(postId)) return false;
  const rows = await sql`
    SELECT 1 FROM posts p JOIN clients c ON c.id = p.client_id
    WHERE p.id = ${postId} AND c.partner_id IS NULL
  `;
  return rows.length > 0;
}
