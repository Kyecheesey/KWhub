import { NextResponse } from "next/server";
import { migrate } from "@/lib/db";
import { exchangeXeroCode, saveXeroTokens, xeroConnections, xeroRedirectUri } from "@/lib/xero";

/**
 * Xero OAuth callback: verifies state, exchanges the code for tokens,
 * resolves the organisation (tenant) and stores everything in settings.
 * The refresh token rotates on every refresh, so this stored set is the
 * single source of truth from here on.
 */
export async function GET(request: Request) {
  await migrate();
  const url = new URL(request.url);
  const back = (params: string) => NextResponse.redirect(new URL(`/directions?${params}`, url.origin));

  const error = url.searchParams.get("error");
  if (error) return back(`xero_error=${encodeURIComponent(error)}`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers.get("cookie")?.match(/(?:^|;\s*)xero_oauth_state=([^;]+)/)?.[1];
  if (!code || !state || !cookieState || state !== cookieState) {
    return back("xero_error=State+mismatch+—+try+Connect+Xero+again");
  }

  const exchanged = await exchangeXeroCode(code, xeroRedirectUri(url.origin));
  if (!exchanged.ok) return back(`xero_error=${encodeURIComponent(exchanged.error)}`);

  const connections = await xeroConnections(exchanged.access_token);
  if (connections.length === 0) {
    return back("xero_error=No+Xero+organisation+was+authorised");
  }
  // Prefer the KW organisation if several were authorised
  const tenant = connections.find((c) => /kw|innovations/i.test(c.tenantName ?? "")) ?? connections[0];

  await saveXeroTokens({
    access_token: exchanged.access_token,
    refresh_token: exchanged.refresh_token,
    expires_at: Date.now() + exchanged.expires_in * 1000,
    tenant_id: tenant.tenantId,
    tenant_name: tenant.tenantName,
  });

  const res = back(`xero_connected=${encodeURIComponent(tenant.tenantName ?? "Xero")}`);
  res.cookies.set("xero_oauth_state", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
