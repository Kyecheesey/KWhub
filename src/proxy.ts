import { auth } from "../auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const path = req.nextUrl.pathname;
  const isLoginPage = path === "/login";
  const role = req.auth?.user?.role ?? "staff";

  // Public support intake — no login required
  if (path.startsWith("/api/public")) {
    return;
  }
  if (path === "/support") {
    return NextResponse.redirect(new URL("/it-support", req.nextUrl.origin));
  }
  if (path === "/it-support") {
    // Logged-in clients get their portal's support tab instead of the public form
    if (isLoggedIn && role === "client") {
      return NextResponse.redirect(new URL("/portal?section=support", req.nextUrl.origin));
    }
    return;
  }
  if (path === "/signup" || path === "/sign-up") {
    if (path === "/sign-up") {
      return NextResponse.redirect(new URL("/signup", req.nextUrl.origin));
    }
    // Logged-in clients already have a portal — send them there
    if (isLoggedIn && role === "client") {
      return NextResponse.redirect(new URL("/portal", req.nextUrl.origin));
    }
    return;
  }
  if (path === "/marketing") {
    return NextResponse.redirect(new URL("/portal?section=marketing", req.nextUrl.origin));
  }

  if (!isLoggedIn && !isLoginPage) {
    const login = new URL("/login", req.nextUrl.origin);
    // Keep portal deep links (e.g. /it-support → /portal?section=support) across login
    if (path.startsWith("/portal")) login.searchParams.set("next", path + req.nextUrl.search);
    return NextResponse.redirect(login);
  }
  if (isLoggedIn && isLoginPage) {
    const home = role === "client" ? "/portal" : role === "partner" ? "/partner" : "/";
    return NextResponse.redirect(new URL(home, req.nextUrl.origin));
  }

  if (isLoggedIn && role === "partner") {
    // Partners (e.g. GC Media Group) live in their own workspace. They get
    // /partner and its APIs, plus portal preview — resolvePortalScope locks
    // portal APIs to clients belonging to their own partner org. Everything
    // else in the KWI hub is off limits.
    const allowed =
      path.startsWith("/partner") || path.startsWith("/api/partner") ||
      path.startsWith("/portal") || path.startsWith("/api/portal") ||
      path.startsWith("/api/account") || // change their own password
      path.startsWith("/api/push"); // push notifications on their devices
    if (!allowed) {
      if (path.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/partner", req.nextUrl.origin));
    }
  }

  if (isLoggedIn && role !== "partner" && (path.startsWith("/partner") || path.startsWith("/api/partner"))) {
    // KWI staff and clients never enter the partner workspace — the two
    // businesses stay fully separated.
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.redirect(new URL(role === "client" ? "/portal" : "/", req.nextUrl.origin));
  }

  if (isLoggedIn && role === "client") {
    // Clients only get the portal and its APIs
    const allowed = path.startsWith("/portal") || path.startsWith("/api/portal");
    if (!allowed) {
      if (path.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/portal", req.nextUrl.origin));
    }
  }

  if (isLoggedIn && role !== "client" && path === "/portal" && !req.nextUrl.searchParams.has("client")) {
    // Staff/partners only enter the portal in preview mode (?client=<id>)
    return NextResponse.redirect(new URL(role === "partner" ? "/partner" : "/", req.nextUrl.origin));
  }

  if (path.startsWith("/management") || path.startsWith("/directions") || path.startsWith("/api/directions")
      || path.startsWith("/partnerships") || path.startsWith("/api/partnerships")
      || path.startsWith("/api/xero")) {
    const name = (req.auth?.user?.name ?? "").toLowerCase();
    if (name !== "kye") {
      if (path.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }
  }
});

export const config = {
  matcher: ["/((?!api/auth|api/mobile|api/cron|_next/static|_next/image|favicon.ico).*)"],
};
