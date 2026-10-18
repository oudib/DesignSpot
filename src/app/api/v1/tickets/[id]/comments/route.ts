import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiAuth, readBody, str } from "@/lib/apiAuth";
import { addComment } from "@/lib/tickets";
import { notFound } from "@/lib/errors";
import { serializeComment } from "@/lib/apiSerialize";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApiAuth<Ctx>(async (_req, _actor, { params }) => {
  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: {
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!ticket) throw notFound("Ticket not found.");
  return NextResponse.json({ comments: ticket.comments.map(serializeComment) });
});

export const POST = withApiAuth<Ctx>(async (req, actor, { params }) => {
  const { id } = await params;
  const body = await readBody(req);
  const comment = await addComment(actor, id, str(body, "body") ?? "");
  return NextResponse.json({ comment: serializeComment(comment) }, { status: 201 });
});
