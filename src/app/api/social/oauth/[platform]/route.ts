import { SignJWT } from "jose";
import { migrate } from "@/lib/db";
import { auth } from "../../../../../../auth";
import { appBaseUrl } from "@/lib/social/platforms";

/**
 * GET /api/social/oauth/[platform]?client_id= — kicks off the OAuth connect
 * flow for a client's social account. Supported: meta (Facebook + Instagram)
 * and linkedin. The signed state token carries which client to attach the
 * connected accounts to.
 */
export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  await migrate();
  const session = await auth();
  if (!session?.user || session.user.role === "client") {
    return Response.json({ error: "Staff only" }, { status: 403 });
  }
  const { platform } = await params;
  const clientId = new URL(request.url).searchParams.get("client_id");
  if (!clientId) return Response.json({ error: "client_id is required" }, { status: 400 });

  const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
  const state = await new SignJWT({ client_id: parseInt(clientId, 10), platform })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(secret);
  const redirectUri = `${appBaseUrl(request)}/api/social/oauth/${platform}/callback`;

  if (platform === "meta") {
    if (!process.env.META_APP_ID) {
      return Response.json({ error: "Meta OAuth isn't configured (META_APP_ID / META_APP_SECRET missing). Add the accounts manually for now." }, { status: 503 });
    }
    const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    url.searchParams.set("client_id", process.env.META_APP_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,business_management");
    return Response.redirect(url.toString(), 302);
  }
  if (platform === "linkedin") {
    if (!process.env.LINKEDIN_CLIENT_ID) {
      return Response.json({ error: "LinkedIn OAuth isn't configured (LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET missing). Add the account manually for now." }, { status: 503 });
    }
    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "openid profile w_member_social");
    return Response.redirect(url.toString(), 302);
  }
  return Response.json({ error: `OAuth isn't available for "${platform}" yet — add the account manually and we'll flag its posts for manual publishing.` }, { status: 400 });
}
