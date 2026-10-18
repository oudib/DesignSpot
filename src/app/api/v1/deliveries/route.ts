import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiAuth, readBody, str, bool, file } from "@/lib/apiAuth";
import { createDelivery, deliveryInclude } from "@/lib/deliveries";
import { serializeDelivery } from "@/lib/apiSerialize";

export const GET = withApiAuth(async (req: NextRequest) => {
  const q = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(q.get("limit") ?? 100) || 100, 1), 500);
  const designs = await prisma.design.findMany({
    where: {
      ticketId: q.get("ticketId") ?? undefined,
      flowId: q.get("flowId") ?? undefined,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: deliveryInclude,
  });
  return NextResponse.json({ deliveries: designs.map(serializeDelivery) });
});

export const POST = withApiAuth(async (req, actor) => {
  const body = await readBody(req);
  const delivery = await createDelivery(actor, {
    ticketId: str(body, "ticketId") || null,
    flowId: str(body, "flowId") || null,
    title: str(body, "title") ?? "",
    linkUrl: str(body, "linkUrl"),
    variant: str(body, "variant"),
    markDone: bool(body, "markDone") ?? false,
    file: file(body) ?? null,
  });
  return NextResponse.json({ delivery: serializeDelivery(delivery) }, { status: 201 });
});
