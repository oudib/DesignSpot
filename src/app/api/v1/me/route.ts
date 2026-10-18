import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/apiAuth";
import { serializeUser } from "@/lib/apiSerialize";

export const GET = withApiAuth(async (_req, actor) =>
  NextResponse.json({
    user: serializeUser(actor.user),
    apiKey: actor.apiKey,
  })
);
