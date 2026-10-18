import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/apiAuth";
import { deleteDeliveryFile } from "@/lib/deliveries";

type Ctx = { params: Promise<{ id: string }> };

// Deletes the file and every version in its revision chain.
export const DELETE = withApiAuth<Ctx>(async (_req, actor, { params }) => {
  const { id } = await params;
  await deleteDeliveryFile(actor, id);
  return NextResponse.json({ ok: true });
});
