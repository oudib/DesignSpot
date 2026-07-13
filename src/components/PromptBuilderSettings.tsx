"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  savePromptTemplate,
  resetPromptTemplate,
  saveSolutionPromptTemplate,
  resetSolutionPromptTemplate,
} from "@/app/manage/prompt-builder/actions";
import { cn } from "@/lib/utils";
import { PROMPT_PLACEHOLDERS } from "@/lib/designPrompt";

type Entity = { id: string; label: string };
type Scope = "designer" | "solution";

const TABS: { scope: Scope; label: string }[] = [
  { scope: "designer", label: "By designer" },
  { scope: "solution", label: "By solution" },
];

export default function PromptBuilderSettings({
  scope,
  entities,
  selectedId,
  defaultTemplate,
  customBody,
}: {
  scope: Scope;
  entities: Entity[];
  selectedId: string;
  defaultTemplate: string;
  customBody: string | null;
}) {
  const router = useRouter();
  const isCustom = customBody !== null;
  const [body, setBody] = useState(customBody ?? defaultTemplate);

  const idField = scope === "solution" ? "solutionId" : "userId";
  const saveAction = scope === "solution" ? saveSolutionPromptTemplate : savePromptTemplate;
  const resetAction = scope === "solution" ? resetSolutionPromptTemplate : resetPromptTemplate;
  const entityLabel = scope === "solution" ? "Solution" : "Designer";

  return (
    <div className="space-y-5">
      <div className="flex gap-1.5 border-b border-slate-200">
        {TABS.map((tab) => (
          <Link
            key={tab.scope}
            href={`/manage/prompt-builder?scope=${tab.scope}`}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition",
              scope === tab.scope
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {entities.length === 0 ? (
        <p className="card p-6 text-sm text-slate-500">
          {scope === "solution"
            ? "No solutions yet — add one in Structure & designs first."
            : "No users yet — invite someone in Users & access first."}
        </p>
      ) : (
        <>
          <div className="card p-5">
            <label className="label" htmlFor="entity">
              {entityLabel}
            </label>
            <select
              id="entity"
              className="input"
              value={selectedId}
              onChange={(e) =>
                router.push(
                  `/manage/prompt-builder?scope=${scope}&${idField}=${e.target.value}`
                )
              }
            >
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>

          <div className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">Template</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {scope === "solution"
                    ? "Used for tickets under this solution, unless the assigned designer has their own override."
                    : "Used for any ticket assigned to this designer, regardless of solution."}
                </p>
              </div>
              <span
                className={
                  isCustom
                    ? "badge bg-brand-50 text-brand-700"
                    : "badge bg-slate-100 text-slate-500"
                }
              >
                {isCustom ? "Custom" : "Default"}
              </span>
            </div>

            <form action={saveAction} className="mt-4 space-y-3">
              <input type="hidden" name={idField} value={selectedId} />
              <textarea
                name="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={22}
                className="input font-mono text-xs leading-relaxed"
                spellCheck={false}
              />

              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer select-none">
                  Available placeholders
                </summary>
                <ul className="mt-2 space-y-1">
                  {PROMPT_PLACEHOLDERS.map((p) => (
                    <li key={p.key}>
                      <code className="rounded bg-slate-100 px-1 py-0.5">{`{{${p.key}}}`}</code>{" "}
                      — {p.label}
                    </li>
                  ))}
                </ul>
              </details>

              <div className="flex justify-end gap-2">
                {isCustom && (
                  <button
                    type="submit"
                    formAction={resetAction}
                    className="btn-secondary btn-sm"
                  >
                    Reset to default
                  </button>
                )}
                <button type="submit" className="btn-primary btn-sm">
                  Save template
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
