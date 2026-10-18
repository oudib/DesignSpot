import { NextResponse } from "next/server";
import { withApiAuth, readBody, str } from "@/lib/apiAuth";
import { createFlow } from "@/lib/structure";

// Create a flow under a submodule — so a ticket filed without a flow can get
// one without leaving the API (same as the inline "new flow" on a ticket page).
export const POST = withApiAuth(async (req) => {
  const body = await readBody(req);
  const f = await createFlow({
    submoduleId: str(body, "submoduleId"),
    name: str(body, "name"),
    description: str(body, "description"),
  });
  return NextResponse.json(
    { flow: { id: f.id, name: f.name, description: f.description, submoduleId: f.submoduleId } },
    { status: 201 }
  );
});
