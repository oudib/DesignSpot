import type { NextRequest } from "next/server";

export const OAUTH_STATE_COOKIE = "sobrus_ds_oauth_state";

/** Absolute callback URL registered in the Google Cloud console. */
export function googleRedirectUri(req: NextRequest) {
  const base = process.env.APP_BASE_URL ?? req.nextUrl.origin;
  return new URL("/api/auth/google/callback", base).toString();
}
