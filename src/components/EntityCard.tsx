import Link from "next/link";
import { tint } from "@/lib/utils";

type Stat = { value: number; label: string };

type BaseProps = {
  title: string;
  subtitle?: string;
  color: string;
  /** short label shown in the tinted tile — a monogram, emoji or glyph */
  glyph: string;
  stats?: Stat[];
  badge?: string;
  index?: number;
};

type Props = BaseProps &
  (
    | { href: string; onClick?: never }
    | { onClick: () => void; href?: never }
  );

export default function EntityCard({
  title,
  subtitle,
  color,
  glyph,
  stats = [],
  badge,
  index = 0,
  href,
  onClick,
}: Props) {
  const className =
    "animate-rise group relative flex w-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 text-left shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:border-transparent hover:shadow-card-hover";
  const style = { animationDelay: `${index * 50}ms` } as const;

  const inner = (
    <>
      <span
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        style={{ backgroundColor: tint(color, 0.5) }}
      />

      <div className="relative flex items-start justify-between">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-bold uppercase shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3"
          style={{
            backgroundImage: `linear-gradient(135deg, ${tint(
              color,
              0.18
            )}, ${tint(color, 0.08)})`,
            color,
          }}
        >
          {glyph}
        </div>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300 group-hover:translate-x-0.5"
          style={{ color }}
        >
          →
        </span>
      </div>

      <h3 className="relative mt-5 flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
        {title}
        {badge && (
          <span className="badge bg-violet-100 text-violet-700">{badge}</span>
        )}
      </h3>
      {subtitle && (
        <p className="relative mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500">
          {subtitle}
        </p>
      )}

      {stats.length > 0 && (
        <div className="relative mt-5 flex flex-1 items-end gap-2 border-t border-slate-100 pt-4">
          {stats.map((s, i) => (
            <span key={s.label} className="flex items-center gap-2">
              {i > 0 && <span className="h-1 w-1 rounded-full bg-slate-300" />}
              <span className="text-xs text-slate-500">
                <strong className="text-sm font-bold text-slate-800">
                  {s.value}
                </strong>{" "}
                {s.label}
              </span>
            </span>
          ))}
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className} style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {inner}
    </button>
  );
}
