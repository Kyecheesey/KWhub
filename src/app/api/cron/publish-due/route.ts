import { sql, migrate } from "@/lib/db";
import { publishPost } from "@/lib/social/publish";

/**
 * The post scheduler. Vercel Cron hits this every 15 minutes (vercel.json);
 * it publishes every approved post whose scheduled time has passed.
 * Guarded by CRON_SECRET (Vercel sends it as a Bearer token automatically).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await migrate();
  const due = (await sql`
    SELECT id FROM posts
    WHERE status = 'approved' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW()
    ORDER BY scheduled_at
    LIMIT 25
  `) as unknown as { id: number }[];

  const results = [];
  for (const post of due) {
    results.push({ id: post.id, ...(await publishPost(post.id)) });
  }
  return Response.json({ processed: due.length, results });
}
