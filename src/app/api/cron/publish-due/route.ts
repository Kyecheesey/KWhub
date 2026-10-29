import { sql, migrate } from "@/lib/db";
import { publishPost } from "@/lib/social/publish";

/**
 * The post scheduler. Vercel Cron hits this every 15 minutes (vercel.json);
 * it publishes every approved post whose scheduled time has passed.
 * Guarded by CRON_SECRET (Vercel sends it as a Bearer token automatically).
 */
const MAX_ATTEMPTS = 5;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await migrate();
  // Channels that have failed MAX_ATTEMPTS times are left for staff ("Publish
  // now"), so a broken post can't hold the queue ahead of newer ones.
  const due = (await sql`
    SELECT p.id FROM posts p
    WHERE p.status = 'approved' AND p.scheduled_at IS NOT NULL AND p.scheduled_at <= NOW()
      AND (NOT EXISTS (SELECT 1 FROM post_channels c WHERE c.post_id = p.id)
           OR EXISTS (SELECT 1 FROM post_channels c WHERE c.post_id = p.id
                        AND c.publish_status IN ('pending', 'failed', 'publishing')
                        AND COALESCE(c.attempts, 0) < ${MAX_ATTEMPTS}))
    ORDER BY p.scheduled_at
    LIMIT 25
  `) as unknown as { id: number }[];

  const results = [];
  for (const post of due) {
    results.push({ id: post.id, ...(await publishPost(post.id, { maxAttempts: MAX_ATTEMPTS })) });
  }
  return Response.json({ processed: due.length, results });
}
