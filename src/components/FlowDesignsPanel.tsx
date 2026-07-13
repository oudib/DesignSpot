"use client";

import { useState } from "react";
import Link from "next/link";
import { updateDesign, deleteDesign } from "@/app/manage/actions";
import { tint } from "@/lib/utils";
import { attachmentPreviewUrl } from "@/lib/attachmentUrl";

type Attachment = {
  id: string;
  name: string;
  url: string;
  kind: string;
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
    <div className="grid gap-4 sm:grid-cols-2">
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
      <form
        action={updateDesign}
        onSubmit={() => setTimeout(() => setEditing(false), 0)}
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
            className="btn-secondary btn-sm"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary btn-sm">
            Save
          </button>
        </div>
      </form>
    );
  }

  return (
    <div
      className="animate-rise rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm"
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
            <p className="truncate font-semibold text-slate-800">
              {design.title}
            </p>
          </div>
          {design.variant && (
            <span className="badge mt-2 bg-slate-100 text-slate-500">
              {design.variant}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm">
          {design.claudeUrl && (
            <a
              href={design.claudeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-600 hover:underline"
            >
              Open ↗
            </a>
          )}
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="font-medium text-slate-500 hover:text-brand-600"
              >
                Edit
              </button>
              <form
                action={deleteDesign}
                onSubmit={(e) => {
                  if (
                    !confirm(
                      `Delete "${design.title}"? This also removes its attachments.`
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="id" value={design.id} />
                <button
                  type="submit"
                  className="font-medium text-slate-500 hover:text-red-600"
                >
                  Delete
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {design.attachments.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
          {design.attachments.map((att) => (
            <li key={att.id}>
              <a
                href={
                  att.kind === "html" ? attachmentPreviewUrl(att.url) : att.url
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-brand-600"
              >
                <span>{att.kind === "html" ? "◈" : "📎"}</span>
                <span className="truncate">{att.name}</span>
                {att.kind === "html" && (
                  <span className="badge shrink-0 bg-brand-50 text-brand-700">
                    Preview standalone HTML
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
