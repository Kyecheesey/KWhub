import webpush from "web-push";
import { sql } from "./db";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:kye@kwinnovations.com.au", pub, priv);
  configured = true;
  return true;
}

/**
 * Send a push notification to every device a user has subscribed.
 * Cleans up subscriptions the push service reports as gone. Never throws.
 */
export async function sendPush(username: string, payload: { title: string; body: string; url?: string }) {
  try {
    if (!ensureConfigured()) return;
    const subs = await sql`SELECT * FROM push_subscriptions WHERE LOWER(username) = LOWER(${username})`;
    await Promise.all(
      (subs as { endpoint: string; p256dh: string; auth: string }[]).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await sql`DELETE FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
          }
        }
      }),
    );
  } catch {
    // Push must never break the request it rides on.
  }
}
