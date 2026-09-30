import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { sql, migrate } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { sendPush } from "@/lib/push";
import { ACCEPTED_ANSWER, STAGES, linkedRecord, matchRecord, nextStage, type ProposalRow, type Stage } from "@/lib/proposals";

/**
 * ProposalMe webhook receiver. ProposalMe (kwi-proposals.vercel.app) posts
 * here on every proposal publish, open, answer and stage change, with an
 * HMAC-SHA256 of the raw body in `x-proposalme-signature` using the shared
 * secret: KWHUB_WEBHOOK_SECRET there, PROPOSALME_WEBHOOK_SECRET here.
 * Public route (proxy allows it); the signature is the auth.
 */

interface Payload {
  type: "proposal.published" | "proposal.updated" | "proposal.opened" | "proposal.answered" | "proposal.stage"
    | "proposal.renamed" | "proposal.sync" | "proposal.unpublished";
  at: string;
  proposal: { id: string; kind?: string; name?: string; title?: string; number?: string; client?: string; clientEmail?: string; url?: string };
  /** ProposalMe's full current state for this proposal; mirrored as-is when present. */
  summary?: {
    stage?: string; views?: number; responses?: number; answer?: string; package?: string; lastNote?: string;
    publishedAt?: string | null; firstViewedAt?: string | null; lastViewedAt?: string | null; respondedAt?: string | null;
  };
  event: { at?: string; first?: boolean; page?: string; status?: string; package?: string; notes?: string; name?: string; email?: string; stage?: string };
}

const MAX_SKEW_MS = 15 * 60 * 1000;

function verify(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const STAGE_LABEL: Record<Stage, string> = {
  sent: "Sent", opened: "Opened", questions: "Questions", accepted: "Accepted", won: "Won", lost: "Lost",
};

export async function POST(request: Request) {
  const secret = process.env.PROPOSALME_WEBHOOK_SECRET?.trim();
  if (!secret) return Response.json({ error: "PROPOSALME_WEBHOOK_SECRET isn't set" }, { status: 503 });

  const rawBody = await request.text();
  if (!verify(rawBody, request.headers.get("x-proposalme-signature"), secret)) {
    // key: first 8 hex of sha256(secret), so a mismatch can be spotted without revealing either secret.
    return Response.json({ error: "Bad signature", key: createHash("sha256").update(secret).digest("hex").slice(0, 8) }, { status: 401 });
  }

  let body: Payload;
  try {
    body = JSON.parse(rawBody) as Payload;
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400 });
  }
  const ext = body.proposal?.id;
  if (!ext || !body.type) return Response.json({ error: "Missing proposal id or type" }, { status: 400 });
  // Signed but stale payloads are refused, so a captured request can't be replayed later.
  const sentAt = Date.parse(body.at);
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > MAX_SKEW_MS) {
    return Response.json({ error: "Stale event" }, { status: 400 });
  }

  await migrate();
  const p = body.proposal;
  const ev = body.event ?? {};
  const at = ev.at ?? body.at;

  // Upsert the mirror row; published_at is only set when the row is created.
  const kind = body.type === "proposal.unpublished" ? "unpublished" : p.kind ?? "published";
  const upserted = await sql`
    INSERT INTO proposals (external_id, kind, name, title, number, client_name, client_email, url, published_at)
    VALUES (${ext}, ${kind}, ${p.name || null}, ${p.title || "Untitled proposal"}, ${p.number || null},
            ${p.client || null}, ${p.clientEmail || null}, ${p.url || null}, ${body.summary?.publishedAt ?? at})
    ON CONFLICT (external_id) DO UPDATE SET
      kind = EXCLUDED.kind, name = COALESCE(EXCLUDED.name, proposals.name),
      title = EXCLUDED.title, number = EXCLUDED.number, client_name = EXCLUDED.client_name,
      client_email = COALESCE(EXCLUDED.client_email, proposals.client_email),
      url = EXCLUDED.url, updated_at = NOW()
    RETURNING *
  `;
  let row = upserted[0] as unknown as ProposalRow;

  // Link to a potential/client the first time we can.
  let record = await linkedRecord(row);
  if (!record) {
    record = await matchRecord(row.client_name, row.client_email || ev.email || null);
    if (record) {
      await sql`
        UPDATE proposals SET ${record.type === "potential" ? sql`potential_id = ${record.id}` : sql`client_id = ${record.id}`}
        WHERE id = ${row.id}
      `;
    }
  }

  const stage = nextStage(row.stage, body.type, ev);
  const sum = body.summary;
  if (sum && STAGES.includes(sum.stage as Stage)) {
    // Mirror ProposalMe's own numbers, so the hub matches even if an event was missed.
    const res = await sql`
      UPDATE proposals SET stage = ${sum.stage as Stage}, views = ${sum.views ?? 0}, answers = ${sum.responses ?? 0},
        last_answer = ${sum.answer || null}, package = ${sum.package || null},
        last_note = ${sum.lastNote ?? (body.type === "proposal.answered" ? ev.notes || null : row.last_note)},
        first_viewed_at = ${sum.firstViewedAt ?? null}, last_viewed_at = ${sum.lastViewedAt ?? null},
        responded_at = ${sum.respondedAt ?? null}, updated_at = NOW()
      WHERE id = ${row.id} RETURNING *
    `;
    row = res[0] as unknown as ProposalRow;
  } else if (body.type === "proposal.opened") {
    const res = await sql`
      UPDATE proposals SET views = views + 1, stage = ${stage},
        first_viewed_at = COALESCE(first_viewed_at, ${at}), last_viewed_at = ${at}, updated_at = NOW()
      WHERE id = ${row.id} RETURNING *
    `;
    row = res[0] as unknown as ProposalRow;
  } else if (body.type === "proposal.answered") {
    const res = await sql`
      UPDATE proposals SET answers = answers + 1, stage = ${stage}, last_answer = ${ev.status ?? null},
        package = ${ev.package || null}, last_note = ${ev.notes || null}, responded_at = ${at}, updated_at = NOW()
      WHERE id = ${row.id} RETURNING *
    `;
    row = res[0] as unknown as ProposalRow;
  } else if (body.type === "proposal.stage") {
    const res = await sql`UPDATE proposals SET stage = ${stage}, updated_at = NOW() WHERE id = ${row.id} RETURNING *`;
    row = res[0] as unknown as ProposalRow;
  }

  // Timeline, pipeline and push on the linked record.
  if (record) {
    const base = { entity_type: record.type, entity_id: record.id, entity_name: record.name, actor: "ProposalMe" } as const;
    const version = ev.page ? ` (${ev.page === "v1" ? "original" : "redesign"})` : "";

    if (body.type === "proposal.published") {
      await logEvent({ ...base, action: "proposal_sent", detail: row.title });
      // A proposal going out moves an early-stage potential to "Proposal Sent".
      if (record.type === "potential" && ["new", "contacted", "qualified"].includes(record.status ?? "")) {
        await sql`UPDATE potentials SET status = 'proposal', updated_at = NOW() WHERE id = ${record.id}`;
        await logEvent({ ...base, action: "stage_changed", detail: `${record.status} → proposal` });
      }
    } else if (body.type === "proposal.opened" && ev.first) {
      await logEvent({ ...base, action: "proposal_opened", detail: `${row.title}${version}` });
    } else if (body.type === "proposal.answered") {
      const detail = [`${ev.status}${ev.package ? ` · ${ev.package}` : ""}`, ev.notes ? `"${ev.notes}"` : ""].filter(Boolean).join(" — ");
      await logEvent({ ...base, action: "proposal_answered", detail });
      if (record.type === "potential") await sql`UPDATE potentials SET updated_at = NOW() WHERE id = ${record.id}`;
    } else if (body.type === "proposal.unpublished") {
      await logEvent({ ...base, action: "proposal_unpublished", detail: row.name || row.title });
    } else if (body.type === "proposal.stage") {
      await logEvent({ ...base, action: "proposal_stage", detail: STAGE_LABEL[row.stage] ?? row.stage });
      // Closing the deal in ProposalMe closes the potential too.
      const closed = row.stage;
      if (record.type === "potential" && (closed === "won" || closed === "lost") && record.status !== closed) {
        await sql`UPDATE potentials SET status = ${closed}, updated_at = NOW() WHERE id = ${record.id}`;
        await logEvent({ ...base, action: "stage_changed", detail: `${record.status} → ${closed}` });
      }
    }
  }

  if (body.type === "proposal.answered") {
    const who = ev.name || row.client_name || "A client";
    const accepted = ev.status === ACCEPTED_ANSWER;
    const payload = {
      title: accepted ? `✅ ${who} said let's go` : `💬 ${who} has questions`,
      body: [row.title, ev.package, ev.notes].filter(Boolean).join(" · ").slice(0, 180),
      url: "/proposals",
    };
    const people = new Set(["kye", ...(record?.assigned_to ? [record.assigned_to.toLowerCase()] : [])]);
    await Promise.all([...people].map((u) => sendPush(u, payload)));
  }

  return Response.json({ ok: true, proposal: row.id, stage: row.stage, linked: record ? { type: record.type, id: record.id } : null });
}
