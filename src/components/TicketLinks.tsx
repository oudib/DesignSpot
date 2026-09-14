"use client";

import { useState } from "react";
import Link from "next/link";
import { setTicketLocation, linkTicketLinear } from "@/app/manage/actions";
import HierarchyPicker, { type SolLite } from "@/components/HierarchyPicker";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";

/* ------------------------------------------------------------------ */
/* Location card: shows where the ticket lives, or lets you set it —  */
/* including creating a brand-new flow inline — right from the page.  */
/* ------------------------------------------------------------------ */

type LocationProps = {
  ticketId: string;
  solution: { id: string; name: string } | null;
  flow: { id: string; name: string } | null;
  tree: SolLite[];
  canManage: boolean;
};

export function TicketLocationCard({
  ticketId,
  solution,
  flow,
  tree,
  canManage,
}: LocationProps) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Location
        </h3>
        {canManage && flow && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-slate-400 transition hover:text-slate-700"
          >
            Change
          </button>
        )}
      </div>

      {editing ? (
        <ActionForm
          action={setTicketLocation}
          success={flow ? "Location updated." : "Flow linked to the ticket."}
          error="Couldn't save the location. Please try again."
          onDone={() => setEditing(false)}
          className="mt-4 space-y-3"
        >
          <input type="hidden" name="id" value={ticketId} />
          <p className="text-xs text-slate-400">
            Pick the solution, module, submodule and flow — or create a new one
            at any level.
          </p>
          <HierarchyPicker
            tree={tree}
            initialSolutionId={solution?.id}
            initialFlowId={flow?.id}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn-secondary btn-sm"
            >
              Cancel
            </button>
            <SubmitButton className="btn-primary btn-sm" pendingLabel="Saving…">
              {flow ? "Save location" : "Link flow"}
            </SubmitButton>
          </div>
        </ActionForm>
      ) : (
        <>
          <dl className="mt-4 space-y-3.5 text-sm">
            <Row label="Solution">
              {solution ? (
                <span className="font-medium text-slate-700">{solution.name}</span>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </Row>
            <Row label="Flow">
              {flow ? (
                <Link
                  href={`/flows/${flow.id}`}
                  className="font-medium text-brand-600 hover:underline"
                >
                  {flow.name}
                </Link>
              ) : (
                <span className="text-slate-400">Not linked</span>
              )}
            </Row>
          </dl>

          {!flow && canManage && (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3">
              <p className="text-xs text-slate-500">
                This ticket isn&apos;t attached to a flow yet. Pick an existing
                one or create a new flow to deliver designs into.
              </p>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="btn-primary btn-sm mt-3 w-full"
              >
                + Create or pick a flow
              </button>
            </div>
          )}
          {!flow && !canManage && (
            <p className="mt-3 text-xs text-slate-400">
              Only the assigned designer or an admin can set the location.
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Linear card: link a Linear issue when none is attached, or swap /  */
/* clear the existing one.                                             */
/* ------------------------------------------------------------------ */

type LinearProps = {
  ticketId: string;
  linearUrl: string;
  canManage: boolean;
};

/** "SOB-123" from a Linear issue URL, or null if the URL has no issue id. */
function linearIssueId(url: string): string | null {
  const m = url.match(/\/issue\/([A-Za-z][A-Za-z0-9]*-\d+)/i);
  return m ? m[1].toUpperCase() : null;
}

export function TicketLinearCard({ ticketId, linearUrl, canManage }: LinearProps) {
  const [editing, setEditing] = useState(false);
  const linked = !!linearUrl;
  const issueId = linked ? linearIssueId(linearUrl) : null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Linear
        </h3>
        {canManage && linked && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-slate-400 transition hover:text-slate-700"
          >
            Change
          </button>
        )}
      </div>

      {editing || (!linked && canManage) ? (
        <ActionForm
          action={linkTicketLinear}
          success={linked ? "Linear link updated." : "Linear issue linked."}
          error="Couldn't link the Linear issue. Please try again."
          onDone={() => setEditing(false)}
          className="mt-4 space-y-3"
        >
          <input type="hidden" name="id" value={ticketId} />
          <div>
            <label className="label" htmlFor="ticket-linear-url">
              Linear issue link
            </label>
            <input
              id="ticket-linear-url"
              name="linearUrl"
              type="url"
              defaultValue={linearUrl}
              autoFocus={editing}
              className="input"
              placeholder="https://linear.app/sobrus/issue/SOB-123/…"
              autoComplete="off"
              required={!linked}
            />
            {!linked && (
              <p className="mt-1.5 text-xs text-slate-400">
                Once linked, status changes and delivered designs are posted to
                the issue as comments.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            {linked && (
              <SubmitButton
                className="btn-secondary btn-sm text-red-600 hover:text-red-700"
                pendingLabel="Unlinking…"
                spinOnlyWhenClicked
                onClick={(e) => {
                  const form = e.currentTarget.form;
                  const input = form?.elements.namedItem(
                    "linearUrl"
                  ) as HTMLInputElement | null;
                  if (input) input.value = "";
                }}
              >
                Unlink
              </SubmitButton>
            )}
            {editing && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="btn-secondary btn-sm"
              >
                Cancel
              </button>
            )}
            <SubmitButton
              className="btn-primary btn-sm"
              pendingLabel="Linking…"
              spinOnlyWhenClicked={linked}
            >
              {linked ? "Save link" : "Link Linear issue"}
            </SubmitButton>
          </div>
        </ActionForm>
      ) : linked ? (
        <div className="mt-4 space-y-3 text-sm">
          <Row label="Issue">
            <a
              href={linearUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-violet-700 hover:underline"
              title={linearUrl}
            >
              <span>◆</span>
              {issueId ?? "Open issue"}
            </a>
          </Row>
          <a
            href={linearUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary btn-sm w-full"
          >
            <span className="text-violet-600">◆</span> Open in Linear
          </a>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-400">
          Not linked.
          <span className="mt-1 block text-xs">
            Only the assigned designer or an admin can link a Linear issue.
          </span>
        </p>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
