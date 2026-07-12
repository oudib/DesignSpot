"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { findByLinear } from "@/app/actions/lookup";
import Spinner from "./Spinner";

export default function LinearFinder() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  // Reset + focus when the dialog opens.
  useEffect(() => {
    if (open) {
      setUrl("");
      setError("");
      setPending(false);
      // focus after paint
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    const res = await findByLinear(url);
    if (res.ok) {
      setOpen(false);
      router.push(`/flows/${res.flowId}`);
    } else {
      setError(res.error);
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary btn-sm sm:px-3.5 sm:py-2.5"
      >
        <span className="text-violet-600">◆</span>
        <span className="hidden sm:inline">Find by Linear</span>
        <span className="sm:hidden">Linear</span>
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/40 p-4 pt-28 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="card animate-rise w-full max-w-md p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                  Find by Linear
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Paste a Linear ticket link to jump straight to its flow.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <form onSubmit={submit} className="mt-5">
              <label className="label" htmlFor="linear-url">
                Linear ticket link
              </label>
              <input
                ref={inputRef}
                id="linear-url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError("");
                }}
                placeholder="https://linear.app/sobrus/issue/SOB-123/…"
                className="input"
                autoComplete="off"
              />

              {error && (
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
                  <span className="mt-0.5 shrink-0">⚠</span>
                  <span>{error}</span>
                </p>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || !url.trim()}
                  className="btn-primary"
                >
                  {pending && <Spinner />}
                  {pending ? "Looking up…" : "Go to flow"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
