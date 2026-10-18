import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiAuth, readBody, str } from "@/lib/apiAuth";
import { badRequest } from "@/lib/errors";

// Create a flow under a submodule — so a ticket filed without a flow can get
// one without leaving the API (same as the inline "new flow" on a ticket page).
export const POST = withApiAuth(async (req) => {
  const body = await readBody(req);
  const name = str(body, "name") ?? "";
  const submoduleId = str(body, "submoduleId") ?? "";
  if (!name) throw badRequest("name is required.");
  if (!submoduleId) throw badRequest("submoduleId is required (see GET /api/v1/structure).");
  const submodule = await prisma.submodule.findUnique({
    where: { id: submoduleId },
    select: { id: true },
  });
  if (!submodule) throw badRequest(`No submodule with id "${submoduleId}".`);
  const count = await prisma.flow.count({ where: { submoduleId } });
  const flow = await prisma.flow.create({
    data: { name, description: str(body, "description") ?? "", submoduleId, order: count },
    select: { id: true, name: true, description: true, submoduleId: true },
  });
  return NextResponse.json({ flow }, { status: 201 });
});
