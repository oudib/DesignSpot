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
import { attachmentPreviewUrl } from "@/lib/attachmentUrl";

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

/**
 * One deliverable file: its newest version, with the version count, and (for
 * the people responsible) an inline "New version" upload. Re-uploading here
 * keeps the preview link that was already shared in Linear — it starts serving
 * the new design instead of the old one.
 */
function AttachmentRow({
  attachment: att,
  versionCount,
  canManage,
}: {
  attachment: Attachment;
  versionCount: number;
  canManage: boolean;
}) {
  const [uploading, setUploading] = useState(false);

  return (
    <li>
      <div className="flex items-center justify-between gap-2">
        <a
          href={
            att.kind === "html" ? attachmentPreviewUrl(att.url) : att.url
          }
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 items-center gap-1.5 text-slate-500 hover:text-brand-600"
        >
          <span>{att.kind === "html" ? "◈" : "📎"}</span>
          <span className="truncate">{att.name}</span>
          <span className="shrink-0 text-xs text-slate-400">
            {fmtSize(att.size)}
          </span>
          {versionCount > 1 && (
            <span className="badge shrink-0 bg-brand-50 text-brand-700">
              v{att.version}
            </span>
          )}
          {att.kind === "html" && (
            <span className="badge bg-brand-50 text-brand-700">
              standalone HTML
            </span>
          )}
        </a>
        {canManage && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setUploading((o) => !o)}
              className="text-xs font-medium text-slate-400 hover:text-brand-600"
              title="Upload a redesign — the preview link already shared in Linear will show it"
            >
              New version
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
                className="shrink-0 text-slate-400 hover:text-red-600 disabled:opacity-60"
                aria-label={`Remove ${att.name}`}
              >
                ✕
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
          className="mt-1.5 flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/40 p-2"
        >
          <input type="hidden" name="attachmentId" value={att.id} />
          <input
            type="file"
            name="file"
            required
            className="min-w-0 flex-1 text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-white file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-600 hover:file:bg-slate-100"
          />
          <SubmitButton
            className="btn-primary btn-sm shrink-0"
            pendingLabel="Uploading…"
          >
            Upload v{att.version + 1}
          </SubmitButton>
          <button
            type="button"
            onClick={() => setUploading(false)}
            className="btn-secondary btn-sm shrink-0"
          >
            Cancel
          </button>
        </ActionForm>
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
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">
          Deliverables
          <span className="ml-2 text-sm font-normal text-slate-400">
            {designs.length}
          </span>
        </h2>
        {ticket.flowId && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            + Add delivery
          </button>
        )}
      </div>

      {designs.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          {ticket.flowId
            ? "No files or links delivered yet."
            : "Attach this ticket to a flow (from the tickets board) to deliver files here."}
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {designs.map((d) =>
            editingId === d.id ? (
              <li key={d.id}>
                <ActionForm
                  action={updateDesign}
                  success="Delivery updated."
                  error="Couldn't update the delivery. Please try again."
                  onDone={() => setEditingId(null)}
                  className="space-y-2 rounded-lg border border-brand-200 bg-brand-50/30 p-3"
                >
                  <input type="hidden" name="id" value={d.id} />
                  <input
                    name="title"
                    defaultValue={d.title}
                    required
                    className="input py-1 text-sm"
                    placeholder="Title"
                  />
                  <div className="flex gap-2">
                    <input
                      name="variant"
                      defaultValue={d.variant}
                      className="input py-1 text-sm"
                      placeholder="Variant (optional)"
                    />
                    <input
                      name="claudeUrl"
                      type="url"
                      defaultValue={d.claudeUrl}
                      className="input py-1 text-sm"
                      placeholder="https://claude.ai/… (optional)"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="btn-secondary btn-sm"
                    >
                      Cancel
                    </button>
                    <SubmitButton
                      className="btn-primary btn-sm"
                      pendingLabel="Saving…"
                    >
                      Save
                    </SubmitButton>
                  </div>
                </ActionForm>
              </li>
            ) : (
              <li key={d.id} className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5 text-slate-600">
                    <span>{d.claudeUrl ? "🔗" : "◑"}</span>
                    {d.claudeUrl ? (
                      <a
                        href={d.claudeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate hover:text-brand-600"
                      >
                        {d.title}
                        {d.variant && ` (${d.variant})`}
                      </a>
                    ) : (
                      <span className="truncate">
                        {d.title}
                        {d.variant && ` (${d.variant})`}
                      </span>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(d.id)}
                        className="text-xs font-medium text-slate-400 hover:text-brand-600"
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
                          className="text-slate-400 hover:text-red-600 disabled:opacity-60"
                          aria-label={`Delete ${d.title}`}
                        >
                          ✕
                        </SubmitButton>
                      </ActionForm>
                    </div>
                  )}
                </div>
                {d.attachments.length > 0 && (
                  <ul className="ml-5 space-y-1">
                    {/* One row per deliverable file — its newest version. Older
                        revisions stay reachable from the preview page. */}
                    {groupRevisions(d.attachments).map(({ latest, versions }) => (
                      <AttachmentRow
                        key={latest.id}
                        attachment={latest}
                        versionCount={versions.length}
                        canManage={canManage}
                      />
                    ))}
                  </ul>
                )}
              </li>
            ),
          )}
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
