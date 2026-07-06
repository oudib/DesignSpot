import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/auth";
import { OAUTH_STATE_COOKIE, googleRedirectUri } from "@/lib/googleAuth";

// Step 1: send the user to Google's consent screen.
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL("/login?error=google_config", req.url));
  }

  const from = req.nextUrl.searchParams.get("from") ?? "/";
  const state = randomBytes(16).toString("hex");

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", googleRedirectUri(req));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  // Hint Google to only offer company accounts — enforced again in the callback,
  // since `hd` is cosmetic and can be bypassed.
  authUrl.searchParams.set("hd", ALLOWED_EMAIL_DOMAIN);
  authUrl.searchParams.set("prompt", "select_account");
  authUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authUrl);
  res.cookies.set(OAUTH_STATE_COOKIE, JSON.stringify({ state, from }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });
  return res;
}
