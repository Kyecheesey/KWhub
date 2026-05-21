import * as cheerio from "cheerio";
import { sql, migrate } from "@/lib/db";

export async function POST() {
  await migrate();
  let html: string;
  try {
    const res = await fetch("https://kwinnovations.com.au", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KWHub/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    html = await res.text();
  } catch {
    return Response.json({ error: "Failed to fetch kwinnovations.com.au" }, { status: 502 });
  }

  const $ = cheerio.load(html);
  const found: { business_name: string; website: string }[] = [];

  const selectors = [
    ".clients a", ".portfolio a", ".our-clients a",
    '[class*="client"] a', '[class*="portfolio"] a',
    '[id*="client"] a', '[id*="portfolio"] a',
  ];
  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr("href") ?? "";
      if (text && text.length > 1) found.push({ business_name: text, website: href });
    });
    if (found.length > 0) break;
  }

  if (found.length === 0) {
    $("a[href^='http']").each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr("href") ?? "";
      if (text.length > 2 && !href.includes("kwinnovations.com.au") &&
          !["facebook","instagram","linkedin"].some((s) => text.toLowerCase().includes(s))) {
        found.push({ business_name: text, website: href });
      }
    });
  }

  if (found.length === 0) {
    return Response.json({ imported: 0, message: "No client data found on the page. Add clients manually." });
  }

  let imported = 0;
  for (const c of found) {
    const r = await sql`
      INSERT INTO clients (business_name, website, source)
      VALUES (${c.business_name}, ${c.website}, 'scraped')
      ON CONFLICT DO NOTHING
    `;
    if (r.length > 0 || (r as unknown as { rowCount?: number }).rowCount) imported++;
  }

  return Response.json({ imported, total_found: found.length });
}
