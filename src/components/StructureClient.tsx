"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import * as A from "@/app/manage/actions";
import { cn, SOLUTION_LANGUAGES, languageMeta } from "@/lib/utils";
import { attachmentPreviewUrl } from "@/lib/attachmentUrl";
import { groupRevisions } from "@/lib/revisions";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";

/** "module" → "Module", for toast copy built from a label prop. */
function cap(label: string) {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/* ----------------------------- Types ---------------------------- */
type DesignAttachment = {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  kind: string; // "file" | "html"
  version: number;
  rootId: string | null;
};
type Design = {
  id: string;
  title: string;
  claudeUrl: string;
  variant: string;
  attachments: DesignAttachment[];
};
type LinearTicket = {
  id: string;
  url: string;
  label: string;
  date: string; // ISO date (yyyy-mm-dd) for the date input
};
type Flow = {
  id: string;
  name: string;
  description: string;
  designs: Design[];
  linearTickets: LinearTicket[];
  // Ids of designers already assigned to a ticket on this flow — "responsible
  // for the flow", used to decide who may edit/delete its designs.
  designerIds: string[];
};
type Submodule = { id: string; name: string; flows: Flow[] };
type Module = { id: string; name: string; submodules: Submodule[] };
type Solution = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  color: string;
  icon: string;
  language: string;
  modules: Module[];
};

/* --------------------------- Permissions ------------------------- */
// Only an admin, or a designer already responsible for a flow (assignee on
// at least one of its tickets), may edit/delete that flow's designs.
const ActorContext = createContext<{ isAdmin: boolean; userId: string | null }>({
  isAdmin: false,
  userId: null,
});

function useCanManageFlow(flow: Flow) {
  const actor = useContext(ActorContext);
  return actor.isAdmin || (!!actor.userId && flow.designerIds.includes(actor.userId));
}

/* ---------------------------- Focus ------------------------------ */
// Id of the flow the page was opened on (`?flow=<id>`). Every block on the
// path down to it starts expanded, so the tree lands on that flow instead of
// making you re-open the whole branch by hand.
const FocusContext = createContext<string | null>(null);

/* --------------------------- Component -------------------------- */
export default function StructureClient({
  solutions,
  isAdmin,
  currentUserId,
  focusFlowId = null,
}: {
  solutions: Solution[];
  isAdmin: boolean;
  currentUserId: string | null;
  focusFlowId?: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    // Open on the focused flow's solution when arriving from a flow page.
    (focusFlowId &&
      solutions.find((s) =>
        s.modules.some((m) =>
          m.submodules.some((sm) => sm.flows.some((f) => f.id === focusFlowId))
        )
      )?.id) ||
      solutions[0]?.id ||
      null
  );
  const [addingSolution, setAddingSolution] = useState(false);
  const [editingSolution, setEditingSolution] = useState<Solution | null>(null);

  const selected = solutions.find((s) => s.id === selectedId) ?? solutions[0];

  return (
    <ActorContext.Provider value={{ isAdmin, userId: currentUserId }}>
    <FocusContext.Provider value={focusFlowId}>
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Structure & designs
          </h1>
          <p className="mt-1 text-slate-500">
            Build the Solution → Module → Submodule → Flow tree and attach Claude
            design links.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setAddingSolution(true)}>
          + New solution
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Solutions list */}
        <aside className="space-y-1.5">
          {solutions.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                s.id === selected?.id
                  ? "border-brand-200 bg-brand-50"
                  : "border-transparent bg-white hover:bg-slate-100"
              )}
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg text-base"
                style={{ backgroundColor: s.color + "22", color: s.color }}
              >
                {s.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-800">
                  {s.name}
                </span>
                <span className="block text-xs text-slate-400">
                  {s.modules.length} modules
                </span>
              </span>
            </button>
          ))}
          {solutions.length === 0 && (
            <p className="px-2 py-6 text-sm text-slate-400">
              No solutions yet.
            </p>
          )}
        </aside>

        {/* Selected solution tree */}
        <section className="min-w-0">
          {selected ? (
            <div className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                    style={{
                      backgroundColor: selected.color + "22",
                      color: selected.color,
                    }}
                  >
                    {selected.icon}
                  </span>
                  <div>
                    <h2 className="text-xl font-bold">{selected.name}</h2>
                    <p className="text-sm text-slate-500">{selected.tagline}</p>
                    <span
                      className={`badge mt-1.5 ${languageMeta(selected.language).color}`}
                    >
                      {languageMeta(selected.language).label}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => setEditingSolution(selected)}
                  >
                    Edit
                  </button>
                  <ConfirmDelete
                    action={A.deleteSolution}
                    id={selected.id}
                    label="solution"
                  />
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {selected.modules.map((m) => (
                  <ModuleBlock key={m.id} module={m} />
                ))}
                <InlineAdd
                  action={A.createModule}
                  hidden={{ solutionId: selected.id }}
                  placeholder="New module name…"
                  cta="Add module"
                  label="module"
                />
              </div>
            </div>
          ) : (
            <div className="card p-10 text-center text-slate-500">
              Create your first solution to get started.
            </div>
          )}
        </section>
      </div>

      {addingSolution && (
        <SolutionDialog
          onClose={() => setAddingSolution(false)}
          action={A.createSolution}
        />
      )}
      {editingSolution && (
        <SolutionDialog
          solution={editingSolution}
          onClose={() => setEditingSolution(null)}
          action={A.updateSolution}
        />
      )}
    </div>
    </FocusContext.Provider>
    </ActorContext.Provider>
  );
}

/* --------------------------- Module ---------------------------- */
function ModuleBlock({ module }: { module: Module }) {
  const focusFlowId = useContext(FocusContext);
  const [open, setOpen] = useState(() =>
    module.submodules.some((sm) => sm.flows.some((f) => f.id === focusFlowId))
  );
  return (
    <div className="rounded-xl border border-slate-200">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-left"
        >
          <Chevron open={open} />
          <span className="font-semibold text-slate-800">{module.name}</span>
          <span className="badge bg-slate-100 text-slate-500">
            {module.submodules.length} submodules
          </span>
        </button>
        <div className="flex items-center gap-1">
          <InlineEdit
            action={A.updateModule}
            id={module.id}
            defaultValue={module.name}
            label="module"
          />
          <ConfirmDelete action={A.deleteModule} id={module.id} label="module" />
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 p-4">
          {module.submodules.map((sm) => (
            <SubmoduleBlock key={sm.id} submodule={sm} />
          ))}
          <InlineAdd
            action={A.createSubmodule}
            hidden={{ moduleId: module.id }}
            placeholder="New submodule name…"
            cta="Add submodule"
            label="submodule"
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------- Submodule --------------------------- */
function SubmoduleBlock({ submodule }: { submodule: Submodule }) {
  const focusFlowId = useContext(FocusContext);
  const [open, setOpen] = useState(() =>
    submodule.flows.some((f) => f.id === focusFlowId)
  );
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between px-3 py-2.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-left"
        >
          <Chevron open={open} />
          <span className="text-sm font-semibold text-slate-700">
            {submodule.name}
          </span>
          <span className="badge bg-slate-100 text-slate-500">
            {submodule.flows.length} flows
          </span>
        </button>
        <div className="flex items-center gap-1">
          <InlineEdit
            action={A.updateSubmodule}
            id={submodule.id}
            defaultValue={submodule.name}
            label="submodule"
          />
          <ConfirmDelete
            action={A.deleteSubmodule}
            id={submodule.id}
            label="submodule"
          />
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-slate-100 p-3">
          {submodule.flows.map((f) => (
            <FlowBlock key={f.id} flow={f} />
          ))}
          <FlowAdd submoduleId={submodule.id} />
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Flow ----------------------------- */
function FlowBlock({ flow }: { flow: Flow }) {
  const focused = useContext(FocusContext) === flow.id;
  const [open, setOpen] = useState(focused);
  const [editing, setEditing] = useState(false);
  const canManage = useCanManageFlow(flow);

  // Arriving from a flow page: bring the flow into view, since it can sit far
  // down a long tree once its branch is expanded.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focused]);

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-slate-50/60",
        focused
          ? "border-brand-300 ring-2 ring-brand-200"
          : "border-slate-200"
      )}
    >
      <div className="flex items-center justify-between px-3 py-2.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          <Chevron open={open} />
          <span className="truncate text-sm font-medium text-slate-700">
            {flow.name}
          </span>
          {flow.linearTickets.length > 0 && (
            <span className="badge bg-violet-100 text-violet-700">
              {flow.linearTickets.length} Linear
            </span>
          )}
          <span className="badge bg-brand-50 text-brand-700">
            {flow.designs.length} designs
          </span>
        </button>
        <div className="flex items-center gap-1">
          <button
            className="btn-secondary btn-sm"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
          <ConfirmDelete action={A.deleteFlow} id={flow.id} label="flow" />
        </div>
      </div>

      {open && (
        <div className="space-y-4 border-t border-slate-100 p-3">
          {flow.description && (
            <p className="text-xs text-slate-500">{flow.description}</p>
          )}

          {/* Designs */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Designs
            </p>
            {flow.designs.map((d) => (
              <DesignRow key={d.id} design={d} canManage={canManage} />
            ))}
            <DesignAdd flowId={flow.id} />
          </div>

          {/* Linear tickets — dated, multiple per flow */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Linear tickets
            </p>
            {flow.linearTickets.map((lt) => (
              <LinearRow key={lt.id} ticket={lt} />
            ))}
            <LinearAdd flowId={flow.id} />
          </div>
        </div>
      )}

      {editing && (
        <FlowDialog flow={flow} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}

/* --------------------------- Design ---------------------------- */
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DesignRow({
  design,
  canManage,
}: {
  design: Design;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [addingFile, setAddingFile] = useState(false);

  if (editing && canManage) {
    return (
      <ActionForm
        action={A.updateDesign}
        success="Design updated."
        error="Couldn't update the design. Please try again."
        onDone={() => setEditing(false)}
        className="flex flex-wrap items-center gap-2 rounded-md border border-brand-200 bg-white p-2"
      >
        <input type="hidden" name="id" value={design.id} />
        <input
          name="title"
          defaultValue={design.title}
          className="input flex-1 py-1 text-xs"
          placeholder="Title"
          required
        />
        <input
          name="variant"
          defaultValue={design.variant}
          className="input w-24 py-1 text-xs"
          placeholder="Variant"
        />
        <input
          name="claudeUrl"
          defaultValue={design.claudeUrl}
          className="input w-full py-1 text-xs"
          placeholder="https://claude.ai/… (optional)"
        />
        <SubmitButton className="btn-primary btn-sm" pendingLabel="Saving…">
          Save
        </SubmitButton>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => setEditing(false)}
        >
          Cancel
        </button>
      </ActionForm>
    );
  }
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-brand-500">◑</span>
          <span className="truncate text-xs font-medium text-slate-700">
            {design.title}
          </span>
          {design.variant && (
            <span className="badge bg-slate-100 text-slate-500">
              {design.variant}
            </span>
          )}
          {design.claudeUrl && (
            <a
              href={design.claudeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-xs font-semibold text-brand-600 hover:underline"
            >
              Claude link ↗
            </a>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAddingFile((o) => !o)}
            className="text-xs font-medium text-slate-500 hover:text-brand-600"
          >
            Attach
          </button>
          {canManage && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-xs font-medium text-slate-500 hover:text-brand-600"
              >
                Edit
              </button>
              <ConfirmDelete
                action={A.deleteDesign}
                id={design.id}
                label="design"
              />
            </>
          )}
        </div>
      </div>

      {design.attachments.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
          {/* Newest version per file — older revisions live behind the preview
              page's version picker. */}
          {groupRevisions(design.attachments).map(({ latest, versions }) => (
            <AttachmentRow
              key={latest.id}
              attachment={latest}
              versionCount={versions.length}
              canManage={canManage}
            />
          ))}
        </ul>
      )}

      {addingFile && (
        <ActionForm
          action={A.addDesignAttachment}
          success="File attached."
          error="The upload failed. Check the file and try again."
          onDone={() => setAddingFile(false)}
          className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2"
        >
          <input type="hidden" name="designId" value={design.id} />
          <input
            type="file"
            name="file"
            required
            className="flex-1 text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-600 hover:file:bg-slate-200"
          />
          <SubmitButton className="btn-primary btn-sm" pendingLabel="Uploading…">
            Upload
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}

/**
 * One attached file — its newest version — with an inline "New version" upload
 * for a redesign. The revision reuses the preview link already shared in
 * Linear, so reviewers see the new design at the URL they already have.
 */
function AttachmentRow({
  attachment: att,
  versionCount,
  canManage,
}: {
  attachment: DesignAttachment;
  versionCount: number;
  canManage: boolean;
}) {
  const [uploading, setUploading] = useState(false);

  return (
    <li className="text-xs">
      <div className="flex items-center justify-between gap-2">
        <a
          href={att.kind === "html" ? attachmentPreviewUrl(att.url) : att.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-w-0 items-center gap-1.5 text-slate-600 hover:text-brand-600"
        >
          <span>{att.kind === "html" ? "◈" : "📎"}</span>
          <span className="truncate">{att.name}</span>
          <span className="shrink-0 text-slate-400">{fmtSize(att.size)}</span>
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
              className="font-medium text-slate-400 hover:text-brand-600"
              title="Upload a redesign — the preview link already shared in Linear will show it"
            >
              New version
            </button>
            <ActionForm
              action={A.deleteDesignAttachment}
              confirm={
                versionCount > 1
                  ? `Remove "${att.name}" and all ${versionCount} of its versions?`
                  : `Remove "${att.name}" from this design?`
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
          action={A.addDesignRevision}
          success={`Uploaded as v${att.version + 1} — the shared preview link now shows it.`}
          error="The upload failed. Check the file and try again."
          onDone={() => setUploading(false)}
          className="mt-1.5 flex items-center gap-2 rounded-md border border-brand-200 bg-brand-50/40 p-2"
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

function DesignAdd({ flowId }: { flowId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-brand-600 hover:underline"
      >
        + Add design
      </button>
    );
  }
  return (
    <ActionForm
      action={A.createDesign}
      success="Design added."
      error="Couldn't add the design. Please try again."
      onDone={() => setOpen(false)}
      className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-2"
    >
      <input type="hidden" name="flowId" value={flowId} />
      <input
        name="title"
        className="input flex-1 py-1 text-xs"
        placeholder="Design title"
        required
      />
      <input
        name="variant"
        className="input w-24 py-1 text-xs"
        placeholder="Variant"
      />
      <input
        name="claudeUrl"
        type="url"
        className="input w-full py-1 text-xs"
        placeholder="https://claude.ai/… (optional — attach files instead if none)"
      />
      <SubmitButton className="btn-primary btn-sm" pendingLabel="Adding…">
        Add
      </SubmitButton>
      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={() => setOpen(false)}
      >
        Cancel
      </button>
    </ActionForm>
  );
}

function LinearRow({ ticket }: { ticket: LinearTicket }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <ActionForm
        action={A.updateLinearTicket}
        success="Linear ticket updated."
        error="Couldn't update the Linear ticket. Please try again."
        onDone={() => setEditing(false)}
        className="flex flex-wrap items-center gap-2 rounded-md border border-violet-200 bg-white p-2"
      >
        <input type="hidden" name="id" value={ticket.id} />
        <input
          name="label"
          defaultValue={ticket.label}
          className="input w-32 py-1 text-xs"
          placeholder="Label"
        />
        <input
          name="date"
          type="date"
          defaultValue={ticket.date}
          className="input w-36 py-1 text-xs"
          required
        />
        <input
          name="url"
          defaultValue={ticket.url}
          className="input w-full py-1 text-xs"
          placeholder="https://linear.app/…"
          required
        />
        <SubmitButton className="btn-primary btn-sm" pendingLabel="Saving…">
          Save
        </SubmitButton>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => setEditing(false)}
        >
          Cancel
        </button>
      </ActionForm>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
      <a
        href={ticket.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 items-center gap-2"
      >
        <span className="text-violet-500">◆</span>
        <span className="badge bg-slate-100 text-slate-500">
          {formatDate(ticket.date)}
        </span>
        <span className="truncate text-xs font-medium text-slate-700">
          {ticket.label || ticket.url}
        </span>
      </a>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-slate-500 hover:text-brand-600"
        >
          Edit
        </button>
        <ConfirmDelete
          action={A.deleteLinearTicket}
          id={ticket.id}
          label="Linear ticket"
        />
      </div>
    </div>
  );
}

function LinearAdd({ flowId }: { flowId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-violet-600 hover:underline"
      >
        + Add Linear ticket
      </button>
    );
  }
  return (
    <ActionForm
      action={A.createLinearTicket}
      success="Linear ticket added."
      error="Couldn't add the Linear ticket. Please try again."
      onDone={() => setOpen(false)}
      className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-2"
    >
      <input type="hidden" name="flowId" value={flowId} />
      <input
        name="label"
        className="input w-32 py-1 text-xs"
        placeholder="Label (optional)"
      />
      <input
        name="date"
        type="date"
        defaultValue={todayISO()}
        className="input w-36 py-1 text-xs"
        required
      />
      <input
        name="url"
        type="url"
        className="input w-full py-1 text-xs"
        placeholder="https://linear.app/…"
        required
      />
      <SubmitButton className="btn-primary btn-sm" pendingLabel="Adding…">
        Add
      </SubmitButton>
      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={() => setOpen(false)}
      >
        Cancel
      </button>
    </ActionForm>
  );
}

function FlowAdd({ submoduleId }: { submoduleId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-brand-600 hover:underline"
      >
        + Add flow
      </button>
    );
  }
  return (
    <ActionForm
      action={A.createFlow}
      success="Flow added."
      error="Couldn't add the flow. Please try again."
      onDone={() => setOpen(false)}
      className="space-y-2 rounded-md border border-slate-200 bg-white p-3"
    >
      <input type="hidden" name="submoduleId" value={submoduleId} />
      <input
        name="name"
        className="input py-1.5 text-sm"
        placeholder="Flow name"
        required
      />
      <input
        name="description"
        className="input py-1.5 text-sm"
        placeholder="Short description (optional)"
      />
      <div className="flex gap-2">
        <SubmitButton className="btn-primary btn-sm" pendingLabel="Adding…">
          Add flow
        </SubmitButton>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </ActionForm>
  );
}

/* ----------------------- Shared helpers ------------------------ */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function formatDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      className={cn(
        "inline-block text-slate-400 transition-transform",
        open && "rotate-90"
      )}
    >
      ▸
    </span>
  );
}

function InlineAdd({
  action,
  hidden,
  placeholder,
  cta,
  label,
}: {
  action: (fd: FormData) => Promise<void>;
  hidden: Record<string, string>;
  placeholder: string;
  cta: string;
  label: string;
}) {
  return (
    <ActionForm
      action={action}
      success={`${cap(label)} added.`}
      error={`Couldn't add the ${label}. Please try again.`}
      className="flex items-center gap-2"
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input name="name" className="input py-1.5 text-sm" placeholder={placeholder} required />
      <SubmitButton
        className="btn-secondary btn-sm shrink-0"
        pendingLabel="Adding…"
      >
        {cta}
      </SubmitButton>
    </ActionForm>
  );
}

function InlineEdit({
  action,
  id,
  defaultValue,
  label,
}: {
  action: (fd: FormData) => Promise<void>;
  id: string;
  defaultValue: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-brand-600"
      >
        Edit
      </button>
    );
  }
  return (
    <ActionForm
      action={action}
      success={`${cap(label)} renamed.`}
      error={`Couldn't rename the ${label}. Please try again.`}
      onDone={() => setOpen(false)}
      className="flex items-center gap-1"
    >
      <input type="hidden" name="id" value={id} />
      <input
        name="name"
        defaultValue={defaultValue}
        className="input w-40 py-1 text-xs"
        aria-label={`Edit ${label}`}
        required
        autoFocus
      />
      <SubmitButton className="btn-primary btn-sm" pendingLabel="Saving…">
        Save
      </SubmitButton>
      <button
        type="button"
        className="btn-secondary btn-sm"
        onClick={() => setOpen(false)}
      >
        ✕
      </button>
    </ActionForm>
  );
}

function ConfirmDelete({
  action,
  id,
  label,
}: {
  action: (fd: FormData) => Promise<void>;
  id: string;
  label: string;
}) {
  return (
    <ActionForm
      action={action}
      confirm={`Delete this ${label}? This also removes everything inside it.`}
      success={`${cap(label)} deleted.`}
      error={`Couldn't delete the ${label}. Please try again.`}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
        aria-label={`Delete ${label}`}
        pendingLabel="Deleting…"
      >
        Delete
      </SubmitButton>
    </ActionForm>
  );
}

/* --------------------------- Dialogs --------------------------- */
function FlowDialog({ flow, onClose }: { flow: Flow; onClose: () => void }) {
  return (
    <Modal onClose={onClose} title="Edit flow">
      <ActionForm
        action={A.updateFlow}
        success="Flow updated."
        error="Couldn't update the flow. Please try again."
        onDone={onClose}
        className="space-y-4"
      >
        <input type="hidden" name="id" value={flow.id} />
        <div>
          <label className="label">Name</label>
          <input name="name" defaultValue={flow.name} className="input" required />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            name="description"
            rows={2}
            defaultValue={flow.description}
            className="input"
          />
        </div>
        <p className="text-xs text-slate-400">
          Manage this flow’s Linear tickets and dates from the expanded flow
          panel.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}

function SolutionDialog({
  solution,
  onClose,
  action,
}: {
  solution?: Solution;
  onClose: () => void;
  action: (fd: FormData) => Promise<void>;
}) {
  return (
    <Modal onClose={onClose} title={solution ? "Edit solution" : "New solution"}>
      <ActionForm
        action={action}
        success={solution ? "Solution updated." : "Solution created."}
        error={
          solution
            ? "Couldn't update the solution. Please try again."
            : "Couldn't create the solution. Please try again."
        }
        onDone={onClose}
        className="space-y-4"
      >
        {solution && <input type="hidden" name="id" value={solution.id} />}
        <div className="grid grid-cols-[1fr_88px_88px] gap-3">
          <div>
            <label className="label">Name</label>
            <input
              name="name"
              defaultValue={solution?.name}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Icon</label>
            <input
              name="icon"
              defaultValue={solution?.icon ?? "✦"}
              className="input text-center"
              maxLength={2}
            />
          </div>
          <div>
            <label className="label">Color</label>
            <input
              name="color"
              type="color"
              defaultValue={solution?.color ?? "#3464f6"}
              className="input h-[38px] p-1"
            />
          </div>
        </div>
        <div>
          <label className="label">Default UI language</label>
          <select
            name="language"
            defaultValue={solution?.language ?? "en"}
            className="input"
          >
            {SOLUTION_LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Tagline</label>
          <input
            name="tagline"
            defaultValue={solution?.tagline}
            className="input"
            placeholder="Short one-liner"
          />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            name="description"
            rows={3}
            defaultValue={solution?.description}
            className="input"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <SubmitButton pendingLabel={solution ? "Saving…" : "Creating…"}>
            {solution ? "Save changes" : "Create solution"}
          </SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="card my-8 w-full max-w-lg p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
