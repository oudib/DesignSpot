"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  setTicketStatus,
  updateDesign,
  deleteDesign,
  deleteDesignAttachment,
  addDesignRevision,
} from "@/app/manage/actions";
import { groupRevisions } from "@/lib/revisions";
import DeliveryDialog from "@/components/DeliveryDialog";
import Spinner from "@/components/Spinner";
import ActionForm, { useActionToast } from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import { attachmentPreviewUrl, attachmentDriveUrl } from "@/lib/attachmentUrl";

type TicketLite = {
  id: string;
  title: string;
  status: string;
  flowId: string | null;
  flowName: string | null;
};

type Attachment = {
  id: string;
  name: string;
  url: string;
  kind: string;
  size: number;
  version: number;
  rootId: string | null;
};

type DesignWithAttachments = {
  id: string;
  title: string;
  variant: string;
  claudeUrl: string;
  createdAt: Date | string;
  attachments: Attachment[];
};

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function markDone(ticketId: string) {
  const fd = new FormData();
  fd.set("id", ticketId);
  fd.set("status", "done");
  await setTicketStatus(fd);
}

export function MarkDoneButton({ ticket }: { ticket: TicketLite }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const { run } = useActionToast();

  if (ticket.status === "done") return null;

  // No flow to deliver a design into — just flip the status directly,
  // same as the board does when there's nothing to attach.
  if (!ticket.flowId) {
    return (
      <button
        type="button"
        onClick={async () => {
          setPending(true);
          await run(() => markDone(ticket.id), {
            success: "Ticket marked as done.",
            error: "Couldn't mark the ticket as done. Please try again.",
            // setTicketStatus is called directly (not via a <form action>),
            // so the router cache needs an explicit nudge to pick up the
            // fresh status on this Server Component page.
            onDone: () => router.refresh(),
          });
          setPending(false);
        }}
        disabled={pending}
        className="btn-secondary shrink-0"
      >
        {pending ? <Spinner className="text-emerald-600" /> : <span className="text-emerald-600">✓</span>}{" "}
        {pending ? "Marking…" : "Mark as done"}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary shrink-0"
      >
        <span className="text-emerald-600">✓</span> Mark as done
      </button>
      {open && (
        <DeliveryDialog
          ticket={ticket}
          mode="complete"
          onSaved={() => {
            // createDesign already marked the ticket done (mode="complete"
            // always sets markDone) and posted the combined Linear comment.
            setOpen(false);
            router.refresh();
          }}
          onSkip={async () => {
            await run(() => markDone(ticket.id), {
              success: "Ticket marked as done.",
              error: "Couldn't mark the ticket as done. Please try again.",
              onDone: () => {
                setOpen(false);
                router.refresh();
              },
            });
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}

/** The design link can be a Claude share link or a Google Drive one. */
function externalLinkLabel(url: string) {
  return url.includes("drive.google.com") ? "Google Drive" : "Claude design";
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * One deliverable file — its newest version — as a card with real buttons:
 * open the preview, download it, jump to Drive, or upload a redesign. A
 * revision keeps the preview link already shared in Linear, so that link
 * starts serving the new design instead of the old one.
 */
function DeliverableFile({
  attachment: att,
  versionCount,
  canManage,
}: {
  attachment: Attachment;
  versionCount: number;
  canManage: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const isHtml = att.kind === "html";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-lg text-brand-600 ring-1 ring-inset ring-slate-200">
          {isHtml ? "◈" : "📎"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">
            {att.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
            <span>{fmtSize(att.size)}</span>
            {isHtml && (
              <span className="badge bg-brand-50 text-brand-700">
                standalone HTML
              </span>
            )}
            {versionCount > 1 && (
              <span className="badge bg-emerald-50 text-emerald-700">
                v{att.version} · {versionCount} versions
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={isHtml ? attachmentPreviewUrl(att.url) : att.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
        >
          <span>{isHtml ? "◈" : "↗"}</span>
          {isHtml ? "Open preview" : "Open file"}
        </a>
        <a
          href={`${att.url}?download=1`}
          download={att.name}
          className="btn-secondary"
        >
          <span>⬇</span> Download
        </a>
        <a
          href={attachmentDriveUrl(att.url)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
          title="Open the file in Google Drive"
        >
          <span>📁</span> Drive
        </a>
        {canManage && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setUploading((o) => !o)}
              className="btn-secondary"
              title="Upload a redesign — the preview link already shared in Linear will show it"
            >
              <span className="text-brand-600">⇧</span> New version
            </button>
            <ActionForm
              action={deleteDesignAttachment}
              confirm={
                versionCount > 1
                  ? `Remove "${att.name}" and all ${versionCount} of its versions?`
                  : `Remove "${att.name}" from this delivery?`
              }
              success="Attachment removed."
              error="Couldn't remove the attachment. Please try again."
            >
              <input type="hidden" name="id" value={att.id} />
              <SubmitButton
                className="btn-danger"
                pendingLabel="Removing…"
                aria-label={`Remove ${att.name}`}
              >
                Remove
              </SubmitButton>
            </ActionForm>
          </div>
        )}
      </div>

      {uploading && canManage && (
        <ActionForm
          action={addDesignRevision}
          success={`Uploaded as v${att.version + 1} — the shared preview link now shows it.`}
          error="The upload failed. Check the file and try again."
          onDone={() => setUploading(false)}
          className="mt-3 rounded-xl border border-brand-200 bg-white p-3"
        >
          <input type="hidden" name="attachmentId" value={att.id} />
          <p className="text-xs text-slate-500">
            Pick the redesigned file. It becomes{" "}
            <span className="font-semibold text-slate-700">
              v{att.version + 1}
            </span>{" "}
            and the preview link already shared in Linear will show it.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="file"
              name="file"
              required
              className="min-w-0 flex-1 text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-600 hover:file:bg-slate-200"
            />
            <SubmitButton className="btn-primary" pendingLabel="Uploading…">
              Upload v{att.version + 1}
            </SubmitButton>
            <button
              type="button"
              onClick={() => setUploading(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </ActionForm>
      )}
    </div>
  );
}

/** One delivery: its title, its external design link, and its files. */
function DeliverableCard({
  design: d,
  canManage,
}: {
  design: DesignWithAttachments;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const files = groupRevisions(d.attachments);

  if (editing && canManage) {
    return (
      <li>
        <ActionForm
          action={updateDesign}
          success="Delivery updated."
          error="Couldn't update the delivery. Please try again."
          onDone={() => setEditing(false)}
          className="space-y-3 rounded-2xl border border-brand-200 bg-brand-50/30 p-4"
        >
          <input type="hidden" name="id" value={d.id} />
          <div>
            <label className="label">Title</label>
            <input
              name="title"
              defaultValue={d.title}
              required
              className="input"
              placeholder="Title"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Variant</label>
              <input
                name="variant"
                defaultValue={d.variant}
                className="input"
                placeholder="e.g. v2, dark mode"
              />
            </div>
            <div>
              <label className="label">Design link</label>
              <input
                name="claudeUrl"
                type="url"
                defaultValue={d.claudeUrl}
                className="input"
                placeholder="https://claude.ai/… (optional)"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
          </div>
        </ActionForm>
      </li>
    );
  }

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg text-brand-600">
            ◑
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-800">{d.title}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-400">
              {d.variant && (
                <span className="badge bg-slate-100 text-slate-600">
                  {d.variant}
                </span>
              )}
              <span>
                {files.length > 0
                  ? `${files.length} file${files.length === 1 ? "" : "s"}`
                  : "Link only"}
              </span>
              <span>Delivered {fmtDate(d.createdAt)}</span>
            </div>
          </div>
        </div>
        {canManage && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-secondary btn-sm"
            >
              Edit
            </button>
            <ActionForm
              action={deleteDesign}
              confirm={`Delete "${d.title}"? This also removes its attachments.`}
              success="Delivery deleted."
              error="Couldn't delete the delivery. Please try again."
            >
              <input type="hidden" name="id" value={d.id} />
              <SubmitButton
                className="btn-danger btn-sm"
                pendingLabel="Deleting…"
                aria-label={`Delete ${d.title}`}
              >
                Delete
              </SubmitButton>
            </ActionForm>
          </div>
        )}
      </div>

      {d.claudeUrl && (
        <a
          href={d.claudeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary mt-3"
        >
          <span className="text-brand-600">🔗</span>{" "}
          {externalLinkLabel(d.claudeUrl)} ↗
        </a>
      )}

      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {/* Newest version of each file — older revisions live behind the
              preview page's version picker. */}
          {files.map(({ latest, versions }) => (
            <DeliverableFile
              key={latest.id}
              attachment={latest}
              versionCount={versions.length}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </li>
  );
}

export function DeliverablesCard({
  ticket,
  designs,
  canManage,
}: {
  ticket: TicketLite;
  designs: DesignWithAttachments[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold">
          Deliverables
          <span className="badge bg-slate-100 text-slate-500">
            {designs.length}
          </span>
        </h2>
        {ticket.flowId && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn-secondary btn-sm"
          >
            <span className="text-brand-600">＋</span> Add delivery
          </button>
        )}
      </div>

      {designs.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-8 text-center">
          <p className="text-2xl text-slate-300">◑</p>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            Nothing delivered yet
          </p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-slate-400">
            {ticket.flowId
              ? "Attach the final HTML export or a design link — it shows up here and gets pushed to any linked Linear issue."
              : "Attach this ticket to a flow (from the tickets board) to deliver files here."}
          </p>
          {ticket.flowId && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="btn-primary mt-4"
            >
              <span>＋</span> Add delivery
            </button>
          )}
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {designs.map((d) => (
            <DeliverableCard key={d.id} design={d} canManage={canManage} />
          ))}
        </ul>
      )}

      {adding && ticket.flowId && (
        <DeliveryDialog
          ticket={ticket}
          mode="attach"
          onSaved={() => {
            setAdding(false);
            router.refresh();
          }}
          onCancel={() => setAdding(false)}
        />
      )}
    </div>
  );
}
