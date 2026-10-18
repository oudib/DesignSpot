import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiAuth } from "@/lib/apiAuth";
import { serializeUser } from "@/lib/apiSerialize";

export const GET = withApiAuth(async () => {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
  return NextResponse.json({ users: users.map(serializeUser) });
});
