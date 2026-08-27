import { auth } from "./auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const path = req.nextUrl.pathname;
  const isLoginPage = path === "/login";
  const role = req.auth?.user?.role ?? "staff";

  // Friendly shareable links — send clients straight to a portal section
  if (path === "/it-support" || path === "/support") {
    return NextResponse.redirect(new URL("/portal?section=support", req.nextUrl.origin));
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
    // Staff only enter the portal in preview mode (?client=<id>); manage from /clients/[id]/portal
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  if (path.startsWith("/management")) {
    const name = (req.auth?.user?.name ?? "").toLowerCase();
    if (name !== "kye") {
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }
  }
});

export const config = {
  matcher: ["/((?!api/auth|api/mobile|api/cron|_next/static|_next/image|favicon.ico).*)"],
};
