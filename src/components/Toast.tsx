"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastApi = {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

// No-op fallback so a component rendered outside the provider (tests, isolated
// stories) never crashes on a toast call.
const NOOP: ToastApi = {
  toast: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NOOP;
}

// Errors stay long enough to read and act on; confirmations get out of the way.
const DURATION: Record<ToastKind, number> = {
  success: 3500,
  info: 4000,
  error: 6500,
};

const STYLE: Record<ToastKind, { icon: string; bar: string; iconColor: string }> = {
  success: { icon: "✓", bar: "bg-emerald-500", iconColor: "text-emerald-600" },
  error: { icon: "⚠", bar: "bg-red-500", iconColor: "text-red-600" },
  info: { icon: "ℹ", bar: "bg-brand-500", iconColor: "text-brand-600" },
};

/** Max toasts on screen — older ones fall off the top of the stack. */
const MAX_VISIBLE = 4;

export default function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = "success") => {
      if (!message) return;
      const id = nextId.current++;
      setItems((list) => [
        ...list.slice(-(MAX_VISIBLE - 1)),
        { id, kind, message },
      ]);
      setTimeout(() => dismiss(id), DURATION[kind]);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (m: string) => toast(m, "success"),
      error: (m: string) => toast(m, "error"),
      info: (m: string) => toast(m, "info"),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[300] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
      >
        {items.map((t) => {
          const style = STYLE[t.kind];
          return (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              className="animate-toast-in pointer-events-auto flex items-start gap-2.5 overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3 pl-0 shadow-lg shadow-slate-900/10"
            >
              <span className={`w-1 shrink-0 self-stretch rounded-r ${style.bar}`} />
              <span
                className={`mt-px shrink-0 text-sm font-bold ${style.iconColor}`}
                aria-hidden="true"
              >
                {style.icon}
              </span>
              <p className="min-w-0 flex-1 text-sm text-slate-700">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="shrink-0 rounded-md px-1 text-slate-400 transition hover:text-slate-700"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
