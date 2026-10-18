// Ticket operations shared by the /manage server actions (cookie session) and
// the /api/v1 routes (API key). Both resolve the caller to an Actor first; the
// permission rules, validation and Linear sync live here so the two entry
// points can't drift apart.

import { prisma } from "@/lib/db";
import { canManageFlow } from "@/lib/access";
import { TICKET_STATUSES, TICKET_PRIORITIES, type Actor } from "@/lib/utils";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { actingLinearKey, announceStatus, syncTicketChanges } from "@/lib/linearSync";

export type TicketActor = NonNullable<Actor>;

export type TicketInput = {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  linearUrl?: string;
  assigneeId?: string | null;
  solutionId?: string | null;
  flowId?: string | null;
};

const STATUS_VALUES = TICKET_STATUSES.map((s) => s.value) as string[];
const PRIORITY_VALUES = TICKET_PRIORITIES.map((p) => p.value) as string[];

export function assertStatus(status: string) {
  if (!STATUS_VALUES.includes(status)) {
    throw badRequest(`Unknown status "${status}". Use one of: ${STATUS_VALUES.join(", ")}.`);
  }
}

export function assertPriority(priority: string) {
  if (!PRIORITY_VALUES.includes(priority)) {
    throw badRequest(
      `Unknown priority "${priority}". Use one of: ${PRIORITY_VALUES.join(", ")}.`
    );
  }
}

function assertLinearUrl(url: string) {
  if (url && !/linear\.app\//i.test(url)) {
    throw badRequest("linearUrl doesn't look like a Linear link.");
  }
}

/** Check the referenced rows exist, so a typo'd id fails loudly instead of at the DB. */
async function assertReferences(input: TicketInput) {
  if (input.assigneeId) {
    const u = await prisma.user.findUnique({ where: { id: input.assigneeId }, select: { id: true } });
    if (!u) throw badRequest(`No user with id "${input.assigneeId}".`);
  }
  if (input.solutionId) {
    const s = await prisma.solution.findUnique({ where: { id: input.solutionId }, select: { id: true } });
    if (!s) throw badRequest(`No solution with id "${input.solutionId}".`);
  }
  if (input.flowId) {
    const f = await prisma.flow.findUnique({ where: { id: input.flowId }, select: { id: true } });
    if (!f) throw badRequest(`No flow with id "${input.flowId}".`);
  }
}

export const ticketInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  solution: { select: { id: true, name: true, slug: true } },
  flow: {
    select: {
      id: true,
      name: true,
      submodule: {
        select: {
          id: true,
          name: true,
          module: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

/** Create a ticket as `actor`. Unassigned tickets default to the actor. */
export async function createTicket(actor: TicketActor, input: TicketInput) {
  const title = (input.title ?? "").trim();
  if (!title) throw badRequest("title is required.");
  const status = input.status || "todo";
  const priority = input.priority || "medium";
  assertStatus(status);
  assertPriority(priority);
  const linearUrl = input.linearUrl ?? "";
  assertLinearUrl(linearUrl);
  await assertReferences(input);

  const ticket = await prisma.ticket.create({
    data: {
      title,
      description: input.description ?? "",
      status,
      priority,
      linearUrl,
      assigneeId: input.assigneeId || actor.userId,
      solutionId: input.solutionId || null,
      flowId: input.flowId || null,
    },
    include: ticketInclude,
  });

  // Push to Linear (as the acting user): announce the status if it wasn't
  // created as a plain "todo". The flow-link comment is intentionally not
  // posted on creation (only later, when the link/flow changes via update).
  if (linearUrl && status !== "todo") {
    await announceStatus(await actingLinearKey(actor.userId), linearUrl, status);
  }
  return ticket;
}

/**
 * Partially update a ticket. Only the keys present in `patch` change; `null`
 * clears an optional relation (assignee / solution / flow). The actor must be
 * an admin or a designer responsible for the ticket's flow.
 */
export async function updateTicket(actor: TicketActor, id: string, patch: TicketInput) {
  const prev = await prisma.ticket.findUnique({ where: { id } });
  if (!prev) throw notFound("Ticket not found.");
  if (!(await canManageFlow(actor, prev.flowId, prev.assigneeId))) throw forbidden();

  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) throw badRequest("title can't be empty.");
    data.title = title;
  }
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.status !== undefined) {
    assertStatus(patch.status);
    data.status = patch.status;
  }
  if (patch.priority !== undefined) {
    assertPriority(patch.priority);
    data.priority = patch.priority;
  }
  if (patch.linearUrl !== undefined) {
    assertLinearUrl(patch.linearUrl);
    data.linearUrl = patch.linearUrl;
  }
  if (patch.assigneeId !== undefined) data.assigneeId = patch.assigneeId || null;
  if (patch.solutionId !== undefined) data.solutionId = patch.solutionId || null;
  if (patch.flowId !== undefined) data.flowId = patch.flowId || null;
  await assertReferences(patch);

  const ticket = await prisma.ticket.update({
    where: { id },
    data,
    include: ticketInclude,
  });
  await syncTicketChanges(await actingLinearKey(actor.userId), prev, {
    linearUrl: ticket.linearUrl,
    flowId: ticket.flowId,
    status: ticket.status,
  });
  return ticket;
}

/** Status-only change — the board's drag-and-drop. No permission gate, like the UI. */
export async function setTicketStatus(actor: TicketActor, id: string, status: string) {
  assertStatus(status);
  const prev = await prisma.ticket.findUnique({ where: { id } });
  if (!prev) throw notFound("Ticket not found.");
  const ticket = await prisma.ticket.update({
    where: { id },
    data: { status },
    include: ticketInclude,
  });
  if (prev.status !== status) {
    await announceStatus(await actingLinearKey(actor.userId), prev.linearUrl, status);
  }
  return ticket;
}

export async function deleteTicket(actor: TicketActor, id: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { flowId: true, assigneeId: true },
  });
  if (!ticket) throw notFound("Ticket not found.");
  if (!(await canManageFlow(actor, ticket.flowId, ticket.assigneeId))) throw forbidden();
  await prisma.ticket.delete({ where: { id } });
}

export async function addComment(actor: TicketActor, ticketId: string, body: string) {
  const clean = body.trim();
  if (!clean) throw badRequest("body is required.");
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!ticket) throw notFound("Ticket not found.");
  return prisma.comment.create({
    data: { ticketId, body: clean, authorId: actor.userId },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
}
