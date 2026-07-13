import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  updateTicketDetails,
  deleteTicketAndRedirect,
  addComment,
  deleteComment,
} from "@/app/manage/actions";
import { currentActor, canManageFlow } from "@/lib/access";
import {
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  statusMeta,
  priorityMeta,
} from "@/lib/utils";
import GeneratePromptButton from "@/components/GeneratePromptButton";
import { MarkDoneButton, DeliverablesCard } from "@/components/TicketDelivery";

export const dynamic = "force-dynamic";

function fmtDateTime(d: Date) {
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [ticket, users] = await Promise.all([
    prisma.ticket.findUnique({
      where: { id },
      include: {
        assignee: true,
        solution: true,
        flow: true,
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: true },
        },
        designs: {
          orderBy: { createdAt: "asc" },
          include: { attachments: { orderBy: { createdAt: "asc" } } },
        },
      },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!ticket) notFound();

  const actor = await currentActor();
  const canManage = await canManageFlow(actor, ticket.flowId, ticket.assigneeId);

  const sm = statusMeta(ticket.status);
  const pm = priorityMeta(ticket.priority);
  const ticketLite = {
    id: ticket.id,
    title: ticket.title,
    status: ticket.status,
    flowId: ticket.flowId,
    flowName: ticket.flow?.name ?? null,
  };

  return (
    <div>
      <Link
        href="/manage/tickets"
        className="text-sm font-medium text-slate-500 transition hover:text-slate-800"
      >
        ← Back to tickets
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{ticket.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={`badge ${sm.color}`}>{sm.label}</span>
            <span className={`badge ${pm.color}`}>{pm.label}</span>
            {ticket.assignee && (
              <span className="badge bg-slate-100 text-slate-600">
                {ticket.assignee.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <MarkDoneButton ticket={ticketLite} />
          <GeneratePromptButton ticketId={ticket.id} />
          {ticket.linearUrl && (
            <a
              href={ticket.linearUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary shrink-0"
            >
              <span className="text-violet-600">◆</span> Open in Linear
            </a>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Left column: edit form + comments */}
        <div className="space-y-6">
          {/* Edit */}
          <div className="card p-5">
            <h2 className="font-bold">Details</h2>
            {canManage ? (
              <form action={updateTicketDetails} className="mt-4 space-y-4">
                <input type="hidden" name="id" value={ticket.id} />
                <div>
                  <label className="label">Title</label>
                  <input
                    name="title"
                    required
                    defaultValue={ticket.title}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea
                    name="description"
                    rows={4}
                    defaultValue={ticket.description}
                    className="input"
                    placeholder="Context, acceptance criteria…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Status</label>
                    <select
                      name="status"
                      defaultValue={ticket.status}
                      className="input"
                    >
                      {TICKET_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Priority</label>
                    <select
                      name="priority"
                      defaultValue={ticket.priority}
                      className="input"
                    >
                      {TICKET_PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Assignee</label>
                  <select
                    name="assigneeId"
                    defaultValue={ticket.assigneeId ?? ""}
                    className="input"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Linear ticket URL</label>
                  <input
                    name="linearUrl"
                    type="url"
                    defaultValue={ticket.linearUrl}
                    className="input"
                    placeholder="https://linear.app/sobrus/issue/…"
                  />
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="btn-primary">
                    Save changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 space-y-3.5 text-sm">
                <Row label="Description">
                  <span className="max-w-xs text-right text-slate-600">
                    {ticket.description || "—"}
                  </span>
                </Row>
                <Row label="Status">
                  <span className={`badge ${sm.color}`}>{sm.label}</span>
                </Row>
                <Row label="Priority">
                  <span className={`badge ${pm.color}`}>{pm.label}</span>
                </Row>
                <Row label="Assignee">
                  <span className="text-slate-600">
                    {ticket.assignee?.name ?? "Unassigned"}
                  </span>
                </Row>
                <p className="pt-1 text-xs text-slate-400">
                  Only {ticket.assignee ? "the assigned designer" : "a flow designer"} or an admin can edit this ticket.
                </p>
              </div>
            )}
          </div>

          <DeliverablesCard
            ticket={ticketLite}
            designs={ticket.designs}
            canManage={canManage}
          />

          {/* Comments */}
          <div className="card p-5">
            <h2 className="font-bold">
              Comments
              <span className="ml-2 text-sm font-normal text-slate-400">
                {ticket.comments.length}
              </span>
            </h2>

            <div className="mt-4 space-y-4">
              {ticket.comments.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No comments yet. Start the discussion below.
                </p>
              ) : (
                ticket.comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                      {c.author ? initials(c.author.name) : "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">
                          {c.author?.name ?? "Unknown"}
                        </span>
                        <span className="text-xs text-slate-400">
                          {fmtDateTime(c.createdAt)}
                        </span>
                        <form action={deleteComment} className="ml-auto">
                          <input type="hidden" name="id" value={c.id} />
                          <input
                            type="hidden"
                            name="ticketId"
                            value={ticket.id}
                          />
                          <button
                            type="submit"
                            className="text-xs font-medium text-slate-400 hover:text-red-600"
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-600">
                        {c.body}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form action={addComment} className="mt-5 border-t border-slate-100 pt-4">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <label className="label">Add a comment</label>
              <textarea
                name="body"
                rows={3}
                required
                className="input"
                placeholder="Write a comment…"
              />
              <div className="mt-2 flex justify-end">
                <button type="submit" className="btn-primary">
                  Comment
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <div className="card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Location
            </h3>
            <dl className="mt-4 space-y-3.5 text-sm">
              <Row label="Solution">
                {ticket.solution ? (
                  <span className="font-medium text-slate-700">
                    {ticket.solution.name}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </Row>
              <Row label="Flow">
                {ticket.flow ? (
                  <Link
                    href={`/flows/${ticket.flow.id}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    {ticket.flow.name}
                  </Link>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </Row>
            </dl>
            <p className="mt-3 text-xs text-slate-400">
              Change the location from the tickets board.
            </p>
          </div>

          <div className="card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Activity
            </h3>
            <dl className="mt-4 space-y-3.5 text-sm">
              <Row label="Created">
                <span className="text-slate-500">
                  {fmtDateTime(ticket.createdAt)}
                </span>
              </Row>
              <Row label="Updated">
                <span className="text-slate-500">
                  {fmtDateTime(ticket.updatedAt)}
                </span>
              </Row>
            </dl>
          </div>

          {canManage && (
            <form action={deleteTicketAndRedirect}>
              <input type="hidden" name="id" value={ticket.id} />
              <button type="submit" className="btn-danger w-full">
                Delete ticket
              </button>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
