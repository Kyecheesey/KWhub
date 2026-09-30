import { sql } from "./db";

/**
 * ProposalMe integration — shared by the webhook and the /proposals page.
 * ProposalMe posts every publish/open/answer/stage change; the hub keeps a
 * mirror row per proposal and links it to a potential or client.
 */

export const STAGES = ["sent", "opened", "questions", "accepted", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];

export interface ProposalRow {
  id: number;
  external_id: string;
  kind: string;
  title: string;
  number: string | null;
  client_name: string | null;
  client_email: string | null;
  url: string | null;
  stage: Stage;
  views: number;
  answers: number;
  last_answer: string | null;
  package: string | null;
  last_note: string | null;
  potential_id: number | null;
  client_id: number | null;
  published_at: string | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export const ACCEPTED_ANSWER = "Happy, let's go";

const RANK: Record<Stage, number> = { sent: 0, opened: 1, questions: 2, accepted: 3, won: 4, lost: 4 };
const CLOSED = new Set<Stage>(["won", "lost"]);

/**
 * Same rules as ProposalMe's tracking board: client activity moves a proposal
 * forward, a manual stage change sets it outright, and client activity never
 * reopens a won or lost deal.
 */
export function nextStage(current: Stage, type: string, event: { stage?: string; status?: string }): Stage {
  if (type === "proposal.stage" && STAGES.includes(event.stage as Stage)) return event.stage as Stage;
  if (CLOSED.has(current)) return current;
  if (type === "proposal.opened") return RANK[current] < RANK.opened ? "opened" : current;
  if (type === "proposal.answered") return event.status === ACCEPTED_ANSWER ? "accepted" : "questions";
  return current;
}

export interface LinkedRecord {
  type: "potential" | "client";
  id: number;
  name: string;
  status?: string;
  assigned_to?: string | null;
}

/** Candidate business names from a proposal's client line, e.g. "Sam, Acme Pty Ltd". */
function nameCandidates(clientName: string): string[] {
  const whole = clientName.trim();
  const parts = whole.split(/\s*,\s*|\s+and\s+/i).map((p) => p.trim()).filter((p) => p.length >= 3);
  return [...new Set([whole, ...parts].map((n) => n.toLowerCase()))].filter(Boolean);
}

/**
 * Find the hub record a proposal belongs to: exact email first (potentials,
 * then KWI clients), then an exact business-name match. Name matches are
 * exact (case-insensitive) so a proposal is never linked on a loose guess.
 */
export async function matchRecord(clientName: string | null, clientEmail: string | null): Promise<LinkedRecord | null> {
  const email = (clientEmail ?? "").trim().toLowerCase();
  if (email) {
    const pot = await sql`SELECT id, business_name, status, assigned_to FROM potentials WHERE LOWER(email) = ${email} ORDER BY updated_at DESC LIMIT 1`;
    if (pot[0]) return { type: "potential", id: pot[0].id as number, name: pot[0].business_name as string, status: pot[0].status as string, assigned_to: pot[0].assigned_to as string | null };
    const cl = await sql`SELECT id, business_name, assigned_to FROM clients WHERE partner_id IS NULL AND LOWER(email) = ${email} LIMIT 1`;
    if (cl[0]) return { type: "client", id: cl[0].id as number, name: cl[0].business_name as string, assigned_to: cl[0].assigned_to as string | null };
  }
  const names = clientName ? nameCandidates(clientName) : [];
  if (names.length) {
    const pot = await sql`SELECT id, business_name, status, assigned_to FROM potentials WHERE LOWER(business_name) = ANY(${names}) ORDER BY updated_at DESC LIMIT 1`;
    if (pot[0]) return { type: "potential", id: pot[0].id as number, name: pot[0].business_name as string, status: pot[0].status as string, assigned_to: pot[0].assigned_to as string | null };
    const cl = await sql`SELECT id, business_name, assigned_to FROM clients WHERE partner_id IS NULL AND LOWER(business_name) = ANY(${names}) LIMIT 1`;
    if (cl[0]) return { type: "client", id: cl[0].id as number, name: cl[0].business_name as string, assigned_to: cl[0].assigned_to as string | null };
  }
  return null;
}

/** The record a stored proposal is linked to, if any. */
export async function linkedRecord(p: Pick<ProposalRow, "potential_id" | "client_id">): Promise<LinkedRecord | null> {
  if (p.potential_id) {
    const r = await sql`SELECT id, business_name, status, assigned_to FROM potentials WHERE id = ${p.potential_id}`;
    if (r[0]) return { type: "potential", id: r[0].id as number, name: r[0].business_name as string, status: r[0].status as string, assigned_to: r[0].assigned_to as string | null };
  }
  if (p.client_id) {
    const r = await sql`SELECT id, business_name, assigned_to FROM clients WHERE id = ${p.client_id}`;
    if (r[0]) return { type: "client", id: r[0].id as number, name: r[0].business_name as string, assigned_to: r[0].assigned_to as string | null };
  }
  return null;
}

export const proposalMeUrl = () => (process.env.PROPOSALME_URL || "https://kwi-proposals.vercel.app").replace(/\/$/, "");
