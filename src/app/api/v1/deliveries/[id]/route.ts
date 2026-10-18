import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiAuth, readBody, str } from "@/lib/apiAuth";
import { updateDelivery, deleteDelivery, deliveryInclude } from "@/lib/deliveries";
import { notFound } from "@/lib/errors";
import { serializeDelivery } from "@/lib/apiSerialize";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApiAuth<Ctx>(async (_req, _actor, { params }) => {
  const { id } = await params;
  const design = await prisma.design.findUnique({ where: { id }, include: deliveryInclude });
  if (!design) throw notFound("Delivery not found.");
  return NextResponse.json({ delivery: serializeDelivery(design) });
});

export const PATCH = withApiAuth<Ctx>(async (req, actor, { params }) => {
  const { id } = await params;
  const body = await readBody(req);
  const delivery = await updateDelivery(actor, id, {
    title: str(body, "title"),
    linkUrl: str(body, "linkUrl"),
    variant: str(body, "variant"),
  });
  return NextResponse.json({ delivery: serializeDelivery(delivery) });
});

export const DELETE = withApiAuth<Ctx>(async (_req, actor, { params }) => {
  const { id } = await params;
  await deleteDelivery(actor, id);
  return NextResponse.json({ ok: true });
});
