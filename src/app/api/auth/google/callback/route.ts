import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSession, ALLOWED_EMAIL_DOMAIN } from "@/lib/auth";
import { isAdminEmail } from "@/lib/access";
import { OAUTH_STATE_COOKIE, googleRedirectUri } from "@/lib/googleAuth";

type GoogleIdToken = {
  email?: string;
  email_verified?: boolean;
  name?: string;
  hd?: string;
};

function loginRedirect(req: NextRequest, error: string) {
  const res = NextResponse.redirect(new URL(`/login?error=${error}`, req.url));
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}

// Step 2: Google redirects back here with a one-time code.
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return loginRedirect(req, "google_config");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const stateCookie = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !stateCookie) return loginRedirect(req, "google");

  let from = "/";
  try {
    const parsed = JSON.parse(stateCookie) as { state: string; from: string };
    if (parsed.state !== state) return loginRedirect(req, "google");
    if (parsed.from.startsWith("/")) from = parsed.from;
  } catch {
    return loginRedirect(req, "google");
  }

  // Exchange the code for tokens.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleRedirectUri(req),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return loginRedirect(req, "google");

  const { id_token: idToken } = (await tokenRes.json()) as { id_token?: string };
  if (!idToken) return loginRedirect(req, "google");

  // The id_token comes straight from Google over TLS, so decoding without
  // signature verification is safe here.
  let claims: GoogleIdToken;
  try {
    claims = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString());
  } catch {
    return loginRedirect(req, "google");
  }

  const email = claims.email?.trim().toLowerCase();
  if (!email || claims.email_verified !== true) return loginRedirect(req, "google");

  // The real domain gate — `hd` on the auth URL is only a UI hint.
  if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
    return loginRedirect(req, "domain");
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: claims.name || email.split("@")[0],
        // Google-only account: unguessable placeholder so password login stays unusable.
        password: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
        // New sign-ins can only browse — workspace access is granted by an
        // admin in /manage/users. ADMIN_EMAILS accounts skip straight to admin.
        role: isAdminEmail(email) ? "admin" : "viewer",
      },
    });
  } else if (isAdminEmail(email) && user.role !== "admin") {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { role: "admin" },
    });
  }

  await createSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const res = NextResponse.redirect(new URL(from, req.url));
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}
