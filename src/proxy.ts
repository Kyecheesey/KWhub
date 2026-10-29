import { auth } from "../auth";
import { NextResponse } from "next/server";

// True for base itself and anything under it ("/partner" and "/partner/x",
// but not "/partnerships", which is a separate hub page)
const under = (path: string, base: string) => path === base || path.startsWith(base + "/");

// Which hub sections use each staff API (see ACCESS_SECTIONS in lib/nav)
const API_SECTIONS: [string, string[]][] = [
  ["/api/clients", ["/clients", "/client-jobs", "/contracts", "/proposals", "/my-work"]],
  ["/api/client-jobs", ["/clients", "/client-jobs", "/my-work"]],
  ["/api/call-list", ["/clients", "/potentials", "/call-list"]],
  ["/api/portal", ["/clients"]],
  ["/api/stripe/client", ["/clients"]],
  ["/api/posts", ["/clients"]],
  ["/api/social-accounts", ["/clients"]],
  ["/api/contracts", ["/contracts"]],
  ["/api/potentials", ["/potentials", "/proposals", "/follow-ups", "/insights"]],
  ["/api/proposals", ["/proposals"]],
  ["/api/activities", ["/activities", "/my-work"]],
  ["/api/tasks", ["/tasks", "/my-work"]],
];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const path = req.nextUrl.pathname;
  const isLoginPage = path === "/login";
  const role = req.auth?.user?.role ?? "staff";

  // Public support intake + signed webhooks — no login required
  if (path.startsWith("/api/public") || path === "/api/signit/webhook" || path === "/api/stripe/webhook" || path === "/api/proposalme/webhook" || path === "/api/proposalme/login" || path === "/api/proposalme/search") {
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
  if (path === "/content") {
    // The Content planner was removed; send old bookmarks home
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
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
      under(path, "/partner") || under(path, "/api/partner") ||
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

  if (isLoggedIn && role !== "partner" && (under(path, "/partner") || under(path, "/api/partner"))) {
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

  // Per-user section access — Kye assigns sections from Management → Users &
  // access; users with a restricted list are bounced off pages outside it.
  // (Changes reach a signed-in user within minutes; see RECHECK_MS in auth.ts.)
  if (isLoggedIn && role === "staff" && (req.auth?.user?.name ?? "").toLowerCase() !== "kye") {
    const sections = (req.auth?.user as { sections?: string[] | null } | undefined)?.sections;
    if (Array.isArray(sections)) {
      const gated = ["/clients", "/client-jobs", "/contracts", "/potentials", "/proposals",
        "/follow-ups", "/call-list", "/insights", "/my-work", "/activities", "/tasks"];
      const hit = gated.find((p) => path === p || path.startsWith(p + "/"));
      if (hit && !sections.includes(hit)) {
        return NextResponse.redirect(new URL("/", req.nextUrl.origin));
      }
      // The same restriction for the data behind those pages: an API is open
      // if any section the user has relies on it.
      const api = API_SECTIONS.find(([prefix]) => under(path, prefix));
      if (api && !api[1].some((s) => sections.includes(s))) {
        return NextResponse.json({ error: "You don't have access to this section" }, { status: 403 });
      }
    }
  }

  if (path.startsWith("/management") || path.startsWith("/directions") || path.startsWith("/api/directions")
      || path.startsWith("/partnerships") || path.startsWith("/api/partnerships")
      || path.startsWith("/api/xero") || path.startsWith("/api/staff-users")) {
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
