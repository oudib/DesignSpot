"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchEverything, type SearchResult } from "@/app/actions/lookup";
import { cn } from "@/lib/utils";

const TYPE_META: Record<
  SearchResult["type"],
  { glyph: string; label: string; chip: string }
> = {
  solution: { glyph: "✦", label: "Solution", chip: "bg-brand-100 text-brand-700" },
  module: { glyph: "▣", label: "Module", chip: "bg-sky-100 text-sky-700" },
  submodule: { glyph: "▢", label: "Submodule", chip: "bg-teal-100 text-teal-700" },
  flow: { glyph: "◑", label: "Flow", chip: "bg-violet-100 text-violet-700" },
  ticket: { glyph: "◆", label: "Ticket", chip: "bg-amber-100 text-amber-700" },
};

type Props = {
  /** "dark" renders the translucent input used on the navy home hero. */
  variant?: "light" | "dark";
  className?: string;
};

export default function HomeSearch({ variant = "light", className }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await searchEverything(q);
        setResults(res);
        setActive(0);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(handle);
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(r: SearchResult) {
    setOpen(false);
    router.push(r.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[active];
      if (r) go(r);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={boxRef} className={cn("relative", className ?? "max-w-xl")}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
          <SearchIcon />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search by name or ticket ID…"
          className={cn(
            variant === "dark"
              ? "w-full rounded-xl border border-white/10 bg-white/10 py-2.5 pl-10 pr-10 text-sm text-white outline-none backdrop-blur transition placeholder:text-slate-400 focus:border-white/25 focus:bg-white/15 focus:ring-4 focus:ring-white/10"
              : "input",
            "pl-10 pr-10"
          )}
          aria-label="Search solutions, flows and tickets"
        />
        {loading && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
            <Spinner />
          </span>
        )}
      </div>

      {showPanel && (
        <div className="card absolute z-40 mt-2 w-full overflow-hidden p-1.5 shadow-card-hover">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-slate-400">
              {loading ? "Searching…" : "No matches found."}
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {results.map((r, i) => {
                const meta = TYPE_META[r.type];
                return (
                  <li key={`${r.type}-${r.id}`}>
                    <button
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(r)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                        i === active ? "bg-slate-100" : "hover:bg-slate-50"
                      )}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500">
                        {meta.glyph}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="truncate font-semibold text-slate-800">
                          {r.title}
                        </span>
                        <span className="block truncate text-xs text-slate-400">
                          {r.subtitle}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "badge shrink-0",
                          meta.chip
                        )}
                      >
                        {meta.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M11 11l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
