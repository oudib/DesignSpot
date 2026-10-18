import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withApiAuth } from "@/lib/apiAuth";

// The whole hierarchy in one call — what an agent needs to pick a solutionId
// / flowId for a ticket, or a submoduleId to create a flow under.
export const GET = withApiAuth(async () => {
  const solutions = await prisma.solution.findMany({
    orderBy: { order: "asc" },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: {
          submodules: {
            orderBy: { order: "asc" },
            include: {
              flows: {
                orderBy: { order: "asc" },
                select: { id: true, name: true, description: true },
              },
            },
          },
        },
      },
    },
  });
  return NextResponse.json({
    solutions: solutions.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      tagline: s.tagline,
      color: s.color,
      language: s.language,
      modules: s.modules.map((m) => ({
        id: m.id,
        name: m.name,
        submodules: m.submodules.map((sm) => ({
          id: sm.id,
          name: sm.name,
          flows: sm.flows,
        })),
      })),
    })),
  });
});
