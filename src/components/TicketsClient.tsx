"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  createTicket,
  updateTicket,
  deleteTicket,
  setTicketStatus,
} from "@/app/manage/actions";
import { TICKET_STATUSES, TICKET_PRIORITIES, priorityMeta } from "@/lib/utils";
import HierarchyPicker, { type SolLite } from "@/components/HierarchyPicker";
import DeliveryDialog from "@/components/DeliveryDialog";
import Spinner from "@/components/Spinner";

type Ticket = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  linearUrl: string;
  assigneeId: string | null;
  assigneeName: string | null;
  solutionId: string | null;
  solutionName: string | null;
  flowId: string | null;
  flowName: string | null;
};
type Option = { id: string; name: string };

export default function TicketsClient({
  tickets,
  users,
  tree,
  currentUserId,
}: {
  tickets: Ticket[];
  users: Option[];
  tree: SolLite[];
  currentUserId: string | null;
}) {
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [creating, setCreating] = useState(false);

  // Local copy so a drag updates the board instantly (optimistic). We re-sync
  // whenever the server sends fresh data after revalidation.
  const [board, setBoard] = useState<Ticket[]>(tickets);
  useEffect(() => setBoard(tickets), [tickets]);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  // Dropping into Done opens this prompt; the status change is held back until
  // the design link is added (or explicitly skipped) so we never fire a Linear
  // comment we'd have to revert.
  const [designPrompt, setDesignPrompt] = useState<Ticket | null>(null);
  const [isPending, startTransition] = useTransition();

  function setStatus(id: string, status: string) {
    setStatusLocal(id, status);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", status);
    startTransition(() => {
      setTicketStatus(fd);
    });
  }

  // Optimistic-only update, no server call — used after createDesign already
  // persisted the status server-side (and posted the combined Linear
  // comment) so we don't fire a second status update/comment.
  function setStatusLocal(id: string, status: string) {
    setBoard((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status } : t)),
    );
  }

  function moveTicket(id: string, status: string) {
    const ticket = board.find((t) => t.id === id);
    if (!ticket || ticket.status === status) return;

    // Hold the move to Done until the designer attaches (or skips) the design
    // link in the prompt — nothing is persisted and no Linear comment fires
    // until they confirm.
    if (status === "done") {
      setDesignPrompt(ticket);
      return;
    }

    setStatus(id, status);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            Tickets
            {isPending && <Spinner className="text-slate-400" />}
          </h1>
          <p className="mt-1 text-slate-500">
            Drag a card between columns to change its status.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}>
          + New ticket
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TICKET_STATUSES.map((col) => {
          const items = board.filter((t) => t.status === col.value);
          const isOver = dragOverCol === col.value;
          return (
            <div
              key={col.value}
              onDragOver={(e) => {
                if (!draggingId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverCol !== col.value) setDragOverCol(col.value);
              }}
              onDragLeave={(e) => {
                // Only clear when the pointer truly leaves the column.
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverCol((c) => (c === col.value ? null : c));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id =
                  e.dataTransfer.getData("text/plain") || draggingId;
                if (id) moveTicket(id, col.value);
                setDragOverCol(null);
                setDraggingId(null);
              }}
              className={`rounded-2xl p-3 transition-colors ${
                isOver
                  ? "bg-brand-50 ring-2 ring-brand-300"
                  : "bg-slate-100/70"
              }`}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <span className={`badge ${col.color}`}>{col.label}</span>
                <span className="text-xs font-semibold text-slate-400">
                  {items.length}
                </span>
              </div>
              <div className="space-y-3">
                {items.map((t) => (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    dragging={draggingId === t.id}
                    onDragStart={(e) => {
                      setDraggingId(t.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", t.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverCol(null);
                    }}
                    onEdit={() => setEditing(t)}
                  />
                ))}
                {items.length === 0 && (
                  <p className="px-1 py-6 text-center text-xs text-slate-400">
                    {isOver ? "Drop here" : "Nothing here"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {(creating || editing) && (
        <TicketDialog
          ticket={editing}
          users={users}
          tree={tree}
          currentUserId={currentUserId}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {designPrompt && (
        <DeliveryDialog
          ticket={designPrompt}
          mode="complete"
          onSaved={() => {
            // createDesign already marked the ticket done and posted the
            // combined Linear comment — just reflect it optimistically.
            setStatusLocal(designPrompt.id, "done");
            setDesignPrompt(null);
          }}
          onSkip={() => {
            setStatus(designPrompt.id, "done");
            setDesignPrompt(null);
          }}
          onCancel={() => setDesignPrompt(null)}
        />
      )}
    </div>
  );
}

function TicketCard({
  ticket,
  dragging,
  onDragStart,
  onDragEnd,
  onEdit,
}: {
  ticket: Ticket;
  dragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onEdit: () => void;
}) {
  const pmeta = priorityMeta(ticket.priority);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`card cursor-grab p-3 shadow-sm transition active:cursor-grabbing ${
        dragging ? "rotate-1 opacity-50" : "hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/manage/tickets/${ticket.id}`}
          draggable={false}
          className="text-left text-sm font-semibold text-slate-800 hover:text-brand-600"
        >
          {ticket.title}
        </Link>
        <span className={`badge shrink-0 ${pmeta.color}`}>{pmeta.label}</span>
      </div>

      {ticket.description && (
        <p className="mt-1 line-clamp-2 text-xs text-slate-500">
          {ticket.description}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-500">
        {ticket.solutionName && (
          <span className="badge bg-slate-100">{ticket.solutionName}</span>
        )}
        {ticket.flowName && (
          <span className="badge bg-brand-50 text-brand-700">
            {ticket.flowName}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
        <span className="text-[11px] text-slate-400">
          {ticket.assigneeName ?? "Unassigned"}
        </span>
        <div className="flex items-center gap-1.5">
          {ticket.linearUrl && (
            <a
              href={ticket.linearUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold text-violet-600 hover:underline"
            >
              Linear ↗
            </a>
          )}
          <button
            onClick={onEdit}
            className="text-[11px] font-semibold text-slate-500 hover:text-brand-600"
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
}

function TicketDialog({
  ticket,
  users,
  tree,
  currentUserId,
  onClose,
}: {
  ticket: Ticket | null;
  users: Option[];
  tree: SolLite[];
  currentUserId: string | null;
  onClose: () => void;
}) {
  const isEdit = !!ticket;
  // New tickets default to the current user (the creator); editable here.
  const defaultAssignee = ticket?.assigneeId ?? currentUserId ?? "";

  const handleSave = async (fd: FormData) => {
    await (isEdit ? updateTicket : createTicket)(fd);
    onClose();
  };
  const handleDelete = async (fd: FormData) => {
    await deleteTicket(fd);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="card my-8 w-full max-w-lg p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold">
          {isEdit ? "Edit ticket" : "New ticket"}
        </h2>

        <form action={handleSave} className="mt-4 space-y-4">
          {isEdit && <input type="hidden" name="id" value={ticket.id} />}

          <div>
            <label className="label">Title</label>
            <input
              name="title"
              required
              defaultValue={ticket?.title}
              className="input"
              placeholder="e.g. Redesign POS payment modal"
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              name="description"
              rows={3}
              defaultValue={ticket?.description}
              className="input"
              placeholder="Context, acceptance criteria…"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              <select
                name="status"
                defaultValue={ticket?.status ?? "todo"}
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
                defaultValue={ticket?.priority ?? "medium"}
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
              defaultValue={defaultAssignee}
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
            <label className="label">Location</label>
            <p className="mb-2 text-xs text-slate-400">
              Pick the solution, module, submodule and flow — or create a new one
              at any level.
            </p>
            <HierarchyPicker
              tree={tree}
              initialSolutionId={ticket?.solutionId}
              initialFlowId={ticket?.flowId}
            />
          </div>

          <div>
            <label className="label">Linear ticket URL</label>
            <input
              name="linearUrl"
              type="url"
              defaultValue={ticket?.linearUrl}
              className="input"
              placeholder="https://linear.app/sobrus/issue/…"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {isEdit ? (
              <button
                type="submit"
                formAction={handleDelete}
                className="btn-danger"
              >
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                {isEdit ? "Save changes" : "Create ticket"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
