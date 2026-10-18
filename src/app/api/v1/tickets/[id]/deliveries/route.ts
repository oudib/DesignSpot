import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiAuth, readBody, str, bool, file } from "@/lib/apiAuth";
import { createDelivery, deliveryInclude } from "@/lib/deliveries";
import { notFound } from "@/lib/errors";
import { serializeDelivery } from "@/lib/apiSerialize";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApiAuth<Ctx>(async (_req, _actor, { params }) => {
  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
  if (!ticket) throw notFound("Ticket not found.");
  const designs = await prisma.design.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: "asc" },
    include: deliveryInclude,
  });
  return NextResponse.json({ deliveries: designs.map(serializeDelivery) });
});

// Deliver a design for this ticket. JSON for a link-only delivery, or
// multipart/form-data with a `file` field to upload the deliverable too.
export const POST = withApiAuth<Ctx>(async (req, actor, { params }) => {
  const { id } = await params;
  const body = await readBody(req);
  const delivery = await createDelivery(actor, {
    ticketId: id,
    flowId: str(body, "flowId") || null,
    title: str(body, "title") ?? "",
    linkUrl: str(body, "linkUrl"),
    variant: str(body, "variant"),
    markDone: bool(body, "markDone") ?? false,
    file: file(body) ?? null,
  });
  return NextResponse.json({ delivery: serializeDelivery(delivery) }, { status: 201 });
});
