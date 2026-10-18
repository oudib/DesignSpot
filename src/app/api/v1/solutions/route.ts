import { NextResponse } from "next/server";
import { withApiAuth, readBody, str } from "@/lib/apiAuth";
import { createSolution } from "@/lib/structure";

// Create a solution. GET /api/v1/structure lists the existing ones.
export const POST = withApiAuth(async (req) => {
  const body = await readBody(req);
  const s = await createSolution({
    name: str(body, "name"),
    tagline: str(body, "tagline"),
    description: str(body, "description"),
    color: str(body, "color"),
    icon: str(body, "icon"),
    language: str(body, "language"),
  });
  return NextResponse.json(
    { solution: { id: s.id, name: s.name, slug: s.slug, tagline: s.tagline, color: s.color, language: s.language } },
    { status: 201 }
  );
});
