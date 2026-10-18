import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiAuth, readBody, readTicketPatch } from "@/lib/apiAuth";
import { createTicket, ticketInclude, assertStatus, assertPriority } from "@/lib/tickets";
import { serializeTicket } from "@/lib/apiSerialize";


export const GET = withApiAuth(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const status = q.get("status") ?? undefined;
  const priority = q.get("priority") ?? undefined;
  if (status) assertStatus(status);
  if (priority) assertPriority(priority);
  const search = q.get("q")?.trim();
  const limit = Math.min(Math.max(Number(q.get("limit") ?? 100) || 100, 1), 500);

  const tickets = await prisma.ticket.findMany({
    where: {
      status,
      priority,
      assigneeId: q.get("assigneeId") ?? undefined,
      solutionId: q.get("solutionId") ?? undefined,
      flowId: q.get("flowId") ?? undefined,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { linearUrl: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: ticketInclude,
  });
  return NextResponse.json({ tickets: tickets.map(serializeTicket) });
});

export const POST = withApiAuth(async (req, actor) => {
  const body = await readBody(req);
  const ticket = await createTicket(actor, readTicketPatch(body));
  return NextResponse.json({ ticket: serializeTicket(ticket) }, { status: 201 });
});
