"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  connectLinear,
  disconnectLinear,
  type ConnectResult,
} from "@/app/manage/actions";
import Spinner from "@/components/Spinner";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import { useToast } from "@/components/Toast";

export default function LinearSettings({
  connected,
  viewerLabel,
}: {
  connected: boolean;
  // e.g. "Sara Idrissi (sara@sobrus.com)" — only set when the key still works.
  viewerLabel: string | null;
}) {
  const [state, formAction, pending] = useActionState<ConnectResult | null, FormData>(
    connectLinear,
    null
  );

  // connectLinear reports through its action state; mirror each new result as a
  // toast so the outcome is visible even if the form has scrolled out of view.
  const toast = useToast();
  const announced = useRef<ConnectResult | null>(null);
  useEffect(() => {
    if (!state || announced.current === state) return;
    announced.current = state;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state, toast]);

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Linear</h2>
          <p className="mt-1 text-sm text-slate-500">
            Connect your own Linear account. Comments this app posts (flow links,
            status updates, new designs) are authored as you.
          </p>
        </div>
        <span
          className={
            connected
              ? "badge bg-emerald-50 text-emerald-700"
              : "badge bg-slate-100 text-slate-500"
          }
        >
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>

      {connected ? (
        <div className="mt-5 space-y-4">
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {viewerLabel
              ? `Connected as ${viewerLabel}.`
              : "A key is saved, but it no longer works — reconnect with a fresh key below."}
          </p>
          <ActionForm
            action={disconnectLinear}
            confirm="Disconnect your Linear account? Comments will stop being posted as you."
            success="Linear disconnected."
            error="Couldn't disconnect Linear. Please try again."
          >
            <SubmitButton
              className="btn-secondary btn-sm"
              pendingLabel="Disconnecting…"
            >
              Disconnect
            </SubmitButton>
          </ActionForm>

          <details className="text-sm">
            <summary className="cursor-pointer text-slate-500">
              Replace key
            </summary>
            <ConnectForm formAction={formAction} pending={pending} state={state} />
          </details>
        </div>
      ) : (
        <ConnectForm formAction={formAction} pending={pending} state={state} />
      )}
    </div>
  );
}

function ConnectForm({
  formAction,
  pending,
  state,
}: {
  formAction: (fd: FormData) => void;
  pending: boolean;
  state: ConnectResult | null;
}) {
  return (
    <form action={formAction} className="mt-4 space-y-3">
      <div>
        <label className="label" htmlFor="apiKey">
          Personal API key
        </label>
        <input
          id="apiKey"
          name="apiKey"
          type="password"
          required
          className="input"
          placeholder="lin_api_…"
          autoComplete="off"
        />
        <p className="mt-1.5 text-xs text-slate-400">
          Create one in Linear → Settings → Security &amp; access → Personal API
          keys. It&apos;s stored encrypted and never shown again.
        </p>
      </div>

      {state && (
        <p
          className={
            state.ok
              ? "rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              : "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"
          }
        >
          {state.message}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary btn-sm">
        {pending && <Spinner />}
        {pending ? "Connecting…" : "Connect Linear"}
      </button>
    </form>
  );
}
