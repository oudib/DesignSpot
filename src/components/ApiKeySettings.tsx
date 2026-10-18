"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createApiKey,
  revokeApiKey,
  deleteApiKey,
  type CreateKeyResult,
} from "@/app/manage/settings/actions";
import Spinner from "@/components/Spinner";
import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import { useToast } from "@/components/Toast";

export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** What to hand to Claude: where the API lives, how to authenticate, where the docs are. */
function claudeInstructions(baseUrl: string, key: string) {
  const base = baseUrl || "<your Sobrus DS URL>";
  return [
    `You can manage my design tickets and deliveries in Sobrus DS through its REST API.`,
    `Base URL: ${base}/api/v1`,
    `Auth header on every request: Authorization: Bearer ${key}`,
    `Start with GET ${base}/api/v1 for the endpoint list, GET /me to see who you act as,`,
    `GET /structure for solution/flow ids, GET /users for assignee ids, then GET/POST/PATCH /tickets`,
    `and POST /tickets/{id}/deliveries (JSON for a link, multipart with a \`file\` field to upload).`,
    `Full reference: https://github.com/oudib/DesignSpot/blob/main/docs/API.md`,
  ].join("\n");
}

export default function ApiKeySettings({
  keys,
  baseUrl,
}: {
  keys: ApiKeyRow[];
  baseUrl: string;
}) {
  const [state, formAction, pending] = useActionState<CreateKeyResult | null, FormData>(
    createApiKey,
    null
  );
  const toast = useToast();
  const announced = useRef<CreateKeyResult | null>(null);
  useEffect(() => {
    if (!state || announced.current === state) return;
    announced.current = state;
    if (state.ok) toast.success(`Key “${state.name}” created — copy it now.`);
    else toast.error(state.message);
  }, [state, toast]);

  const live = keys.filter((k) => !k.revokedAt);
  const revoked = keys.filter((k) => k.revokedAt);

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">API keys</h2>
          <p className="mt-1 text-sm text-slate-500">
            Let an agent such as Claude manage tickets and deliveries for you
            through the REST API. Requests made with a key act as you — same
            permissions, same Linear connection.
          </p>
        </div>
        <span className="badge bg-slate-100 text-slate-500">
          {live.length} active
        </span>
      </div>

      {state?.ok && <NewKeyReveal keyValue={state.key} name={state.name} baseUrl={baseUrl} />}

      <form action={formAction} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label" htmlFor="keyName">
            New key name
          </label>
          <input
            id="keyName"
            name="name"
            className="input"
            placeholder="e.g. Claude on my laptop"
            maxLength={80}
            required
            autoComplete="off"
          />
        </div>
        <button type="submit" disabled={pending} className="btn-primary btn-sm">
          {pending && <Spinner />}
          {pending ? "Creating…" : "Create key"}
        </button>
      </form>

      {live.length > 0 && (
        <ul className="mt-5 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {live.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{k.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  <code className="rounded bg-slate-100 px-1 py-0.5">{k.prefix}…</code>
                  <span className="mx-1.5">·</span>created {fmtDate(k.createdAt)}
                  <span className="mx-1.5">·</span>last used {fmtDate(k.lastUsedAt)}
                </p>
              </div>
              <ActionForm
                action={revokeApiKey}
                confirm={`Revoke “${k.name}”? Anything using it will stop working immediately.`}
                success="Key revoked."
                error="Couldn't revoke the key. Please try again."
              >
                <input type="hidden" name="id" value={k.id} />
                <SubmitButton className="btn-secondary btn-sm" pendingLabel="Revoking…">
                  Revoke
                </SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      )}

      {revoked.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-slate-500">
            {revoked.length} revoked {revoked.length === 1 ? "key" : "keys"}
          </summary>
          <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {revoked.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-500 line-through">{k.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    <code className="rounded bg-slate-100 px-1 py-0.5">{k.prefix}…</code>
                    <span className="mx-1.5">·</span>revoked {fmtDate(k.revokedAt)}
                  </p>
                </div>
                <ActionForm action={deleteApiKey} success="Key removed." error="Couldn't remove the key.">
                  <input type="hidden" name="id" value={k.id} />
                  <SubmitButton className="btn-secondary btn-sm" pendingLabel="Removing…">
                    Remove
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="mt-4 text-xs text-slate-400">
        Endpoint list: <code>{baseUrl || ""}/api/v1</code>. Full reference in{" "}
        <code>docs/API.md</code>. Keys are stored hashed and shown only once.
      </p>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked — the value is selectable on screen anyway.
        }
      }}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

function NewKeyReveal({
  keyValue,
  name,
  baseUrl,
}: {
  keyValue: string;
  name: string;
  baseUrl: string;
}) {
  const prompt = claudeInstructions(baseUrl, keyValue);
  return (
    <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-sm font-medium text-emerald-800">
        “{name}” is ready. Copy the key now — it won&apos;t be shown again.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 select-all overflow-x-auto rounded-md bg-white px-3 py-2 font-mono text-sm text-slate-800 ring-1 ring-emerald-200">
          {keyValue}
        </code>
        <CopyButton text={keyValue} label="Copy key" />
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-emerald-800">
          Instructions to paste into Claude
        </summary>
        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-white p-3 font-mono text-xs text-slate-700 ring-1 ring-emerald-200">
          {prompt}
        </pre>
        <div className="mt-2">
          <CopyButton text={prompt} label="Copy instructions" />
        </div>
      </details>
    </div>
  );
}
