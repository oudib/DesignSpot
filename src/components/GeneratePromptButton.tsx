"use client";

import { useState } from "react";
import { generateDesignPrompt } from "@/app/manage/actions";
import Spinner from "./Spinner";
import { useToast } from "./Toast";

export default function GeneratePromptButton({ ticketId }: { ticketId: string }) {
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await generateDesignPrompt(ticketId);
      if ("error" in res) {
        setError(res.error);
        toast.error(res.error);
      } else {
        setPrompt(res.prompt);
        toast.success("Design prompt ready.");
      }
    } catch {
      const message = "Could not generate the prompt. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setPrompt(null);
    setError(null);
    setCopied(false);
  }

  async function copy() {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("Prompt copied to your clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the textarea below is still selectable/copyable.
      toast.error("Couldn't copy — select the text below and copy it manually.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="btn-secondary shrink-0"
        title="Generate a Claude design prompt from this ticket"
      >
        {loading ? (
          <Spinner className="text-brand-600" />
        ) : (
          <span className="text-brand-600">✦</span>
        )}{" "}
        {loading ? "Generating…" : "Generate a prompt"}
      </button>

      {(prompt !== null || error) && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm"
          onMouseDown={close}
        >
          <div
            className="card my-8 w-full max-w-2xl p-6"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Design prompt</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Copy this into Claude to generate the design.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {error ? (
              <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
                {error}
              </p>
            ) : (
              <>
                <textarea
                  readOnly
                  value={prompt ?? ""}
                  rows={18}
                  className="input mt-4 font-mono text-xs leading-relaxed"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={close} className="btn-secondary">
                    Close
                  </button>
                  <button type="button" onClick={copy} className="btn-primary">
                    {copied ? "Copied ✓" : "Copy prompt"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
