import * as cheerio from "cheerio";
import { getDb } from "@/lib/db";

export async function POST() {
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

  // Try common patterns for client/portfolio sections
  const selectors = [
    ".clients a",
    ".portfolio a",
    ".our-clients a",
    '[class*="client"] a',
    '[class*="portfolio"] a',
    '[id*="client"] a',
    '[id*="portfolio"] a',
  ];

  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr("href") ?? "";
      if (text && text.length > 1) {
        found.push({ business_name: text, website: href });
      }
    });
    if (found.length > 0) break;
  }

  // Fallback: grab any external links with meaningful text as potential client names
  if (found.length === 0) {
    $("a[href^='http']").each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr("href") ?? "";
      if (
        text.length > 2 &&
        !href.includes("kwinnovations.com.au") &&
        !text.toLowerCase().includes("facebook") &&
        !text.toLowerCase().includes("instagram") &&
        !text.toLowerCase().includes("linkedin")
      ) {
        found.push({ business_name: text, website: href });
      }
    });
  }

  if (found.length === 0) {
    return Response.json({
      imported: 0,
      message: "No client data found on the page. Add clients manually.",
    });
  }

  const db = getDb();
  const insert = db.prepare(
    "INSERT OR IGNORE INTO clients (business_name, website, source) VALUES (?, ?, 'scraped')"
  );

  let imported = 0;
  for (const c of found) {
    const r = insert.run(c.business_name, c.website);
    if (r.changes > 0) imported++;
  }

  return Response.json({ imported, total_found: found.length });
}
