import { NextResponse } from "next/server";
import { withApiAuth, readBody, str } from "@/lib/apiAuth";
import { createModule } from "@/lib/structure";

// Create a module under a solution.
export const POST = withApiAuth(async (req) => {
  const body = await readBody(req);
  const m = await createModule({ solutionId: str(body, "solutionId"), name: str(body, "name") });
  return NextResponse.json(
    { module: { id: m.id, name: m.name, slug: m.slug, solutionId: m.solutionId } },
    { status: 201 }
  );
});
