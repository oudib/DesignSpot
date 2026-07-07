"use client";

import { useState } from "react";
import { createDesign } from "@/app/manage/actions";

type DeliveryTicket = {
  id: string;
  title: string;
  flowId: string | null;
  flowName: string | null;
};

/**
 * Shared "attach a design" form. Two call sites:
 *  - the tickets board, dragging a card into Done ("complete" mode — a
 *    delivery here also flips the ticket's status, or can be skipped)
 *  - the ticket detail page's "+ Add delivery" ("attach" mode — no status
 *    change, just adds to the Deliverables list)
 */
export default function DeliveryDialog({
  ticket,
  mode,
  onSaved,
  onSkip,
  onCancel,
}: {
  ticket: DeliveryTicket;
  mode: "complete" | "attach";
  onSaved: () => void;
  onSkip?: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [method, setMethod] = useState<"file" | "drive">("file");
  const [error, setError] = useState("");

  const handleSave = async (fd: FormData) => {
    setPending(true);
    setError("");
    try {
      await createDesign(fd);
      onSaved();
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
          {mode === "complete" && (
            <span className="badge bg-emerald-100 text-emerald-700">Done</span>
          )}
          <h2 className="text-lg font-bold">
            {mode === "complete" ? "Deliver the design" : "Add a delivery"}
          </h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {mode === "complete" ? (
            <>
              Attach the final design to{" "}
              <span className="font-medium text-slate-700">{ticket.flowName}</span>{" "}
              to mark “{ticket.title}” as done. It’ll also be pushed to any
              linked Linear issues.
            </>
          ) : (
            <>
              Attach a file or link to{" "}
              <span className="font-medium text-slate-700">{ticket.flowName}</span>.
              It’ll also be pushed to any linked Linear issues.
            </>
          )}
        </p>

        <form action={handleSave} className="mt-4 space-y-4">
          <input type="hidden" name="flowId" value={ticket.flowId ?? ""} />
          <input type="hidden" name="ticketId" value={ticket.id} />

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
              title={
                mode === "complete"
                  ? "Leave the ticket where it is"
                  : "Close without adding a delivery"
              }
            >
              Cancel
            </button>
            <div className="flex gap-2">
              {onSkip && (
                <button
                  type="button"
                  onClick={onSkip}
                  disabled={pending}
                  className="text-sm font-medium text-slate-500 hover:text-slate-800"
                  title="Mark it Done without a delivery"
                >
                  Skip
                </button>
              )}
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
