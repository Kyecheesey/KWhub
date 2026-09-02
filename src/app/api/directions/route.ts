import { migrate } from "@/lib/db";
import { auth } from "../../../../auth";
import { xeroSnapshot } from "@/lib/xero";
import { growthSnapshot } from "@/lib/growth";

/**
 * The Directions snapshot: Xero financials + growth numbers from the hub.
 * Kye-only (middleware enforces it too).
 */
export async function GET() {
  await migrate();
  const session = await auth();
  if ((session?.user?.name ?? "").toLowerCase() !== "kye") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const [xero, growth] = await Promise.all([xeroSnapshot(), growthSnapshot()]);
  return Response.json({ xero, growth });
}
