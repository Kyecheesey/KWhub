import { jwtVerify } from "jose";
import { sql, migrate } from "@/lib/db";
import { auth } from "../../../../../../../auth";
import { appBaseUrl } from "@/lib/social/platforms";

const GRAPH = "https://graph.facebook.com/v21.0";

function backToPlanner(request: Request, clientId: number | null, msg: string, ok: boolean) {
  const url = new URL(`${appBaseUrl(request)}/content`);
  if (clientId) url.searchParams.set("client", String(clientId));
  url.searchParams.set(ok ? "connected" : "connect_error", msg);
  return Response.redirect(url.toString(), 302);
}

async function upsertAccount(a: {
  clientId: number; platform: string; name: string; ref: string;
  token: string; expiresAt: string | null; by: string | null;
}) {
  const existing = await sql`
    SELECT id FROM social_accounts
    WHERE client_id = ${a.clientId} AND platform = ${a.platform} AND account_ref = ${a.ref}
  `;
  if (existing.length > 0) {
    await sql`
      UPDATE social_accounts SET account_name = ${a.name}, access_token = ${a.token},
        token_expires_at = ${a.expiresAt}, status = 'connected', connected_by = ${a.by}
      WHERE id = ${(existing[0] as { id: number }).id}
    `;
  } else {
    await sql`
      INSERT INTO social_accounts (client_id, platform, account_name, account_ref, access_token, token_expires_at, status, connected_by)
      VALUES (${a.clientId}, ${a.platform}, ${a.name}, ${a.ref}, ${a.token}, ${a.expiresAt}, 'connected', ${a.by})
    `;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  await migrate();
  const session = await auth();
  if (!session?.user || session.user.role === "client") {
    return Response.json({ error: "Staff only" }, { status: 403 });
  }
  const { platform } = await params;
  const sp = new URL(request.url).searchParams;
  const code = sp.get("code");
  const state = sp.get("state");

  let clientId: number | null = null;
  try {
    const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
    const { payload } = await jwtVerify(state ?? "", secret);
    clientId = payload.client_id as number;
  } catch {
    return backToPlanner(request, null, "Connection link expired — try again.", false);
  }
  if (!code) {
    return backToPlanner(request, clientId, sp.get("error_description") ?? "Connection was cancelled.", false);
  }
  const redirectUri = `${appBaseUrl(request)}/api/social/oauth/${platform}/callback`;
  const by = session.user.name ?? null;

  try {
    if (platform === "meta") {
      // code → short-lived user token → long-lived user token → page tokens
      const tokenRes = await fetch(`${GRAPH}/oauth/access_token?` + new URLSearchParams({
        client_id: process.env.META_APP_ID!, client_secret: process.env.META_APP_SECRET!,
        redirect_uri: redirectUri, code,
      }));
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData?.error?.message ?? "Meta token exchange failed");
      const longRes = await fetch(`${GRAPH}/oauth/access_token?` + new URLSearchParams({
        grant_type: "fb_exchange_token", client_id: process.env.META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!, fb_exchange_token: tokenData.access_token,
      }));
      const longData = await longRes.json();
      const userToken = longRes.ok ? longData.access_token : tokenData.access_token;

      const pagesRes = await fetch(`${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${userToken}`);
      const pages = await pagesRes.json();
      if (!pagesRes.ok) throw new Error(pages?.error?.message ?? "Couldn't list Facebook pages");
      let count = 0;
      for (const page of pages.data ?? []) {
        await upsertAccount({
          clientId, platform: "facebook", name: page.name, ref: page.id,
          token: page.access_token, expiresAt: null, by,
        });
        count++;
        if (page.instagram_business_account) {
          await upsertAccount({
            clientId, platform: "instagram",
            name: `@${page.instagram_business_account.username ?? page.name}`,
            ref: page.instagram_business_account.id,
            token: page.access_token, expiresAt: null, by,
          });
          count++;
        }
      }
      if (count === 0) return backToPlanner(request, clientId, "No Facebook pages found on that account.", false);
      return backToPlanner(request, clientId, `Connected ${count} Meta account${count === 1 ? "" : "s"}.`, true);
    }

    if (platform === "linkedin") {
      const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code", code, redirect_uri: redirectUri,
          client_id: process.env.LINKEDIN_CLIENT_ID!, client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData?.error_description ?? "LinkedIn token exchange failed");
      const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const me = await meRes.json();
      if (!meRes.ok) throw new Error("Couldn't read the LinkedIn profile");
      const expiresAt = tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null;
      await upsertAccount({
        clientId, platform: "linkedin", name: me.name ?? "LinkedIn",
        ref: `urn:li:person:${me.sub}`, token: tokenData.access_token, expiresAt, by,
      });
      return backToPlanner(request, clientId, `Connected LinkedIn (${me.name ?? "profile"}).`, true);
    }

    return backToPlanner(request, clientId, `Unknown platform "${platform}".`, false);
  } catch (err) {
    return backToPlanner(request, clientId, err instanceof Error ? err.message : "Connection failed.", false);
  }
}
