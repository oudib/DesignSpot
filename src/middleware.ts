import { NextRequest, NextResponse } from "next/server";
import { verifyToken, SESSION_COOKIE_NAME } from "@/lib/auth";

// The entire platform requires login — only /login itself is public.
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifyToken(token);
  const isLoginPage = req.nextUrl.pathname === "/login";
  // OAuth endpoints must be reachable while logged out.
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth/");

  if (isAuthRoute) {
    return NextResponse.next();
  }

  if (!session && !isLoginPage) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Already signed in — no reason to show the login page.
  if (session && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next.js internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map)$).*)"],
};
