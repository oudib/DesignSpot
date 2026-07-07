"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  createTicket,
  updateTicket,
  deleteTicket,
  setTicketStatus,
  createDesign,
} from "@/app/manage/actions";
import { TICKET_STATUSES, TICKET_PRIORITIES, priorityMeta } from "@/lib/utils";
import HierarchyPicker, { type SolLite } from "@/components/HierarchyPicker";

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
  const [, startTransition] = useTransition();

  function setStatus(id: string, status: string) {
    setBoard((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status } : t)),
    );
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", status);
    startTransition(() => {
      setTicketStatus(fd);
    });
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
          <h1 className="text-2xl font-bold tracking-tight">Tickets</h1>
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
        <DesignLinkDialog
          ticket={designPrompt}
          onAttached={() => {
            setStatus(designPrompt.id, "done");
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

// Shown when a ticket is dragged into Done: capture the finished design —
// either an uploaded file or a Google Drive link — and attach it to the
// ticket's flow. The status change is held back until this succeeds (or is
// explicitly skipped).
function DesignLinkDialog({
  ticket,
  onAttached,
  onSkip,
  onCancel,
}: {
  ticket: Ticket;
  onAttached: () => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [method, setMethod] = useState<"file" | "drive">("file");
  const [error, setError] = useState("");

  const handleSave = async (fd: FormData) => {
    setPending(true);
    setError("");
    try {
      // Attach the design first; only then mark the ticket Done so the status
      // change (and its Linear comment) never fires unless this succeeds.
      await createDesign(fd);
      onAttached();
    } catch {
      setError(
        "The delivery couldn't be saved — check the file or link and try again.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm"
      onMouseDown={onCancel}
    >
      <div
        className="card my-8 w-full max-w-md p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="badge bg-emerald-100 text-emerald-700">Done</span>
          <h2 className="text-lg font-bold">Deliver the design</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Attach the final design to{" "}
          <span className="font-medium text-slate-700">{ticket.flowName}</span>{" "}
          to mark “{ticket.title}” as done. It’ll also be pushed to any linked
          Linear issues.
        </p>

        <form action={handleSave} className="mt-4 space-y-4">
          <input type="hidden" name="flowId" value={ticket.flowId ?? ""} />

          <div>
            <label className="label">Title</label>
            <input
              name="title"
              required
              defaultValue={ticket.title}
              className="input"
              placeholder="e.g. POS payment modal"
            />
          </div>

          <div>
            <label className="label">Delivery</label>
            <div className="mb-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod("file")}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  method === "file"
                    ? "border-brand-300 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                📎 Attachment
              </button>
              <button
                type="button"
                onClick={() => setMethod("drive")}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  method === "drive"
                    ? "border-brand-300 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                🔗 Google Drive link
              </button>
            </div>
            {method === "file" ? (
              <input
                key="file"
                name="file"
                type="file"
                required
                className="input text-sm text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-600 hover:file:bg-slate-200"
              />
            ) : (
              <input
                key="drive"
                name="linkUrl"
                type="url"
                required
                autoFocus
                className="input"
                placeholder="https://drive.google.com/…"
              />
            )}
          </div>

          <div>
            <label className="label">Variant (optional)</label>
            <input
              name="variant"
              className="input"
              placeholder="e.g. v2, dark mode, mobile"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="btn-secondary"
              title="Leave the ticket where it is"
            >
              Cancel
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onSkip}
                disabled={pending}
                className="text-sm font-medium text-slate-500 hover:text-slate-800"
                title="Mark it Done without a delivery"
              >
                Skip
              </button>
              <button type="submit" disabled={pending} className="btn-primary">
                {pending ? "Delivering…" : "Deliver design"}
              </button>
            </div>
          </div>
        </form>
      </div>
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
