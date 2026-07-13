"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EntityCard from "./EntityCard";
import { cn } from "@/lib/utils";

type Flow = {
  id: string;
  name: string;
  description: string;
  linearCount: number;
  designs: number;
};
type Submodule = { id: string; name: string; flows: Flow[] };
type Module = { id: string; name: string; submodules: Submodule[] };

type Props = {
  solution: { slug: string; name: string; color: string };
  modules: Module[];
};

const flowCount = (m: Module) =>
  m.submodules.reduce((a, s) => a + s.flows.length, 0);
const moduleDesigns = (m: Module) =>
  m.submodules.reduce(
    (a, s) => a + s.flows.reduce((b, f) => b + f.designs, 0),
    0
  );
const subDesigns = (s: Submodule) =>
  s.flows.reduce((a, f) => a + f.designs, 0);

export default function SolutionExplorer({ solution, modules }: Props) {
  const [view, setView] = useState<"cards" | "list">("cards");
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [submoduleId, setSubmoduleId] = useState<string | null>(null);

  // Remember the preferred view across visits.
  useEffect(() => {
    const saved = localStorage.getItem("sobrus-ds-view");
    if (saved === "cards" || saved === "list") setView(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem("sobrus-ds-view", view);
  }, [view]);

  const color = solution.color;
  const selectedModule = modules.find((m) => m.id === moduleId) ?? null;
  const selectedSub =
    selectedModule?.submodules.find((s) => s.id === submoduleId) ?? null;

  return (
    <div>
      {/* Header row: breadcrumb (cards mode) + view toggle */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {view === "cards" ? (
          <Crumbs
            items={[
              { label: "Modules", onClick: () => {
                setModuleId(null);
                setSubmoduleId(null);
              }, active: !selectedModule },
              ...(selectedModule
                ? [
                    {
                      label: selectedModule.name,
                      onClick: () => setSubmoduleId(null),
                      active: !selectedSub,
                    },
                  ]
                : []),
              ...(selectedSub
                ? [{ label: selectedSub.name, onClick: () => {}, active: true }]
                : []),
            ]}
          />
        ) : (
          <h2 className="text-lg font-bold tracking-tight">All modules</h2>
        )}

        <ViewToggle view={view} setView={setView} />
      </div>

      {modules.length === 0 ? (
        <Empty />
      ) : view === "list" ? (
        <ListView modules={modules} color={color} />
      ) : (
        <CardsView
          color={color}
          selectedModule={selectedModule}
          selectedSub={selectedSub}
          modules={modules}
          onPickModule={(id) => setModuleId(id)}
          onPickSub={(id) => setSubmoduleId(id)}
        />
      )}
    </div>
  );
}

/* ----------------------------- Cards ---------------------------- */
function CardsView({
  color,
  modules,
  selectedModule,
  selectedSub,
  onPickModule,
  onPickSub,
}: {
  color: string;
  modules: Module[];
  selectedModule: Module | null;
  selectedSub: Submodule | null;
  onPickModule: (id: string) => void;
  onPickSub: (id: string) => void;
}) {
  // Level 3: flows of the selected submodule
  if (selectedSub) {
    if (selectedSub.flows.length === 0)
      return <Empty label="No flows in this submodule yet." />;
    return (
      <Grid>
        {selectedSub.flows.map((f, i) => (
          <EntityCard
            key={f.id}
            index={i}
            color={color}
            glyph={f.name.charAt(0)}
            title={f.name}
            subtitle={f.description || undefined}
            badge={f.linearCount > 0 ? `${f.linearCount} Linear` : undefined}
            stats={[{ value: f.designs, label: "designs" }]}
            href={`/flows/${f.id}`}
          />
        ))}
      </Grid>
    );
  }

  // Level 2: submodules of the selected module
  if (selectedModule) {
    if (selectedModule.submodules.length === 0)
      return <Empty label="No submodules in this module yet." />;
    return (
      <Grid>
        {selectedModule.submodules.map((s, i) => (
          <EntityCard
            key={s.id}
            index={i}
            color={color}
            glyph={s.name.charAt(0)}
            title={s.name}
            stats={[
              { value: s.flows.length, label: "flows" },
              { value: subDesigns(s), label: "designs" },
            ]}
            onClick={() => onPickSub(s.id)}
          />
        ))}
      </Grid>
    );
  }

  // Level 1: modules
  return (
    <Grid>
      {modules.map((m, i) => (
        <EntityCard
          key={m.id}
          index={i}
          color={color}
          glyph={m.name.charAt(0)}
          title={m.name}
          stats={[
            { value: m.submodules.length, label: "submodules" },
            { value: flowCount(m), label: "flows" },
          ]}
          onClick={() => onPickModule(m.id)}
        />
      ))}
    </Grid>
  );
}

/* ------------------------------ List ---------------------------- */
function ListView({ modules, color }: { modules: Module[]; color: string }) {
  return (
    <div className="space-y-10">
      {modules.map((mod) => (
        <section key={mod.id}>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight">{mod.name}</h2>
            <span className="badge bg-slate-100 text-slate-500">
              {mod.submodules.length} submodules
            </span>
          </div>

          <div className="space-y-5">
            {mod.submodules.map((sub) => (
              <div key={sub.id} className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-3">
                  <h3 className="font-semibold text-slate-800">{sub.name}</h3>
                  <span className="text-xs text-slate-400">
                    {sub.flows.length} flows
                  </span>
                </div>

                {sub.flows.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-slate-400">No flows yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {sub.flows.map((flow) => (
                      <li key={flow.id}>
                        <Link
                          href={`/flows/${flow.id}`}
                          className="flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">
                              {flow.name}
                            </p>
                            {flow.description && (
                              <p className="truncate text-sm text-slate-400">
                                {flow.description}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {flow.linearCount > 0 && (
                              <span className="badge bg-violet-100 text-violet-700">
                                {flow.linearCount} Linear
                              </span>
                            )}
                            <span
                              className="badge"
                              style={{
                                backgroundColor: `${color}1a`,
                                color,
                              }}
                            >
                              {flow.designs} designs
                            </span>
                            <span className="text-slate-300">→</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ---------------------------- Shared ---------------------------- */
function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  );
}

function ViewToggle({
  view,
  setView,
}: {
  view: "cards" | "list";
  setView: (v: "cards" | "list") => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {(["cards", "list"] as const).map((v) => (
        <button
          key={v}
          onClick={() => setView(v)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition",
            view === v
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-100"
          )}
        >
          {v === "cards" ? <GridIcon /> : <ListIcon />}
          {v}
        </button>
      ))}
    </div>
  );
}

function Crumbs({
  items,
}: {
  items: { label: string; onClick: () => void; active: boolean }[];
}) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-sm">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-slate-300">/</span>}
          <button
            onClick={it.onClick}
            disabled={it.active}
            className={cn(
              "rounded-md px-1.5 py-0.5 font-semibold transition",
              it.active
                ? "text-slate-800"
                : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            )}
          >
            {it.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

function Empty({ label = "Nothing here yet." }: { label?: string }) {
  return (
    <div className="card p-10 text-center text-slate-500">
      {label}{" "}
      <Link href="/manage/structure" className="text-brand-600 underline">
        Add from the workspace
      </Link>
      .
    </div>
  );
}

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="1" width="6" height="6" rx="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" />
    </svg>
  );
}
function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="2" width="14" height="2.5" rx="1.25" />
      <rect x="1" y="6.75" width="14" height="2.5" rx="1.25" />
      <rect x="1" y="11.5" width="14" height="2.5" rx="1.25" />
    </svg>
  );
}
