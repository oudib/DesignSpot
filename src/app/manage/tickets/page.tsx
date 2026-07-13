import { prisma } from "@/lib/db";
import TicketsClient from "@/components/TicketsClient";
import { currentActor } from "@/lib/access";
import { buildFlowDesignerMap, canManageWithMap } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const actor = await currentActor();
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

  // Only an admin, or a designer already responsible for a ticket's flow
  // (assignee on at least one other ticket there), may edit/delete it.
  // Ticket with no flow falls back to just its own assignee.
  const designerMap = buildFlowDesignerMap(tickets);

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
    updatedAt: t.updatedAt.toISOString(),
    canManage: canManageWithMap(actor, t.flowId, t.assigneeId, designerMap),
  }));

  return (
    <TicketsClient
      tickets={ticketData}
      users={users.map((u) => ({ id: u.id, name: u.name }))}
      tree={tree}
      currentUserId={actor?.userId ?? null}
    />
  );
}
