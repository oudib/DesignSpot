import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiAuth, readBody, readTicketPatch } from "@/lib/apiAuth";
import { updateTicket, deleteTicket, ticketInclude } from "@/lib/tickets";
import { deliveryInclude } from "@/lib/deliveries";
import { notFound } from "@/lib/errors";
import { serializeTicket, serializeComment, serializeDelivery } from "@/lib/apiSerialize";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApiAuth<Ctx>(async (_req, _actor, { params }) => {
  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      ...ticketInclude,
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
      designs: { orderBy: { createdAt: "asc" }, include: deliveryInclude },
    },
  });
  if (!ticket) throw notFound("Ticket not found.");
  return NextResponse.json({
    ticket: {
      ...serializeTicket(ticket),
      comments: ticket.comments.map(serializeComment),
      deliveries: ticket.designs.map(serializeDelivery),
    },
  });
});

export const PATCH = withApiAuth<Ctx>(async (req, actor, { params }) => {
  const { id } = await params;
  const body = await readBody(req);
  const ticket = await updateTicket(actor, id, readTicketPatch(body));
  return NextResponse.json({ ticket: serializeTicket(ticket) });
});

export const DELETE = withApiAuth<Ctx>(async (_req, actor, { params }) => {
  const { id } = await params;
  await deleteTicket(actor, id);
  return NextResponse.json({ ok: true });
});
