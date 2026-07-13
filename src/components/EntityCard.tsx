import Link from "next/link";
import { tint } from "@/lib/utils";

type Stat = { value: number; label: string };

/** "1 designs" → "1 design" — labels are passed in plural form. */
function pluralize(value: number, label: string) {
  return value === 1 && label.endsWith("s") ? label.slice(0, -1) : label;
}

type BaseProps = {
  title: string;
  subtitle?: string;
  color: string;
  /** short label shown in the tinted chip — a monogram, emoji or glyph */
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
    "animate-rise group relative flex w-full flex-col overflow-hidden rounded-[1.6rem] border border-slate-200/60 bg-white p-6 text-left shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover";
  const style = { animationDelay: `${index * 50}ms` } as const;

  // Payfin-style: the last stat is the headline number, the rest go in the footer.
  const heroStat = stats[stats.length - 1];
  const footerStats = stats.slice(0, -1);

  const inner = (
    <>
      <span
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-60"
        style={{ backgroundColor: tint(color, 0.5) }}
      />

      <div className="relative flex items-center gap-3.5">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold uppercase ring-1 ring-inset ring-slate-900/5 transition-transform duration-300 group-hover:scale-110"
          style={{
            backgroundImage: `linear-gradient(135deg, ${tint(
              color,
              0.2
            )}, ${tint(color, 0.08)})`,
            color,
          }}
        >
          {glyph}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-bold tracking-tight text-slate-900">
            {title}
          </h3>
          {subtitle && (
            <p className="truncate text-xs font-medium text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
        {badge && (
          <span className="badge shrink-0 bg-violet-100 text-violet-700">
            {badge}
          </span>
        )}
      </div>

      {heroStat && (
        <div className="relative mt-6 flex items-baseline gap-1.5">
          <span className="text-3xl font-extrabold tracking-tight text-slate-900">
            {heroStat.value}
          </span>
          <span className="text-sm font-medium text-slate-400">
            {pluralize(heroStat.value, heroStat.label)}
          </span>
        </div>
      )}

      <div className="relative mt-5 flex flex-1 items-end justify-between border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2">
          {footerStats.length === 0 ? (
            <span className="text-xs font-medium text-slate-400">
              View details
            </span>
          ) : (
            footerStats.map((s, i) => (
              <span key={s.label} className="flex items-center gap-2">
                {i > 0 && (
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                )}
                <span className="text-xs text-slate-500">
                  <strong className="text-sm font-bold text-slate-800">
                    {s.value}
                  </strong>{" "}
                  {pluralize(s.value, s.label)}
                </span>
              </span>
            ))
          )}
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-all duration-300 group-hover:bg-slate-900 group-hover:text-white">
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
