import { migrate } from "@/lib/db";
import { syncAllClients } from "@/lib/metricSync";

/**
 * Refreshes live service metrics (uptime pings, Search Console, Vercel
 * analytics) for every client with a source configured. Vercel Cron hits
 * this daily as a backstop; the GitHub Actions workflow ticks it hourly.
 * Guarded by CRON_SECRET, same as publish-due.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  await migrate();
  const results = await syncAllClients();
  return Response.json({ clients: Object.keys(results).length, results });
}
