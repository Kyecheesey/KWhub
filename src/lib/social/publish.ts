import { sql } from "../db";
import { notifyStaff } from "../portalNotify";

/**
 * Publishing engine — takes an approved post and pushes it to each of its
 * channels via the stored account tokens. Channels on platforms without an
 * adapter (or accounts added manually, without tokens) are marked "manual"
 * and the team is emailed to post by hand.
 *
 * Adapters:
 *  - facebook:  Page feed/photos via Graph API (token = Page access token)
 *  - instagram: Business account via Graph API container flow (needs an image)
 *  - linkedin:  Organization or member post via /rest/posts
 */

interface PostRow {
  id: number; client_id: number; title: string | null; caption: string | null;
  scheduled_at: string | null; status: string;
}
interface ChannelRow {
  id: number; post_id: number; social_account_id: number | null;
  platform: string; publish_status: string;
}
interface AccountRow {
  id: number; platform: string; account_name: string; account_ref: string | null;
  access_token: string | null; token_expires_at: string | null; status: string;
}
interface MediaRow { url: string; content_type: string | null; }

type PublishOutcome =
  | { ok: true; externalId: string | null }
  | { ok: false; manual: boolean; error: string };

const GRAPH = "https://graph.facebook.com/v21.0";

async function publishFacebook(account: AccountRow, caption: string, media: MediaRow[]): Promise<PublishOutcome> {
  const pageId = account.account_ref;
  const token = account.access_token;
  if (!pageId || !token) return { ok: false, manual: true, error: "No page token stored — post manually." };
  const image = media.find((m) => m.content_type?.startsWith("image/"));
  const endpoint = image ? `${GRAPH}/${pageId}/photos` : `${GRAPH}/${pageId}/feed`;
  const params = new URLSearchParams({ access_token: token });
  if (image) { params.set("url", image.url); params.set("caption", caption); }
  else params.set("message", caption);
  const res = await fetch(endpoint, { method: "POST", body: params });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, manual: false, error: data?.error?.message ?? `Facebook error ${res.status}` };
  return { ok: true, externalId: data.post_id ?? data.id ?? null };
}

async function publishInstagram(account: AccountRow, caption: string, media: MediaRow[]): Promise<PublishOutcome> {
  const igUserId = account.account_ref;
  const token = account.access_token;
  if (!igUserId || !token) return { ok: false, manual: true, error: "No account token stored — post manually." };
  const image = media.find((m) => m.content_type?.startsWith("image/"));
  if (!image) return { ok: false, manual: true, error: "Instagram requires an image — post manually." };
  const create = await fetch(`${GRAPH}/${igUserId}/media`, {
    method: "POST",
    body: new URLSearchParams({ access_token: token, image_url: image.url, caption }),
  });
  const container = await create.json().catch(() => ({}));
  if (!create.ok || !container.id) {
    return { ok: false, manual: false, error: container?.error?.message ?? `Instagram error ${create.status}` };
  }
  const pub = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
    method: "POST",
    body: new URLSearchParams({ access_token: token, creation_id: container.id }),
  });
  const published = await pub.json().catch(() => ({}));
  if (!pub.ok) return { ok: false, manual: false, error: published?.error?.message ?? `Instagram error ${pub.status}` };
  return { ok: true, externalId: published.id ?? null };
}

async function publishLinkedIn(account: AccountRow, caption: string): Promise<PublishOutcome> {
  const author = account.account_ref; // e.g. urn:li:organization:123 or urn:li:person:abc
  const token = account.access_token;
  if (!author || !token) return { ok: false, manual: true, error: "No account token stored — post manually." };
  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": "202411",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author,
      commentary: caption,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, manual: false, error: `LinkedIn error ${res.status}: ${body.slice(0, 200)}` };
  }
  return { ok: true, externalId: res.headers.get("x-restli-id") };
}

async function publishChannel(channel: ChannelRow, post: PostRow, media: MediaRow[]): Promise<PublishOutcome> {
  const caption = post.caption ?? post.title ?? "";
  const account = channel.social_account_id
    ? ((await sql`SELECT * FROM social_accounts WHERE id = ${channel.social_account_id}`)[0] as unknown as AccountRow | undefined)
    : undefined;
  if (!account) return { ok: false, manual: true, error: "No connected account — post manually." };
  if (account.status !== "connected" || !account.access_token) {
    return { ok: false, manual: true, error: `${account.account_name} isn't auto-connected — post manually.` };
  }
  if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
    await sql`UPDATE social_accounts SET status = 'expired' WHERE id = ${account.id}`;
    return { ok: false, manual: true, error: `${account.account_name}'s connection has expired — reconnect it.` };
  }
  try {
    switch (channel.platform) {
      case "facebook": return await publishFacebook(account, caption, media);
      case "instagram": return await publishInstagram(account, caption, media);
      case "linkedin": return await publishLinkedIn(account, caption);
      default: return { ok: false, manual: true, error: "Auto-publish isn't supported for this platform yet — post manually." };
    }
  } catch (err) {
    return { ok: false, manual: false, error: err instanceof Error ? err.message : "Publish failed" };
  }
}

/**
 * Publish every still-pending channel of a post. Updates channel + post rows
 * and returns a summary. Safe to call repeatedly — published channels are
 * skipped, failed ones retried.
 */
export async function publishPost(postId: number): Promise<{ published: number; manual: number; failed: number; errors: string[] }> {
  const post = (await sql`SELECT * FROM posts WHERE id = ${postId}`)[0] as unknown as PostRow | undefined;
  if (!post) return { published: 0, manual: 0, failed: 1, errors: ["Post not found"] };
  const channels = (await sql`
    SELECT * FROM post_channels WHERE post_id = ${postId} AND publish_status NOT IN ('published', 'manual')
  `) as unknown as ChannelRow[];
  const media = (await sql`SELECT url, content_type FROM post_media WHERE post_id = ${postId} ORDER BY id`) as unknown as MediaRow[];

  let published = 0, manual = 0, failed = 0;
  const errors: string[] = [];
  for (const ch of channels) {
    const result = await publishChannel(ch, post, media);
    if (result.ok) {
      published++;
      await sql`
        UPDATE post_channels SET publish_status = 'published', external_post_id = ${result.externalId}, published_at = NOW(), error = NULL
        WHERE id = ${ch.id}
      `;
    } else if (result.manual) {
      manual++;
      await sql`UPDATE post_channels SET publish_status = 'manual', error = ${result.error} WHERE id = ${ch.id}`;
      errors.push(`${ch.platform}: ${result.error}`);
    } else {
      failed++;
      await sql`UPDATE post_channels SET publish_status = 'failed', error = ${result.error} WHERE id = ${ch.id}`;
      errors.push(`${ch.platform}: ${result.error}`);
    }
  }

  const remaining = (await sql`
    SELECT COUNT(*)::int AS n FROM post_channels WHERE post_id = ${postId} AND publish_status IN ('pending', 'failed')
  `)[0] as { n: number };
  if (remaining.n === 0) {
    await sql`
      UPDATE posts SET status = 'published', published_at = COALESCE(published_at, NOW()),
        publish_error = ${errors.length ? errors.join(" · ") : null}, updated_at = NOW()
      WHERE id = ${postId}
    `;
  } else if (failed > 0) {
    await sql`UPDATE posts SET publish_error = ${errors.join(" · ")}, updated_at = NOW() WHERE id = ${postId}`;
  }

  if (manual > 0) {
    await notifyStaff(
      post.client_id,
      `Manual posting needed: "${post.title ?? post.caption?.slice(0, 60) ?? "Untitled post"}"`,
      `A scheduled post is due but some channels can't auto-publish:\n\n${errors.join("\n")}\n\nOpen the Content planner to copy the caption and post manually.`
    );
  }
  return { published, manual, failed, errors };
}
