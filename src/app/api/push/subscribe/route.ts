import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../auth";

export async function POST(req: Request) {
  await migrate();
  const session = await auth();
  const username = session?.user?.email;
  if (!username) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { endpoint, keys } = await req.json();
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return Response.json({ error: "Invalid subscription" }, { status: 400 });
  }
  await sql`
    INSERT INTO push_subscriptions (username, endpoint, p256dh, auth)
    VALUES (${username}, ${endpoint}, ${keys.p256dh}, ${keys.auth})
    ON CONFLICT (endpoint) DO UPDATE SET username = EXCLUDED.username, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
  `;
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  await migrate();
  const { endpoint } = await req.json();
  if (endpoint) await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
  return Response.json({ ok: true });
}
