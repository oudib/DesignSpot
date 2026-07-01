"use client";

import { useMemo, useState } from "react";
import {
  quickCreateSolution,
  quickCreateModule,
  quickCreateSubmodule,
  quickCreateFlow,
} from "@/app/manage/actions";

export type FlowLite = { id: string; name: string };
export type SubLite = { id: string; name: string; flows: FlowLite[] };
export type ModLite = { id: string; name: string; submodules: SubLite[] };
export type SolLite = { id: string; name: string; modules: ModLite[] };

type Props = {
  tree: SolLite[];
  /** edit mode: preselect from an existing ticket */
  initialSolutionId?: string | null;
  initialFlowId?: string | null;
};

/**
 * Cascading Solution → Module → Submodule → Flow picker.
 * Each level can create a new entry inline. Emits hidden inputs
 * `solutionId` and `flowId` for the surrounding <form>.
 */
export default function HierarchyPicker({
  tree: initialTree,
  initialSolutionId,
  initialFlowId,
}: Props) {
  const [tree, setTree] = useState<SolLite[]>(initialTree);

  // Derive the initial cascade from an existing flow (edit mode).
  const initial = useMemo(() => {
    for (const sol of initialTree) {
      for (const mod of sol.modules) {
        for (const sub of mod.submodules) {
          const f = sub.flows.find((x) => x.id === initialFlowId);
          if (f)
            return {
              sol: sol.id,
              mod: mod.id,
              sub: sub.id,
              flow: f.id,
            };
        }
      }
    }
    return {
      sol: initialSolutionId ?? "",
      mod: "",
      sub: "",
      flow: "",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [solId, setSolId] = useState(initial.sol);
  const [modId, setModId] = useState(initial.mod);
  const [subId, setSubId] = useState(initial.sub);
  const [flowId, setFlowId] = useState(initial.flow);

  const solution = tree.find((s) => s.id === solId) ?? null;
  const module = solution?.modules.find((m) => m.id === modId) ?? null;
  const submodule = module?.submodules.find((s) => s.id === subId) ?? null;

  /* ---- tree mutation helpers (immutable) ---- */
  const addSolution = (row: { id: string; name: string }) =>
    setTree((t) => [...t, { ...row, modules: [] }]);
  const addModule = (sid: string, row: { id: string; name: string }) =>
    setTree((t) =>
      t.map((s) =>
        s.id === sid
          ? { ...s, modules: [...s.modules, { ...row, submodules: [] }] }
          : s
      )
    );
  const addSubmodule = (mid: string, row: { id: string; name: string }) =>
    setTree((t) =>
      t.map((s) => ({
        ...s,
        modules: s.modules.map((m) =>
          m.id === mid
            ? { ...m, submodules: [...m.submodules, { ...row, flows: [] }] }
            : m
        ),
      }))
    );
  const addFlow = (sid: string, row: { id: string; name: string }) =>
    setTree((t) =>
      t.map((s) => ({
        ...s,
        modules: s.modules.map((m) => ({
          ...m,
          submodules: m.submodules.map((sub) =>
            sub.id === sid ? { ...sub, flows: [...sub.flows, row] } : sub
          ),
        })),
      }))
    );

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
      <input type="hidden" name="solutionId" value={solId} />
      <input type="hidden" name="flowId" value={flowId} />

      <div className="grid grid-cols-2 gap-3">
        <Level
          label="Solution"
          options={tree}
          value={solId}
          onPick={(id) => {
            setSolId(id);
            setModId("");
            setSubId("");
            setFlowId("");
          }}
          onCreate={async (name) => {
            const row = await quickCreateSolution(name);
            addSolution(row);
            setSolId(row.id);
            setModId("");
            setSubId("");
            setFlowId("");
          }}
        />

        <Level
          label="Module"
          options={solution?.modules ?? []}
          value={modId}
          disabled={!solId}
          onPick={(id) => {
            setModId(id);
            setSubId("");
            setFlowId("");
          }}
          onCreate={async (name) => {
            const row = await quickCreateModule(solId, name);
            addModule(solId, row);
            setModId(row.id);
            setSubId("");
            setFlowId("");
          }}
        />

        <Level
          label="Submodule"
          options={module?.submodules ?? []}
          value={subId}
          disabled={!modId}
          onPick={(id) => {
            setSubId(id);
            setFlowId("");
          }}
          onCreate={async (name) => {
            const row = await quickCreateSubmodule(modId, name);
            addSubmodule(modId, row);
            setSubId(row.id);
            setFlowId("");
          }}
        />

        <Level
          label="Flow"
          options={submodule?.flows ?? []}
          value={flowId}
          disabled={!subId}
          onPick={(id) => setFlowId(id)}
          onCreate={async (name) => {
            const row = await quickCreateFlow(subId, name);
            addFlow(subId, row);
            setFlowId(row.id);
          }}
        />
      </div>
    </div>
  );
}

/* ----------------------- One cascade level ---------------------- */
function Level({
  label,
  options,
  value,
  onPick,
  onCreate,
  disabled,
}: {
  label: string;
  options: { id: string; name: string }[];
  value: string;
  onPick: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const name = draft.trim();
    if (!name) return;
    setBusy(true);
    try {
      await onCreate(name);
      setDraft("");
      setCreating(false);
    } finally {
      setBusy(false);
    }
  };

  if (creating) {
    return (
      <div>
        <label className="label">{label} · new</label>
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape") setCreating(false);
            }}
            placeholder={`New ${label.toLowerCase()} name`}
            className="input py-2 text-sm"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || !draft.trim()}
            className="btn-primary btn-sm shrink-0"
          >
            {busy ? "…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => setCreating(false)}
            className="btn-secondary btn-sm shrink-0"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="label">{label}</label>
      <select
        value={value}
        disabled={disabled}
        required
        onChange={(e) => {
          if (e.target.value === "__new__") setCreating(true);
          else onPick(e.target.value);
        }}
        className="input disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        <option value="">{disabled ? "—" : `Select ${label.toLowerCase()}…`}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
        {!disabled && <option value="__new__">+ Create new {label.toLowerCase()}…</option>}
      </select>
    </div>
  );
}
