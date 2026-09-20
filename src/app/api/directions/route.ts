import { migrate } from "@/lib/db";
import { auth } from "../../../../auth";
import { xeroRedirectUri, xeroSnapshot } from "@/lib/xero";
import { growthSnapshot } from "@/lib/growth";

/**
 * The Directions snapshot: Xero financials + growth numbers from the hub.
 * Kye-only (middleware enforces it too).
 */
export async function GET(request: Request) {
  await migrate();
  const session = await auth();
  if ((session?.user?.name ?? "").toLowerCase() !== "kye") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const [xero, growth] = await Promise.all([xeroSnapshot(), growthSnapshot()]);
  // Surface the exact redirect URI this deployment sends, so a Xero
  // "Invalid redirect_uri" is a copy-paste fix rather than a guessing game.
  const redirectUri = xero.configured ? undefined : xeroRedirectUri(new URL(request.url).origin);
  return Response.json({ xero: { ...xero, redirect_uri: redirectUri }, growth });
}
