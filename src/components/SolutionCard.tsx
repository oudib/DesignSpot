import Link from "next/link";
import { tint, languageMeta } from "@/lib/utils";

type Props = {
  solution: {
    slug: string;
    name: string;
    tagline: string;
    description: string;
    color: string;
    icon: string;
    language: string;
  };
  stats: { modules: number; flows: number; designs: number };
  index?: number;
};

export default function SolutionCard({ solution, stats, index = 0 }: Props) {
  return (
    <Link
      href={`/solutions/${solution.slug}`}
      className="animate-rise group relative flex flex-col overflow-hidden rounded-[1.6rem] border border-slate-200/60 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* glow that appears on hover, tinted by the solution color */}
      <span
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-60"
        style={{ backgroundColor: tint(solution.color, 0.5) }}
      />

      <div className="relative flex items-center gap-3.5">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ring-1 ring-inset ring-slate-900/5 transition-transform duration-300 group-hover:scale-110"
          style={{
            backgroundImage: `linear-gradient(135deg, ${tint(
              solution.color,
              0.22
            )}, ${tint(solution.color, 0.08)})`,
            color: solution.color,
          }}
        >
          {solution.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-bold tracking-tight text-slate-900">
            {solution.name}
          </h3>
          <p className="truncate text-xs font-medium text-slate-400">
            {solution.tagline}
          </p>
        </div>
        <span
          className={`badge shrink-0 ${languageMeta(solution.language).color}`}
        >
          {languageMeta(solution.language).short}
        </span>
      </div>

      <div className="relative mt-6 flex items-baseline gap-1.5">
        <span className="text-3xl font-extrabold tracking-tight text-slate-900">
          {stats.designs}
        </span>
        <span className="text-sm font-medium text-slate-400">
          design{stats.designs === 1 ? "" : "s"}
        </span>
      </div>

      {/* Payfin-style segmented bar: modules / flows / designs proportions */}
      <div className="relative mt-4 flex h-1.5 gap-1">
        <span
          className="rounded-full"
          style={{
            flexGrow: Math.max(stats.modules, 0.4),
            backgroundColor: solution.color,
          }}
        />
        <span
          className="rounded-full"
          style={{
            flexGrow: Math.max(stats.flows, 0.4),
            backgroundColor: tint(solution.color, 0.45),
          }}
        />
        <span
          className="rounded-full"
          style={{
            flexGrow: Math.max(stats.designs, 0.4),
            backgroundColor: tint(solution.color, 0.16),
          }}
        />
      </div>

      <div className="relative mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2">
          <Stat value={stats.modules} label="modules" />
          <Dot />
          <Stat value={stats.flows} label="flows" />
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-all duration-300 group-hover:bg-slate-900 group-hover:text-white">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2.5 7h9M8 3.5L11.5 7 8 10.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </Link>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const text = value === 1 && label.endsWith("s") ? label.slice(0, -1) : label;
  return (
    <span className="text-xs text-slate-500">
      <strong className="text-sm font-bold text-slate-800">{value}</strong>{" "}
      {text}
    </span>
  );
}

function Dot() {
  return <span className="h-1 w-1 rounded-full bg-slate-300" />;
}
