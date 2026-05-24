import { auth } from "./auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isManagement = req.nextUrl.pathname.startsWith("/management");

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }
  if (isManagement) {
    const name = (req.auth?.user?.name ?? "").toLowerCase();
    if (name !== "kye") {
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }
  }
});

export const config = {
  matcher: ["/((?!api/auth|api/mobile|_next/static|_next/image|favicon.ico).*)"],
};
