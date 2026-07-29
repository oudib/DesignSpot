"use client";

import { useCallback, useMemo } from "react";
import { useToast } from "./Toast";

type Action = (fd: FormData) => Promise<unknown>;

export type ActionToastOptions = {
  /** Toast shown when the action resolves. Omit for silent success. */
  success?: string;
  /** Toast shown when it throws. Falls back to a generic message. */
  error?: string;
  /** Browser confirm shown before running — the action is skipped on cancel. */
  confirm?: string;
  /** Runs after a successful action (close a dialog, exit edit mode…). */
  onDone?: () => void;
  /** Runs when the action failed — undo an optimistic update, for instance. */
  onError?: () => void;
};

const GENERIC_ERROR = "Something went wrong. Please try again.";

/**
 * Next.js signals redirect() / notFound() by throwing — those must bubble up to
 * the framework instead of being reported as a failed action.
 */
function isRouterControlError(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") ||
      digest === "NEXT_NOT_FOUND" ||
      digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))
  );
}

/**
 * Wrap server actions so every mutation reports itself: a toast on success, a
 * toast on failure, and no silent no-ops.
 *
 * - `wrap(action, opts)` → a form action for `action=` / `formAction=`
 * - `run(fn, opts)` → for imperative calls from an onClick handler
 */
export function useActionToast() {
  const { success, error } = useToast();

  const run = useCallback(
    async <T,>(
      fn: () => Promise<T>,
      opts: ActionToastOptions = {}
    ): Promise<{ ok: boolean; data?: T }> => {
      if (opts.confirm && !window.confirm(opts.confirm)) return { ok: false };
      try {
        const data = await fn();
        if (opts.success) success(opts.success);
        opts.onDone?.();
        return { ok: true, data };
      } catch (err) {
        if (isRouterControlError(err)) throw err;
        error(opts.error ?? GENERIC_ERROR);
        opts.onError?.();
        return { ok: false };
      }
    },
    [success, error]
  );

  const wrap = useCallback(
    (action: Action, opts: ActionToastOptions = {}) =>
      async (fd: FormData) => {
        await run(() => action(fd), opts);
      },
    [run]
  );

  return useMemo(() => ({ wrap, run }), [wrap, run]);
}

/**
 * A `<form>` whose server action reports its outcome as a toast. Drop-in
 * replacement for `<form action={serverAction}>`, usable from Server Components
 * too (the action is passed through as a prop).
 */
export default function ActionForm({
  action,
  success,
  error,
  confirm,
  onDone,
  onError,
  children,
  ...rest
}: Omit<React.ComponentProps<"form">, "action"> &
  ActionToastOptions & { action: Action }) {
  const { wrap } = useActionToast();
  return (
    <form
      {...rest}
      action={wrap(action, { success, error, confirm, onDone, onError })}
    >
      {children}
    </form>
  );
}
