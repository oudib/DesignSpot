"use client";

import { useState } from "react";
import Link from "next/link";
import { updateDesign, deleteDesign } from "@/app/manage/actions";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import { cn, tint } from "@/lib/utils";
import { attachmentPreviewUrl, attachmentDriveUrl } from "@/lib/attachmentUrl";
import { groupRevisions } from "@/lib/revisions";

type Attachment = {
  id: string;
  name: string;
  url: string;
  kind: string;
  version: number;
  rootId: string | null;
};
type Design = {
  id: string;
  title: string;
  claudeUrl: string;
  variant: string;
  attachments: Attachment[];
};

export default function FlowDesignsPanel({
  designs,
  color,
  canManage,
}: {
  designs: Design[];
  color: string;
  canManage: boolean;
}) {
  if (designs.length === 0) {
    return (
      <div className="card p-8 text-center text-slate-500">
        No designs linked yet. Add Claude design links from the{" "}
        <Link href="/manage/structure" className="text-brand-600 underline">
          workspace
        </Link>
        .
      </div>
    );
  }

  return (
    // A lone design would otherwise sit at half width next to dead space.
    <div className={cn("grid gap-4", designs.length > 1 && "sm:grid-cols-2")}>
      {designs.map((design, i) => (
        <DesignCard
          key={design.id}
          design={design}
          color={color}
          index={i}
          canManage={canManage}
        />
      ))}
    </div>
  );
}

function DesignCard({
  design,
  color,
  index,
  canManage,
}: {
  design: Design;
  color: string;
  index: number;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing && canManage) {
    return (
      <ActionForm
        action={updateDesign}
        success="Design updated."
        error="Couldn't update the design. Please try again."
        onDone={() => setEditing(false)}
        className="animate-rise space-y-2.5 rounded-2xl border border-brand-200 bg-white p-5 shadow-card"
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <input type="hidden" name="id" value={design.id} />
        <div>
          <label className="label">Title</label>
          <input
            name="title"
            defaultValue={design.title}
            required
            className="input"
          />
        </div>
        <div>
          <label className="label">Variant</label>
          <input
            name="variant"
            defaultValue={design.variant}
            className="input"
            placeholder="e.g. v2, dark mode"
          />
        </div>
        <div>
          <label className="label">Design link</label>
          <input
            name="claudeUrl"
            defaultValue={design.claudeUrl}
            className="input"
            placeholder="https://claude.ai/… (optional)"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
          <SubmitButton className="btn-primary" pendingLabel="Saving…">
            Save
          </SubmitButton>
        </div>
      </ActionForm>
    );
  }

  return (
    <article
      className="animate-rise flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-card-hover"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <header className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base"
          style={{
            backgroundImage: `linear-gradient(135deg, ${tint(
              color,
              0.18
            )}, ${tint(color, 0.08)})`,
            color,
          }}
        >
          ◑
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold leading-snug text-slate-800">
            {design.title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {design.variant ||
              `${design.attachments.length} file${
                design.attachments.length === 1 ? "" : "s"
              }`}
          </p>
        </div>
        {canManage && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn-icon"
              aria-label={`Edit ${design.title}`}
              title="Edit"
            >
              ✎
            </button>
            <ActionForm
              action={deleteDesign}
              confirm={`Delete "${design.title}"? This also removes its attachments.`}
              success="Design deleted."
              error="Couldn't delete the design. Please try again."
            >
              <input type="hidden" name="id" value={design.id} />
              <SubmitButton
                className="btn-icon hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                aria-label={`Delete ${design.title}`}
                title="Delete"
              >
                ✕
              </SubmitButton>
            </ActionForm>
          </div>
        )}
      </header>

      {design.attachments.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {/* Newest version of each file — the preview page holds the history. */}
          {groupRevisions(design.attachments).map(({ latest: att, versions }) => (
            <li
              key={att.id}
              className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3"
            >
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="shrink-0">
                  {att.kind === "html" ? "◈" : "📎"}
                </span>
                <span className="truncate" title={att.name}>
                  {att.name}
                </span>
                {versions.length > 1 && (
                  <span className="badge shrink-0 bg-brand-50 text-brand-700">
                    v{att.version}
                  </span>
                )}
              </div>
              {/* Preview is the thing people actually come here to click, so it
                  gets the full-width primary treatment. */}
              <div className="mt-2.5 flex gap-2">
                <a
                  href={attachmentPreviewUrl(att.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary flex-1"
                >
                  Preview
                </a>
                <a
                  href={attachmentDriveUrl(att.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  title="Open the Google Drive backup"
                >
                  Drive ↗
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      {design.claudeUrl && (
        <a
          href={design.claudeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "btn-secondary w-full",
            design.attachments.length ? "mt-2.5" : "mt-4"
          )}
        >
          Open in Claude ↗
        </a>
      )}
    </article>
  );
}
