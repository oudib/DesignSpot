import { NextResponse } from "next/server";
import { withApiAuth, readBody, str } from "@/lib/apiAuth";
import { createSubmodule } from "@/lib/structure";

// Create a submodule under a module.
export const POST = withApiAuth(async (req) => {
  const body = await readBody(req);
  const sm = await createSubmodule({ moduleId: str(body, "moduleId"), name: str(body, "name") });
  return NextResponse.json(
    { submodule: { id: sm.id, name: sm.name, slug: sm.slug, moduleId: sm.moduleId } },
    { status: 201 }
  );
});
