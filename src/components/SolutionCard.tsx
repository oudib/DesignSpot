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
      className="animate-rise group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 p-6 shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:border-transparent hover:shadow-card-hover"
      style={{
        animationDelay: `${index * 60}ms`,
        backgroundImage: `linear-gradient(150deg, ${tint(
          solution.color,
          0.16
        )}, ${tint(solution.color, 0.05)} 55%, #ffffff 100%)`,
      }}
    >
      {/* glow that appears on hover, tinted by the solution color */}
      <span
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        style={{ backgroundColor: tint(solution.color, 0.5) }}
      />

      <div className="relative flex items-start justify-between">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3"
          style={{
            backgroundImage: `linear-gradient(135deg, ${tint(
              solution.color,
              0.32
            )}, ${tint(solution.color, 0.14)})`,
            color: solution.color,
          }}
        >
          {solution.icon}
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${languageMeta(solution.language).color}`}>
            {languageMeta(solution.language).short}
          </span>
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-all duration-300 group-hover:translate-x-0.5"
            style={{ color: solution.color }}
          >
            →
          </span>
        </div>
      </div>

      <h3 className="relative mt-5 text-lg font-bold tracking-tight text-slate-900">
        {solution.name}
      </h3>
      <p
        className="relative mb-1 flex-1 text-sm font-semibold"
        style={{ color: solution.color }}
      >
        {solution.tagline}
      </p>

      <div className="relative mt-5 flex items-center gap-2 border-t border-slate-200/70 pt-4">
        <Stat value={stats.modules} label="modules" />
        <Dot />
        <Stat value={stats.flows} label="flows" />
        <Dot />
        <Stat value={stats.designs} label="designs" />
      </div>
    </Link>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="text-xs text-slate-500">
      <strong className="text-sm font-bold text-slate-800">{value}</strong>{" "}
      {label}
    </span>
  );
}

function Dot() {
  return <span className="h-1 w-1 rounded-full bg-slate-300" />;
}
