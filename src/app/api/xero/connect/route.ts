import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { XERO_SCOPES, xeroRedirectUri } from "@/lib/xero";

/**
 * Kicks off the Xero OAuth 2.0 web flow (Kye-only via the proxy).
 * Sends the browser to Xero's consent screen; Xero returns to
 * /api/xero/callback with a code we exchange for tokens.
 */
export async function GET(request: Request) {
  if (!process.env.XERO_CLIENT_ID) {
    return NextResponse.redirect(new URL("/directions?xero_error=XERO_CLIENT_ID+isn%27t+set+in+Vercel", request.url));
  }
  const origin = new URL(request.url).origin;
  const state = randomBytes(16).toString("hex");
  const authorize = new URL("https://login.xero.com/identity/connect/authorize");
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", process.env.XERO_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", xeroRedirectUri(origin));
  authorize.searchParams.set("scope", XERO_SCOPES);
  authorize.searchParams.set("state", state);

  // ?debug=1 → show exactly what would be sent, for matching against the
  // Xero app config when the consent screen rejects the request.
  if (new URL(request.url).searchParams.get("debug") === "1") {
    return NextResponse.json({
      client_id: process.env.XERO_CLIENT_ID,
      redirect_uri: xeroRedirectUri(origin),
      scopes: XERO_SCOPES,
      authorize_url: authorize.toString(),
      note: "client_id must be the NEW web app's Client ID, and redirect_uri must appear character-for-character in that app's OAuth 2.0 redirect URIs.",
    });
  }

  const res = NextResponse.redirect(authorize);
  res.cookies.set("xero_oauth_state", state, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600,
  });
  return res;
}
