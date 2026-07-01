import { prisma } from "@/lib/db";
import TicketsClient from "@/components/TicketsClient";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const session = await getSession();
  const [tickets, users, solutions] = await Promise.all([
    prisma.ticket.findMany({
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      include: { assignee: true, solution: true, flow: true },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.solution.findMany({
      orderBy: { order: "asc" },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: {
            submodules: {
              orderBy: { order: "asc" },
              include: { flows: { orderBy: { order: "asc" } } },
            },
          },
        },
      },
    }),
  ]);

  const tree = solutions.map((s) => ({
    id: s.id,
    name: s.name,
    modules: s.modules.map((m) => ({
      id: m.id,
      name: m.name,
      submodules: m.submodules.map((sub) => ({
        id: sub.id,
        name: sub.name,
        flows: sub.flows.map((f) => ({ id: f.id, name: f.name })),
      })),
    })),
  }));

  const ticketData = tickets.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    linearUrl: t.linearUrl,
    assigneeId: t.assigneeId,
    assigneeName: t.assignee?.name ?? null,
    solutionId: t.solutionId,
    solutionName: t.solution?.name ?? null,
    flowId: t.flowId,
    flowName: t.flow?.name ?? null,
  }));

  return (
    <TicketsClient
      tickets={ticketData}
      users={users.map((u) => ({ id: u.id, name: u.name }))}
      tree={tree}
      currentUserId={session?.userId ?? null}
    />
  );
}
